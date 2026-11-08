# OAuth and session service — Task #7

Separate Node.js >=22 / TypeScript / Express service using maintained free open-source `oauth4webapi` and `express-session`. No password route, seeded authentication, production bypass, provider tokens in sessions, or credentials in client bundles.

## Local run

```sh
cd backend/auth
npm ci
cp .env.example .env
# Set APP_URL and a random SESSION_SECRET (at least 32 characters).
npm run build
node --env-file=.env dist/server.js
# Development with an env file: node --env-file=.env --import tsx src/server.ts
```

`npm start`/`npm run dev` read the supplied process environment; they do not implicitly load `.env`. Keep real `.env` files ignored. Defaults are `HOST=127.0.0.1`, `PORT=3001`. Missing/invalid APP_URL or SESSION_SECRET fails startup with variable-specific guidance, not secret values. Each provider requires its CLIENT_ID, CLIENT_SECRET and CALLBACK_URL; blank/incomplete configuration disables only that provider and returns actionable JSON 503. Callback URLs must share APP_URL's origin and use the exact provider callback path without query/fragment. No provider credentials are needed for anonymous sessions or public listings reads.

## Same-origin API contract

The browser uses relative `/api` URLs. Route `/api/auth/*`, `/api/session`, `/api/logout` unchanged to this service; route `/api/listings` and its descendants to listings (port 3002). Keep both service ports internal. React and the proxy must share the APP_URL origin; no wildcard CORS or separate browser auth origin is introduced.

- `GET /api/auth/:provider/start` (`google`/`facebook`): 302 provider authorization redirect; 503 unconfigured; 400 unsupported provider.
- `GET /api/auth/:provider/callback`: 302 to the configured APP_URL with a rotated HTTP-only session; 400 missing/invalid/expired/replayed/cross-provider state or malformed callback; 401 provider denial or rejected token/profile; 502 provider/network failure; 503 unconfigured. Callback error descriptions are never reflected. Failed sign-in does not create a new authenticated identity or discard a previously authenticated identity.
- `GET /api/session`: 200 `{user:{id,displayName}|null,csrfToken}`. Creates an anonymous session if needed. Stable CSRF per session, rotated on successful authentication. All auth responses use `Cache-Control: no-store`.
- `POST /api/logout`: no body; `X-CSRF-Token` must equal the session endpoint's token; 204 destroys the server session and clears the cookie; 403 invalid/missing CSRF. Old cookies no longer authenticate.
- Error envelope: `{error:{code,message}}`. Unknown routes return JSON 404; internal failures return sanitized JSON 500.

Provider identities are namespaced (`google:<id>`, `facebook:<id>`), not merged by email; only provider-validated ID and name are projected into sessions. Google uses authorization code + S256 PKCE and the profile scope; Facebook uses confidential-client authorization code and `public_profile`. Both use random browser-session-bound state, valid for ten minutes and consumed once before token exchange. Token exchange and profile fetch have ten-second timeouts. Access tokens exist only during the server exchange, never in URLs returned to the app, the cookie, browser JSON, or logs. Facebook endpoints currently target Graph API v22.0; confirm app/version support when live testing is authorized.

## Cookies, proxy and prototype limits

Cookie: `market.sid`, signed opaque session ID, HTTP-only, SameSite=Lax, host-only (no Domain), Path=/, eight-hour maximum age. Local HTTP uses `SESSION_COOKIE_SECURE=false` and `TRUST_PROXY=false`. HTTPS requires `SESSION_COOKIE_SECURE=true`. `NODE_ENV=production` refuses insecure cookies. With a single trusted HTTPS reverse proxy, use `TRUST_PROXY=true` so Express sees the forwarded scheme. Do not expose auth directly or trust arbitrary forwarded headers; a multi-hop proxy requires a separately reviewed trust configuration. Forward Cookie and Set-Cookie unchanged; never cache auth/session responses.

The default express-session MemoryStore and replay tracking are intentionally **single-process prototype only**. Sessions disappear on auth restart. Do not run multiple auth replicas; a durable shared session/replay store and resource/rate limits are follow-ups, not certified production infrastructure. All listings verification calls must reach this same authority. No shared browser-visible signing secret or client-supplied seller identity is trusted.

## Listings integration / consumer handoff

Set listings `AUTH_SERVICE_URL` to the **trusted internal auth origin**, e.g. `http://127.0.0.1:3001` locally or `http://auth:3001` inside a private container network. This must not be client-controlled or routed through a proxy back to listings. Listings forwards only Cookie to `/api/session`, validates the response and verifies X-CSRF-Token locally; never forwards auth service's Set-Cookie from this internal call. A signed session must authenticate before CSRF is checked: 401 unauthenticated, 403 invalid/missing CSRF, 503 unavailable/malformed authority. Public reads remain independent of auth.

`backend/listings/src/auth.ts` is mounted before all POST/PUT/PATCH/DELETE listing paths. Successful guards set `res.locals.user` to the verified `{id,displayName}`; create/sold handlers must use that ID, not request seller IDs, and separately enforce ownership. **This checkout contains only public listing read handlers, not Task #10's create/sold implementation.** Authorized writes still return 404; guard integration with actual mutation/ownership handlers cannot be claimed complete here. Consumer contract remains unchanged; this handoff identifies the trusted identity API for the missing write implementation. This checkout also has no Task #15 proxy/container files, so auth-service wiring is documented, not deployed.

## Callback reachability / deferred live checks

Register the exact full callback URLs in each provider console, along with applicable authorized app origins and test users/app mode. Local Google OAuth may accept registered localhost HTTP callbacks; Facebook typically requires HTTPS and provider-specific localhost/development allowances must be verified. For a private EC2 prototype, arrange a provider-accepted HTTPS hostname, valid certificate, same-origin proxy and a callback reachable by the **user's browser**. Backend needs outbound HTTPS to provider token/profile endpoints. Provider checks/allowlisting may also impose additional reachability constraints.

**SSM forwarding alone does not establish OAuth compatibility.** It supplies a private tunnel, not a provider-approved redirect hostname, HTTPS certificate, Facebook app approval or guaranteed callback reachability. Resolve these prerequisites before claiming successful live login. Credentials, AWS deployment, provider console configuration and live Google/Facebook verification are explicitly deferred.

## Checks

```sh
(cd backend/auth && npm run typecheck && npm run build && npm test)
(cd backend/listings && npm run typecheck && npm run build && npm test)
node --test backend/tests/auth-listings.test.mjs # requires both builds
(cd backend/auth && npm audit)
```

Run these from the repository root. Existing Node test runner and Supertest are retained. Controlled OAuth clients and fetch fixtures exercise both actual token/profile adapters without external credentials; inter-service test uses real auth HTTP and mocks only OAuth. Coverage includes sessions/cookies, CSRF/logout, session fixation/replay/expiry, invalid state/callbacks, denied authentication, unconfigured providers, safe failures, and listings authorization. Live OAuth, AWS/SSM/HTTPS deployment and actual create/sold handlers are not tested and are not claimed to pass.
