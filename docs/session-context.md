# Session Context

Estimated reading time: 2 minutes (150 WPM)

## 2026-11-09

- **Project init:** Started project notes in the repository root. The project has `backend/` and `frontend/` directories. No substantive task has been requested yet.
- **Full-stack Compose:** Added root `compose.yaml`, a frontend image and same-origin Nginx proxy, setup instructions, and an HTTP smoke test. Auth and listings images built and became healthy; a temporary frontend on another port passed the proxy/session/listings smoke test. The regular frontend cannot start because a pre-existing standalone auth process occupies port 3001, which matches the existing OAuth callback origin. Awaiting the user's choice before stopping it or changing the origin. Frontend and auth unit tests passed; listings unit tests could not run locally because its development dependencies are not installed.
- **Port conflict resolved:** With the user's permission, stopped the standalone auth process and started the Compose stack on port 3001. The regular same-origin smoke test passed. Listings unit tests also passed in an isolated container. Its existing dependency audit reports one high-severity Zod advisory; no dependency changes were made. Live OAuth was not tested.
- **Frontend port correction:** The user clarified that port 3001 was only for callback testing. Updated the frontend's host port and auth app/Google callback URLs to localhost:3000; the Facebook callback already used port 3000. Rebuilt and restarted the stack, updated setup instructions and smoke tests, and verified API routing plus the configured Google authorization redirect. Live OAuth remains untested.
