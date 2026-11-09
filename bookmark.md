# Project Bookmark

Estimated reading time: 1 minute (150 WPM)

## Current task

Root Docker Compose for the frontend, auth, and listings services is running at `http://localhost:3000`.

- The user corrected the frontend and OAuth callback origin to port 3000; auth still listens on port 3001 inside Docker.
- The same-origin Compose smoke tests and Google redirect callback check passed. Live OAuth was not tested; the provider must register the port 3000 callback.
- The listings dependency audit reported one high-severity Zod advisory; it was not changed.

## Relevant paths

- `docs/session-context.md` — chronological project log.
- `bookmark.md` — current-task summary.
- `compose.yaml` — full-stack services.
- `frontend/Dockerfile` and `frontend/nginx.conf` — frontend build and API proxy.
- `README.md` and `tests/compose-smoke.test.mjs` — setup and smoke test.
