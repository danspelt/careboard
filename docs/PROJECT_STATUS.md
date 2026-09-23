# Project Status — CareBoard

**Last updated:** September 23, 2026
**Status:** Live in production; readiness work in flight on a separate integration branch
**Live:** https://care.danspelt.com
**Deploy:** Coolify → `coolify-production` branch, Dockerfile build pack — `running:healthy`
**Health:** `GET /api/health` → 200 `{"status":"ok"}` (verified 2026-09-23)
**Repo state:** `careboard-readiness-integration` checked out locally, clean

---

## Branch Topology (important)

| Branch | Role | Last commit |
|---|---|---|
| `origin/coolify-production` | **What is actually deployed** | 2026-09-20 — parity test-suite audit |
| `careboard-readiness-integration` | Local checkout — readiness work | 2026-09-18 — auth/landing rebrand |
| `main` | Base branch | 2026-09-17 — undici security patch |

`careboard-readiness-integration` is **8 commits ahead and 19 behind** `origin/coolify-production` — the branches have diverged and need reconciliation before the next deploy.

## Where We Are

- Private household chore/care-coordination tracker: manager dashboard (create/assign/complete tasks, CSV export, append-only audit log) + worker dashboard (claim, start, complete, proof photos)
- Security-first roles — workers can't see other workers' data; disabled workers blocked on every request
- 90-day retention on profile/proof photos served only through authenticated ownership-checked routes
- PWA installable; Auth.js 5 with Google OAuth + credentials; SQLite via better-sqlite3
- Recent work: shift handovers, shared brand-icon rebrand, first-owner password login fix

## Where We Go Next

Reconcile `careboard-readiness-integration` with `coolify-production` so shipped and in-flight work converge, then decide whether CareBoard stays a private household tool or becomes a marketable product.

## What Needs To Get Done

- [ ] Merge/rebase `careboard-readiness-integration` onto latest `origin/coolify-production`; resolve the 19-commit drift, then promote through the Docker verification path
- [ ] Confirm Coolify env vars: `AUTH_SECRET`, `AUTH_URL`, `CAREBOARD_OWNER_EMAIL`, `DATABASE_PATH=/data/careboard.db`, `UPLOAD_PATH=/data/uploads` — plus a persistent `/data` volume
- [ ] Optional: enable Google sign-in (`AUTH_GOOGLE_ID` / `AUTH_GOOGLE_SECRET`)
- [ ] Product decision: private household tool vs. sellable care-coordination app (affects roadmap)

## Verification

```bash
node --test tests/*.test.mjs
npm run lint        # oxlint
npm run build
```

On Windows, if `node_modules` holds Linux binaries, use the Docker path from AGENTS.md (bind-mount into `node:22-bookworm-slim`, or `docker build -t careboard-ui-verify .`).

## Known Issues

- Branch divergence between local integration work and the deployed `coolify-production` branch
- Google OAuth documented but optional — credential login is the current path
