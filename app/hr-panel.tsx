'use client';

import { useMemo, useState } from 'react';
import { BadgeCheck, CalendarDays, Check, CircleDollarSign, ClipboardList, FileText, Mail, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { HouseholdState, Member } from '@/lib/household-data';
import { remainingLeaveHours, type LeaveKind } from '@/lib/hr';
import { aggregateWorkerHours, grossFor, payPeriodReadyToClose } from '@/lib/hr-payroll';
import { certificationAlerts } from '@/lib/certifications';

type HrTab = 'people' | 'leave' | 'documents' | 'onboarding' | 'payroll';

export function ManagerHrView({
  state,
  setProfile,
  mutate,
  busy,
}: {
  state: HouseholdState;
  setProfile: (member: Member) => void;
  mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const [tab, setTab] = useState<HrTab>('people');
  const workers = state.members.filter((member) => member.role === 'worker');
  const today = new Date().toISOString().slice(0, 10);
  const certCount = certificationAlerts(state.certifications ?? [], workers, today).length;
  const pendingLeave = (state.leaveRequests ?? []).filter((request) => request.status === 'pending').length;
  const tabs: Array<{ id: HrTab; label: string; hint?: number }> = [
    { id: 'people', label: 'People' },
    { id: 'leave', label: 'Time off', hint: pendingLeave || undefined },
    { id: 'documents', label: 'Documents' },
    { id: 'onboarding', label: 'Onboarding' },
    { id: 'payroll', label: 'Payroll' },
  ];

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">HR</h1>
        <p className="mt-1 text-sm text-[#687873]">People records, time off, policies, hire checklists, and pay periods.</p>
      </div>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="HR sections">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
            className={`inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${tab === item.id ? 'bg-[#287b6f] text-white' : 'border border-[#d7dfd7] bg-white text-[#52645f] hover:bg-[#f1f5f1]'}`}
          >
            {item.label}
            {item.hint ? <span className={`rounded-full px-1.5 text-xs ${tab === item.id ? 'bg-white/20' : 'bg-[#e8f1ec] text-[#287b6f]'}`}>{item.hint}</span> : null}
          </button>
        ))}
      </div>
      {tab === 'people' && <PeopleTab workers={workers} certifications={state.certifications ?? []} certCount={certCount} setProfile={setProfile} today={today} />}
      {tab === 'leave' && <LeaveTab state={state} workers={workers} mutate={mutate} busy={busy} />}
      {tab === 'documents' && <DocumentsTab state={state} workers={workers} mutate={mutate} busy={busy} />}
      {tab === 'onboarding' && <OnboardingTab state={state} workers={workers} mutate={mutate} busy={busy} />}
      {tab === 'payroll' && <PayrollTab state={state} workers={workers} mutate={mutate} busy={busy} />}
    </>
  );
}

function Panel({ children, className = '', ...props }: React.ComponentProps<'section'>) {
  return <section className={`rounded-2xl border border-[#dfe5dc] bg-[#fffefa] p-5 ${className}`} {...props}>{children}</section>;
}

