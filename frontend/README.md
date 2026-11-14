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

The root page displays **Local Markets** and loads public listings from
`GET /api/listings`, independently of sign-in state. For working API requests,
use the root Docker Compose setup at `http://localhost:3000`; Vite alone does not
provide the backend APIs.

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
**not** log out on the server. `LogoutControl` calls it only after HTTP 204 from
`POST /api/logout`. Refresh/reset/unmount prevent stale responses from
restoring old identities. Mutations must send the token in `X-CSRF-Token`.

Tests use Node's built-in test runner, React's `act`, and jsdom for provider lifecycle
checks. Identity fixtures and mocked HTTP responses exist only in `tests/`; there
is no production fake login. TypeScript checks cover the application source,
including `src/App.tsx` and `src/main.tsx`.

The root page includes authentication controls and public listing cards. Shared
session state (#16), logout (#18), and the reusable create-listing form (#22) are
implemented; other frontend leaves remain separate. Live OAuth and AWS deployment
remain unverified.

## Listings after sign-in

`src/App.tsx` always mounts `src/listings/ListingsSection.tsx`. The listings request
is not gated on session loading, login success, or session-check errors. A successful
OAuth callback returning to `/` therefore loads listings alongside the session.
Signed-in users see their account/logout control instead of the sign-in prompt;
logging out retains public listings.

`src/listings/listingsService.ts` reads the existing same-origin `GET /api/listings`
contract (`{ items: [...] }`) with cancellation and no-store caching. It validates
rendered fields and rejects duplicate IDs. The view displays title, price/currency,
description, locality, category, availability, seller name, and public contact. It
announces loading, provides an empty state, and shows safe error feedback with retry.
Requests are cancelled on unmount; obsolete responses cannot replace current data.
This view adds no dependencies, API routes, or environment variables, and does not
implement listing creation, filters, or a separate detail page. Listing photo browsing
is described below.

`npm test` covers the API contract and real root/session integration, including
successful login, anonymous browse, slow/failed session checks, logout, empty/error
states, retry, StrictMode cancellation, and late responses. Browser regression checks
use test-only API/provider routes on desktop and mobile:

```sh
node tests/browser/listings.mjs
# Optional system Chromium override:
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/listings.mjs
```

The script starts Vite on an ephemeral localhost port. It checks a simulated provider
callback returning to `/`, signed-in reload, logout, failure/retry, and empty state;
it does not verify live provider credentials or real OAuth cookies. Chromium must
be installed separately (for example, `npx playwright install chromium`).

## Listing photos

Listing cards on `/` render the existing API's `imageUrls` for both signed-in and
anonymous visitors. `ListingPhotoGallery.tsx` shows the first photo, previous/next
buttons with wraparound, numbered thumbnails, and a current-photo count. Focus the
gallery to use Left/Right arrow keys, or swipe horizontally on the image on mobile.
Vertical scrolling and pinch zoom remain available. The full-size link opens the
selected original image in a new tab for closer inspection.

Images are lazy-loaded and retain their entire composition with `object-fit: contain`.
Empty arrays show **No photos provided**. Loading and failed photos have explicit
feedback; failed photos can be retried without losing listing details, and buyers
can continue browsing other photos. Updating a listing's image URLs resets its gallery.
The service validates the required image array and accepts only absolute HTTP(S)
URLs, matching the backend contract. No photo uploads, placeholder product photos,
new dependencies, routes, or application environment variables were added.

Design references: [Meta's Marketplace overview](https://about.fb.com/news/2016/10/introducing-marketplace-buy-and-sell-with-your-local-community/)
(photo-first browsing) and [Facebook's selling guide](https://www.facebook.com/help/561376580709359)
(listing photos and cover photos). These inform the interaction, not a claim to
reproduce every Facebook feature.

`npm test` includes gallery navigation, loading/failure/retry, keyboard and synthetic
touch events, empty/single-photo states, URL validation, and signed-in photo rendering.
Desktop/mobile browser checks use deterministic test-only image responses:

```sh
node tests/browser/listing-photos.mjs
node tests/browser/listings.mjs
# Optional system Chromium override for either script:
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/listing-photos.mjs
```

The scripts start Vite on an ephemeral localhost port. They check actual image decoding,
photo controls, full-size navigation, loading/failure/retry, and photos after a simulated
OAuth return. Swipe is exercised with synthetic touch events, not a physical device.
Live OAuth, deployment, and third-party photo hosting availability remain unverified;
listing photo URLs must be publicly accessible and usable by the buyer's browser.

## Logout control (task #18)

`src/auth/LogoutControl.tsx` is mounted on `/` inside the shared session provider.
Only signed-in users see their display name and the Log out button. The control
sends a bodyless `POST /api/logout` with same-origin cookie credentials and the
in-memory `X-CSRF-Token` header. Only HTTP 204 resets shared identity and token;
no response body is read. It disables repeat clicks and announces pending state.
403, network errors, and unexpected statuses preserve identity, display actionable
failure feedback, and allow retry. A missing token disables the request and asks
for a page reload. Errors are logged with diagnostics; server error text is not
rendered. No credentials or tokens are persisted.

`npm test` covers the request contract and integration with the real provider,
including shared identity/token reset, pending duplicates, signed-out visibility,
missing tokens, 403/network failures, unexpected 200, and retry. Browser verification
uses only Playwright route fixtures against the real root page; it does not add a
production fake login or test route:

```sh
node tests/browser/logout.mjs
# Or use a system Chromium:
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/logout.mjs
```

The browser script starts its own localhost Vite server on an ephemeral port and
checks desktop/mobile behavior. No new application environment variables or
libraries are required. Live API cookie clearing and AWS/OAuth remain unverified.

## Provider sign-in initiation (task #17)

`src/auth/SignInPanel.tsx` is mounted on `/`. Its button-styled native links make
bodyless, same-origin `GET /api/auth/google/start` and
`GET /api/auth/facebook/start` navigation requests. The browser follows the 302
provider redirect in the current tab; there is no preflight fetch, duplicate start,
provider SDK, provider secret, or production fake login. Native links are used
instead of JavaScript buttons because this action is document navigation.
Session loading and logout remain owned by their separate modules.

A trusted caller can supply `failureStatus: 503 | 400 | 401 | null` to announce
unconfigured, invalid/expired, or rejected/cancelled feedback with `role="alert"`.
Retry links and **Continue without signing in** remain available. URL parameters
are not interpreted as authentication results. The root currently has no trusted
status source, so this feedback is a reusable interface, **not integrated live
error handling**. The agreed API returns JSON errors on navigation, with no
specified error redirect or app handoff. This missing feedback integration is a
blocker/incomplete item for review; no new endpoint or redirect convention was
invented. Recovery guidance explains 503/400/401 and returning with browser Back
(possibly more than once after provider navigation). `/` remains publicly reachable.

Tests are isolated from production authentication:

```sh
node --test tests/SignInPanel.test.js
node tests/browser/sign-in.mjs
# Optional system Chromium override:
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/browser/sign-in.mjs
```

The Playwright script starts Vite on an ephemeral `127.0.0.1` port and intercepts
both providers' start/callback routes and external test-only provider destinations.
It verifies GET/no body/document navigation, a single start request, external 302
navigation, callback 302 app return, 503/400/401 JSON responses, Back recovery, and
public root access at desktop/mobile sizes. A separate
`/tests/fixtures/sign-in.html` harness injects trusted statuses to verify the
panel's feedback, retry links, and browsing link; it does not claim an API-to-app
error handoff exists. The harness is excluded from the default production build.
The unit tests also check that untrusted URL parameters have no effect.
No new application environment variables or libraries are required.

Live OAuth, cookies, and AWS integration are unverified and deferred. A live
callback URL must be registered with each provider, reachable from the user's
browser under that provider's current redirect URI rules, and use HTTPS where
required by the provider and secure session cookies. Provider credentials belong
on the backend, never in Vite/browser environment variables. Local SSM forwarding
alone does not establish provider-compatible callback reachability or HTTPS.

## Create-listing form (task #22)

Atomicity check: pass. One reusable form, local validation, and a typed callback
contract are bounded work; authentication and API submission belong to #23.

Import `CreateListingForm` from `src/listings/CreateListingForm.tsx`. The caller
provides `onSubmit(values): void | Promise<void>`, and may pass `isSubmitting`
and `submissionError: string | null`. The form disables its fields while an
async callback or external submission is pending, displays errors, and retains
entries for retry. Rejected callbacks are logged and display a safe retry message.
The caller must clear its own `submissionError` when retrying and handle success
navigation or confirmation. This module makes no requests and does not use session
state; #23 owns mounting it in the seller UI and the authenticated write workflow.
There is no new production route in this leaf.

`ListingCreationValues` is exported from `src/listings/listingFormValidation.ts`:

```ts
{
  title: string; description: string; price: number; currency: string;
  category: string; locality: string; imageUrls: string[]; contact: string;
}
```

All fields except image URLs are required. Price must be finite and nonnegative
(zero is allowed). Currency is trimmed and normalized to a three-letter uppercase
code. Category and locality are free text. Optional image URLs use one absolute
HTTP(S) URL per line; blank lines are ignored and the callback receives a string
array. There are no uploads or remote image fetches. Seller contact is explicitly
labeled public; no private account contact is prefilled.

Node tests cover validation and the rendered callback/loading/error interface.
Playwright is a dev-only dependency; to run desktop/mobile browser checks:

```sh
npx playwright install chromium
npm run test:browser
# Or use a system Chromium:
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium npm run test:browser
```

The browser script starts and closes its own Vite server on an ephemeral localhost
port. `/tests/fixtures/create-listing.html` is a test-only harness with callback
controls, not a production entry point; it is excluded from the default build.
You can also inspect it using `npm run dev -- --host 127.0.0.1 --port 5173`.
No new application environment variables, authentication fixtures, or secrets are
introduced. Live `POST /api/listings` integration is not implemented or verified
here; the next leaf must use the session cookie and `X-CSRF-Token` contract.
