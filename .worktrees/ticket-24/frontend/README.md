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

Open the local URL printed by Vite (normally `http://localhost:5173/`) to browse listings.
The page requires the same-origin listings API; without it, it shows a retryable error.

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

## Public listing browse (task #19)

`src/listings/BrowsePage.tsx` is the buildable React/TypeScript page rendered at `/`.
It requests `GET /api/listings` with no request body, auth header, or CSRF token.
Session failure or signed-out state does not block browsing. Cards show the first
photo (or a missing/broken-photo fallback), title, numeric price and currency code,
and locality. Sold items are excluded defensively. Loading, empty, and retryable
failure states are included; API error bodies are not exposed to users.

Integration points for later tickets:

- `useListings()` in `src/listings/useListings.ts` exposes `items`, `isLoading`,
  `error`, and stable `refetch()`. Refetch clears the previous list while loading,
  handles errors, and cancels/ignores stale requests. Its promise resolves `true`
  on success or `false` on failure/cancellation; failure details appear in `error`.
- `ListingGrid` accepts those state values, `onRetry`, and optional
  `onOpenListing(listing)`. Later controls can compose the hook and grid without
  duplicating requests. Each hook instance owns its own list/request lifecycle.
- `App.jsx` owns one `useListings()` instance, passes it as the required `listings`
  prop to `BrowsePage`, and passes its `refetch` to the detail page for sold updates.
  `BrowsePage` also accepts `onOpenListing(listing)`. Cards link to
  `/listings/:id` (URL-encoded ID); the callback overrides ordinary navigation.
  Modified clicks retain link behavior. Task #21 implements the detail route;
  filters and search UI remain separate leaves.

The Vite build emits `dist/index.html` and hashed JS/CSS assets for runtime hosting.
Serve them alongside a same-origin `/api` proxy. No frontend credentials or
production fixtures are required. Live backend integration is unverified.

### Browse tests

```sh
npm test
npm run lint
npm run typecheck
npx playwright install chromium
npm run test:browser
```

The browser command builds the production page, starts a preview at
`http://127.0.0.1:4173/`, and closes it afterward. All listings/images/session
responses are test-only fixtures or intercepted requests. It checks desktop and
375px/320px mobile layouts, photos/fallbacks, keyboard access, public fetching,
loading, empty, error and retry states. Screenshots go to ignored `test-results/`.
Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only if tests must use an existing
Chromium executable. Node/jsdom tests additionally cover malformed responses,
network failures, callbacks, refetch state, cancellation, and stale responses.

Sign-in/logout, search/filters, and creation/publication remain separate tickets.
Sold controls are implemented below. OAuth and AWS deployment are unverified.

## Public listing detail (task #21)

Cards navigate to `/listings/:id` with a URL-encoded string ID. `App.jsx` selects
`ListingDetailPage.tsx` from the path using ordinary links (no new router dependency).
Direct URLs and browser back/forward work through full-page navigation. Production
hosting must serve `dist/index.html` for `/listings/*`, while proxying `/api/*` to the
backend. Vite preview/dev already provide the history fallback.

The detail page sends public `GET /api/listings/:id` with no body, auth header, or
CSRF token. It renders all photos, title, price/currency, description, category,
locality, seller name/public contact, and available/sold status. Missing/broken
photos have fallbacks. Loading, 404 missing, and other failures are distinct visible
states, with retry/refetch and a browse link. API messages are not exposed directly.
There are no create mutations or production fixtures; owner-only sold mutations are described below.

`useListingDetail(id)` in `src/listings/useListingDetail.ts` exposes:

- `listing`, `isLoading`, `isMissing`, and `error`.
- Stable `refetch()`, resolving after a handled success/failure; inspect state for
  the outcome. It clears old content while loading and cancels/ignores stale reads.
- Stable `updateListing(listing)` for a future control to supply a confirmed API
  result. It accepts only the current ID, cancels pending reads, and updates local
  state without an HTTP mutation. A different ID throws. Each hook instance owns
  its own state; future controls should receive these values/functions from the
  owning component, not instantiate a second hook expecting shared state.

Node fixtures cover request encoding/contract, 404, HTTP/network/malformed errors,
state/refetch/update, ID changes, stale responses, and unmount/StrictMode cleanup.
Run `npm run test:detail` for Playwright against the production build at
`http://127.0.0.1:4174/` (server is closed afterward). It verifies card opening and
direct access despite session failure, all fields/status/photos, desktop and
375px/320px mobile layouts, loading/missing/errors/retry, and photo fallbacks.
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` optionally selects an existing Chromium.
No new application environment variables are required. Live API, OAuth, and AWS
integration remain unverified.

## Owner-only mark sold (task #24)

At `/listings/:id`, `MarkSoldControl.tsx` uses the shared session identity and only
shows a control for an available listing whose seller ID matches the current user
ID. Signed-out, non-owner, loading, and failed-session states have no control.
Backend authorization is authoritative; displaying the button never grants access.

`markSoldService.ts` sends `PATCH /api/listings/:id` with `{ status: "sold" }`,
`Content-Type: application/json`, `X-CSRF-Token` from session state, and same-origin
cookie credentials. Only HTTP 200 with a matching, valid sold listing is accepted.
The control passes that result to the detail hook's `updateListing` interface, then
awaits the application-owned available-list `refetch`. Pending requests disable
repeat submissions; 400/401/403/404/network/malformed responses show safe retry
feedback without changing status or claiming success. A failed list refresh after
an accepted sale is reported separately: the item remains correctly marked sold.
Unmount cancels/ignores late responses; cancellation cannot undo a server mutation,
so revisit/refetch detail to resolve uncertainty after navigation or network loss.

Run `npm run test:sold` for Playwright fixtures against the production build at
`http://127.0.0.1:4175/`. The preview closes afterward. Tests cover identity gating,
pending states, exact request/CSRF headers, sold detail update, available-list
refresh/removal, request/authorization failures, malformed responses, retries, and
post-sale list refresh failure. Node tests cover service validation and the shared
list/detail interfaces, including unmount cancellation. No production fake login
or new application environment variables were introduced. Optional
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` selects a local Chromium for tests only.
Live backend authorization, OAuth, and AWS integration remain unverified.
