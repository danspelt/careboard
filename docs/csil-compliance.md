# CSIL readiness assessment

This document maps the obligations of a **Choice in Supports for Independent Living (CSIL)** employer in British Columbia against what CareBoard actually does. It is a product gap analysis, not legal advice — the CSIL employer remains legally responsible for compliance, and items marked "outside scope" still need to be handled elsewhere.

## Sources

- [Province of BC — Choice in Supports for Independent Living](https://www2.gov.bc.ca/gov/content/health/accessing-health-care/home-community-care/care-options-and-cost/choice-in-supports-for-independent-living) (eligibility, employer role, assessed hours, funding rate and client contribution)
- [BC Ministry of Health — Home and Community Care Policy Manual, Chapter 4, section 4.C](https://www2.gov.bc.ca/assets/gov/health-safety/home-community-care/accountability/hcc-policy-manual/4_hcc_policy_manual_chapter_4.pdf) (CSIL agreements, dedicated account, backup/respite planning, financial accountability and health-authority reporting)
- [Fraser Health — Choices in Supports for Independent Living](https://www.fraserhealth.ca/Service-Directory/Services/home-and-community-care/choices-in-supports-for-independent-living) (employer staffing duties and monthly reporting to CRA, WorkSafeBC and the health authority)
- [SCI BC — CSIL Online Workbook, Module 3: Starting Your Business](https://sci-bc.ca/wp-content/uploads/2023/03/csil-module3-2023-update.pdf)
- [SCI BC — CSIL Online Workbook, Module 4: How to Be a Lawful CSIL Employer](https://sci-bc.ca/wp-content/uploads/2021/12/csil-module4-2021update.pdf)
- [Province of BC — Payroll records (ESA Part 3, s.28 interpretation)](https://www2.gov.bc.ca/gov/content/employment-business/employment-standards-advice/employment-standards/forms-resources/igm/esa-part-3-section-28)
- [BC Employment Standards Act](https://www.bclaws.gov.bc.ca/civix/document/id/complete/statreg/00_96113_01)

## Requirements matrix

Status key: **Supported** · **Partial** · **Not supported** · **Outside scope** (operational/legal duty the app cannot perform).

## Employer records (BC ESA s.28 — payroll records must be kept in English for 4 years)

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
| Wage statement per payday (hours, rate, gross/net, deductions) | Partial | Locked pay runs store hours, rate, and gross; `/api/wage-statements` exports a gross statement. Deductions and net pay remain payroll-software scope |
| Benefits paid | Outside scope | Payroll |
| Statutory holiday records | Not supported | — |
| Vacation dates/pay/days owed | Partial | `leave_balances` / `leave_requests` track vacation and sick hours with manager approval; pay-out of vacation pay still outside scope |
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
| Dedicated CSIL bank account and spending reconciliation | Supported | Manager records only the account's last four digits; monthly funding, client contribution, payroll cost, confirmed expenses and balance are reconciled without storing banking credentials |
| Statutory deductions, CRA remittances, CPP/EI, T4s | Outside scope | Payroll software / accountant |
| WorkSafeBC registration and coverage | Outside scope | Employer duty |
| Bullying and harassment policy | Partial | HR documents with required acknowledgment; incident reporting supports evidence |
| Employment contract / terms and conditions | Partial | HR documents (contract category) with acknowledgment; not a substitute for legal review |
| Monthly reporting to the health authority | Supported | Configurable due-day window, filing status and notes, receipt-gap warning, and manager-only `/api/csil-report` CSV. The health authority's own form remains authoritative. |
| Predictable pay-period scheduling | Supported | Configurable pay periods (default 14 days) with close-run snapshots; two-week rotating shift schedule |

## Privacy posture for employee records

- Date of birth, address, job title, employment start date, pay rate, phone, emergency contact, skills notes, and certifications are **manager-only fields** — workers never see other workers' records.
- Workers can see (and a manager edits) their own record; self-editing is restricted to phone, availability, and languages.
- Leave balances, wage statements, and hire checklists are scoped to the signed-in worker for care workers; managers see the full household.
- All member data is included in the manager CSV export for record-keeping.

## What still needs an employer process, not software

1. **Payroll** — deductions, net pay, remittances, T4s, and formal net wage statements require payroll software or an accountant. CareBoard's pay runs and CSV supply the hours/rate/gross inputs.
2. **Statutory holiday and overtime/time-bank tracking** — not yet modeled; track in payroll software or extend the app.
3. **WCB / WorkSafeBC** — registration, premiums, and coverage are employer obligations.
4. **Retention review** — confirm the deployment's backup/retention setup keeps payroll-relevant records (time entries, member records, exports, pay runs) for the full 4-year ESA requirement before relying on them.
5. **Legal review of employment agreements and policies** — in-app documents support distribution and acknowledgment; have counsel review the actual text.

## Comprehensive feature coverage and remaining gaps

| Requested capability | CareBoard coverage |
|---|---|
| Eligibility/onboarding and agreement | Agreement dates, health authority/contact, readiness checklist; formal assessment and approval stay with the health authority. |
| Funding, forecasts and reconciliation | Assessed hours × rate, client contribution, actual payroll and expenses, month-end balance, pace projection. Direct bank feeds and statement matching are not implemented. |
| Allowed expenses and reimbursements | Categorized register with `confirmed`, `pending`, and `ineligible` status so CareBoard never substitutes a generic rule for the employer's agreement. Reimbursements can be recorded as expenses; approval routing is a follow-up. |
| Receipts/scanning and secure documents | Receipt/reference tracking, missing-evidence alerts, authenticated HR document storage and existing OCR-assisted client-note capture. A dedicated encrypted receipt upload/OCR flow is not yet implemented; keep originals outside CareBoard. |
| Health-authority templates | Portable CSV plus configurable due window. Exact authority-specific PDF/XLS forms vary and require sample templates before safe field mapping. |
| Worker setup, credentials and training | Employee records, onboarding checklists, policy/document acknowledgement, certifications and expiry alerts. |
| Scheduling, time, payroll and approvals | Two-week scheduling, availability, clock records, manager-reviewed tasks, leave approvals, pay-run review/close/reopen, wage statements and payroll CSV. Statutory deductions/remittances remain external. |
| Reporting, audit and year-end package | Monthly CSIL CSV, household/payroll/timesheet/wage exports and append-only audit log. A single ZIP/PDF year-end bundle is a follow-up; current exports are portable individually. |
| Privacy and consent | Manager-only finances/settings, role-filtered worker/family views, authenticated uploads, SMS opt-in, fixed photo retention, and no banking credentials. Granular consent forms and financial-record retention controls remain follow-up work. |
| Backup/emergency care | Availability, persistent coverage requests, email/SMS alerts and shift handoffs. The agreement's narrative respite/backup plan is not yet a dedicated structured document. |
| Accessibility, mobile and offline | Responsive/touch-friendly dashboard, labelled controls, reduced-motion styling, PWA manifest and offline shell. Authenticated records and mutations intentionally require a connection and are not cached offline. |

CareBoard now also provides AES-256-GCM encrypted receipt images with best-effort OCR, authenticated manager-only retrieval, provider-neutral CSV/OFX transaction import with deterministic matching, reimbursement request/decision records, consent grants and withdrawal records, configurable financial retention, a dedicated emergency backup-care plan, configurable JSON authority-field mappings, and a one-click portable year-end JSON package. Live bank feeds still require an owner-selected provider, and an authority-specific PDF/XLS rendition requires the authority's current official template; the generic mapping and portable export intentionally avoid inventing either dependency.

## Suggested next product steps

- Statutory holiday calendar on member records.
- Vacation pay calculation alongside leave balances.
- A retention/export checklist covering the full ESA record set.