function PeopleTab({ workers, certifications, certCount, setProfile, today }: { workers: Member[]; certifications: HouseholdState['certifications']; certCount: number; setProfile: (member: Member) => void; today: string }) {
  return (
    <Panel>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />People roster</h2>
          <p className="mt-1 text-sm text-[#687873]">Employment records for the household. Open a profile to edit rate, title, and certifications. Invites stay on Team.</p>
        </div>
        {certCount > 0 && <span className="rounded-full bg-[#fcf4e9] px-3 py-1 text-xs font-bold text-[#805322]">{certCount} cert alert{certCount === 1 ? '' : 's'}</span>}
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-[#687873]">
            <tr>
              <th className="py-2 pr-4 font-semibold">Name</th>
              <th className="py-2 pr-4 font-semibold">Title</th>
              <th className="py-2 pr-4 font-semibold">Started</th>
              <th className="py-2 pr-4 font-semibold">Rate</th>
              <th className="py-2 pr-4 font-semibold">Status</th>
              <th className="py-2 font-semibold">Certs</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e5eae4]">
            {workers.map((worker) => {
              const workerCerts = (certifications ?? []).filter((cert) => cert.memberId === worker.id);
              const alerts = certificationAlerts(workerCerts, [worker], today).length;
              return (
                <tr key={worker.id}>
                  <td className="py-3 pr-4">
                    <button type="button" onClick={() => setProfile(worker)} className="font-semibold text-[#287b6f] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">{worker.name}</button>
                  </td>
                  <td className="py-3 pr-4 text-[#52645f]">{worker.jobTitle || 'Care worker'}</td>
                  <td className="py-3 pr-4 tabular-nums text-[#52645f]">{worker.employmentStartedOn || '—'}</td>
                  <td className="py-3 pr-4 tabular-nums text-[#52645f]">{worker.hourlyRate != null ? `$${worker.hourlyRate.toFixed(2)}` : 'Not set'}</td>
                  <td className="py-3 pr-4 capitalize text-[#52645f]">{worker.status}</td>
                  <td className="py-3">{alerts ? <span className="font-semibold text-[#8b4e2c]">{alerts} alert{alerts === 1 ? '' : 's'}</span> : <span className="text-[#687873]">{workerCerts.length || 'None'}</span>}</td>
                </tr>
              );
            })}
            {!workers.length && <tr><td colSpan={6} className="py-8 text-center text-[#687873]">Add care workers from Team to build the roster.</td></tr>}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

function LeaveTab({ state, workers, mutate, busy }: { state: HouseholdState; workers: Member[]; mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>; busy: boolean }) {
  const pending = (state.leaveRequests ?? []).filter((request) => request.status === 'pending');
  const recent = (state.leaveRequests ?? []).filter((request) => request.status !== 'pending').slice(0, 12);
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-[#287b6f]" aria-hidden="true" />Pending requests</h2>
        <div className="mt-4 space-y-3">
          {pending.map((request) => {
            const worker = workers.find((item) => item.id === request.memberId);
            return (
              <div key={request.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
                <p className="font-semibold">{worker?.name ?? 'Care worker'} · {request.kind}</p>
                <p className="text-sm text-[#687873]">{request.startOn} → {request.endOn} · {request.hours}h{request.note ? ` · ${request.note}` : ''}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" disabled={busy} className="min-h-11 bg-[#287b6f]" onClick={() => void mutate({ action: 'decideLeaveRequest', requestId: request.id, decision: 'approved' }, 'Leave approved.')}>Approve</Button>
                  <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => void mutate({ action: 'decideLeaveRequest', requestId: request.id, decision: 'denied' }, 'Leave denied.')}>Deny</Button>
                </div>
              </div>
            );
          })}
          {!pending.length && <p className="rounded-xl bg-[#f7f6f1] p-4 text-center text-sm text-[#687873]">No pending leave requests.</p>}
        </div>
        {recent.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-bold">Recent decisions</h3>
            <ul className="mt-2 space-y-2 text-sm text-[#687873]">
              {recent.map((request) => {
                const worker = workers.find((item) => item.id === request.memberId);
                return <li key={request.id}>{worker?.name ?? 'Care worker'} — {request.kind} {request.startOn} ({request.status})</li>;
              })}
            </ul>
          </div>
        )}
      </Panel>
      <Panel>
        <h2 className="flex items-center gap-2 text-lg font-bold"><ClipboardList className="size-5 text-[#287b6f]" aria-hidden="true" />Balances</h2>
        <div className="mt-4 space-y-4">
          {workers.map((worker) => {
            const balances = (state.leaveBalances ?? []).filter((row) => row.memberId === worker.id);
            return (
              <form
                key={worker.id}
                className="rounded-xl border border-[#e2e8e1] bg-white p-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  const data = Object.fromEntries(new FormData(event.currentTarget));
                  void mutate({ action: 'setLeaveBalance', memberId: worker.id, kind: data.kind, hoursEntitled: data.hoursEntitled, hoursUsed: data.hoursUsed }, 'Leave balance updated.');
                }}
              >
                <p className="font-semibold">{worker.name}</p>
                <p className="mt-1 text-xs text-[#687873]">
                  {(balances.length ? balances : [{ kind: 'vacation' as LeaveKind, hoursEntitled: 0, hoursUsed: 0 }]).map((row) => `${row.kind}: ${remainingLeaveHours({ memberId: worker.id, kind: row.kind as LeaveKind, hoursEntitled: row.hoursEntitled, hoursUsed: row.hoursUsed })}h left`).join(' · ')}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-4">
                  <label className="grid gap-1 text-xs font-semibold">Kind
                    <select name="kind" defaultValue="vacation" className="min-h-11 rounded-xl border border-[#d7dfd7] bg-white px-2 text-sm">
                      <option value="vacation">Vacation</option>
                      <option value="sick">Sick</option>
                      <option value="other">Other</option>
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold">Entitled<input name="hoursEntitled" type="number" step="any" defaultValue={balances.find((row) => row.kind === 'vacation')?.hoursEntitled ?? 80} className="min-h-11 rounded-xl border border-[#d7dfd7] px-2 text-sm" /></label>
                  <label className="grid gap-1 text-xs font-semibold">Used<input name="hoursUsed" type="number" step="any" defaultValue={balances.find((row) => row.kind === 'vacation')?.hoursUsed ?? 0} className="min-h-11 rounded-xl border border-[#d7dfd7] px-2 text-sm" /></label>
                  <div className="flex items-end"><Button type="submit" disabled={busy} variant="outline" className="min-h-11 w-full">Save</Button></div>
                </div>
              </form>
            );
          })}
          {!workers.length && <p className="text-sm text-[#687873]">No care workers yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

function DocumentsTab({ state, workers, mutate, busy }: { state: HouseholdState; workers: Member[]; mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>; busy: boolean }) {
  const docs = (state.hrDocuments ?? []).filter((doc) => !doc.archivedAt);
  const acks = state.hrDocumentAcks ?? [];
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <h2 className="flex items-center gap-2 text-lg font-bold"><FileText className="size-5 text-[#287b6f]" aria-hidden="true" />Add or update document</h2>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            void mutate({ action: 'saveHrDocument', ...data, required: data.required === 'on' }, 'Document saved.').then(() => event.currentTarget.reset());
          }}
        >
          <label htmlFor="hr-doc-title" className="grid gap-1 text-sm font-semibold">Title<Input id="hr-doc-title" name="title" required className="min-h-11" /></label>
          <label className="grid gap-1 text-sm font-semibold">Category
            <select name="category" defaultValue="policy" className="min-h-11 rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm">
              <option value="policy">Policy</option>
              <option value="contract">Contract</option>
              <option value="handbook">Handbook</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold">Body<textarea name="body" rows={6} className="min-h-32 rounded-xl border border-[#d7dfd7] bg-white px-3 py-2 text-sm" /></label>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" name="required" defaultChecked /> Required acknowledgment</label>
          <Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f]"><Check className="size-4" />Save document</Button>
        </form>
      </Panel>
      <Panel>
        <h2 className="text-lg font-bold">Active documents</h2>
        <div className="mt-4 space-y-3">
          {docs.map((doc) => {
            const signed = workers.filter((worker) => acks.some((ack) => ack.documentId === doc.id && ack.memberId === worker.id)).length;
            return (
              <div key={doc.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{doc.title}</p>
                    <p className="text-xs capitalize text-[#687873]">{doc.category}{doc.required ? ' · required' : ''} · {signed}/{workers.length} acknowledged</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" disabled={busy} className="min-h-11" onClick={() => void mutate({ action: 'archiveHrDocument', documentId: doc.id }, 'Document archived.')}>Archive</Button>
                </div>
                <p className="mt-2 line-clamp-3 text-sm leading-6 text-[#52645f]">{doc.body || 'No body text.'}</p>
              </div>
            );
          })}
          {!docs.length && <p className="rounded-xl bg-[#f7f6f1] p-4 text-center text-sm text-[#687873]">No policies or contracts yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

function OnboardingTab({ state, workers, mutate, busy }: { state: HouseholdState; workers: Member[]; mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>; busy: boolean }) {
  const [selected, setSelected] = useState(workers[0]?.id ?? '');
  const memberId = selected || workers[0]?.id || '';
  const items = (state.hireChecklistItems ?? []).filter((item) => item.memberId === memberId).sort((a, b) => a.sortOrder - b.sortOrder);
  const done = items.filter((item) => item.done).length;
  return (
    <Panel>
      <h2 className="flex items-center gap-2 text-lg font-bold"><BadgeCheck className="size-5 text-[#287b6f]" aria-hidden="true" />Hire checklists</h2>
      <p className="mt-1 text-sm text-[#687873]">Track onboarding for each care worker. New invites get a default checklist automatically.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {workers.map((worker) => (
          <button key={worker.id} type="button" onClick={() => setSelected(worker.id)} className={`min-h-11 rounded-xl px-3 text-sm font-semibold ${memberId === worker.id ? 'bg-[#287b6f] text-white' : 'border border-[#d7dfd7] bg-white text-[#52645f]'}`}>{worker.name}</button>
        ))}
      </div>
      {memberId ? (
        <>
          <p className="mt-4 text-sm font-semibold text-[#4d6b5e]">{done} of {items.length} done</p>
          <ul className="mt-3 space-y-2">
            {items.map((item) => (
              <li key={item.id}>
                <button type="button" disabled={busy} onClick={() => void mutate({ action: 'toggleHireChecklistItem', itemId: item.id }, item.done ? 'Marked incomplete.' : 'Checklist item done.')} className={`flex min-h-12 w-full items-center gap-3 rounded-xl border px-3 text-left text-sm ${item.done ? 'border-[#cfe0d3] bg-[#f4f7f2] text-[#687873] line-through' : 'border-[#e2e8e1] bg-white'}`}>
                  <span className={`grid size-6 place-items-center rounded-full ${item.done ? 'bg-[#287b6f] text-white' : 'border-2 border-[#c6d2c8]'}`}>{item.done ? <Check className="size-3.5" aria-hidden="true" /> : null}</span>
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
          {!items.length && (
            <Button type="button" disabled={busy} className="mt-4 min-h-11 bg-[#287b6f]" onClick={() => void mutate({ action: 'seedHireChecklist', memberId }, 'Hire checklist created.')}>Seed checklist</Button>
          )}
          <form className="mt-4 flex flex-wrap gap-2" onSubmit={(event) => { event.preventDefault(); const title = new FormData(event.currentTarget).get('title'); void mutate({ action: 'addHireChecklistItem', memberId, title }, 'Checklist item added.').then(() => event.currentTarget.reset()); }}>
            <Input name="title" required placeholder="Add a custom step…" className="min-h-11 flex-1" />
            <Button type="submit" disabled={busy} variant="outline" className="min-h-11">Add</Button>
          </form>
        </>
      ) : <p className="mt-4 text-sm text-[#687873]">Invite a care worker to start onboarding.</p>}
    </Panel>
  );
}

function PayrollTab({ state, workers, mutate, busy }: { state: HouseholdState; workers: Member[]; mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>; busy: boolean }) {
  const openPeriod = (state.payPeriods ?? []).find((period) => period.status === 'open' || period.status === 'review');
  const latestClosed = [...(state.payPeriods ?? [])].filter((period) => period.status === 'closed').sort((a, b) => b.endOn.localeCompare(a.endOn))[0];
  const today = new Date().toISOString().slice(0, 10);
  const ready = payPeriodReadyToClose(openPeriod, today);
  const runs = state.payRuns ?? [];
  const lines = state.payRunLines ?? [];
  const preview = useMemo(() => {
    if (!openPeriod) return [];
    return workers.map((worker) => {
      const entries = (state.timeEntries ?? []).filter((entry) => entry.memberId === worker.id);
      const { hours } = aggregateWorkerHours(entries, openPeriod.startOn, openPeriod.endOn);
      return { worker, hours, gross: grossFor(hours, worker.hourlyRate ?? null) };
    });
  }, [openPeriod, workers, state.timeEntries]);
  const periodEntries = openPeriod
    ? (state.timeEntries ?? []).filter((entry) => entry.startedAt.slice(0, 10) >= openPeriod.startOn && entry.startedAt.slice(0, 10) <= openPeriod.endOn).slice(0, 12)
    : [];

  return (
    <div className="grid gap-6">
      <Panel data-guide="payroll-bookkeeper">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDollarSign className="size-5 text-[#287b6f]" aria-hidden="true" />Current pay period</h2>
            <p className="mt-1 text-sm text-[#687873]">
              {openPeriod ? `${openPeriod.startOn} → ${openPeriod.endOn} · ${openPeriod.status}${ready ? ' · ready to close' : ''}` : 'No open period — create one to start.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!openPeriod && <Button type="button" disabled={busy} className="min-h-11 bg-[#287b6f]" onClick={() => void mutate({ action: 'ensurePayPeriods' }, 'Pay period opened.')}>Open period</Button>}
            {openPeriod && (
              <>
                <a href={`/api/payroll?from=${openPeriod.startOn}&to=${openPeriod.endOn}`} className="inline-flex min-h-11 items-center rounded-xl border border-[#d7dfd7] px-4 text-sm font-semibold text-[#52645f] hover:bg-[#f1f5f1]">Download CSV</a>
                <Button type="button" disabled={busy || !state.settings?.bookkeeperEmail} variant="outline" className="min-h-11" onClick={() => void mutate({ action: 'sendPayrollReport', from: openPeriod.startOn, to: openPeriod.endOn }, 'Payroll report emailed to the bookkeeper.')}><Mail className="size-4" aria-hidden="true" />Email bookkeeper</Button>
                {openPeriod.status === 'open' && <Button type="button" disabled={busy} variant="outline" className="min-h-11" onClick={() => void mutate({ action: 'startPayPeriodReview' }, 'Pay period marked for review.')}>Mark for review</Button>}
                <Button type="button" disabled={busy} className="min-h-11 bg-[#287b6f]" onClick={() => void mutate({ action: 'closePayRun' }, 'Pay run closed.')}>Close pay run</Button>
              </>
            )}
            {latestClosed && (
              <Button type="button" disabled={busy} variant="outline" className="min-h-11" onClick={() => void mutate({ action: 'reopenPayPeriod', periodId: latestClosed.id }, 'Pay period reopened.')}>Reopen last period</Button>
            )}
          </div>
        </div>
        {openPeriod && (
          <div className="mt-4 space-y-2">
            {preview.map(({ worker, hours, gross }) => (
              <div key={worker.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#e2e8e1] bg-white p-3 text-sm">
                <span className="font-semibold">{worker.name}</span>
                <span className="tabular-nums text-[#687873]">{hours.toFixed(2)} h · {worker.hourlyRate != null ? `$${gross.toFixed(2)} gross` : 'no rate'}</span>
              </div>
            ))}
          </div>
        )}
        {openPeriod && (
          <div className="mt-4 border-t border-[#e5eae4] pt-4">
            <h3 className="text-sm font-bold">Time entries in this period</h3>
            <p className="mt-1 text-xs text-[#687873]">Delete incorrect entries in Settings → Hours tracked. Clock corrections are made by workers on Today.</p>
            <ul className="mt-2 divide-y divide-[#e5eae4] text-sm">
              {periodEntries.map((entry) => {
                const worker = workers.find((item) => item.id === entry.memberId);
                return (
                  <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span className="font-medium">{worker?.name ?? 'Care worker'}</span>
                    <span className="tabular-nums text-xs text-[#687873]">{new Date(entry.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} → {entry.endedAt ? new Date(entry.endedAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'now'}</span>
                    <button type="button" disabled={busy} className="text-xs font-semibold text-[#873d27]" onClick={() => void mutate({ action: 'deleteTimeEntry', entryId: entry.id }, 'Time entry removed.')}>Delete</button>
                  </li>
                );
              })}
              {!periodEntries.length && <li className="py-3 text-[#687873]">No clock entries in this period yet.</li>}
            </ul>
          </div>
        )}
        <form
          className="mt-6 grid gap-3 border-t border-[#e5eae4] pt-4 sm:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            void mutate({
              action: 'updateHouseholdSettings',
              recurrenceHorizonDays: state.settings?.recurrenceHorizonDays ?? 30,
              reminderDefaultLeadDays: state.settings?.reminderDefaultLeadDays ?? 1,
              fundedHoursMonthly: state.settings?.fundedHoursMonthly ?? 0,
              fundingHourlyRate: state.settings?.fundingHourlyRate ?? 0,
              bookkeeperEmail: data.bookkeeperEmail,
              defaultVacationHours: data.defaultVacationHours,
              payPeriodDays: data.payPeriodDays,
              payPeriodAnchor: data.payPeriodAnchor,
            }, 'Payroll settings saved.');
          }}
        >
          <label htmlFor="hr-bookkeeper-email" className="grid gap-1 text-sm font-semibold">Bookkeeper email<Input id="hr-bookkeeper-email" name="bookkeeperEmail" type="email" defaultValue={state.settings?.bookkeeperEmail ?? ''} className="min-h-11" /></label>
          <label className="grid gap-1 text-sm font-semibold">Default vacation hours<input name="defaultVacationHours" type="number" step="any" defaultValue={state.settings?.defaultVacationHours ?? 80} className="min-h-11 rounded-xl border border-[#d7dfd7] px-3 text-sm" /></label>
          <label className="grid gap-1 text-sm font-semibold">Pay period length (days)<input name="payPeriodDays" type="number" defaultValue={state.settings?.payPeriodDays ?? 14} className="min-h-11 rounded-xl border border-[#d7dfd7] px-3 text-sm" /></label>
          <label className="grid gap-1 text-sm font-semibold">Pay period anchor date<input name="payPeriodAnchor" type="date" defaultValue={state.settings?.payPeriodAnchor ?? '2025-01-06'} className="min-h-11 rounded-xl border border-[#d7dfd7] px-3 text-sm" /></label>
          <div className="sm:col-span-2"><Button type="submit" disabled={busy} variant="outline" className="min-h-11">Save payroll settings</Button></div>
        </form>
      </Panel>
      <Panel>
        <h2 className="text-lg font-bold">Closed pay runs</h2>
        <div className="mt-4 space-y-3">
          {runs.map((run) => {
            const period = (state.payPeriods ?? []).find((item) => item.id === run.periodId);
            const runLines = lines.filter((line) => line.runId === run.id);
            return (
              <div key={run.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
                <p className="font-semibold">{period ? `${period.startOn} → ${period.endOn}` : run.periodId}</p>
                <p className="text-xs text-[#687873]">Closed {new Date(run.closedAt).toLocaleString()}</p>
                <ul className="mt-2 space-y-1 text-sm">
                  {runLines.map((line) => {
                    const worker = workers.find((item) => item.id === line.memberId);
                    return (
                      <li key={line.id} className="flex flex-wrap items-center justify-between gap-2">
                        <span>{worker?.name ?? 'Care worker'} · {line.hours.toFixed(2)}h · ${line.grossAmount.toFixed(2)}</span>
                        <a href={`/api/wage-statements?runId=${run.id}&memberId=${line.memberId}`} className="text-xs font-semibold text-[#287b6f] underline-offset-2 hover:underline">Wage statement</a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {!runs.length && <p className="rounded-xl bg-[#f7f6f1] p-4 text-center text-sm text-[#687873]">No closed pay runs yet.</p>}
        </div>
      </Panel>
    </div>
  );
}

export function WorkerHrCards({
  state,
  member,
  mutate,
  busy,
}: {
  state: HouseholdState;
  member: Member;
  mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const balances = state.leaveBalances ?? [];
  const requests = state.leaveRequests ?? [];
  const docs = (state.hrDocuments ?? []).filter((doc) => !doc.archivedAt);
  const acks = new Set((state.hrDocumentAcks ?? []).map((ack) => ack.documentId));
  const checklist = (state.hireChecklistItems ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
  const openPeriod = (state.payPeriods ?? []).find((period) => period.status === 'open' || period.status === 'review');
  const myLines = state.payRunLines ?? [];
  const runs = state.payRuns ?? [];
  const periodHours = openPeriod
    ? aggregateWorkerHours((state.timeEntries ?? []).filter((entry) => entry.memberId === member.id), openPeriod.startOn, openPeriod.endOn).hours
    : 0;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <Panel>
        <h2 className="font-bold">Request time off</h2>
        <form
          className="mt-3 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const data = Object.fromEntries(new FormData(event.currentTarget));
            void mutate({ action: 'requestLeave', ...data }, 'Leave request submitted.').then(() => event.currentTarget.reset());
          }}
        >
          <label className="grid gap-1 text-sm font-semibold">Kind
            <select name="kind" defaultValue="vacation" className="min-h-11 rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm">
              <option value="vacation">Vacation</option>
              <option value="sick">Sick</option>
              <option value="other">Other</option>
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1 text-sm font-semibold">From<input name="startOn" type="date" required defaultValue={today} className="min-h-11 rounded-xl border border-[#d7dfd7] px-2 text-sm" /></label>
            <label className="grid gap-1 text-sm font-semibold">To<input name="endOn" type="date" required defaultValue={today} className="min-h-11 rounded-xl border border-[#d7dfd7] px-2 text-sm" /></label>
          </div>
          <label className="grid gap-1 text-sm font-semibold">Hours<input name="hours" type="number" step="any" defaultValue={8} className="min-h-11 rounded-xl border border-[#d7dfd7] px-3 text-sm" /></label>
          <label className="grid gap-1 text-sm font-semibold">Note<textarea name="note" rows={2} className="rounded-xl border border-[#d7dfd7] px-3 py-2 text-sm" /></label>
          <Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f]">Submit request</Button>
        </form>
        <p className="mt-3 text-xs text-[#687873]">
          Balances: {balances.length ? balances.map((row) => `${row.kind} ${remainingLeaveHours(row)}h left`).join(' · ') : 'Not set yet'}
        </p>
        <ul className="mt-2 space-y-1 text-xs text-[#687873]">
          {requests.slice(0, 5).map((request) => (
            <li key={request.id} className="flex items-center justify-between gap-2">
              <span>{request.kind} {request.startOn} ({request.status})</span>
              {request.status === 'pending' && <button type="button" disabled={busy} className="font-semibold text-[#873d27]" onClick={() => void mutate({ action: 'cancelLeaveRequest', requestId: request.id }, 'Leave request cancelled.')}>Cancel</button>}
            </li>
          ))}
        </ul>
      </Panel>
      <Panel>
        <h2 className="font-bold">Policies to acknowledge</h2>
        <div className="mt-3 space-y-3">
          {docs.map((doc) => (
            <div key={doc.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
              <p className="font-semibold">{doc.title}{doc.required ? ' *' : ''}</p>
              <p className="mt-1 line-clamp-4 text-sm leading-6 text-[#687873]">{doc.body}</p>
              {acks.has(doc.id) ? (
                <p className="mt-2 text-xs font-semibold text-[#216b61]">Acknowledged</p>
              ) : (
                <Button type="button" disabled={busy} variant="outline" className="mt-2 min-h-11" onClick={() => void mutate({ action: 'acknowledgeHrDocument', documentId: doc.id }, 'Document acknowledged.')}>I acknowledge</Button>
              )}
            </div>
          ))}
          {!docs.length && <p className="text-sm text-[#687873]">No policies posted yet.</p>}
        </div>
      </Panel>
      {checklist.length > 0 && (
        <Panel>
          <h2 className="font-bold">Your hire checklist</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {checklist.map((item) => (
              <li key={item.id} className={item.done ? 'text-[#687873] line-through' : 'font-medium'}>{item.title}</li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel>
        <h2 className="font-bold">Pay period &amp; statements</h2>
        <p className="mt-2 text-sm text-[#687873]">
          {openPeriod ? `Open period ${openPeriod.startOn} → ${openPeriod.endOn}: ${periodHours.toFixed(2)} h clocked${member.hourlyRate != null ? ` · est. $${(periodHours * member.hourlyRate).toFixed(2)}` : ''}.` : 'No open pay period.'}
        </p>
        <ul className="mt-3 space-y-2 text-sm">
          {myLines.slice(0, 8).map((line) => {
            const run = runs.find((item) => item.id === line.runId);
            const period = (state.payPeriods ?? []).find((item) => item.id === run?.periodId);
            return (
              <li key={line.id} className="flex items-center justify-between gap-2">
                <span>{period ? `${period.startOn} → ${period.endOn}` : 'Pay run'} · ${line.grossAmount.toFixed(2)}</span>
                <a href={`/api/wage-statements?runId=${line.runId}&memberId=${member.id}`} className="font-semibold text-[#287b6f] underline-offset-2 hover:underline">Statement</a>
              </li>
            );
          })}
          {!myLines.length && <li className="text-[#687873]">Wage statements appear after your manager closes a pay run.</li>}
        </ul>
      </Panel>
    </div>
  );
}
