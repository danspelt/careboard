# Project Status — CareBoard

**Last updated:** September 25, 2026
**Status:** Live production version is healthy; substantial integration-branch work passes local verification but is not deployed
**Live:** https://care.danspelt.com
**Deploy:** Coolify → `coolify-production` branch, Dockerfile build pack — `running:healthy`
**Health:** `GET /api/health` → 200 (verified 2026-09-25)
**Repo state:** `careboard-readiness-integration` has extensive staged and unstaged local work; preserved and not pushed

---

## Branch Topology

| Branch | Role |
|---|---|
| `origin/coolify-production` | Deployed production branch |
| `careboard-readiness-integration` | Local integration work, including the current feature set |
| `main` | Base branch |

The integration branch is **9 commits ahead and 19 behind** `origin/coolify-production`. The worktree also contains substantial staged and unstaged changes. Do not merge/rebase or deploy until these changes are reviewed and branch reconciliation is planned.

## Where We Are

- Existing private-household app: manager and worker dashboards, task coordination, timesheets, reports, PWA, Auth.js, SQLite, authenticated uploads, 90-day photo retention
- Current local integration work adds/extends: schedule coverage and two-week shifts, care-safety reporting, worker handovers, workload warnings, configurable dashboard widgets, email/SMS notifications, payroll reporting, and a privacy-bounded assistant
- Local integration branch verification passes: **154 tests**, oxlint (0 warnings/errors), production build
- These integration features are not in the currently deployed `coolify-production` branch

## What Needs To Get Done

- [ ] Review and commit the validated integration work on `careboard-readiness-integration`; keep current staged/unstaged edits intact until review is complete
- [ ] Reconcile the integration branch with latest `origin/coolify-production` (9 ahead / 19 behind) on a clean working tree; resolve conflicts and rerun tests/lint/build
- [ ] Confirm Coolify `AUTH_SECRET`, `AUTH_URL`, `CAREBOARD_OWNER_EMAIL`, `DATABASE_PATH=/data/careboard.db`, `UPLOAD_PATH=/data/uploads`, and persistent `/data` volume; do not expose secret values
- [ ] Before enabling email/SMS/AI features in production, configure and verify provider credentials, consent/retention requirements, and delivery behavior
- [x] Safe default for current scope: treat CareBoard as a private household tool; do not add public SaaS signup, billing, or marketing until Dan explicitly changes that direction

## Verification

```bash
node --test tests/*.test.mjs   # 154 passed
npm run lint                   # 0 warnings/errors
npm run build                  # passes
```

## Remaining Risks / Dependencies

- Local features are not deployed; no production behavior should be inferred from local tests
- Branch/worktree reconciliation and Coolify configuration are still pending
- External notification-provider setup and consent/retention configuration require owner credentials and review
