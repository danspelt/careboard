# What care workers need — and how CareBoard supports it

This document summarizes established research on what improves working conditions for care workers, and maps each need to the CareBoard features that support it. It exists so product decisions stay anchored to evidence rather than guesswork.

## Sources

- [WHO — Occupational hazards in the health sector: psycho-social risks and mental health](https://www.who.int/tools/occupational-hazards-in-health-sector/psycho-social-risks-mental-health)
- [OECD — Beyond applause? Improving working conditions in long-term care](https://www.oecd.org/en/publications/beyond-applause-improving-working-conditions-in-long-term-care_27d33ab3-en.html)
- [OECD — Health at a Glance 2025: Long-term care workers](https://www.oecd.org/en/publications/health-at-a-glance-2025_8f9e3f98-en/full-report/long-term-care-workers_9c3bdbaf.html)

## The recurring needs

Across WHO and OECD findings, the same priorities appear for frontline and long-term care workers:

1. **Predictable, flexible scheduling** — irregular hours and last-minute changes are a leading source of stress and attrition in long-term care.
2. **Clear communication and handoffs** — continuity of care breaks down when information does not travel reliably between shifts.
3. **Manageable workloads and rest** — long runs of consecutive shifts, short turnarounds, and heavy daily task loads drive burnout and errors.
4. **Workplace safety** — care workers face elevated rates of injury, exposure to hazards, and workplace violence; reporting channels and follow-up matter.
5. **Training and clear instructions** — workers perform better and report less stress when expectations and task instructions are explicit.
6. **Fair treatment, feedback, and recognition** — visible acknowledgment and responsive management improve retention.

## How CareBoard addresses them

| Need | CareBoard feature |
|---|---|
| Predictable, flexible scheduling | Weekly shift patterns, personal availability windows, explicit day-off requests, and one-tap shift coverage acceptance (`schedule_change_requests`) |
| Clear communication and handoffs | Persisted end-of-shift handoffs (`shift_handoffs`) with completed care, outstanding tasks, observations, and a checklist — visible to the manager and to a worker covering that shift date |
| Manageable workloads | Workload signals (`lib/workload-warnings.ts`) flag long runs of scheduled days, short turnarounds between shifts, high daily task loads, and overdue work — derived only from schedule and task data, never health claims |
| Workplace safety | Safety incident and near-miss reporting (`safety_incidents`) with category, severity, location, and immediate action; manager triage with follow-up owner and resolution tracking; urgent/high reports notify the manager inbox |
| Training and clear instructions | Task instructions, checklists, certification records with expiry alerts |
| Fair treatment and recognition | Managers see per-worker completion reports; reporters get a private inbox follow-up when a safety report is reviewed or resolved |

## Privacy boundaries

These features are deliberately scoped so they help workers without surveilling them:

- Workers see only their own safety reports and their own workload signals; managers see the full set for triage and rebalancing.
- Handoffs are shared only with the manager and a worker who accepted coverage for that shift date.
- Workload warnings use schedule and task data only — they do not infer health, fatigue, or performance, and the copy says so.
