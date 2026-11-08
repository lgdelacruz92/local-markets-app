# Task #7 completion report — Review

## Files modified

New:
- `backend/auth/.gitignore`
- `backend/auth/.env.example`
- `backend/auth/package.json`
- `backend/auth/package-lock.json`
- `backend/auth/tsconfig.json`
- `backend/auth/tsconfig.test.json`
- `backend/auth/src/config.ts`
- `backend/auth/src/providers.ts`
- `backend/auth/src/app.ts`
- `backend/auth/src/server.ts`
- `backend/auth/tests/auth.test.ts`
- `backend/auth/README.md`
- `backend/auth/IMPLEMENTATION_REPORT.md`
- `backend/listings/src/auth.ts`
- `backend/listings/tests/auth.test.ts`
- `backend/tests/auth-listings.test.mjs`

Updated:
- `backend/listings/.env.example`
- `backend/listings/README.md`
- `backend/listings/src/app.ts`
- `backend/listings/src/server.ts`
- `backend/listings/tests/listings.test.ts`

Builds also generated ignored `dist/` artifacts; npm installed ignored auth `node_modules/`. No secrets, fake login route or frontend bundle changes.

## Changes implemented

Separate Express/TypeScript auth service with environment configuration, Google/Facebook confidential OAuth clients using oauth4webapi, Google S256 PKCE, one-time expiring browser-bound state, safe failures, signed HTTP-only sessions, fixation-resistant regeneration, CSRF and server-side logout invalidation.

Endpoints added: `GET /api/auth/:provider/start`, `GET /api/auth/:provider/callback`, `GET /api/session`, `POST /api/logout`. Shared user/error envelopes and 302/400/401/403/503 semantics retained; provider outages use safe 502. Listings verifies authoritative session identity and CSRF before every POST/PUT/PATCH/DELETE listing path, passing identity in `res.locals.user`. Public reads remain independent. Cookie settings, callback reachability, HTTPS, env handling and runtime/consumer integration documented.

## Tests executed

Existing Node test runner + Supertest; controlled OAuth/fetch fixtures, real auth-to-listings HTTP test. Both services: `npm run typecheck`, `npm run build`, `npm test`. Integration: `node --test backend/tests/auth-listings.test.mjs`. Dependency audits: `npm audit` in both services. Used existing `/workspace/.tools/bin/node` wrapper and workspace npm CLI because node/npm are absent from default PATH.

## Test results

Both typechecks and builds: PASS. Final test run: **35 passed, 0 failed, 0 skipped**.

Auth tests (each PASS):
1. Anonymous stable/isolated HTTP-only uncached sessions.
2. Google callback identity/session/CSRF rotation and replay rejection.
3. Facebook callback identity/session/CSRF rotation and replay rejection.
4. Concurrent callback one-time state consumption.
5. Expired/forged cookies do not authenticate.
6. Missing required configuration fails startup actionably.
7. Logout CSRF, server-side invalidation and cookie clearing.
8. Missing/wrong/duplicate/cross-browser/cross-provider state rejection.
9. Ten-minute state expiry.
10. Malformed callbacks consume state without authenticating.
11. Provider denial/rejected exchange 401; sanitized outage 502.
12. Unconfigured/incomplete providers 503; unknown provider 400.
13. Secret/URL/origin/production HTTPS configuration validation.
14. Secure/HttpOnly/SameSite cookie behind trusted HTTPS proxy.
15. Actual Google adapter controlled token/profile fixtures and identity projection.
16. Actual Facebook adapter controlled token/profile fixtures and identity projection.
17. Actual adapter invalid state/token/profile rejection.

Listings guard tests (each PASS):
1. All write methods require authenticated identity before CSRF.
2. Missing/wrong/Unicode CSRF rejection.
3. Trusted identity, ignoring submitted seller/header identity.
4. Authority outage/malformed response fails closed safely.
5. Public read independence and unsafe auth-origin configuration rejection.

Existing listings tests (each PASS):
1. Public browse/schema/availability.
2. Literal case-insensitive title/description search.
3. Locality/category/combined filters.
4. Empty filters/unknown categories.
5. Full available/sold listing details.
6. Missing IDs/unknown routes/shared errors (write expectation updated to 401).
7. Invalid query/path inputs.
8. Idempotent concurrent seeding.
9. Persisted edits/empty stores/live reads.
10. Invalid existing data preservation/startup failure.
11. Safe storage errors/secret projection.
12. Real process restart/disk persistence.

Inter-service test (PASS): actual auth service HTTP session/CSRF verification by listings, tampered-cookie rejection, logout revocation, unchanged public reads. Valid writes pass guards but reach 404 because mutation handlers are absent.

Initial auth run: 13/14 passed, one malformed-path fixture expected 400 on an unmatched route that correctly returned 404. Corrected the fixture to use a malformed provider parameter; subsequent runs passed all tests. No unresolved test failures.

Auth audit: PASS, zero vulnerabilities. Listings audit: **FAIL**, one pre-existing high-severity Zod `<4.6.6` advisory GHSA-mrhx-c7xc-m3w5 (oversized collection memory exhaustion). npm proposes a breaking Zod 4 upgrade; no unreviewed major migration performed. This finding remains unresolved. Initial candidate Arctic install was deprecated; replaced with maintained oauth4webapi and removed its unsupported transitive dependencies before delivery.

## Skipped tests / blockers

- Live Google/Facebook sign-in: deferred, credentials/provider-console setup absent.
- AWS, deployed HTTPS/certificates, SSM, proxy/container reachability: deferred; runtime files absent. SSM forwarding is not OAuth compatibility proof.
- Actual create/sold mutations and owner enforcement: not verified or completed here because Task #10 handlers are absent from this checkout, despite related ticket status. Guards are mounted and tested; authorized writes currently return 404. Runtime Task #15 packaging is also absent; wiring remains documented handoff.
- Default MemoryStore/replay map is single-process, non-durable prototype only; sessions disappear on restart. Production scaling/storage/rate limits not certified.
- Pre-existing listings Zod security audit finding remains unresolved as detailed above.
- `git` is unavailable, so git status/diff/commit checks could not run. Files were inspected and both service builds/tests executed; no commit claimed.

## Easy

Existing Express/error contract and Node/Supertest runner were straightforward to reuse; public listing behavior remained stable.

## Difficult

Missing write/runtime implementations limited end-to-end completion; finding the usable workspace runtime, selecting a maintained OAuth library, and verifying state consumption/session regeneration across separate services took additional work.
