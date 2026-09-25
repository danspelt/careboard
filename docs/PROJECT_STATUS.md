# Project Status — CareBoard

**Last updated:** September 25, 2026
**Status:** Live production version is healthy; integration branch adds a large, fully verified feature set that is not yet deployed
**Live:** https://care.danspelt.com
**Deploy:** Coolify → `coolify-production` branch, Dockerfile build pack — `running:healthy`
**Health:** `GET /api/health` → 200 (verified 2026-09-25)
**Repo state:** `careboard-readiness-integration` is committed and pushed

---

## Branch Topology

| Branch | Role |
|---|---|
| `origin/coolify-production` | Deployed production branch |
| `careboard-readiness-integration` | Integration branch with all new work |
| `main` | Base branch |

The integration branch is **ahead of and 0 behind** `origin/coolify-production`, so deploying is a clean fast-forward with no merge conflicts. Deploying runs new database migrations (`0015`–`0022`) against the live database — back up `/data/careboard.db` first.

## Where We Are

- Private-household app: manager and worker dashboards, task coordination, timesheets, reports, PWA, Auth.js, SQLite, authenticated uploads, 90-day photo retention
- Integration work (not deployed): schedule coverage and two-week shifts, care-safety reporting, worker handovers, workload warnings, configurable dashboard widgets, email/SMS notifications, payroll reporting, and a privacy-bounded assistant
- **New care-plan features** (not deployed) — see [care-worker-needs.md](care-worker-needs.md) for the research behind them:
  - **Medication round** — manager defines medications and dose times (or as-needed); caregivers log each dose as given, refused, missed, or held. A reason is required whenever a dose is not given, and the manager is notified. Live due/overdue status and a 7-day exceptions list for spotting patterns
  - **About me profile** — a one-page, person-centred profile (what matters, how to support, communication, routine, likes, triggers, important-to-know, key contacts) so new and substitute caregivers get it right from day one
  - **Appointments** — scheduled with a care worker going along; the companion is notified and can close it out with notes
  - **Team shout-outs** — any caregiver or the manager can recognize a teammate; team-internal, never shown to family viewers
  - **Supplies list** — anyone on the care team can flag items running low and mark them bought
- Family viewers get a read-only **Care plan** page (profile, medication round, appointments, supplies)
- Verification passes: **170 tests**, oxlint (0 warnings/errors), production build

## What Needs To Get Done

- [ ] Decide when to deploy: back up the live database, fast-forward `coolify-production` to the integration branch, and verify the live app
- [ ] Confirm Coolify `AUTH_SECRET`, `AUTH_URL`, `CAREBOARD_OWNER_EMAIL`, `DATABASE_PATH=/data/careboard.db`, `UPLOAD_PATH=/data/uploads`, and persistent `/data` volume; do not expose secret values
- [ ] Before enabling email/SMS/AI features in production, configure and verify provider credentials, consent/retention requirements, and delivery behavior
- [ ] After deploying, fill in the About me profile and the medication list so the round appears for caregivers
- [ ] Optional follow-up: give the assistant read access to the care plan (profile, meds due, appointments) — deliberately not done yet because it sends more health information to OpenAI and needs an owner decision
- [x] Safe default for current scope: treat CareBoard as a private household tool; do not add public SaaS signup, billing, or marketing until Dan explicitly changes that direction

## Verification

```bash
node --test tests/*.test.mjs   # 170 passed
npm run lint                   # 0 warnings/errors
npm run build                  # passes
npm run dev                    # local preview with in-memory demo data; switch persona with the role switcher
```

## Remaining Risks / Dependencies

- Integration features are not deployed; no production behavior should be inferred from local tests
- The medication round is a coordination record, not a clinical eMAR — it does not check interactions or dosing, and the UI says to follow the care plan and call for clinical help
- External notification-provider setup and consent/retention configuration require owner credentials and review
