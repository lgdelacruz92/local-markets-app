# Auth session context

Estimated reading time: 5 minutes (150 WPM)

## Working agreement

- Resume is context gathering and note-taking only; do not start services, agents, implementation, or commits without a request.
- Update this note and the backend session note when relevant context, progress, or decisions change.

## Current state

- Resumed from `backend/auth/` on November 9, 2026. Reviewed the auth handoff, configuration, service and provider code, listings integration, and frontend handoff. No tests were run.
- Google/Facebook OAuth, sessions, CSRF, and logout are implemented. Sessions and replay tracking are single-process and in memory by default.
- `.env.example` contains a fixed session secret; replace it with a newly generated secret before use. Provider credentials and live OAuth remain deferred.
- Listings protects writes with auth and CSRF, but create/sold handlers and ownership enforcement are absent; authorized writes return 404.
- Same-origin proxy/container wiring, HTTPS, AWS deployment, and live provider callbacks remain unverified. SSM forwarding alone does not prove OAuth compatibility.
- The auth report records a listings Zod audit finding; it has not been rechecked. Frontend sign-in error handoff is also incomplete.

## Session log

### November 9, 2026 — Project init

- Initialized ongoing notes in `backend/auth/`. Future prompts in this session will be recorded here and reflected in `bookmark.md`.
- No new substantive task was requested. Existing context and the working agreement remain in effect; no implementation or tests were started.

### November 9, 2026 — Google sign-in discussion

- Discussed the high-level Google OAuth setup: cloud project and consent screen, web client and exact callback, server-only credentials, same-origin routing, and live verification.
- Local versus deployed testing is undecided. No credentials were created, configuration changed, services started, or live tests run.

### November 9, 2026 — Step-by-step setup

- User wants to go through Google sign-in integration one step at a time. First decision: test locally or on the deployed app.

### November 9, 2026 — Dev startup investigation

- User added `.env` and reported `npm run dev` failing; their exact error is not yet known.
- The dev script does not load `.env` automatically. A configuration-only check failed without loading the file and succeeded with Node's `--env-file=.env`; no service was started and no secrets were recorded.
- Suggested starting with `node --env-file=.env --import tsx src/server.ts` from `backend/auth/`; awaiting the user's result.

### November 9, 2026 — Remove example env from Git history

- User requested removal of `backend/auth/.env.example` from Git history. It appears in commits reachable from `origin/main`, and local `main` is one commit ahead.
- No history was rewritten or pushed. Awaiting direction on the published history; preserve the local `.env` and avoid recording secrets.

### November 9, 2026 — Local history rewritten

- User chose local history only. Rewrote local `main` to remove `backend/auth/.env.example` from its history; verified the path no longer appears in that branch's log.
- Preserved `.env` and `.env.example` on disk; the example is now untracked. No push was performed. `origin/main`, GitHub, and local reflogs can still retain the old history; local `main` now diverges from `origin/main`.

### November 9, 2026 — Resume Google setup

- User asked to continue the step-by-step Google sign-in setup. Assuming localhost for the walkthrough; first check whether a Google Cloud project already exists.
- Auth dev startup outcome remains unconfirmed. No Google configuration or live test has been verified.

### November 9, 2026 — Google Cloud project

- User has an existing Google Cloud project and is signed in on the Cloud Console welcome page. Next: select that project before configuring OAuth.

### November 9, 2026 — Project selected

- User selected their Google Cloud project. Next: open Google Auth Platform and check whether its consent setup has already been configured.

### November 9, 2026 — Google Auth dashboard

- User sees the Google Auth Platform dashboard. Next: inspect Audience user type and publishing status before deciding whether a test user is needed.

### November 9, 2026 — Dashboard correction

- User described project info, APIs, and resources tiles; this appears to be the general Cloud Console dashboard rather than Google Auth Platform. Direct them to Auth Platform before checking Audience.

### November 9, 2026 — Auth Platform opened

- User now sees traffic and error metrics, consistent with the Google Auth Platform dashboard. Next: check Audience settings.

### November 9, 2026 — Audience status

- User reports Google Auth Platform audience is External and publishing status is In production. Leave existing settings unchanged; inspect Clients before creating a separate web client.

### November 9, 2026 — New Google client

- User wants a new OAuth client rather than using the existing 2024 clients. Directed them to create a Web application client and register the localhost callback.
- Checked only that local app origin and Google callback match the example; no credential values were displayed or recorded. Client creation is not yet confirmed.
