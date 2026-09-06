# CareBoard architecture

This document describes how CareBoard is structured, how users are authenticated, how data is modeled, and how the Progressive Web App (PWA) layer works. For deployment and day-to-day operations, see [deployment.md](deployment.md).

## Overview

CareBoard is a single-tenant Next.js application backed by SQLite. One household manager owns the instance; the manager creates worker accounts that can claim and complete tasks. All business logic lives in server-side modules under `lib/` and API routes under `app/api/`. The interactive dashboard is a client component (`app/household-app.tsx`) that receives an initial server-fetched state and performs mutations through a single `/api/household` endpoint.

## Directory layout

```text
app/                       Next.js App Router pages and server actions
  api/                     JSON API and authenticated routes
    auth/[...nextauth]     Auth.js endpoint
    export/                CSV report download
    health/                Liveness/readiness probe
    household/             Task and profile mutations
    uploads/               Authenticated photo upload and delete
  actions/auth.ts          Server actions for sign-in, sign-out, password change
  household-app.tsx        Main dashboard client component
components/ui/             shadcn/ui Base UI primitives
lib/                       Business logic and access policies
  access-policy.ts         Role-based authorization predicates
  account-store.ts         Member lifecycle and Google account mapping
  auth-access.ts           Session-to-member resolution for requests
  auth-config.ts           Environment-driven authentication configuration
  auth-security.ts         Password policy, hashing, and email normalization
  credential-store.ts      Credential password state
  household-data.ts        Household state, mutations, recurring tasks, cleanup
  operations.ts            Date/recurrence helpers, CSV, upload validation, metrics
db/                        SQLite adapter and migration runner
  index.ts                 better-sqlite3 wrapper and migration loop
drizzle/                   SQL migration files applied at startup
public/                    Static assets, PWA manifest, service worker
tests/                     Node.js test suite
```

## Authentication

CareBoard uses [Auth.js 5](https://authjs.dev/) (NextAuth.js beta). Two providers are supported:

- **Google OAuth** — configured with `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`.
- **Credentials** — email and password, backed by the `auth_credentials` table.

Regardless of provider, a user is only allowed to sign in if their email maps to an existing member profile. The manager is identified by `CAREBOARD_OWNER_EMAIL` and must use the manager member ID (`member-manager` by default). Worker emails can be pre-approved at startup via the `CAREBOARD_MEMBER_EMAILS` JSON mapping.

Authentication is considered configured only when all of the following are true:

- `AUTH_SECRET` is at least 32 characters.
- `AUTH_URL` is an `https:` origin (or `http://localhost`, `http://127.0.0.1`, or `http://[::1]` in development).
- `CAREBOARD_OWNER_EMAIL` is a valid email address.

Sessions use JWT strategy with an 8-hour maximum age. See [AUTH_SETUP.md](../AUTH_SETUP.md) for the full environment reference.

## Role and access security

Access decisions are centralized in `lib/access-policy.ts` and enforced at two levels:

1. **Data visibility** — `getHouseholdState()` in `lib/household-data.ts` strips private fields from the worker response. Workers receive only their own profile, tasks assigned to them, and unassigned open tasks.
2. **Mutation authorization** — `mutateHousehold()` checks the actor role against a `managerOnly` allowlist before executing privileged actions.

Key access rules:

| Action | Manager | Worker |
|---|---|---|
| Create/edit/delete tasks | Yes | No |
| Assign/unclaim tasks | Yes | No |
| Add/disable/reactivate workers | Yes | No |
| Reset worker passwords | Yes | No |
| View team roster and audit log | Yes | No |
| View own profile | Yes | Yes |
| Edit own limited profile fields | No | Yes (phone, availability, languages, profile photo) |
| Claim an unassigned open task | No | Yes |
| Start own assigned open task | No | Yes |
| Complete own in-progress task | No | Yes |
| Add notes to own tasks | No | Yes |

Disabled workers are checked on every protected request. A disabled account immediately loses access even if it holds a valid session cookie.

## Database schema and migrations

The SQLite database is created automatically on first access. Migrations are stored in `drizzle/*.sql` and applied in a deterministic order by `db/index.ts`:

1. `0000_narrow_madrox` — core tables (`members`, `chores`, `activity`, `task_notes`, `proof_photos`, `household_settings`).
2. `0001_role_lifecycle` — account lifecycle table and status tracking.
3. `0002_operations_pwa` — recurring task fields and PWA support tables.
4. `0003_enhancements` — additional profile and completion metadata.

The migration runner records applied IDs in `_careboard_migrations` so each migration runs once. Foreign keys and WAL mode are enabled, and the database is opened with a 5-second busy timeout.

### Key tables

- `members` — household members with role, contact details, and profile metadata.
- `chores` — tasks, status, assignments, recurrence, due dates, completion metadata.
- `activity` — append-only log of significant actions.
- `task_notes` — progress, completion, and issue notes attached to tasks.
- `proof_photos` — uploaded photo metadata; files are stored on disk, not in the database.
- `account_lifecycle` — active/disabled status and activation timestamps.
- `google_accounts` — approved email-to-member mapping for OAuth.
- `auth_credentials` — bcrypt-hashed credential passwords and temporary-password flag.
- `audit_log` — immutable operational audit history visible to managers.
- `household_settings` — recurrence horizon, reminder lead, and retention policy.

If the database is empty, a seed manager and sample chore are inserted so the first sign-in succeeds.

## Recurring tasks and cleanup

- **Recurring tasks** — Tasks with a `recurrence` of `daily`, `weekly`, or `monthly` spawn future copies up to `recurrenceHorizonDays` ahead (default 30, maximum 365).
- **Reminders** — Open tasks with a due date within `reminderDefaultLeadDays` (default 1) are surfaced in the dashboard reminders card.
- **Upload retention** — Proof photos older than the fixed 90-day retention policy are deleted from disk and from `proof_photos` on each household state load. This is a privacy policy, not a configurable setting.

## API routes

- `POST /api/household` — authenticated task and profile mutations. The request body must include `action` and is validated server-side against the actor role.
- `POST /api/uploads` — authenticated multipart photo upload for task proof or profile photo. Only JPEG, PNG, and WebP under 10 MB are accepted; magic-byte signatures are verified.
- `DELETE /api/uploads/[id]` — authenticated deletion restricted to managers or the upload/task owner.
- `GET /api/uploads/[id]` — authenticated ownership-checked photo download.
- `GET /api/export` — manager-only CSV export over a date range.
- `GET /api/health` — container health check; returns HTTP 200 when the app is running.

## PWA

CareBoard ships with a web app manifest and a custom service worker:

- `public/manifest.webmanifest` defines icons, theme color, and display mode.
- `public/sw.js` caches the public shell (`/`, `/sign-in`, `/offline.html`) and static assets. API requests and authenticated HTML pages are never cached.
- `app/pwa-register.tsx` registers the service worker in supported browsers.

The offline page is served when a navigation request fails and a cached shell is unavailable.

## Security notes

- The `/data/uploads` directory is not exposed by a static file server. Photos are served only through authenticated routes that verify ownership.
- Passwords must be at least 12 characters and contain uppercase, lowercase, a number, and a symbol.
- Credentials use `bcryptjs` hashing.
- Mutation payloads are validated with strict regexes for dates, times, and identifiers.
- CSV export sanitizes cell values to neutralize spreadsheet formula injection.
