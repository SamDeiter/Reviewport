/**
 * Reviewport Access API (Google Apps Script)
 *
 * Replaces the Firebase cloud functions for invites and tool access, so it
 * runs free under a Google Workspace account (no Firebase billing needed).
 *
 * Storage: the Google Sheet this script is bound to. Two tabs are created
 * automatically on first use:
 *   Invites: code | tools | role | createdBy | createdAt | expiresAt | usedBy | usedAt | revoked
 *   Users:   email | tools | role | addedAt | inviteCode
 *
 * Auth: the hub/tools send the user's Firebase ID token. It is verified with
 * Google (identitytoolkit accounts:lookup) and the verified email is used.
 * Admins = verified @epicgames.com emails (plus ADMIN_EMAILS script property).
 *
 * Transport: JSONP over GET (same approach as the review-storage script) so it
 * works cross-origin from GitHub Pages without CORS preflight.
 *
 * Setup: see README.md in this folder.
 */

var FIREBASE_API_KEY = "AIzaSyDHtXGk_e5ntXOqTBAr5whLnVU8LaWsqOQ"; // public web key
var TOKEN_REFERER = "https://samdeiter.github.io/"; // satisfies key referrer restrictions
var ADMIN_DOMAIN = "@epicgames.com";
var VALID_TOOLS = ["questions", "blueprint", "scenario", "materials", "learning-path"];
var VALID_ROLES = ["viewer", "editor"];
var MAX_BATCH = 50;

var INVITE_HEADERS = ["code", "tools", "role", "createdBy", "createdAt", "expiresAt", "usedBy", "usedAt", "revoked"];
var USER_HEADERS = ["email", "tools", "role", "addedAt", "inviteCode"];

function doGet(e) {
  var p = (e && e.parameter) || {};
  var result;
  try {
    result = route_(p);
  } catch (err) {
    result = { ok: false, error: String(err && err.message ? err.message : err) };
  }
  var json = JSON.stringify(result);
  var cb = (p.callback || "").replace(/[^A-Za-z0-9_$.]/g, "");
  if (cb) {
    return ContentService.createTextOutput(cb + "(" + json + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}

function route_(p) {
  var user = verifyToken_(p.token);
  switch (p.action) {
    case "me":
      return { ok: true, email: user.email, isAdmin: isAdmin_(user), access: accessFor_(user) };
    case "check":
      return checkTool_(user, p.tool);
    case "redeem":
      return redeem_(user, p.code);
    case "createInvites":
      requireAdmin_(user);
      return createInvites_(user, p);
    case "listInvites":
      requireAdmin_(user);
      return listInvites_();
    case "revokeInvite":
      requireAdmin_(user);
      return revokeInvite_(p.code);
    default:
      throw new Error("Unknown action");
  }
}

/* ---------- auth ---------- */

function verifyToken_(token) {
  if (!token) throw new Error("Not signed in");
  var cache = CacheService.getScriptCache();
  var key = "t_" + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
  );
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var res = UrlFetchApp.fetch(
    "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + FIREBASE_API_KEY,
    {
      method: "post",
      contentType: "application/json",
      headers: { Referer: TOKEN_REFERER },
      payload: JSON.stringify({ idToken: token }),
      muteHttpExceptions: true,
    }
  );
  if (res.getResponseCode() !== 200) throw new Error("Invalid or expired sign-in");
  var info = JSON.parse(res.getContentText());
  var u = info.users && info.users[0];
  if (!u || !u.email) throw new Error("Invalid or expired sign-in");
  var user = { email: String(u.email).toLowerCase(), verified: u.emailVerified === true };
  cache.put(key, JSON.stringify(user), 300);
  return user;
}

function isAdmin_(user) {
  if (!user.verified) return false;
  if (user.email.slice(-ADMIN_DOMAIN.length) === ADMIN_DOMAIN) return true;
  var extra = PropertiesService.getScriptProperties().getProperty("ADMIN_EMAILS") || "";
  return extra.toLowerCase().split(",").map(function (s) { return s.trim(); }).indexOf(user.email) !== -1;
}

function requireAdmin_(user) {
  if (!isAdmin_(user)) throw new Error("Admin access required");
}

/* ---------- sheet helpers ---------- */

function sheet_(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.setFrozenRows(1);
  }
  return sh;
}

function rows_(sh) {
  var values = sh.getDataRange().getValues();
  var headers = values.shift();
  return values.map(function (row, i) {
    var o = { _row: i + 2 };
    headers.forEach(function (h, c) { o[h] = row[c]; });
    return o;
  });
}

