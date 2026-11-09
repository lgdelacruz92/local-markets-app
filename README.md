# Local Markets

Estimated reading time: 2 minutes (150 WPM)

## Run the whole app

Start Docker and configure `backend/auth/.env`. If it does not exist, copy `backend/auth/.env.example`, set `APP_URL=http://localhost:3000/`, and generate a random `SESSION_SECRET` of at least 32 characters. For each OAuth provider you use, set its credentials and a callback URL on the same origin, such as `http://localhost:3000/api/auth/google/callback`. Register that exact callback with the provider. Providers without complete configuration remain disabled; anonymous access still works.

From the repository root:

```sh
docker compose up --build -d
docker compose ps
docker compose logs -f
node --test tests/compose-smoke.test.mjs
docker compose down
```

Open `http://localhost:3000`. The frontend proxies API requests to the private auth and listings containers. Listing data persists in a named Docker volume across rebuilds and ordinary `docker compose down`; removing the volume deletes that data. Auth sessions are in memory and disappear when auth restarts.

This is a local HTTP prototype, not a production HTTPS deployment. The current frontend is a basic page, and the listings API currently supports reads but not listing creation or updates. Live OAuth depends on provider configuration and callback rules.
