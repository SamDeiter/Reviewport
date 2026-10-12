/**
 * Reviewport Gatekeeper v1.3
 * Enforces authentication and tool-specific access control for UE5 educational tools.
 * Hosted at: https://samdeiter.github.io/Reviewport/gatekeeper.js
 *
 * v1.3: tool access is checked via the Apps Script Access API (access-api.js)
 *       instead of the Firebase checkToolAccess cloud function.
 *       Exposes window.ReviewportRole ("viewer" | "editor") for tools.
 *
 * v1.2 Fixes:
 * - CSS: Overlay now renders independently of the body-hide rule
 * - Timeout: checkToolAccess has a 10s timeout fallback
 */
(function () {
  const HUB_URL = "https://samdeiter.github.io/Reviewport/";
  const ALLOWED_DOMAIN = "@epicgames.com";
  const GATEKEEPER_STYLE_ID = "gatekeeper-style";

  // 1. Immediately hide ALL page content (but not the gatekeeper overlay)
  if (!document.getElementById(GATEKEEPER_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = GATEKEEPER_STYLE_ID;
    // Hide everything in body EXCEPT our overlay, so overlay always renders
    style.innerHTML = `
      body > *:not(#gatekeeper-overlay) { display: none !important; }
      #gatekeeper-overlay { display: block !important; }
    `;
    document.head.appendChild(style);
  }

  console.log("[Gatekeeper] Initializing...");

  // Config matches Reviewport Hub (Prod)
  const firebaseConfig = {
    apiKey: "AIzaSyDHtXGk_e5ntXOqTBAr5whLnVU8LaWsqOQ",
    authDomain: "ue5-questions-prod.firebaseapp.com",
    projectId: "ue5-questions-prod",
    storageBucket: "ue5-questions-prod.firebasestorage.app",
    messagingSenderId: "15582589888",
    appId: "1:15582589888:web:b767b6bb3a16bf5f42695b5",
  };

  function grantAccess() {
    console.log("[Gatekeeper] Access granted.");
    const style = document.getElementById(GATEKEEPER_STYLE_ID);
    if (style) style.remove();

    // Also remove any loading overlay
    const overlay = document.getElementById("gatekeeper-overlay");
    if (overlay) overlay.remove();
  }

  function denyAccess(reason) {
    console.error("[Gatekeeper] Access denied:", reason);
    if (reason === "no_session") {
      window.location.href = HUB_URL;
    } else {
      alert("Unauthorized access. Redirecting to hub...");
      window.location.href = HUB_URL;
    }
  }

  // Determine current tool based on URL
  function getCurrentToolId() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("blueprint")) return "blueprint";
    if (path.includes("scenario")) return "scenario";
    if (path.includes("question")) return "questions";
    if (path.includes("material")) return "materials";
    if (path.includes("learning") || path.includes("tagging"))
      return "learning-path";
    return "unknown";
  }

  // Load the shared Access API client from the hub
  function loadAccessApi() {
    if (window.ReviewportAccess) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = HUB_URL + "access-api.js";
      s.onload = resolve;
      s.onerror = () => reject(new Error("Could not load access-api.js"));
      document.head.appendChild(s);
    });
  }

  async function initGatekeeper() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      const auth = firebase.auth();

      // Show a simple loading overlay as soon as body is available
      const interval = setInterval(() => {
        if (document.body) {
          clearInterval(interval);
          if (!document.getElementById("gatekeeper-overlay")) {
            const overlay = document.createElement("div");
            overlay.id = "gatekeeper-overlay";
            overlay.innerHTML = `
                    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#0d1117;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;color:#e6edf3;font-family:sans-serif;">
                        <img src="https://samdeiter.github.io/Reviewport/logos/UE-Icon-2023-White.svg" style="width:64px;height:64px;margin-bottom:20px;">
                        <div style="font-size:1.2rem;margin-bottom:10px;">Verifying Access...</div>
                        <div style="font-size:0.8rem;color:#8b949e;">Please wait while we check your credentials.</div>
                    </div>
                `;
            // Overlay is excluded from the hide rule via :not(#gatekeeper-overlay)
            document.body.appendChild(overlay);
          }
        }
      }, 50);

      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          denyAccess("no_session");
          return;
        }

        if (user.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
          window.ReviewportRole = "editor";
          grantAccess();
          return;
        }

        const toolId = getCurrentToolId();
        try {
          await loadAccessApi();
          // Race the API against a timeout so a hung call can't trap the page
          const TIMEOUT_MS = 10000;
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Access check timed out")), TIMEOUT_MS)
          );

          const result = await Promise.race([
            window.ReviewportAccess.call("check", { tool: toolId }),
            timeoutPromise,
          ]);

          if (!result.hasAccess) {
            denyAccess("not_invited");
          } else {
            window.ReviewportRole = result.role;
            grantAccess();
          }
        } catch (error) {
          console.error("[Gatekeeper] Access check failed:", error.message);
          denyAccess("error");
        }
      });
    } catch (err) {
      denyAccess("init_error");
    }
  }

  // Load Firebase SDK if not present
  if (typeof firebase === "undefined") {
    const scripts = [
      "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js",
      "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js",
    ];

    let loadedCount = 0;
    scripts.forEach((src) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = () => {
        loadedCount++;
        if (loadedCount === scripts.length) initGatekeeper();
      };
      document.head.appendChild(s);
    });
  } else {
    initGatekeeper();
  }
})();
