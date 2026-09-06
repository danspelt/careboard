# CareBoard authentication setup

CareBoard supports Google OAuth and email/password authentication. It does not send email.

## Required environment

- `AUTH_SECRET`: at least 32 characters
- `AUTH_URL`: the externally reachable HTTPS origin (localhost HTTP is accepted in development)
- `CAREBOARD_OWNER_EMAIL`: the manager's approved email address
- `CAREBOARD_OWNER_MEMBER_ID`: optional existing manager profile ID; defaults to `member-manager`
- `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`: required only for Google sign-in
- `DATABASE_PATH`: optional SQLite database path
- `UPLOAD_PATH`: persistent proof-photo directory; defaults to `/data/uploads`
- `CAREBOARD_MEMBER_EMAILS`: optional JSON mapping from approved worker emails to existing worker IDs

The manager identity is determined only by `CAREBOARD_OWNER_EMAIL` and its configured manager profile. Worker mappings cannot grant the manager role.

## Worker accounts

The manager creates each worker with a name, approved email, and strong temporary password. The password is hashed with `bcryptjs`; plaintext is never stored. New workers are active immediately. A credentials login with a temporary password is restricted to the protected password-change screen until the worker chooses a permanent password. Google login by the same active approved worker is not restricted by the credential-specific temporary-password state.

Managers can set another temporary password, disable a worker, or reactivate one. Disabled status is checked from the database on every protected request, so an existing JWT cannot retain access. Disabling preserves tasks and activity history.

Workers receive only their own assigned tasks (including completed history) and unassigned open tasks. They never receive the roster, other workers' tasks, or unrelated activity. Workers may atomically claim an unassigned open task, start only their own assigned open task, and complete only their own in-progress task. Managers retain full task and account control.

Run database migrations before production startup. The local SQLite adapter applies migrations automatically.

## Coolify persistence

Mount a persistent volume at `/data` and set `DATABASE_PATH=/data/careboard.db` and `UPLOAD_PATH=/data/uploads`. Both the SQLite database and authenticated proof photos then survive deployments. The Docker image creates the upload directory with ownership for the non-root application user. Do not expose the upload directory through a static file server; photos are served only by CareBoard's authenticated ownership-checked route.
