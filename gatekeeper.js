/**
 * Reviewport Gatekeeper v2.0 (open access)
 *
 * Tools load this script from the hub. Access control is intentionally
 * disabled: anyone with a tool's URL can use it, no sign-in or invite needed.
 *
 * It stays as a file (rather than removing the <script> tags from each tool)
 * so the tools keep working unchanged. Tools can read window.ReviewportRole,
 * which is always "editor" in open-access mode.
 *
 * The previous invite/sign-in gate (v1.3) is in git history if it is needed again.
 * Hosted at: https://samdeiter.github.io/Reviewport/gatekeeper.js
 */
(function () {
  window.ReviewportRole = "editor";
  window.ReviewportOpenAccess = true;
  console.log("[Gatekeeper] Open access - no sign-in required.");
})();
