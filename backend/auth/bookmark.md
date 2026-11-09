# Auth project bookmark

Estimated reading time: 1 minute (150 WPM)

## Current task

- Walking through Google OAuth client integration one step at a time; user reports auth `npm run dev` fails after adding `.env`.
- The service already supports Google OAuth but needs a Google web client ID and secret, exact registered callback, and working same-origin routing.
- Dev script does not load `.env`; configuration-only checks failed without it and passed when explicitly loaded. The user's exact failure is unconfirmed; no service was started.
- Next: try `node --env-file=.env --import tsx src/server.ts` from `backend/auth/` and, if it fails, collect the redacted error.
- Local versus deployed testing remains undecided. Do not request or record credentials in project notes.
- Existing project context and working agreement: `docs/session-context.md`.
