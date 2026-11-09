# Auth project bookmark

Estimated reading time: 1 minute (150 WPM)

## Current task

- Step-by-step Google OAuth walkthrough on localhost. Audience is External and In production; user wants a new web client rather than reusing existing clients.
- Create the new web client with `http://localhost:3000/api/auth/google/callback` as its authorized redirect URI. Local config matches that example; creation not yet confirmed.
- Auth dev script does not load `.env` automatically; the user's startup result remains unconfirmed.
- Local `main` history was rewritten to remove `backend/auth/.env.example`; the local example is untracked. GitHub and `origin/main` retain the old history and the branches diverge.
- Existing project context and working agreement: `docs/session-context.md`.
