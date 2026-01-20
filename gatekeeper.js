/**
 * Reviewport Gatekeeper v1.1
 * Enforces authentication and tool-specific access control for UE5 educational tools.
 * Hosted at: https://samdeiter.github.io/Reviewport/gatekeeper.js
 */
(function () {
  const HUB_URL = "https://samdeiter.github.io/Reviewport/";
  const ALLOWED_DOMAIN = "@epicgames.com";
  const GATEKEEPER_STYLE_ID = "gatekeeper-style";

  // 1. Immediately hide the body to prevent flash of content
  if (!document.getElementById(GATEKEEPER_STYLE_ID)) {
    const style = document.createElement("style");
    style.id = GATEKEEPER_STYLE_ID;
    style.innerHTML = "body { display: none !important; }";
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
    return "unknown";
  }

  async function initGatekeeper() {
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      const auth = firebase.auth();
      const functions = firebase.functions();

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
            document.body.style.display = "block"; // Allow body to show overlay but keep content hidden via GATEKEEPER_STYLE_ID if it targets #app-container or similar?
            // Actually, the style targets body, so we need a different approach.
            // Let's modify the style to hide a likely app container OR just keep it hidden and use a different element.
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
          grantAccess();
          return;
        }

        const toolId = getCurrentToolId();
        try {
          const checkFn = functions.httpsCallable("checkToolAccess");
          const result = await checkFn({ toolId: toolId });

          if (!result.data || !result.data.hasAccess) {
            denyAccess("not_invited");
          } else {
            grantAccess();
          }
        } catch (error) {
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
      "https://www.gstatic.com/firebasejs/9.23.0/firebase-functions-compat.js",
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
