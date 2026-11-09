# Local Markets backend session context

Estimated reading time: 2 minutes (150 WPM)

## Working agreement

- Update this note after each prompt when relevant context, progress, or decisions change.
- Resume means review and note-taking only; do not start services, agents, implementation, or commits without a request.

## Current state

- Resumed from `backend/` on November 9, 2026. Reviewed both backend READMEs, the auth report, frontend README, relevant source, and neighboring factory notes. Working tree was clean before this note.
- Auth implements Google/Facebook OAuth, sessions, CSRF, and logout. Sessions and replay tracking use single-process memory by default.
- Listings provides public reads backed by a JSON file. The auth/CSRF guard protects writes, but create/sold handlers and ownership enforcement are missing; authorized writes return 404.
- Frontend mounts session and sign-in/logout controls. Its reusable create form is not mounted or connected to writes. Sign-in error feedback lacks an API-to-app handoff.
- Same-origin proxy/container wiring and live OAuth, HTTPS, and AWS deployment remain unverified. SSM forwarding alone does not establish OAuth compatibility.
- The auth report records a listings Zod audit finding; it has not been rechecked in this session. No tests were run during resume.
- The neighboring agent factories use this app as their workspace; their handoff says joint live testing remains unconfirmed. Do not start them just to resume.
