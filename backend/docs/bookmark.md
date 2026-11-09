# Local Markets backend bookmark

Estimated reading time: 1 minute (150 WPM)

## Current task

- Created `backend/compose.yaml`, Dockerfiles, and build-context exclusions for auth and listings. Each service loads its own `.env`; listing data uses a persistent volume. Usage is in `backend/README.md`.
- `docker compose config --quiet` passed. Builds and container startup remain unverified because the Docker daemon was unavailable. A local Node process already listens on port 3001 and must be stopped or otherwise accommodated before Compose can bind that port.
- Prior Google sign-in succeeded standalone. Frontend proxy integration remains unverified; Compose does not add a proxy. Keep credentials private; the auth-specific handoff is `backend/auth/bookmark.md`.
