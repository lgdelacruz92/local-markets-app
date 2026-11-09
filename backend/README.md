# Local Markets backend

Estimated reading time: 1 minute (150 WPM)

## Run with Docker Compose

Docker must be running. Provide `auth/.env` and `listings/.env`; for listings, copy `listings/.env.example` if needed. Configure the auth app URL, session secret, and provider credentials in `auth/.env` before starting.

From `backend/`:

```sh
docker compose up --build -d
docker compose logs -f
docker compose down
```

Auth is available at `http://localhost:3001` and listings at `http://localhost:3002`, on this machine only. Compose overrides the service host and port, the listings auth URL, and the listings data path for container networking. Listing data persists in the `listings-data` volume across ordinary restarts and `docker compose down`.

OAuth callback and app URLs must still match the provider registration. This setup does not add the frontend or a same-origin proxy. Auth sessions remain in memory and disappear when auth restarts.
