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
          // Normalize toolId (e.g., 'blueprint-review' -> 'blueprint')
          const baseToolId = toolId.split("-")[0];

          const checkAccessFn = functions.httpsCallable("checkToolAccess");
          const result = await checkAccessFn({ toolId: baseToolId });

          if (result.data.hasAccess) {
            window.open(url, "_blank");
          } else {
            alert(
              `Access Denied: You do not have permission to access the ${baseToolId} tool. Please request an invite link for this tool.`,
            );
          }
        } catch (error) {
          console.error("[Access] Check failed:", error);
          alert("Failed to verify access. Please try again later.");
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

      function handleAuthStateChange(user) {
        const loginOverlay = document.getElementById("login-overlay");
        const appContent = document.getElementById("app-content");
        const userArea = document.getElementById("user-area");

        if (user) {
          // Check domain restriction
          const urlParams = new URLSearchParams(window.location.search);
          const hasInvite = urlParams.has("invite");

          if (
            !hasInvite &&
            !user.email.toLowerCase().endsWith(ALLOWED_DOMAIN.toLowerCase())
          ) {
            console.warn(
              `[Auth] Rejected: ${user.email} (not ${ALLOWED_DOMAIN})`,
            );
            showAuthError(
              `Access restricted to ${ALLOWED_DOMAIN} accounts only. If you have an invite, please use the invite link.`,
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

          // Only hint/force epicgames.com if NO invite is present.
          // Holders of specific tool invites can use personal accounts.
          const urlParams = new URLSearchParams(window.location.search);
          if (!urlParams.has("invite")) {
            provider.setCustomParameters({
              hd: "epicgames.com",
              prompt: "select_account",
            });
          } else {
            provider.setCustomParameters({
              prompt: "select_account",
            });
          }

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

          const checkFn = functions.httpsCallable("checkUserRegistration");
          const result = await checkFn({});
          const userData = result.data;

          console.log("[Admin] Registration check result:", userData);

          if (userData && userData.role === "admin") {
            console.log("[Admin] Access detected via registry");
            document.getElementById("admin-panel").classList.add("visible");
          } else {
            console.log("[Admin] No admin role detected");
          }
        } catch (error) {
          console.error("[Admin] Access check failed:", error);
        }
      }

      async function generateInviteLink() {
        const btn = event.target;
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

          const createFn = functions.httpsCallable("createInvite");
          const result = await createFn({
            tools: selectedTools,
            expiresInDays: 7,
          });

          if (result.data.success) {
            const inviteUrlArea = document.getElementById("invite-link-area");
            const inviteUrlInput = document.getElementById("invite-url");

            // Construct the tool-specific landing URL
            // For now, we point them to Reviewport which will handle the invite consume flow
            const baseUrl = window.location.origin + window.location.pathname;
            const inviteUrl = `${baseUrl}?invite=${result.data.code}`;

            inviteUrlInput.value = inviteUrl;
            inviteUrlArea.classList.add("visible");
          }
        } catch (error) {
          console.error("Invite generation error:", error);
          alert("Failed to generate invite: " + error.message);
        } finally {
          btn.disabled = false;
          btn.innerHTML = originalText;
        }
      }

      function copyInviteUrl() {
        const input = document.getElementById("invite-url");
        input.select();
        document.execCommand("copy");

        const btn = event.currentTarget;
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-check"></i>';
        btn.style.color = "var(--accent-green)";

        setTimeout(() => {
          btn.innerHTML = originalIcon;
          btn.style.color = "";
        }, 2000);
      }

      async function runAccessMigration() {
        if (
          !confirm(
            "This will add 'questions' tool access to all existing users. Proceed?",
          )
        )
          return;

        const statusEl = document.getElementById("system-status");
        try {
          statusEl.textContent = "Running migration...";
          statusEl.style.color = "var(--accent-blue)";

          const migrateFn = functions.httpsCallable(
            "runUnifiedAccessMigration",
          );
          const result = await migrateFn({});

          statusEl.textContent = `Migration complete: ${result.data.message}`;
          statusEl.style.color = "var(--accent-green)";
        } catch (error) {
          console.error("Migration error:", error);
          statusEl.textContent = "Migration failed: " + error.message;
          statusEl.style.color = "var(--accent-red)";
        }
      }

      async function seedToolRegistry() {
        const statusEl = document.getElementById("system-status");
        try {
          statusEl.textContent = "Seeding registry...";
          statusEl.style.color = "var(--accent-blue)";

          const seedFn = functions.httpsCallable("seedToolRegistry");
          const result = await seedFn({});

          statusEl.textContent = `Registry seeded: ${result.data.message}`;
          statusEl.style.color = "var(--accent-green)";
        } catch (error) {
          console.error("Seeding error:", error);
          statusEl.textContent = "Seeding failed: " + error.message;
          statusEl.style.color = "var(--accent-red)";
        }
      }

      async function checkInviteCode() {
        const urlParams = new URLSearchParams(window.location.search);
        const inviteCode = urlParams.get("invite");

        if (!inviteCode || !auth.currentUser) return;

        try {
          console.log(`[Invite] Attempting to consume code: ${inviteCode}`);
          const consumeFn = functions.httpsCallable("consumeInvite");
          const result = await consumeFn({ code: inviteCode });

          if (result.data && result.data.success) {
            const tools = result.data.tools || [];
            const toolsString =
              tools.length > 0 ? tools.join(", ") : "default tools";
            alert(
              `Success! You have been granted access to: ${toolsString}\n\nYou can now launch these tools from the hub.`,
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
