# Auth project bookmark

Estimated reading time: 2 minutes (150 WPM)

## Current task

- User confirmed standalone Google sign-in succeeded: `/api/session` showed a user with their name in the same browser. The auth service's root 404 is expected.
- The earlier redirect port mismatch was overcome in the standalone flow. App integration through a port 3000 proxy remains unverified.
- Running server's client ID matches `.env` and the saved Google client JSON; never share or commit credentials.
- Audience is External and In production. User saved the new Google client JSON; never share or commit credentials.
- Updated `scripts/auth.sh` to make real curl requests to `localhost:3001`, correcting the earlier reference-only script. Anonymous session and Google 302 checks passed against the running service; syntax and ShellCheck passed.
- Explained `umask 077`: it restricts permissions on new files, including the temporary cookie jar; `mktemp` normally makes that file private too.
- Explained the `EXIT` trap cleans up the cookie jar on normal exit or script error; it cannot run after an uncatchable kill or power loss.
- Explained the Node stdin `data` handler accumulates response chunks in `body` until the `end` event.
- Curl's cookie is separate from the browser session. User-modified `npm run dev` loads `.env`.
- Local `main` history was rewritten to remove `backend/auth/.env.example`; the local example is untracked. GitHub and `origin/main` retain the old history and the branches diverge.
- Existing project context and working agreement: `docs/session-context.md`.
