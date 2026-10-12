# Backend changes needed for external invites and viewer role

The hub now sends `role` ("viewer" | "editor") to `createInvite`. The Firebase
project `ue5-questions-prod` is not in this repo, so these changes must be made
there. Until they are, `role` is ignored and nothing is enforced read-only.

## Cloud functions
- `createInvite`: accept `role` (default `"viewer"`), store it on the invite doc.
- `consumeInvite`: copy `role` onto the user's registry doc (never downgrade an
  existing `admin`/`editor`).
- `checkToolAccess` / `checkUserRegistration`: include `role` in the response.

## Security rules (this is the real enforcement)
Firestore and Storage writes must check the role server-side, e.g.:

```
function role() {
  return request.auth.token.email.matches('.*@epicgames.com$') ? 'editor'
    : get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role;
}
allow read: if request.auth != null;
allow write: if request.auth != null && role() in ['editor', 'admin'];
```

Any write that goes through a cloud function needs the same role check.

## Apps Script (apps-script/Code.gs)
Deployed as "Anyone" with no auth, so anyone with the URL can write or call
`clearAll`. Require a Firebase ID token and verify the role before writes, and
remove or protect `clearAll`.

## Tool repos
UE5LMSBlueprint, UE5ScenarioTracker, UE5QuestionGenerator, UE5LMSMaterials and
Unreal-Learning-Path-Tagging-System each need to hide create/edit/delete UI when
`role === "viewer"` (convenience only; the rules above enforce it).

## Firebase console
Add `samdeiter.github.io` to Authentication > Settings > Authorized domains if
it is not already listed.
