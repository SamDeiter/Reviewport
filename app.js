// Tool URLs configuration
      const TOOLS = {
        blueprint: "https://samdeiter.github.io/UE5LMSBlueprint/",
        "blueprint-review":
          "https://samdeiter.github.io/UE5LMSBlueprint/?mode=review",
        scenario: "https://samdeiter.github.io/UE5ScenarioTracker/",
        "scenario-review":
          "https://samdeiter.github.io/UE5ScenarioTracker/?mode=review",
        question: "https://samdeiter.github.io/UE5QuestionGenerator/",
        "question-review":
          "https://samdeiter.github.io/UE5QuestionGenerator/?mode=review",
        materials: "https://samdeiter.github.io/UE5LMSMaterials/",
        "materials-review":
          "https://samdeiter.github.io/UE5LMSMaterials/?mode=review",
        "learning-path":
          "https://samdeiter.github.io/Unreal-Learning-Path-Tagging-System/",
        "learning-path-review":
          "https://samdeiter.github.io/Unreal-Learning-Path-Tagging-System/?mode=review",
      };

      // Google Drive configuration for screenshot storage
      const DRIVE_CONFIG = {
        folderId: "1QUjAnB8HxcsKsLDewC9kzdcJQtsezJCH",
        folderUrl:
          "https://drive.google.com/drive/folders/1QUjAnB8HxcsKsLDewC9kzdcJQtsezJCH",
      };

      async function launchTool(toolId) {
        const url = TOOLS[toolId];
        if (!url) return;

        // 1. Epic Games employees have auto-access to everything
        if (
          auth.currentUser &&
          auth.currentUser.email.toLowerCase().endsWith("@epicgames.com")
        ) {
          window.open(url, "_blank");
          return;
        }

        // 2. Check per-tool access for external users
        try {
          const result = await ReviewportAccess.call("check", {
            tool: toolId.replace(/-review$/, ""),
          });

          if (result.hasAccess) {
            window.open(url, "_blank");
          } else {
            alert(
              `Access Denied: You do not have permission to access this tool. Please request an invite link for it.`,
            );
          }
        } catch (error) {
          console.error("[Access] Check failed:", error);
          alert("Failed to verify access: " + error.message);
        }
      }

      function showLoginInfo() {
        alert(
          "Google Authentication will be configured with Firebase Auth.\n\nFor Epic Games employees, access will be restricted to @epicgames.com domain.",
        );
      }

      function exportReport() {
        const report = {
          timestamp: new Date().toISOString(),
          stats: {
            scenarios: document.getElementById("scenario-count").textContent,
            questions: document.getElementById("question-count").textContent,
            pending: document.getElementById("review-count").textContent,
          },
          tools: Object.keys(TOOLS),
        };

        const blob = new Blob([JSON.stringify(report, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `review-report-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      function syncData() {
        if (confirm("Open Google Drive folder to verify synced data?")) {
          window.open(DRIVE_CONFIG.folderUrl, "_blank");
        }
      }

      function showDocs() {
        window.open("https://github.com/SamDeiter/Reviewport/wiki", "_blank");
      }

      // Check tool status on load
      // Status check for GitHub Pages tools
      // Since these are static GitHub Pages sites, they're always available
      async function checkToolStatus() {
        const tools = [
          {
            id: "blueprint-status",
            url: "https://samdeiter.github.io/UE5LMSBlueprint/",
          },
          {
            id: "scenario-status",
            url: "https://samdeiter.github.io/UE5ScenarioTracker/",
          },
        ];

        for (const tool of tools) {
          const el = document.getElementById(tool.id);
          if (el) {
            // GitHub Pages are static and always available
            el.classList.remove("offline");
            el.innerHTML = '<span class="dot"></span> Available';
          }
        }
      }

      // Run status check on load
      checkToolStatus();

      // Firebase configuration for Question Generator
      // Load Firebase SDK
      const firebaseScript = document.createElement("script");
      firebaseScript.src =
        "https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js";
      firebaseScript.onload = () => {
        const authScript = document.createElement("script");
        authScript.src =
          "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth-compat.js";
        authScript.onload = () => {
          const firestoreScript = document.createElement("script");
          firestoreScript.src =
            "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore-compat.js";
          firestoreScript.onload = () => {
            const functionsScript = document.createElement("script");
            functionsScript.src =
              "https://www.gstatic.com/firebasejs/10.7.0/firebase-functions-compat.js";
            functionsScript.onload = initFirebase;
            document.head.appendChild(functionsScript);
          };
          document.head.appendChild(firestoreScript);
        };
        document.head.appendChild(authScript);
      };
      document.head.appendChild(firebaseScript);

      // Allowed email domain
      const ALLOWED_DOMAIN = "@epicgames.com";

      // Global Firebase references
      let auth, db;

      async function initFirebase() {
        try {
          // Firebase config for ue5-questions-prod
          // API key is restricted to *.samdeiter.github.io/* in Firebase Console
          const firebaseConfig = {
            apiKey: "AIzaSyDHtXGk_e5ntXOqTBAr5whLnVU8LaWsqOQ",
            authDomain: "ue5-questions-prod.firebaseapp.com",
            projectId: "ue5-questions-prod",
            storageBucket: "ue5-questions-prod.firebasestorage.app",
            messagingSenderId: "15582589888",
            appId: "1:15582589888:web:b767b6bb3a16bf5f42695b5",
            measurementId: "G-3L7FJ56DMH",
          };

          firebase.initializeApp(firebaseConfig);
          auth = firebase.auth();
          db = firebase.firestore();
          functions = firebase.functions();

          // Listen for auth state changes
          auth.onAuthStateChanged(handleAuthStateChange);

          console.log("[Auth] Firebase initialized");
        } catch (error) {
          console.error("Firebase init error:", error);
          showAuthError("Failed to initialize. Please refresh the page.");
        }
      }

      // External users who accepted an invite earlier hold per-tool access
      // server-side, so they can sign back in without the ?invite= param.
      async function hasAnyToolAccess() {
        try {
          const result = await ReviewportAccess.call("me");
          return result.access.tools.length > 0;
        } catch (error) {
          console.error("[Access] Lookup failed:", error);
          return false;
        }
      }

      async function handleAuthStateChange(user) {
        const loginOverlay = document.getElementById("login-overlay");
        const appContent = document.getElementById("app-content");
        const userArea = document.getElementById("user-area");

        if (user) {
          // Check domain restriction
          const urlParams = new URLSearchParams(window.location.search);
          const hasInvite = urlParams.has("invite");

          if (
            !hasInvite &&
            !user.email.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase()) &&
            !(await hasAnyToolAccess())
          ) {
            console.warn(`[Auth] Rejected: ${user.email} (no invite on file)`);
            showAuthError(
              "This account has no access yet. Ask for an invite link, then open it while signed in.",
            );
            auth.signOut();
            return;
          }

          // User is authenticated with valid domain
          console.log(`[Auth] Authenticated: ${user.email}`);

          // Hide login, show content
          loginOverlay.classList.add("hidden");
          appContent.classList.add("visible");

          // Update header with user info
          // Use Google provider photoURL (more reliable for Workspace accounts)
          const googleProvider = user.providerData && user.providerData.find(p => p.providerId === 'google.com');
          const avatarUrl = (googleProvider && googleProvider.photoURL) || user.photoURL;
          const fallbackUrl = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(user.displayName || 'User') + '&background=667eea&color=fff&size=96';
          userArea.innerHTML = `
            <div class="user-profile">
              <img src="${avatarUrl || fallbackUrl}" alt="${user.displayName || ''}" referrerPolicy="no-referrer" onerror="this.onerror=null; this.src='${fallbackUrl}';">
              <span class="user-name">${user.displayName || user.email}</span>
              <button class="logout-btn" onclick="signOut()">Sign Out</button>
            </div>
          `;

          // Load data now that user is authenticated
          loadQuestionStats();
          checkAdminAccess();
          checkInviteCode();
        } else {
          // User is not authenticated
          console.log("[Auth] No user signed in");

          // Check for invite in URL even if not signed in (to show login prompt)
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.has("invite")) {
            showAuthError(
              "You have an invite link! Please sign in with your Google account to accept it.",
            );
          }

          // Show login, hide content
          loginOverlay.classList.remove("hidden");
          appContent.classList.remove("visible");

          // Reset header
          userArea.innerHTML = "";
        }
      }

      async function signInWithGoogle() {
        try {
          hideAuthError();
          const provider = new firebase.auth.GoogleAuthProvider();

          // No hd restriction: invited external users sign in with any
          // Google account; access is enforced after sign-in.
          provider.setCustomParameters({ prompt: "select_account" });

          await auth.signInWithPopup(provider);
        } catch (error) {
          console.error("[Auth] Sign-in error:", error);
          if (error.code === "auth/popup-closed-by-user") {
            // User closed popup, don't show error
            return;
          }
          showAuthError("Sign-in failed. Please try again.");
        }
      }

      function signOut() {
        auth
          .signOut()
          .then(() => {
            console.log("[Auth] Signed out");
          })
          .catch((error) => {
            console.error("[Auth] Sign-out error:", error);
          });
      }

      function showAuthError(message) {
        const errorEl = document.getElementById("auth-error");
        errorEl.textContent = message;
        errorEl.classList.remove("hidden");
      }

      function hideAuthError() {
        const errorEl = document.getElementById("auth-error");
        errorEl.classList.add("hidden");
      }

      async function loadQuestionStats() {
        try {
          // Get question counts
          const snapshot = await db.collection("questions").get();
          const total = snapshot.size;

          let verified = 0;
          let pending = 0;
          snapshot.forEach((doc) => {
            const data = doc.data();
            if (data.humanVerified) {
              verified++;
            } else {
              pending++;
            }
          });

          // Update UI
          document.getElementById("question-count").textContent = total;
          document.getElementById("question-card-count").textContent = total;
          document.getElementById("verified-count").textContent = verified;
          document.getElementById("pending-count").textContent = pending;
          document.getElementById("review-count").textContent = pending;

          // Update status to online
          const statusEl = document.getElementById("question-status");
          if (statusEl) {
            statusEl.classList.remove("offline");
            statusEl.innerHTML = '<span class="dot"></span> Online';
          }

          console.log(
            `[Data] Loaded ${total} questions (${verified} verified, ${pending} pending)`,
          );
        } catch (error) {
          console.error("Firebase error:", error);
          document.getElementById("question-card-count").textContent = "?";
          document.getElementById("verified-count").textContent = "?";
          document.getElementById("pending-count").textContent = "?";
        }
      }

      // --- Admin Functions ---

      async function checkAdminAccess() {
        try {
          if (!auth.currentUser) return;

          // Epic Games employees are auto-admins (frontend check for immediate UI)
          if (auth.currentUser.email.toLowerCase().endsWith("@epicgames.com")) {
            console.log("[Admin] Auto-access granted (Epic Employee)");
            document.getElementById("admin-panel").classList.add("visible");
            return;
          }

          // Everyone else is a non-admin; admin = verified @epicgames.com
          console.log("[Admin] No admin role detected");
        } catch (error) {
          console.error("[Admin] Access check failed:", error);
        }
      }

      let generatedInviteUrls = [];

      async function generateInviteLink(event) {
        const btn = event.currentTarget;
        const originalText = btn.innerHTML;

        try {
          btn.disabled = true;
          btn.innerHTML =
            '<i class="fas fa-spinner fa-spin"></i> Generating...';

          const selectedTools = Array.from(
            document.querySelectorAll('input[name="tool"]:checked'),
          ).map((cb) => cb.value);

          if (selectedTools.length === 0) {
            alert("Please select at least one tool.");
            return;
          }

          const role = document.getElementById("invite-role").value;
          const count = Math.min(
            50,
            Math.max(1, parseInt(document.getElementById("invite-count").value, 10) || 1),
          );

          const baseUrl = window.location.origin + window.location.pathname;
          generatedInviteUrls = [];
          let lastError = null;

          try {
            const result = await ReviewportAccess.call("createInvites", {
              tools: selectedTools.join(","),
              role,
              count,
              expiresInDays: 7,
            });
            generatedInviteUrls = result.codes.map(
              (code) => `${baseUrl}?invite=${code}`,
            );
          } catch (error) {
            lastError = error;
            console.error("Invite generation error:", error);
          }

          renderInviteList(role);

          if (lastError) {
            alert("Failed to generate invites: " + lastError.message);
          }
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      }

      function renderInviteList(role) {
        const area = document.getElementById("invite-link-area");
        const list = document.getElementById("invite-list");
        list.innerHTML = "";
        if (generatedInviteUrls.length === 0) {
          area.classList.remove("visible");
          return;
        }

        const roleLabel = role === "viewer" ? "Viewer" : "Editor";
        document.getElementById("invite-list-heading").textContent =
          `${generatedInviteUrls.length} invite(s) generated - ${roleLabel}`;

        generatedInviteUrls.forEach((url, i) => {
          const row = document.createElement("div");
          row.className = "copy-area";
          row.style.marginTop = "0.5rem";

          const label = document.createElement("span");
          label.textContent = `Invite ${i + 1}:`;
          label.style.cssText = "white-space:nowrap;font-size:0.875rem;align-self:center;";

          const input = document.createElement("input");
          input.type = "text";
          input.className = "copy-input";
          input.readOnly = true;
          input.value = url;

          const copyBtn = document.createElement("button");
          copyBtn.className = "btn btn-secondary";
          copyBtn.innerHTML = '<i class="fas fa-copy"></i>';
          copyBtn.onclick = () => copyText(url, copyBtn);

          row.append(label, input, copyBtn);
          list.appendChild(row);
        });

        area.classList.add("visible");
      }

      // Plain-text block ready to paste into an email
      function copyAllInvites(event) {
        const role = document.getElementById("invite-role").value;
        const roleLabel = role === "viewer" ? "Viewer" : "Editor";
        const text = generatedInviteUrls
          .map((url, i) => `Invite ${i + 1} (${roleLabel}): ${url}`)
          .join("\n");
        copyText(text, event.currentTarget);
      }

      async function copyText(text, btn) {
        try {
          await navigator.clipboard.writeText(text);
        } catch (e) {
          const ta = document.createElement("textarea");
          ta.value = text;
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        }
        const originalHtml = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i> Copied';
        btn.style.color = "var(--accent-green)";
        setTimeout(() => {
          btn.innerHTML = originalHtml;
          btn.style.color = "";
        }, 2000);
      }

      async function checkInviteCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = urlParams.get("invite");

        if (!inviteCode || !auth.currentUser) return;

        try {
          console.log(`[Invite] Attempting to consume code: ${inviteCode}`);
          const result = await ReviewportAccess.call("redeem", { code: inviteCode });

          if (result.ok) {
            const tools = result.tools || [];
            const toolsString =
              tools.length > 0 ? tools.join(", ") : "default tools";
            alert(
              `Success! You have been granted ${result.role} access to: ${toolsString}

You can now launch these tools from the hub.`,
            );

            // Clear the URL parameter
            window.history.replaceState(
              {},
              document.title,
              window.location.pathname,
            );

            // Re-check admin status and refresh stats (might have gained permissions)
            checkAdminAccess();
          }
        } catch (error) {
          console.error("[Invite] Consumption error:", error);
          alert(
            "Failed to accept invite: " + (error.message || "Unknown error"),
          );
          // Clear query param even on failure to prevent loops
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname,
          );
        }
      }
