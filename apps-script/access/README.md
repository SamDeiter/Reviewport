# Reviewport Access API - setup (about 5 minutes, free)

Run this under your **sam.deiter@epicgames.com** Google account.

1. Create a new Google Sheet named **Reviewport Access** (keep it private).
2. In the Sheet: **Extensions > Apps Script**.
3. Replace the contents of `Code.gs` with [Code.gs](Code.gs) from this folder.
4. Project Settings (gear) > tick **Show "appsscript.json" manifest file**, then paste
   [appsscript.json](appsscript.json) into it.
5. Select the `setup` function in the toolbar and click **Run**. Approve the
   permissions. This creates the `Invites` and `Users` tabs.
6. **Deploy > New deployment > Web app**
   - Execute as: **Me**
   - Who has access: **Anyone** (people outside Epic need to reach it; every call
     is checked against a verified Firebase sign-in token, so the URL alone gives
     no access)
7. Copy the **Web app URL** (ends in `/exec`) and paste it into `ACCESS_API_URL` at
   the top of [../../access-api.js](../../access-api.js), then commit and redeploy the hub.

If step 6 won't let you pick "Anyone", Epic's Workspace policy restricts it to the
domain. Outside users cannot reach the script in that case; ask Epic IT to allow it
for this one script, or tell me and we will look at an alternative.

## Notes
- Admins: any verified `@epicgames.com` account. To add others, set a script property
  `ADMIN_EMAILS` (Project Settings > Script properties) to a comma-separated list.
- After changing `Code.gs`, use **Deploy > Manage deployments > Edit > New version**
  so the same URL serves the update.
- You can view, edit or delete invites and users directly in the Sheet.
