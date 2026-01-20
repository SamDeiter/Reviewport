/**
 * Reviewport Gatekeeper v1.0
 * Enforces authentication and tool-specific access control for UE5 educational tools.
 * Hosted at: https://samdeiter.github.io/Reviewport/gatekeeper.js
 */
(function () {
  console.log("[Gatekeeper] Initializing...");
  const HUB_URL = "https://samdeiter.github.io/Reviewport/";
  const ALLOWED_DOMAIN = "@epicgames.com";

  // Config matches Reviewport Hub (Prod)
  const firebaseConfig = {
    apiKey: "AIzaSyDHtXGk_e5ntXOqTBAr5whLnVU8LaWsqOQ",
    authDomain: "ue5-questions-prod.firebaseapp.com",
    projectId: "ue5-questions-prod",
    storageBucket: "ue5-questions-prod.firebasestorage.app",
    messagingSenderId: "15582589888",
    appId: "1:15582589888:web:b767b6bb3a16bf5f42695b5",
  };

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
      // Initialize Firebase
      if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }

      const auth = firebase.auth();
      const functions = firebase.functions();

      // Show a simple loading overlay if body exists
      let overlay = document.getElementById("gatekeeper-overlay");
      if (!overlay && document.body) {
        overlay = document.createElement("div");
        overlay.id = "gatekeeper-overlay";
        overlay.innerHTML = `
                    <div style="position:fixed;top:0;left:0;width:100%;height:100%;background:#0d1117;display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:999999;color:#e6edf3;font-family:sans-serif;">
                        <img src="https://samdeiter.github.io/Reviewport/logos/UE-Icon-2023-White.svg" style="width:64px;height:64px;margin-bottom:20px;">
                        <div style="font-size:1.2rem;margin-bottom:10px;">Verifying Access...</div>
                        <div style="font-size:0.8rem;color:#8b949e;">Please wait while we check your credentials.</div>
                    </div>
                `;
        document.body.appendChild(overlay);
      }

      auth.onAuthStateChanged(async (user) => {
        if (!user) {
          console.warn("[Gatekeeper] No session found. Redirecting to hub...");
          window.location.href = HUB_URL;
          return;
        }

        // Epic employees have auto-access
        if (user.email.toLowerCase().endsWith(ALLOWED_DOMAIN)) {
          console.log("[Gatekeeper] Access granted (Epic Employee)");
          if (overlay) overlay.remove();
          return;
        }

        // Check tool access for external reviewers
        const toolId = getCurrentToolId();
        try {
          const checkFn = functions.httpsCallable("checkToolAccess");
          const result = await checkFn({ toolId: toolId });

          if (!result.data || !result.data.hasAccess) {
            console.error("[Gatekeeper] Access denied for tool:", toolId);
            alert(
              "Unauthorized access. You do not have permission for this tool.",
            );
            window.location.href = HUB_URL;
          } else {
            console.log("[Gatekeeper] Access granted via token");
            if (overlay) overlay.remove();
          }
        } catch (error) {
          console.error("[Gatekeeper] Access check failed:", error);
          window.location.href = HUB_URL;
        }
      });
    } catch (err) {
      console.error("[Gatekeeper] Init error:", err);
      window.location.href = HUB_URL;
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
