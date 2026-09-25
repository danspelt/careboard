# What care workers need — and how CareBoard supports it

This document summarizes established research on what improves working conditions for care workers, and maps each need to the CareBoard features that support it. It exists so product decisions stay anchored to evidence rather than guesswork.

## Sources

- [WHO — Occupational hazards in the health sector: psycho-social risks and mental health](https://www.who.int/tools/occupational-hazards-in-health-sector/psycho-social-risks-mental-health)
- [OECD — Beyond applause? Improving working conditions in long-term care](https://www.oecd.org/en/publications/beyond-applause-improving-working-conditions-in-long-term-care_27d33ab3-en.html)
- [OECD — Health at a Glance 2025: Long-term care workers](https://www.oecd.org/en/publications/health-at-a-glance-2025_8f9e3f98-en/full-report/long-term-care-workers_9c3bdbaf.html)
- [CareMobi user survey (2026) — caregivers ranked appointment tracking, health monitoring, and medication tracking highest](https://doi.org/10.1177/01939459261442459)
- [HHAeXchange — 8,200-caregiver survey: scheduling and communication are where technology helps most](https://www.hhaexchange.com/blog/what-caregivers-really-want-in-insights-from-8200-caregivers)
- [Direct care worker retention interviews — appreciation and recognition promote retention](https://doi.org/10.1093/geroni/igac059.3141)
- [JAMA Network Open — respect and community support drive low turnover at home care cooperatives](https://jamanetwork.com/journals/jamanetworkopen/fullarticle/2832228)
- [One-page profiles in person-centred care](https://www.hcpa.info/guideline/one-page-profile/) and [eMAR practice in home care — missed/refused dose alerts with mandatory notes](https://www.birdie.care/product-features/medication-management-e-mar)

## The recurring needs

Across WHO and OECD findings, the same priorities appear for frontline and long-term care workers:

1. **Predictable, flexible scheduling** — irregular hours and last-minute changes are a leading source of stress and attrition in long-term care.
2. **Clear communication and handoffs** — continuity of care breaks down when information does not travel reliably between shifts.
3. **Manageable workloads and rest** — long runs of consecutive shifts, short turnarounds, and heavy daily task loads drive burnout and errors.
4. **Workplace safety** — care workers face elevated rates of injury, exposure to hazards, and workplace violence; reporting channels and follow-up matter.
5. **Training and clear instructions** — workers perform better and report less stress when expectations and task instructions are explicit.
6. **Fair treatment, feedback, and recognition** — visible acknowledgment and responsive management improve retention.
7. **Safe medication support** — in home care, workers are alone with the client; a real-time record of every dose, with alerts for refused or missed doses, catches problems days earlier than paper sheets.
8. **Knowing the person** — new and substitute caregivers need a quick, person-centred summary of what matters to the client and how they want to be supported.
9. **Coordination beyond tasks** — caregivers and families rank appointment tracking and shared household logistics among the most valuable features.

## How CareBoard addresses them

| Need | CareBoard feature |
|---|---|
| Predictable, flexible scheduling | Weekly shift patterns, personal availability windows, explicit day-off requests, and one-tap shift coverage acceptance (`schedule_change_requests`) |
| Clear communication and handoffs | Persisted end-of-shift handoffs (`shift_handoffs`) with completed care, outstanding tasks, observations, and a checklist — visible to the manager and to a worker covering that shift date |
| Manageable workloads | Workload signals (`lib/workload-warnings.ts`) flag long runs of scheduled days, short turnarounds between shifts, high daily task loads, and overdue work — derived only from schedule and task data, never health claims |
| Workplace safety | Safety incident and near-miss reporting (`safety_incidents`) with category, severity, location, and immediate action; manager triage with follow-up owner and resolution tracking; urgent/high reports notify the manager inbox |
| Training and clear instructions | Task instructions, checklists, certification records with expiry alerts |
| Fair treatment and recognition | Managers see per-worker completion reports; reporters get a private inbox follow-up when a safety report is reviewed or resolved; **team shout-outs** (`kudos`) let the manager and teammates recognize great care, with a 30-day count for each person |
| Safe medication support | **Medication round** (`medications`, `medication_logs`): scheduled and as-needed doses logged as given, refused, missed, or held; a reason is mandatory for anything not given and the manager is notified; one log per scheduled dose is enforced in the database; a 7-day exceptions list surfaces repeated refusals |
| Knowing the person | **About me** one-page profile (`care_profile`): what matters, how to support, communication, routine, likes, triggers, important-to-know, and key contacts — shown on every caregiver's dashboard |
| Coordination beyond tasks | **Appointments** with an accompanying care worker who is notified and closes it out with notes; a shared **supplies list** anyone on the care team can update |

## Privacy boundaries

These features are deliberately scoped so they help workers without surveilling them:

- Workers see only their own safety reports and their own workload signals; managers see the full set for triage and rebalancing.
- Handoffs are shared only with the manager and a worker who accepted coverage for that shift date.
- Workload warnings use schedule and task data only — they do not infer health, fatigue, or performance, and the copy says so.
- Shout-outs stay within the care team; family viewers never receive them.
- The care plan (profile, medication round, appointments, supplies) is shared with the whole household, read-only for family viewers. The medication round is a coordination record, not a clinical system: it does not check dosing or interactions.
