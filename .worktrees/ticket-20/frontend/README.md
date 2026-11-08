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
  `error`, and stable `refetch(filters?)`. Refetch clears the previous list while loading,
  handles errors, and cancels/ignores stale requests. Its promise resolves after
  a handled success or failure; inspect `error`, not just promise completion.
- `ListingGrid` accepts those state values, `onRetry`, and optional
  `onOpenListing(listing)`. Later controls can compose the hook and grid without
  duplicating requests. Each hook instance owns its own list/request lifecycle.
- `BrowsePage` also accepts `onOpenListing(listing)`. Cards link to
  `/listings/:id` (URL-encoded ID); the callback overrides ordinary navigation.
  Modified clicks retain link behavior. These URLs are reserved for the later
  detail ticket; no detail route is implemented here.

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

## Search and filters (task #20)

At `/`, labelled Search, Locality and Category controls work on desktop and mobile.
Typing edits drafts without requesting the API; submit with Apply filters or Enter.
Requests use `GET /api/listings?q=...&locality=...&category=...`, with no body.
`URLSearchParams` encodes values; outer whitespace is trimmed and blank parameters
are omitted. Case is preserved for server-side text matching. Clear filters resets
all inputs and immediately reloads `/api/listings`, even during a pending request.
Refresh and retry retain the last applied values, not unsaved input edits.

Category is a string in the shared API contract, with no enum or category-list
endpoint. The category input therefore offers a native datalist of exact category
values from current API listings, deduplicated and sorted, while allowing typed
values for categories not currently returned. No frontend-only category taxonomy
or local search/locality/category matching is introduced.

`ListingFilters.tsx` owns draft inputs and emits filters through `onApply`.
`useListings.refetch(filters)` applies new values; `refetch()` reuses them and
`refetch({})` clears them. The existing `ListingGrid`/cards still own all loading,
empty, error and result presentation. Aborted/stale requests cannot replace newer
results. No additional dependencies or environment variables are required.

Service tests check individual/combined query values, Unicode/reserved-character
encoding and omission of blank filters. Browser fixtures verify server-returned
result updates, combined filters, Enter submit, clear (including while loading),
refresh/retry with edited drafts, filtered empty/error states, and responsive
controls at 1280px, 375px and 320px. Filter screenshots are saved to ignored
`test-results/filters-*.png`. These checks use test-only API fixtures; live API
integration, OAuth and AWS deployment remain unverified/deferred.

Sign-in/logout, detail UI, creation/publication, and sold controls remain separate
tickets.
