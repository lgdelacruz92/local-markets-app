# Frontend

A minimal React application for Local Markets, built with Vite.

## Getting started

Use Node.js 22.22.2+ (or Node.js 24.15+ LTS) and npm. The session tests
use native TypeScript type stripping and jsdom's supported Node versions.

```sh
cd frontend
npm install
npm run dev
```

Open the local URL printed by Vite to see **Hello world!**

## Checks and production build

```sh
npm test
npm run lint
npm run typecheck
npm run build
npm run preview
```

Production files are written to `dist/`.

## Shared session state (task #16)

The application root includes `SessionProvider`. Components beneath it can import
`useSession` from `src/session/useSession.ts` to read `user`, `csrfToken`,
`isLoading`, and `error`, or call `refreshSession()` and `resetSession()`.
Refresh resolves after success or a handled failure; inspect `error` rather than
assuming that a resolved refresh means the request succeeded.

The provider requests `GET /api/session` on mount, using the same-origin HTTP-only
session cookie and disabling response caching. Serve `/api` through the backend's
same-origin proxy for integration; the Vite dev server alone does not provide this API.
The response must be `{ user: { id, displayName } | null, csrfToken: string }`.
Identity and the CSRF token are held in memory only. Loading and failures clear
identity; a null user with no error after loading is confirmed signed-out state.
Request failures expose retry feedback without blocking public children.

`resetSession()` cancels pending requests and clears local identity/token; it does
**not** log out on the server. Future logout controls must call it only after a
successful backend logout. Refresh/reset/unmount prevent stale responses from
restoring old identities. Future mutations must send the token in `X-CSRF-Token`.

Tests use Node's built-in test runner, React's `act`, and jsdom for provider lifecycle
checks. Identity fixtures and mocked HTTP responses exist only in `tests/`; there
is no production fake login. TypeScript checks cover the new session module while
preserving the existing JavaScript app entry point.

This increment implements #16 only. The starter UI remains unchanged; #17–#24
(sign-in, logout, listings, filters, details, form, publication, and sold controls)
are incomplete. Live backend integration, OAuth, and AWS deployment are unverified.
