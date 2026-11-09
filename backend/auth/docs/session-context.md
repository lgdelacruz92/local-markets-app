# Auth session context

Estimated reading time: 2 minutes (150 WPM)

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
