# CSIL readiness assessment

This document maps the obligations of a **Choice in Supports for Independent Living (CSIL)** employer in British Columbia against what CareBoard actually does. It is a product gap analysis, not legal advice — the CSIL employer remains legally responsible for compliance, and items marked "outside scope" still need to be handled elsewhere.

## Sources

- [SCI BC — CSIL Online Workbook, Module 3: Starting Your Business](https://sci-bc.ca/wp-content/uploads/2023/03/csil-module3-2023-update.pdf)
- [SCI BC — CSIL Online Workbook, Module 4: How to Be a Lawful CSIL Employer](https://sci-bc.ca/wp-content/uploads/2021/12/csil-module4-2021update.pdf)
- [Province of BC — Payroll records (ESA Part 3, s.28 interpretation)](https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/forms-resources/igm/esa-part-3-section-28)
- [BC Employment Standards Act](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_96113_01)

## Requirements matrix

Status key: **Supported** · **Partial** · **Not supported** · **Outside scope** (operational/legal duty the app cannot perform).

### Employer records (BC ESA s.28 — payroll records must be kept in English for 4 years)

| Requirement | Status | Where |
|---|---|---|
| Employee name | Supported | `members.name` |
| Date of birth | Supported | `members.date_of_birth` (manager-edited profile) |
| Occupation / job title | Supported | `members.job_title` (defaults to "Care worker") |
| Telephone number | Supported | `members.phone` |
| Residential address | Supported | `members.address` (manager-edited profile) |
| Employment start date | Supported | `members.employment_started_on` |
| Wage rate | Supported | `members.hourly_rate` |
| Hours worked each day | Supported | `time_entries` clock in/out; per-worker timesheet CSV (`/api/timesheets`); all-worker payroll CSV (`/api/payroll`) |
| Wage statement per payday (hours, rate, gross/net, deductions) | Partial | Timesheet and payroll CSVs provide daily hours, rate, and gross amount; deductions and net pay are payroll-software scope |
| Benefits paid | Outside scope | Payroll |
| Statutory holiday records | Not supported | — |
| Vacation dates/pay/days owed | Not supported | — |
| Time-bank (banked overtime) records | Not supported | — |
| 4-year retention | Partial | Member records and time entries persist indefinitely (no deletion job); proof photos expire per the configured retention window |

### CSIL program duties (SCI BC workbooks)

| Requirement | Status | Where |
|---|---|---|
| Competent, adequately trained assistants | Supported | Certification records with expiry dates; skills notes on member profiles |
| Clear work expectations / task instructions | Supported | Per-task instructions, checklists, progress notes |
| Backup staffing plan | Supported | Worker availability records; open-shift coverage requests with opt-in SMS/email alerts |
| Communication between shifts | Supported | Structured shift handoffs (care completed, outstanding tasks, observations, checklist) |
| Workplace safety / hazard reporting | Supported | Safety incident and near-miss reporting with manager triage and follow-up |
| Manageable workloads | Supported | Workload signals (long shift runs, short turnarounds, high task load, overdue work) |
| Monthly funding use tracking (hours × CSIL rate) | Supported | `fundedHoursMonthly` × `fundingHourlyRate` with projected-vs-funded usage on the manager dashboard |
| Dedicated CSIL bank account and spending reconciliation | Outside scope | Banking |
| Statutory deductions, CRA remittances, CPP/EI, T4s | Outside scope | Payroll software / accountant |
| WorkSafeBC registration and coverage | Outside scope | Employer duty |
| Bullying and harassment policy | Outside scope | Policy document; incident reporting supports evidence |
| Employment contract / terms and conditions | Outside scope | Legal document |
| Monthly/quarterly reporting to the health authority | Partial | Household report CSV (`/api/export`), per-worker timesheets, and the bookkeeper payroll CSV (`/api/payroll`, any date range) provide the underlying records |
| Predictable pay-period scheduling | Supported | Two-week rotating shift schedule (Week A / Week B) with a 14-day calendar view |

## Privacy posture for employee records

- Date of birth, address, job title, employment start date, pay rate, phone, emergency contact, skills notes, and certifications are **manager-only fields** — workers never see other workers' records.
- Workers can see (and a manager edits) their own record; self-editing is restricted to phone, availability, and languages.
- All member data is included in the manager CSV export for record-keeping.

## What still needs an employer process, not software

1. **Payroll** — deductions, net pay, remittances, T4s, and formal wage statements require payroll software or an accountant. CareBoard's timesheet CSV supplies the hours/rate inputs.
2. **Statutory holiday, vacation, and overtime/time-bank tracking** — not yet modeled; track in payroll software or extend the app.
3. **WCB / WorkSafeBC** — registration, premiums, and coverage are employer obligations.
4. **Retention review** — confirm the deployment's backup/retention setup keeps payroll-relevant records (time entries, member records, exports) for the full 4-year ESA requirement before relying on them.
5. **Employment agreements and policies** — contracts, bullying/harassment policy, and job descriptions remain documents the employer maintains.

## Suggested next product steps

- Statutory holiday and vacation tracking on member records.
- Pay-period summary export (gross wages by period) to pair with payroll.
- A retention/export checklist covering the full ESA record set.
