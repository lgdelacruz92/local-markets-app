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

The starter UI remains unchanged. Shared session state (#16) and the reusable
create-listing form (#22) are implemented; other frontend leaves remain separate.
Live backend integration, OAuth, and AWS deployment are unverified.

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
