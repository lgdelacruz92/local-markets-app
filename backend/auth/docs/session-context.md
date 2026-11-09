# Auth session context

Estimated reading time: 11 minutes (150 WPM)

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

### November 9, 2026 — Google credentials saved

- User reports saving the new Google client JSON. Next: copy its client ID and secret into the private auth `.env` without sharing them in chat or committing the JSON.
- Client creation is implied by the saved JSON, but redirect registration and live OAuth are not independently verified.

### November 9, 2026 — Auth run command

- User asked how to run auth again. Provided the command that explicitly loads `.env`; service startup and credential configuration remain unconfirmed.

### November 9, 2026 — Frontend auth request reference

- Created executable `scripts/auth.sh` to print browser-side Google sign-in, session, and CSRF-protected logout examples. The callback runs through browser redirects; it is not a frontend API call.
- Checked script syntax, ShellCheck, and printed output. No service or live OAuth test was run; same-origin proxy wiring remains unverified.
- Correction: the user-modified `package.json` now makes `npm run dev` load `.env` explicitly; earlier notes describe its previous behavior.

### November 9, 2026 — Real curl auth checks

- User clarified they wanted actual curl requests to the local auth service, not a printed frontend reference. Replaced `scripts/auth.sh` with session and Google redirect checks, using a temporary private cookie jar.
- Script passed syntax and ShellCheck. Against the already-running service, the anonymous session succeeded and the Google start endpoint returned a 302 to Google. No end-to-end Google login or callback/proxy validation was performed.

### November 9, 2026 — Cookie file permissions

- Explained that `umask 077` prevents group and other users from getting permissions on newly created files, protecting the script's temporary cookie jar. `mktemp` also normally creates a private file.

### November 9, 2026 — Cookie jar cleanup

- Explained that the `EXIT` trap removes the temporary cookie jar when the shell exits normally or after a script error, but cannot run after an uncatchable kill or power loss.

### November 9, 2026 — Reading response chunks

- Explained that the stdin `data` handler appends each incoming text chunk to `body`, which accumulates the response until the `end` event; chunk boundaries are arbitrary.

### November 9, 2026 — Google redirect mismatch

- User reports a URL mismatch during Google authentication; exact error and registered Google redirect URI are not yet confirmed.
- Checked the running auth server: its authorization request uses `http://localhost:3000/api/auth/google/callback` and its client ID matches the current `.env`. No credential values or OAuth state were recorded.
- Next: inspect the new client's Authorized redirect URIs and compare the exact URI; request the redacted error if that is not the issue. Callback routing through port 3000 remains unverified.

### November 9, 2026 — Google mismatch follow-up

- User says the registered redirect URI matches and asks about account lockout from invalid requests. Explained that redirect mismatches are configuration errors, not failed passwords, while automated retries may trigger temporary limits or security checks.
- Exact error is still needed to continue diagnosis; avoid sharing credentials or full OAuth URLs.

### November 9, 2026 — Redirect mismatch confirmed

- User supplied Google error 400 `redirect_uri_mismatch`. The running server's client ID matches both the current `.env` and the saved Google client JSON; no credentials were displayed.
- The saved JSON's redirect URI list does not include `http://localhost:3000/api/auth/google/callback`. This JSON may be an old snapshot if the client was edited after download. User says the console URI matches; verify the same client and Authorized redirect URIs there.

### November 9, 2026 — Redirect port mismatch identified

- User clarified they changed the Google-registered redirect URI to port 3001 after downloading the JSON. The running service sends port 3000, explaining Google's mismatch.
- Instructed user to register the exact port 3000 callback; the callback still needs same-origin routing from port 3000 to auth. Google-side change and successful login are not yet confirmed.

### November 9, 2026 — Callback versus auth port

- User asked why curl uses port 3001 while Google redirects to port 3000. Explained that the configured callback uses the app origin, which needs a proxy to auth, or a standalone auth test can use port 3001 for both APP_URL and callback with matching Google registration.
- No configuration change or end-to-end test performed; with the standalone option the auth service's root page returns 404 and the same browser can check `/api/session` instead.

### November 9, 2026 — Auth root 404

- User reported the auth service's JSON `NOT_FOUND` response. Explained that this is expected at `/` after standalone sign-in but does not prove authentication; check `/api/session` in the same browser without sharing the CSRF token.

### November 9, 2026 — Session check clarification

- User replied "yes" to whether the session showed a user or null; the reply is ambiguous, so authentication is not yet confirmed.

### November 9, 2026 — Google sign-in confirmed

- User confirmed `/api/session` in the same browser returned a user containing their name after the standalone Google sign-in flow. The root 404 is expected because the auth service has no homepage.
- This confirms the standalone browser flow, not the separate app-on-port-3000 proxy integration.
