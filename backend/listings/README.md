# Public listings service — Task #8

Standalone Node.js/TypeScript + Express service. OAuth/session endpoints live in the separate `../auth` service (Task #7). This checkout has no public mutation handlers, uploads or AWS resources. All listing write paths are protected by the session/CSRF guard before reaching route handlers. Express, Zod, Supertest, tsx and TypeScript are free open-source libraries. Node's built-in test runner matches the existing frontend runner; Supertest exercises the actual HTTP routes.

## Run locally

Requires Node.js >=22 and npm:

```sh
cd backend/listings
npm ci
npm run build
npm start
# Alternatively: npm run dev
```

Defaults: `HOST=0.0.0.0`, `PORT=3002`, `LISTINGS_DATA_FILE=./data/listings.json` (relative to the working directory). For local-only access set `HOST=127.0.0.1`. No `.env` loader is installed: supply environment variables through the shell or runtime packaging. `.env.example` documents them.

On first startup a missing data file is initialized with four synthetic listings (three available, one sold). Existing valid data, including an empty array, is never reseeded. Invalid JSON, invalid listings, duplicate IDs or unreadable storage fail startup rather than destroy data. Directory creation/permissions must permit storage initialization. No production authentication bypass exists.

## Shared read contract

- `GET /api/listings` → `200 {items: Listing[]}`; available listings only.
- Optional `q`, `locality`, `category` are single string query parameters. Surrounding whitespace is ignored. `q` is a **case-insensitive literal substring** over title and description. `locality` is a **case-insensitive literal substring** over locality. `category` is a **case-insensitive exact match**. Filters combine with AND; blank filters mean no restriction. No match/unknown category gives `200 {items:[]}`. No regex matching.
- `q`/`locality` maximum 200 characters; `category` maximum 100. Duplicate, structured or unknown query parameters return `400 {error:{code:"INVALID_QUERY",message}}`.
- Categories remain strings per the shared contract; seed values are `furniture`, `sports`, `electronics`. Consumers should send canonical category strings; no new closed category enum is imposed.
- `GET /api/listings/:id` → `200 {listing: Listing}`. Sold items remain accessible by ID. IDs match exactly; absent IDs → `404 {error:{code:"LISTING_NOT_FOUND",message}}`.
- Other routes → JSON 404. Malformed URL encoding → JSON 400. Runtime read/schema failures → JSON 500 with no internal paths, data or stack trace.

```ts
Listing = {
  id: string, title: string, description: string,
  price: number, currency: string, category: string, locality: string,
  imageUrls: string[],
  seller: { id: string, displayName: string, contact: string },
  status: 'available' | 'sold', createdAt: string
}
Error = { error: { code: string, message: string } }
```

Prices are finite nonnegative numbers; currency uses uppercase three-letter codes; photos are HTTP(S) URLs; `createdAt` is an ISO timestamp. Contacts are deliberately public and seed contacts use `example.com`. Storage validation projects only contract fields (including seller), stripping provider tokens/extra properties from responses. No provider credentials are needed or read by this service. Ordering follows file order; pagination is not part of this prototype contract.

## Persistence/runtime handoff (#10 / #15)

The storage format is a UTF-8 JSON **array of Listing objects**, not an envelope or database. Runtime packaging should set `LISTINGS_DATA_FILE=/data/listings.json` and mount a named volume or durable bind directory at `/data` in the listings container. Mount the **directory**, not an individual file, because initialization and future atomic replacements require sibling temporary files. Keep service port 3002 internal; the same-origin proxy forwards `/api/listings` and `/api/listings/*` to this service without changing the paths.

Ensure the runtime service UID can read/write the mounted directory; newly seeded files use mode `0600`. Data survives service/process/container restart and image rebuild **only if this directory remains mounted**. Removing the volume or file destroys storage and causes new seed initialization. Back up the JSON file before manual edits. No external database, credentials or AWS settings are introduced by this ticket.

Seeding publishes a fully written/synced temporary file with an exclusive hard link on the same filesystem, preventing partial or overwritten seed files during concurrent initialization. Use a local filesystem supporting hard links (normal Docker/local Linux volumes); unsupported/read-only storage blocks startup. Disk reads validate on every request, so externally persisted changes become visible without restarting. Filesystem failure after startup returns 500 and does not silently reseed.

This is a small single-file prototype, **not a multi-writer database**. The write-service integration (#10) should serialize mutations in one writer and atomically rename fully written/synced sibling temporary files over the data file; do not truncate it in place while serving reads. That integration and its authorization are outside this read-only ticket. File size/whole-array reads are appropriate only for prototype scale; multi-writer scaling and power-loss recovery are not certified here. No existing backend/runtime implementation was present in this checkout to integrate or verify.

## Session / CSRF handoff — Task #7

Set `AUTH_SERVICE_URL` to a trusted internal HTTP(S) auth origin (default `http://127.0.0.1:3001`; containers commonly use `http://auth:3001`). `src/auth.ts` checks all POST/PUT/PATCH/DELETE `/api/listings` paths. No cookie/anonymous identity → 401; valid identity but missing/wrong `X-CSRF-Token` → 403; unavailable or malformed session authority → sanitized 503. Public reads never contact auth. The guard forwards Cookie only to the authority, validates `{user,csrfToken}`, and places trusted identity in `res.locals.user` for subsequent handlers. Never trust a submitted seller ID. Ownership enforcement remains the write handler's responsibility.

Auth integration, local/HTTPS cookie settings and callback prerequisites are in `../auth/README.md`. Actual create/sold handlers and runtime proxy files from tickets #10/#15 are absent in this checkout; valid authorized writes currently reach JSON 404. The shared 401/403 contract is implemented without inventing mutation endpoints. Internal verification requires one reachable auth authority and a five-second timeout; it fails closed on outages.

## Checks

```sh
npm run typecheck   # includes tests
npm run build
npm test
```

Tests use isolated temporary directories inside the service working directory, real filesystem persistence and Supertest HTTP calls (no database/third-party dependencies to mock). Covered: anonymous browse, availability, title/description search, locality, category, combined/empty/no-match filters, full available/sold details, missing IDs, invalid inputs, structured errors, idempotent/concurrent seeding, persisted edits and empty stores, corrupt/invalid data preservation, runtime storage failure, secret stripping and a real server-process restart.

AWS, live OAuth, React, create/sold mutations and container/volume deployment are explicitly not tested here: they are deferred or outside Task #8. Actual container mounting remains a runtime acceptance check, not a claimed pass from filesystem tests.