function splitTools_(s) {
  return String(s || "").split(",").map(function (t) { return t.trim(); }).filter(Boolean);
}

function normTool_(t) {
  t = String(t || "").toLowerCase().replace(/-review$/, "");
  if (t === "question") t = "questions";
  if (t === "learning") t = "learning-path";
  return t;
}

/* ---------- actions ---------- */

function accessFor_(user) {
  if (isAdmin_(user)) return { role: "editor", tools: VALID_TOOLS.slice() };
  var rec = rows_(sheet_("Users", USER_HEADERS)).filter(function (r) {
    return String(r.email).toLowerCase() === user.email;
  })[0];
  if (!rec) return { role: null, tools: [] };
  return { role: rec.role, tools: splitTools_(rec.tools) };
}

function checkTool_(user, tool) {
  var access = accessFor_(user);
  var t = normTool_(tool);
  return {
    ok: true,
    hasAccess: access.tools.indexOf(t) !== -1,
    role: access.role,
  };
}

function createInvites_(user, p) {
  var count = Math.min(MAX_BATCH, Math.max(1, parseInt(p.count, 10) || 1));
  var days = Math.min(30, Math.max(1, parseInt(p.expiresInDays, 10) || 7));
  var role = VALID_ROLES.indexOf(p.role) !== -1 ? p.role : "viewer";
  var tools = splitTools_(p.tools).map(normTool_).filter(function (t) {
    return VALID_TOOLS.indexOf(t) !== -1;
  });
  if (!tools.length) throw new Error("Select at least one valid tool");

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_("Invites", INVITE_HEADERS);
    var now = new Date();
    var expires = new Date(now.getTime() + days * 86400000);
    var codes = [];
    for (var i = 0; i < count; i++) {
      var code = Utilities.getUuid().replace(/-/g, "").substring(0, 12).toUpperCase();
      sh.appendRow([code, tools.join(","), role, user.email, now, expires, "", "", false]);
      codes.push(code);
    }
    return { ok: true, codes: codes, tools: tools, role: role, expiresAt: expires.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function redeem_(user, code) {
  code = String(code || "").trim().toUpperCase();
  if (!code) throw new Error("Missing invite code");
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var inv = sheet_("Invites", INVITE_HEADERS);
    var rec = rows_(inv).filter(function (r) { return String(r.code) === code; })[0];
    if (!rec) throw new Error("Invite not found");
    if (rec.revoked === true || String(rec.revoked).toLowerCase() === "true") throw new Error("Invite was revoked");
    if (rec.usedBy) throw new Error("Invite already used");
    if (new Date(rec.expiresAt).getTime() < Date.now()) throw new Error("Invite expired");

    var tools = splitTools_(rec.tools);
    inv.getRange(rec._row, INVITE_HEADERS.indexOf("usedBy") + 1, 1, 2).setValues([[user.email, new Date()]]);

    var users = sheet_("Users", USER_HEADERS);
    var existing = rows_(users).filter(function (r) { return String(r.email).toLowerCase() === user.email; })[0];
    if (existing) {
      // merge tools; never downgrade an existing editor
      var merged = splitTools_(existing.tools);
      tools.forEach(function (t) { if (merged.indexOf(t) === -1) merged.push(t); });
      var role = existing.role === "editor" || rec.role === "editor" ? "editor" : "viewer";
      users.getRange(existing._row, 2, 1, 2).setValues([[merged.join(","), role]]);
      return { ok: true, tools: merged, role: role };
    }
    users.appendRow([user.email, tools.join(","), rec.role, new Date(), code]);
    return { ok: true, tools: tools, role: rec.role };
  } finally {
    lock.releaseLock();
  }
}

function listInvites_() {
  var list = rows_(sheet_("Invites", INVITE_HEADERS)).map(function (r) {
    return {
      code: r.code, tools: r.tools, role: r.role, createdBy: r.createdBy,
      expiresAt: r.expiresAt, usedBy: r.usedBy, revoked: r.revoked === true,
    };
  });
  return { ok: true, invites: list };
}

function revokeInvite_(code) {
  code = String(code || "").trim().toUpperCase();
  var sh = sheet_("Invites", INVITE_HEADERS);
  var rec = rows_(sh).filter(function (r) { return String(r.code) === code; })[0];
  if (!rec) throw new Error("Invite not found");
  sh.getRange(rec._row, INVITE_HEADERS.indexOf("revoked") + 1).setValue(true);
  return { ok: true };
}

/** Run once from the editor to create the tabs and authorize the script. */
function setup() {
  sheet_("Invites", INVITE_HEADERS);
  sheet_("Users", USER_HEADERS);
}
