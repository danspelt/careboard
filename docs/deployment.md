# CareBoard deployment and operations

This document explains how to deploy and operate CareBoard in production. For architecture and security details, see [architecture.md](architecture.md). For authentication setup, see [AUTH_SETUP.md](../AUTH_SETUP.md).

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | Yes | At least 32-character random string used by Auth.js to sign sessions. |
| `AUTH_URL` | Yes | Public HTTPS origin of the deployment (e.g. `https://care.example.com`). `http://localhost` and `http://127.0.0.1` are accepted only in development. |
| `CAREBOARD_OWNER_EMAIL` | Yes | Email address that owns the manager account. |
| `CAREBOARD_OWNER_MEMBER_ID` | No | Manager member ID. Defaults to `member-manager`. |
| `AUTH_GOOGLE_ID` | For Google OAuth | Google OAuth client ID. |
| `AUTH_GOOGLE_SECRET` | For Google OAuth | Google OAuth client secret. |
| `CAREBOARD_MEMBER_EMAILS` | No | JSON map of approved worker emails to existing member IDs. Example: `{"worker@example.com":"member-123"}`. |
| `DATABASE_PATH` | No | SQLite file path. Defaults to `data/careboard.db` in development and `/data/careboard.db` in the Docker image. |
| `UPLOAD_PATH` | No | Directory for authenticated uploads. Defaults to `/data/uploads` in the Docker image. |
| `PORT` | No | Listening port. The Docker image defaults to `3000`. |

Do not commit secrets or `.env` files to version control. Rotate `AUTH_SECRET` only after invalidating existing sessions.

## Docker

### Build

```bash
docker build -t careboard .
```

The Dockerfile uses a multi-stage build:

1. `dependencies` — installs native-compiled npm dependencies.
2. `builder` — copies source and runs `npm run build`.
3. `runner` — drops to a non-root `nextjs` user and exposes port `3000`.

### Run with a persistent volume

```bash
docker run --rm -p 3000:3000 \
  -v careboard-data:/data \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_URL="https://care.example.com" \
  -e CAREBOARD_OWNER_EMAIL="manager@example.com" \
  -e AUTH_GOOGLE_ID="..." \
  -e AUTH_GOOGLE_SECRET="..." \
  careboard
```

Mount a persistent volume at `/data`. The image creates `/data/uploads` and sets ownership to the application user. Both the SQLite database and the uploaded photos live in this volume, so they survive image updates and redeploys.

### Docker Compose example

```yaml
services:
  careboard:
    image: careboard
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - careboard-data:/data
    environment:
      AUTH_SECRET: "${AUTH_SECRET}"
      AUTH_URL: "https://care.example.com"
      CAREBOARD_OWNER_EMAIL: "manager@example.com"
      AUTH_GOOGLE_ID: "${AUTH_GOOGLE_ID}"
      AUTH_GOOGLE_SECRET: "${AUTH_GOOGLE_SECRET}"
      DATABASE_PATH: /data/careboard.db
      UPLOAD_PATH: /data/uploads

volumes:
  careboard-data:
```

## Coolify

1. Push the repository to a Git provider connected to Coolify.
2. Create a **New Service** → **Git Repository** and select the CareBoard repository.
3. In **Build Configuration**, confirm the Dockerfile path is `Dockerfile`.
4. In **Environment Variables**, add the variables from the table above. Do not wrap `AUTH_SECRET` in quotes.
5. In **Persistent Storage**, mount a volume to `/data`.
6. Expose port `3000` and configure your Coolify domain or custom HTTPS origin.
7. Set `AUTH_URL` to the exact public origin (e.g. `https://care.example.com`).
8. Deploy. The container applies migrations automatically and starts on port `3000`.

After the first deploy, sign in with the manager email configured in `CAREBOARD_OWNER_EMAIL` to create the seeded manager profile, then add workers from the dashboard.

## Upload retention and privacy

- Profile and task proof photos are stored under `UPLOAD_PATH` (default `/data/uploads`).
- Photos are retained for a fixed 90-day period. Older uploads are removed from disk and from the `proof_photos` table automatically during household state loads.
- The upload directory must never be served as a static folder. Photos are returned only by `/api/uploads/[id]`, which verifies that the requester owns the upload or is a manager.

## Operations

### Health checks

The image includes a `HEALTHCHECK` that hits `/api/health` every 30 seconds. In Coolify, you can use the same endpoint for your service health probe.

### Backups

Back up the persistent `/data` volume regularly. The SQLite database and uploaded photos are ordinary files, so any volume snapshot or file-level backup tool works. Example with `docker exec`:

```bash
# Create a timestamped backup
docker exec <container> sqlite3 /data/careboard.db ".backup /data/careboard-backup-$(date +%F).db"
# Copy it out
docker cp <container>:/data/careboard-backup-YYYY-MM-DD.db .
```

### Migrations

Migrations run automatically when the application starts and the database is opened. If you ever need to apply migrations manually inside a container:

```bash
docker exec <container> node -e "require('./.next/standalone/node_modules/better-sqlite3')('/data/careboard.db')"
```

This is rarely needed because `getD1()` in `db/index.ts` applies pending migrations on every startup.

### Scaling considerations

CareBoard is designed for a single household with a modest number of workers and tasks. SQLite works well for a single-instance deployment. Running multiple containers against the same SQLite file over a network filesystem is not recommended; if you need horizontal scaling, migrate to a client/server database and update `db/index.ts` accordingly.

## Troubleshooting

### "Sign-in could not be completed"

- Verify `AUTH_SECRET` is at least 32 characters.
- Verify `AUTH_URL` matches the public origin and uses `https://` in production.
- Verify `CAREBOARD_OWNER_EMAIL` is set to a valid email.
- For Google sign-in, verify `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- Check that the worker email exists in `google_accounts` or in `CAREBOARD_MEMBER_EMAILS`.

### "Household access denied"

- The signed-in email does not map to an active member profile.
- The account may have been disabled by the manager.
- Workers must be added from the manager dashboard; signing in with Google alone does not create a profile.

### Photos are missing after redeploy

- Confirm a persistent volume is mounted at `/data`.
- Confirm `UPLOAD_PATH` is `/data/uploads` and `DATABASE_PATH` is `/data/careboard.db`.
- Ensure the upload directory is not being wiped by a rebuild or ephemeral storage.

### Database migrations fail

- Check that the `drizzle/` directory is present in the built image.
- Check container logs for the specific migration file reported missing.
- Ensure the application has write access to the database directory.

### Health check fails

- Verify the container is listening on `0.0.0.0:3000`.
- Verify the `PORT` environment variable is `3000` or unset.
- Check that `/data` is writable so the database can be created.

## Security checklist

- [ ] `AUTH_SECRET` is randomly generated and at least 32 characters.
- [ ] `AUTH_URL` uses `https://` in production.
- [ ] Secrets are stored in Coolify or your orchestrator, not in the repository.
- [ ] A persistent volume is mounted at `/data`.
- [ ] The upload directory is not exposed by a reverse proxy or static file server.
- [ ] The public origin is the only origin allowed by your OAuth provider callback.
- [ ] Regular backups of `/data` are scheduled.
