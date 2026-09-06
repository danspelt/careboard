# CareBoard

CareBoard is a private household chore tracker for coordinating care workers. A manager creates and assigns tasks; each worker sees only their own eligible work and available open tasks. The activity log records who handled each task and when.

## Features

- **Manager dashboard**: create, assign, edit, and complete household tasks; manage workers; export monthly CSV reports; review an append-only audit log.
- **Worker dashboard**: claim open tasks, start assigned work, complete in-progress tasks, upload proof photos, and edit a limited self-service profile.
- **Security-first roles**: workers cannot see other workers' profiles, tasks, reports, or audit data. Disabled workers are blocked on every request, so an existing session cannot retain access.
- **Privacy by default**: profile photos and task proof photos are retained for a fixed 90-day period, served only through authenticated ownership-checked routes, and never exposed as static files.
- **Progressive Web App**: installable manifest and service worker support for offline shell pages.

## Technology

- Next.js 16 with the App Router and React 19
- TypeScript and Tailwind CSS 4 with shadcn/ui Base UI components
- Auth.js 5 (NextAuth.js beta) with Google OAuth and credential sign-in
- SQLite via `better-sqlite3` with Drizzle-style SQL migrations
- Docker image based on `node:22-bookworm-slim` with Next.js standalone output

## Requirements

- Node.js 22.13.0 or later
- npm 10 or later
- Optional: Docker for containerized local runs and Coolify deployments

## Local development

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file with the minimum authentication environment:

   ```bash
   AUTH_SECRET="$(openssl rand -base64 32)"
   AUTH_URL="http://localhost:3000"
   CAREBOARD_OWNER_EMAIL="manager@example.com"
   ```

   For Google sign-in, also add `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
   See [AUTH_SETUP.md](AUTH_SETUP.md) for the full authentication guide.

3. Run the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

   The first request automatically creates the SQLite database at `data/careboard.db`, applies migrations, and seeds a manager profile. Sign in with the email configured in `CAREBOARD_OWNER_EMAIL`.

## Build and test

Run the project verification suite before any code is considered complete:

```bash
node --test tests/*.test.mjs
npm run lint
npm run build
```

## Docker

Build and run locally with a persistent `/data` volume:

```bash
docker build -t careboard .
docker run --rm -p 3000:3000 \
  -v "$(pwd)/data:/data" \
  -e AUTH_SECRET="$(openssl rand -base64 32)" \
  -e AUTH_URL="http://localhost:3000" \
  -e CAREBOARD_OWNER_EMAIL="manager@example.com" \
  careboard
```

The image creates `/data/uploads` for authenticated proof photos and uses `/data/careboard.db` as the default database path. Mount a persistent volume at `/data` so the SQLite database and uploads survive container restarts.

## Coolify deployment

1. Push the repository to your Git provider.
2. In Coolify, create a new service from your Git repository.
3. Set the required environment variables in Coolify:
   - `AUTH_SECRET`: at least 32 characters
   - `AUTH_URL`: the public HTTPS origin (e.g. `https://care.example.com`)
   - `CAREBOARD_OWNER_EMAIL`: the manager's email address
   - `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` if using Google OAuth
   - `DATABASE_PATH=/data/careboard.db`
   - `UPLOAD_PATH=/data/uploads`
4. Mount a persistent volume at `/data`.
5. Expose port `3000`.
6. Deploy. The container starts with migrations applied automatically.

See [docs/deployment.md](docs/deployment.md) for detailed architecture and operations documentation.

## Project structure

```text
app/              Next.js App Router pages and the interactive dashboard component
components/ui/    shadcn/ui Base UI components
lib/              Business logic: access policies, auth config, household operations
 db/              SQLite adapter, migration runner, and database client
 tests/           Node.js test suite
 drizzle/         SQL migration files
 public/          Static assets, PWA manifest, and service worker
```

## License

Private household use. See repository for license details.
