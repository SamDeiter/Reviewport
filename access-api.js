/**
 * Reviewport Access API client (JSONP to the Apps Script web app).
 * Shared by the hub (app.js) and the tool gatekeeper (gatekeeper.js).
 *
 * After deploying apps-script/access, paste the web app URL below.
 */
(function () {
  var ACCESS_API_URL = ""; // e.g. https://script.google.com/macros/s/AKfy.../exec
  var TIMEOUT_MS = 15000;
  var counter = 0;

  /**
   * @param {string} action  me | check | redeem | createInvites | listInvites | revokeInvite
   * @param {Object} params  extra query params (tool, code, tools, role, count, ...)
   * @returns {Promise<Object>} the API result; rejects with Error on { ok: false }
   */
  async function call(action, params) {
    if (!ACCESS_API_URL) throw new Error("Access API is not configured yet");
    var user = window.firebase && window.firebase.auth().currentUser;
    if (!user) throw new Error("Not signed in");
    var token = await user.getIdToken();

    return new Promise(function (resolve, reject) {
      var cbName = "__rpAccess" + Date.now() + "_" + counter++;
      var script = document.createElement("script");
      var timer = setTimeout(function () {
        cleanup();
        reject(new Error("Access API timed out"));
      }, TIMEOUT_MS);

      function cleanup() {
        clearTimeout(timer);
        delete window[cbName];
        script.remove();
      }

      window[cbName] = function (result) {
        cleanup();
        if (result && result.ok) resolve(result);
        else reject(new Error((result && result.error) || "Access API error"));
      };

      var query = Object.assign({}, params, { action: action, token: token, callback: cbName });
      script.src =
        ACCESS_API_URL + "?" +
        Object.keys(query)
          .map(function (k) { return encodeURIComponent(k) + "=" + encodeURIComponent(query[k]); })
          .join("&");
      script.onerror = function () {
        cleanup();
        reject(new Error("Could not reach the Access API"));
      };
      document.head.appendChild(script);
    });
  }

  window.ReviewportAccess = { call: call, isConfigured: function () { return !!ACCESS_API_URL; } };
})();
