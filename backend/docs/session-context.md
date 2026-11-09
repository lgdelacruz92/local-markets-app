# Local Markets backend session context

Estimated reading time: 8 minutes (150 WPM)

## Working agreement

- Update this note after each prompt when relevant context, progress, or decisions change.
- Resume means review and note-taking only; do not start services, agents, implementation, or commits without a request.
- Keep the backend task bookmark in `backend/docs/bookmark.md`.

## Current state

- Resumed from `backend/` on November 9, 2026. Reviewed both backend READMEs, the auth report, frontend README, relevant source, and neighboring factory notes. Working tree was clean before this note.
- Auth implements Google/Facebook OAuth, sessions, CSRF, and logout. Sessions and replay tracking use single-process memory by default.
- Listings provides public reads backed by a JSON file. The auth/CSRF guard protects writes, but create/sold handlers and ownership enforcement are missing; authorized writes return 404.
- Frontend mounts session and sign-in/logout controls. Its reusable create form is not mounted or connected to writes. Sign-in error feedback lacks an API-to-app handoff.
- Same-origin proxy/container wiring and live OAuth, HTTPS, and AWS deployment remain unverified. SSM forwarding alone does not establish OAuth compatibility.
- The auth report records a listings Zod audit finding; it has not been rechecked in this session. No tests were run during resume.
- The neighboring agent factories use this app as their workspace; their handoff says joint live testing remains unconfirmed. Do not start them just to resume.
- Resumed from `backend/auth/` on November 9, 2026; auth-specific context is in `auth/docs/session-context.md`. Its `.env.example` contains a fixed session secret that must be replaced before use.
- Discussed Google OAuth setup at a high level; local versus deployed testing is undecided. No credentials, configuration changes, or live tests yet.
- User wants a step-by-step walkthrough, beginning with the choice of testing environment.
- Auth dev startup was reported failing after adding `.env`; the dev script does not load that file automatically. Configuration-only checks passed when it was explicitly loaded; the user's exact error is unconfirmed.
- User requested removal of `auth/.env.example` from Git history. It is already in `origin/main`; no history rewrite or push has been performed while published-history handling is clarified.
- User chose local-only history removal. Local `main` was rewritten and verified; GitHub and `origin/main` were not changed. Both local env files remain; the example is untracked and the branches diverge.
- User resumed the step-by-step Google OAuth walkthrough, provisionally targeting localhost. Auth startup and Google configuration remain unverified.
- User has an existing Google Cloud project and is signed in to Cloud Console; project selection is the next step.
- User selected the Google Cloud project; Google Auth Platform consent setup is next.
- Google Auth Platform dashboard is visible; checking audience and publishing status next.
- Correction: the described tiles appear to be the general Cloud Console dashboard, not Google Auth Platform; navigate there first.
- User reached the Auth Platform metrics dashboard; checking Audience settings next.
- Google Auth Platform audience is External and In production; next inspect OAuth clients without changing existing settings.
- User wants a new Google web client; the local app origin and Google callback match the localhost example. Client creation is not yet confirmed.
- User reports saving the Google client JSON; private `.env` configuration is next. Credentials and live OAuth have not been independently verified.
- Created `auth/scripts/auth.sh` to print frontend Google sign-in, session, and logout examples. Shell checks passed; no live OAuth or proxy test was run. Auth `npm run dev` now loads `.env` in the user-modified package script.
- Correction: `auth/scripts/auth.sh` now makes real curl requests. Against the running auth service, the anonymous session and Google 302 redirect checks passed; full Google login and callback routing remain unverified.
- User reports a Google OAuth URL mismatch. The running auth server sends the localhost:3000 Google callback and uses the client ID in the current `.env`; the Google-side registration and exact error remain unconfirmed.
- User says the registered callback matches. Exact Google error is still needed; discussed that redirect mismatches are not failed passwords, though rapid retries can trigger temporary limits or security checks.
- Google error is 400 `redirect_uri_mismatch`. The running client ID matches both `.env` and saved client JSON, but that JSON does not list the callback; the JSON may predate console edits. Verify the exact URI on the same Google client.
- User clarified Google was configured with a port 3001 callback while the server sends port 3000. Registering the port 3000 callback is the next step; callback proxy routing is still unverified.
- Discussed a standalone port 3001 auth test as an alternative: change both APP_URL and callback to that origin and register the same callback with Google. No option has been chosen or configured yet.
- User reports an auth `NOT_FOUND` JSON response; root 404 can be expected after standalone login, but the same browser's session must be checked to confirm authentication.
- User confirmed the same browser's session returned their name after standalone Google sign-in. The separate app-on-port-3000 proxy integration remains unverified.

## November 9, 2026 — Backend resume

- Resumed from `backend/`; reviewed the backend and auth notes, service source and configuration, frontend proxy configuration, and existing auth script. No tests or services were run.
- Standalone Google sign-in was confirmed by the user in the prior session. Frontend-to-auth proxy integration remains unverified; Vite has no proxy configured. Listings writes and ownership enforcement remain unimplemented.
- Auth `npm run dev` loads `.env`, contrary to the auth README. The curl script's callback instructions assume port 3000; the actual callback is configuration-dependent. No credentials were inspected or recorded.
- Local `main` and the local `origin/main` tracking ref currently point to the same commit, contrary to the older divergence note; GitHub was not contacted and its current state was not checked. Existing working-tree changes were preserved.

### Bookmark location correction

- User requested the backend bookmark in `docs/`; moved it to `backend/docs/bookmark.md` and preserved the current task.

### Docker Compose for backend services

- User requested a simple Compose startup for auth and listings, each using its own `.env`. Added `backend/compose.yaml`, service Dockerfiles, restricted build contexts, and `backend/README.md`. Created ignored `listings/.env` from its example; preserved `auth/.env` without inspecting credentials.
- Compose binds the services to localhost ports 3001 and 3002, uses the internal auth hostname for listings, and persists listings in a named volume. It does not add a frontend proxy; OAuth callback configuration remains separate.
- `docker compose config --quiet` passed and both env files are ignored by Git. Docker daemon was unavailable, so image builds and service startup were not tested. An existing Node process is listening on port 3001; it was not stopped. The startup command is `docker compose up --build -d`.
