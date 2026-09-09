'use client';
/* oxlint-disable typescript/no-explicit-any, next/no-img-element -- API photo URLs require authenticated, unoptimized requests; compact view prop types are intentionally structural. */

import { logOut } from '@/app/actions/auth';
import { useState } from 'react';
import { Bath, BedDouble, Bell, CalendarDays, Check, ChevronRight, ClipboardList, FileDown, Home, LayoutDashboard, MoreHorizontal, Pencil, Plus, Settings, Shield, Sofa, Sprout, Trash2, Upload, User, Users, Utensils, WashingMachine, X } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Chore, HouseholdState, Member } from '@/lib/household-data';

const areas = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Laundry', 'Outside', 'Other'];
const areaIcons = new Map<string, typeof Home>([['Kitchen', Utensils], ['Bathroom', Bath], ['Bedroom', BedDouble], ['Living room', Sofa], ['Laundry', WashingMachine], ['Outside', Sprout], ['Other', Home]]);
type ManagerSection = 'home' | 'tasks' | 'team' | 'more';
type WorkerSection = 'today' | 'tasks' | 'profile' | 'more';
type Section = ManagerSection | WorkerSection;

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function today() { return new Date().toISOString().slice(0, 10); }
function dateLabel(value: string | null) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'; }
function AvatarFor({ member, className = '' }: { member: Member; className?: string }) {
  return <Avatar className={className}>{member.profilePhotoId ? <img src={`/api/uploads/${member.profilePhotoId}`} alt="" className="size-full object-cover" /> : <AvatarFallback style={{ backgroundColor: member.color, color: 'white' }}>{initials(member.name)}</AvatarFallback>}</Avatar>;
}
const fieldClass = 'mt-1 min-h-11 w-full rounded-xl border border-[#d7dfd7] bg-white px-3 py-2 text-sm';
function Field({ label, name, defaultValue, type = 'text', required = false, readOnly = false }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; readOnly?: boolean }) {
  return <label className="block text-sm font-semibold">{label}<Input name={name} type={type} required={required} readOnly={readOnly} defaultValue={defaultValue ?? ''} className="mt-1 h-11 rounded-xl bg-white" /></label>;
}
function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="block text-sm font-semibold">{label}<textarea name={name} defaultValue={defaultValue} rows={3} className={fieldClass} /></label>;
}

export function HouseholdApp({ initialState, authenticatedId }: { initialState: HouseholdState; authenticatedId: string }) {
  const [state, setState] = useState(initialState);
  const member = state.members.find((item) => item.id === authenticatedId) ?? state.members[0];
  const manager = member?.role === 'manager';
  const [section, setSection] = useState<Section>(manager ? 'home' : 'today');
  const [task, setTask] = useState<Chore | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  if (!member) return null;

  async function mutate(payload: Record<string, unknown>, message = 'Saved.') {
    setBusy(true);
    try {
      const response = await fetch('/api/household', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as HouseholdState & { error?: string };
      if (!response.ok) throw new Error(result.error || 'The update could not be saved.');
      setState(result); setNotice(message);
      if (task) setTask(result.chores.find((item) => item.id === task.id) ?? null);
      if (profile) setProfile(result.members.find((item) => item.id === profile.id) ?? null);
      return result;
    } catch (error) { setNotice(error instanceof Error ? error.message : 'The update could not be saved.'); throw error; }
    finally { setBusy(false); }
  }
  async function submit(event: { preventDefault(): void; currentTarget: HTMLFormElement }, action: string, message: string, close?: () => void) {
    event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
    try { await mutate({ action, ...values }, message); close?.(); } catch { /* notice is shown */ }
  }
  async function upload(file: File, target: { choreId?: string; profileMemberId?: string }) {
    const data = new FormData(); data.set('photo', file); Object.entries(target).forEach(([key, value]) => value && data.set(key, value));
    setBusy(true);
    try { const response = await fetch('/api/uploads', { method: 'POST', body: data }); const result = await response.json(); if (!response.ok) throw new Error(result.error); await refresh('Photo uploaded.'); }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Upload failed.'); } finally { setBusy(false); }
  }
  async function refresh(message = '') { const response = await fetch('/api/household', { cache: 'no-store' }); const next = await response.json() as HouseholdState; setState(next); setTask((old) => old ? next.chores.find((item) => item.id === old.id) ?? null : null); setProfile((old) => old ? next.members.find((item) => item.id === old.id) ?? null : null); if (message) setNotice(message); }
  async function deletePhoto(id: string) { setBusy(true); try { const response = await fetch(`/api/uploads/${id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Photo could not be deleted.'); await refresh('Photo deleted.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Delete failed.'); } finally { setBusy(false); } }

  const workers = state.members.filter((item) => item.role === 'worker');
  const open = state.chores.filter((item) => item.status !== 'complete');
  const dueToday = open.filter((item) => item.dueDate === today());
  const nav = manager
    ? [['home', 'Overview', LayoutDashboard], ['tasks', 'Tasks', ClipboardList], ['team', 'Team', Users], ['more', 'Settings', Settings]] as const
    : [['today', 'Today', Home], ['tasks', 'Tasks', ClipboardList], ['profile', 'Profile', User], ['more', 'More', MoreHorizontal]] as const;

  return (
    <div className="careboard min-h-screen bg-[#f7f6f1] text-[#20312d]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#287b6f] focus:px-4 focus:py-2 focus:text-white">
        Skip to dashboard content
      </a>

      {/* Mobile header */}
      <header className="fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#dfe5dc] bg-[#fcfbf7]/95 px-4 backdrop-blur md:hidden">
        <button onClick={() => setSection(manager ? 'home' : 'today')} className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
          <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
          <span className="text-lg font-bold">CareBoard</span>
        </button>
        <div className="flex items-center gap-2">
          <form action={logOut}><button className="min-h-11 rounded-xl px-3 text-sm font-semibold text-[#287b6f]">Sign out</button></form>
          <AvatarFor member={member} className="size-9" />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="fixed left-0 top-0 hidden h-screen w-64 flex-col overflow-y-auto border-r border-[#dfe5dc] bg-[#fffefa] md:flex" aria-label="Main navigation">
        <div className="flex h-16 items-center gap-3 border-b border-[#dfe5dc] px-5">
          <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
          <span className="text-lg font-bold">CareBoard</span>
        </div>
        <nav className="flex flex-1 flex-col gap-1 p-4">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${section === id ? 'bg-[#287b6f] text-white' : 'text-[#52645f] hover:bg-[#f1f5f1]'}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </nav>
        <div className="border-t border-[#dfe5dc] p-4">
          <div className="flex items-center gap-3 rounded-2xl bg-[#f7f6f1] p-3">
            <AvatarFor member={member} className="size-10" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{member.name}</p>
              <p className="truncate text-xs text-[#687873]">{manager ? 'Manager' : 'Care worker'}</p>
            </div>
          </div>
          <form action={logOut} className="mt-3">
            <button className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm font-semibold text-[#52645f] transition hover:bg-[#f1f5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main id="main" tabIndex={-1} className="dashboard-main min-h-screen pt-16 md:pl-64 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-7">
          {manager ? (
            <ManagerView section={section as ManagerSection} state={state} workers={workers} open={open} dueToday={dueToday} setTask={setTask} setProfile={setProfile} setCreateOpen={setCreateOpen} setAddOpen={setAddOpen} setResetMember={setResetMember} mutate={mutate} busy={busy} />
          ) : (
            <WorkerView section={section as WorkerSection} state={state} member={member} dueToday={dueToday} setTask={setTask} setProfile={setProfile} />
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#d7dfd7] bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(32,49,45,.08)] backdrop-blur md:hidden" aria-label="Mobile navigation">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {nav.map(([id, label, Icon]) => (
            <button
              key={id}
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${section === id ? 'bg-[#e6f0eb] text-[#287b6f]' : 'text-[#687873]'}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </nav>

      <TaskDialog task={task} manager={manager} workers={workers} busy={busy} onClose={() => setTask(null)} mutate={mutate} upload={upload} deletePhoto={deletePhoto} />
      <ProfileDialog profile={profile} manager={manager} busy={busy} onClose={() => setProfile(null)} submit={submit} upload={upload} />
      <CreateDialog open={createOpen} workers={workers} busy={busy} onClose={() => setCreateOpen(false)} submit={submit} />
      <AddWorkerDialog open={addOpen} busy={busy} onClose={() => setAddOpen(false)} submit={submit} />
      <ResetDialog member={resetMember} busy={busy} onClose={() => setResetMember(null)} submit={submit} />
      <output aria-live="polite" aria-atomic="true" className="dashboard-notice fixed inset-x-4 z-50 ml-auto max-w-sm md:bottom-6 md:left-auto">
        {notice && <span className="flex items-center gap-3 rounded-2xl bg-[#20312d] p-3 pl-4 text-sm text-white shadow-xl">
          <span className="min-w-0 flex-1 break-words">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss notification" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/10"><X className="size-4" aria-hidden="true" /></button>
        </span>}
      </output>
    </div>
  );
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`rounded-2xl border border-[#dfe5dc] bg-[#fffefa] p-5 shadow-sm ${className}`}>{children}</section>; }
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-[#e8f1ec] text-[#287b6f]',
    in_progress: 'bg-[#fcf4e9] text-[#9e6b2e]',
    complete: 'bg-[#e6f0eb] text-[#216b61]',
    disabled: 'bg-[#f0f0f0] text-[#687873]',
  };
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] ?? 'bg-[#f0f0f0] text-[#687873]'}`}>{status.replace('_', ' ')}</span>;
}

function ManagerView({ section, state, workers, open, dueToday, setTask, setProfile, setCreateOpen, setAddOpen, setResetMember, mutate, busy }: any) {
  if (section === 'tasks') return (
    <>
      <Title title="Tasks" text="Plan, assign, edit, and review household work." action={<Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button>} />
      <Card className="p-0">
        <div className="border-b border-[#dfe5dc] px-5 py-4"><h2 className="font-semibold">All household tasks</h2><p className="text-sm text-[#687873]">{state.chores.length} total · {open.length} open</p></div>
        <TaskList tasks={state.chores} members={state.members} onOpen={setTask} />
      </Card>
    </>
  );
  if (section === 'team') return (
    <>
      <Title title="Care team" text="Detailed profiles are visible only to the household manager." action={<Button onClick={() => setAddOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add worker</Button>} />
      {!workers.length && <Card><div className="flex flex-col items-center py-6 text-center"><span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><Users className="size-6" aria-hidden="true" /></span><h2 className="text-lg font-semibold">Build your care team</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#52645f]">Add your first worker to start sharing household tasks and coordinating care.</p><Button onClick={() => setAddOpen(true)} className="mt-5 min-h-11 bg-[#287b6f]"><Plus className="size-4" />Add worker</Button></div></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {workers.map((worker: Member) => (
          <Card key={worker.id}>
            <div className="flex items-start gap-3">
              <AvatarFor member={worker} className="size-12" />
              <div className="min-w-0 flex-1">
                <h2 className="font-bold">{worker.name}</h2>
                <p className="truncate text-sm text-[#687873]">{worker.email}</p>
                <div className="mt-1"><StatusBadge status={worker.status} /></div>
              </div>
            </div>
            <div className="mt-4 grid gap-2 text-sm">
              <p><span className="text-[#687873]">Availability:</span> {worker.availability || 'Not provided'}</p>
              <p><span className="text-[#687873]">Languages:</span> {worker.languages || 'Not provided'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setProfile(worker)}><Pencil className="size-4" />Profile</Button>
              <Button variant="outline" size="sm" onClick={() => setResetMember(worker)}>Reset password</Button>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => mutate({ action: worker.status === 'disabled' ? 'reactivateMember' : 'disableMember', memberId: worker.id }, worker.status === 'disabled' ? 'Worker reactivated.' : 'Worker disabled.')}>
                {worker.status === 'disabled' ? 'Reactivate' : 'Disable'}
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
  if (section === 'more') return <MoreManager state={state} mutate={mutate} busy={busy} />;
  return (
    <>
      <Title title="Household overview" text="Everything the care team needs, without exposing private worker details." action={<Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Open" value={state.metrics?.open ?? open.length} icon={ClipboardList} />
        <Metric label="Due today" value={state.metrics?.dueToday ?? dueToday.length} icon={CalendarDays} />
        <Metric label="Overdue" value={state.metrics?.overdue ?? 0} icon={Shield} tone="caution" />
        <Metric label="Completed" value={state.metrics?.completed ?? 0} icon={Check} tone="success" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <div><h2 className="text-lg font-bold">Needs attention</h2><p className="text-sm text-[#687873]">Open tasks sorted by priority and date</p></div>
            <Button variant="outline" size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-4" />New</Button>
          </div>
          <TaskList tasks={open.slice(0, 8)} members={state.members} onOpen={setTask} compact />
          {open.length > 8 && <p className="mt-3 text-center text-xs text-[#687873]">Showing 8 of {open.length} open tasks. View Tasks for the full list.</p>}
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Bell className="size-5 text-[#287b6f]" aria-hidden="true" />Reminders</h2>
          <p className="text-sm text-[#687873]">Tasks coming up within the reminder window</p>
          <div className="mt-3 space-y-3">
            {state.reminders.length ? state.reminders.map((item: Chore) => (
              <button key={item.id} onClick={() => setTask(item)} className="block min-h-11 w-full rounded-xl bg-[#f1f5f1] p-3 text-left text-sm transition hover:bg-[#e7ede9]">
                <b>{item.title}</b>
                <span className="block text-[#687873]">{dateLabel(item.dueDate)}</span>
              </button>
            )) : <p className="rounded-xl bg-[#f7f6f1] p-4 text-center text-sm text-[#687873]">No reminders right now.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}

function MoreManager({ state, mutate, busy }: any) {
  const settings = state.settings;
  const month = today().slice(0, 7);
  return (
    <>
      <Title title="Settings & reports" text="Household settings, monthly reports, and immutable audit history." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-lg font-bold">Settings</h2>
          <p className="text-sm text-[#687873]">Tune automation without changing privacy policy.</p>
          <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); mutate({ action: 'updateHouseholdSettings', ...data, retentionDays: 90 }, 'Settings saved.'); }}>
            <Field label="Recurrence horizon (days)" name="recurrenceHorizonDays" type="number" defaultValue={settings?.recurrenceHorizonDays ?? 30} />
            <Field label="Default reminder lead (days)" name="reminderDefaultLeadDays" type="number" defaultValue={settings?.reminderDefaultLeadDays ?? 1} />
            <Field label="Photo retention (days, fixed privacy policy)" name="retentionDays" type="number" defaultValue={90} readOnly />
            <Button disabled={busy} className="min-h-11 bg-[#287b6f]">Save settings</Button>
          </form>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">Monthly report</h2>
          <p className="mt-2 text-sm text-[#687873]">Export tasks, assignments, completion details, issues, notes, and team records.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="On time" value={state.metrics?.completedOnTime ?? 0} icon={Check} tone="success" />
            <Metric label="Open issues" value={state.chores.filter((t: Chore) => t.issueOpen).length} icon={Shield} tone="caution" />
          </div>
          <a href={`/api/export?from=${month}-01&to=${today()}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white transition hover:bg-[#216b61]">
            <FileDown className="size-4" />Download monthly CSV
          </a>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="text-lg font-bold">Audit history</h2>
        <p className="mt-1 text-sm text-[#687873]">Append-only operational history; entries cannot be edited or deleted.</p>
        <div className="mt-4 max-h-[32rem] divide-y overflow-auto rounded-xl border border-[#dfe5dc]">
          {(state.audit ?? []).length ? (state.audit ?? []).map((entry: any) => {
            const actor = state.members.find((m: Member) => m.id === entry.actorId)?.name ?? entry.actorId;
            return (
              <div key={entry.id} className="flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{entry.action.replace(/_/g, ' ')}</p>
                  <p className="text-xs text-[#687873]">{actor}{entry.detail ? ` · ${entry.detail}` : ''}</p>
                </div>
                <time className="shrink-0 text-xs text-[#687873]">{new Date(entry.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </div>
            );
          }) : <p className="p-4 text-center text-sm text-[#687873]">No audit entries yet.</p>}
        </div>
      </Card>
    </>
  );
}

function WorkerView({ section, state, member, dueToday, setTask, setProfile }: any) {
  if (section === 'profile') return (
    <>
      <Title title="Your profile" text="You control your contact, availability, languages, and profile photo." />
      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <AvatarFor member={member} className="size-16" />
          <div>
            <h2 className="text-xl font-bold">{member.name}</h2>
            <p className="text-sm text-[#687873]">Care worker</p>
          </div>
        </div>
        <div className="mt-5 grid gap-2 text-sm">
          <p><span className="text-[#687873]">Phone:</span> {member.phone || 'Not provided'}</p>
          <p><span className="text-[#687873]">Availability:</span> {member.availability || 'Not provided'}</p>
          <p><span className="text-[#687873]">Languages:</span> {member.languages || 'Not provided'}</p>
        </div>
        <Button onClick={() => setProfile(member)} className="mt-5 min-h-11 bg-[#287b6f]"><Pencil className="size-4" />Edit your profile</Button>
      </Card>
    </>
  );
  if (section === 'more') return (
    <>
      <Title title="More" text="Account and privacy." />
      <Card>
        <div className="flex items-center gap-3">
          <span className="grid size-10 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><Shield className="size-5" aria-hidden="true" /></span>
          <h2 className="font-bold">Privacy</h2>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#687873]">You can see only your profile, tasks assigned to you, and tasks available to claim. Other workers’ contact details, activity, reports, settings, and audit records remain private.</p>
      </Card>
    </>
  );
  const tasks = section === 'today' ? dueToday : state.chores;
  return (
    <>
      <Title title={section === 'today' ? `Today, ${member.name}` : 'Tasks'} text={section === 'today' ? 'Focus on work due today and current reminders.' : 'Your assigned work and tasks available to claim.'} />
      <Card className="p-0">
        <div className="border-b border-[#dfe5dc] px-5 py-4">
          <h2 className="font-semibold">{section === 'today' ? `Due today` : 'Your task list'}</h2>
          <p className="text-sm text-[#687873]">{tasks.length} {tasks.length === 1 ? 'task' : 'tasks'}</p>
        </div>
        <TaskList tasks={tasks} members={[member]} onOpen={setTask} />
      </Card>
      {section === 'today' && !tasks.length && <Card className="mt-4"><p className="text-center text-[#687873]">Nothing is due today. Check Tasks for available work.</p></Card>}
    </>
  );
}

function Title({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="welcome-banner mb-6 flex flex-wrap items-end justify-between gap-5"><div className="min-w-0 flex-1 basis-64"><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-[#287b6f]">Your household, connected</p><h1 className="welcome-title break-words text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#52645f]">{text}</p></div>{action && <div className="shrink-0 [&_button]:min-h-11">{action}</div>}</div>; }
function Metric({ label, value, icon: Icon, tone = 'neutral' }: { label: string; value: number; icon?: React.ComponentType<{ className?: string }>; tone?: 'neutral' | 'caution' | 'success' }) {
  const toneStyles = {
    neutral: 'bg-[#fffefa]',
    caution: 'bg-[#fcf4e9] border-[#eadbc6]',
    success: 'bg-[#e8f4ef] border-[#c7e3d9]',
  };
  return (
    <Card className={`flex min-w-0 flex-col gap-4 p-4 ${toneStyles[tone]}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-[#52645f]">{label}</p>
        {Icon && <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${tone === 'caution' ? 'bg-[#f4e7cf] text-[#805322]' : 'bg-[#dcece4] text-[#216b61]'}`}><Icon className="size-4" aria-hidden="true" /></span>}
      </div>
      <p className="break-words text-4xl font-semibold tracking-tight tabular-nums">{value}</p>
    </Card>
  );
}

function TaskList({ tasks, members, onOpen, compact = false }: { tasks: Chore[]; members: Member[]; onOpen: (task: Chore) => void; compact?: boolean }) {
  if (!tasks.length) return <div className="flex flex-col items-center px-5 py-10 text-center"><span className="mb-3 grid size-12 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><ClipboardList className="size-6" aria-hidden="true" /></span><p className="font-semibold">No tasks to show</p><p className="mt-1 max-w-xs text-sm leading-6 text-[#52645f]">Tasks will appear here as work is planned for your household.</p></div>;
  return (
    <div className={compact ? 'divide-y' : 'grid gap-3 p-5'}>
      {tasks.map((task) => {
        const assigned = members.find((m) => m.id === task.assignedTo);
        const AreaIcon = areaIcons.get(task.area) ?? Home;
        const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
        const priorityClass = priorityOrder[task.priority] <= 1 ? 'text-[#9e6b2e]' : 'text-[#687873]';
        return (
          <button
            key={task.id}
            onClick={() => onOpen(task)}
            className={`group flex w-full items-center gap-3 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${compact ? 'min-h-14 rounded-xl px-2 py-4 hover:bg-[#f1f5f1]' : 'min-h-16 rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm hover:border-[#b7c9bc] hover:bg-[#f8faf7]'}`}
          >
            <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${task.status === 'complete' ? 'bg-[#287b6f] text-white' : 'bg-[#e8f1ec] text-[#287b6f]'}`}>
              {task.status === 'complete' ? <Check className="size-5" aria-hidden="true" /> : <AreaIcon className="size-5" aria-hidden="true" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold">{task.title}</span>
              <span className="mt-1 block text-xs leading-5 text-[#52645f]">{task.area} · {dateLabel(task.dueDate)}{task.dueTime ? ` at ${task.dueTime}` : ''}</span>
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"><StatusBadge status={task.status} /><span className="text-xs text-[#52645f]">{assigned?.name ?? 'Available'}</span>{priorityOrder[task.priority] <= 1 && <span className={`text-xs font-semibold capitalize ${priorityClass}`}>{task.priority} priority</span>}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[#687873] transition group-hover:text-[#287b6f]" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function TaskDialog({ task, manager, workers, busy, onClose, mutate, upload, deletePhoto }: any) {
  if (!task) return null;
  const editable = manager || (task.assignedTo && task.status !== 'complete');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{task.title}</DialogTitle>
          <DialogDescription>{task.area} · {dateLabel(task.dueDate)} · {task.status.replace('_', ' ')}</DialogDescription>
        </DialogHeader>
        {manager ? (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'updateTask', choreId: task.id, ...Object.fromEntries(new FormData(e.currentTarget)) }, 'Task updated.'); }}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Task title" name="title" defaultValue={task.title} required />
              <label className="text-sm font-semibold">Area<select name="area" defaultValue={task.area} className={fieldClass}>{areas.map(a => <option key={a}>{a}</option>)}</select></label>
              <Field label="Due date" name="dueDate" type="date" defaultValue={task.dueDate} />
              <Field label="Due time" name="dueTime" type="time" defaultValue={task.dueTime} />
              <label className="text-sm font-semibold">Priority<select name="priority" defaultValue={task.priority} className={fieldClass}><option>low</option><option>normal</option><option>high</option><option>urgent</option></select></label>
              <label className="text-sm font-semibold">Assign to<select name="assigneeId" defaultValue={task.assignedTo ?? ''} className={fieldClass}><option value="">Available to claim</option>{workers.filter((w: Member) => w.status === 'active').map((w: Member) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
              <label className="text-sm font-semibold">Repeat<select name="recurrence" defaultValue={task.recurrence ?? ''} className={fieldClass}><option value="">Never</option><option>daily</option><option>weekly</option><option>monthly</option></select></label>
              <Field label="Reminder lead days" name="reminderLeadDays" type="number" defaultValue={task.reminderLeadDays ?? 1} />
            </div>
            <TextArea label="Instructions" name="instructions" defaultValue={task.instructions} />
            <Button disabled={busy} className="bg-[#287b6f]">Save task changes</Button>
          </form>
        ) : editable ? (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'updateTask', choreId: task.id, ...Object.fromEntries(new FormData(e.currentTarget)), issueOpen: new FormData(e.currentTarget).get('issueOpen') === 'on' }, 'Task update saved.'); }}>
            <TextArea label="Progress notes" name="progressNotes" defaultValue={task.progressNotes} />
            <TextArea label="Completion notes" name="completionNotes" defaultValue={task.completionNotes} />
            <TextArea label="Issue or blocker" name="issueReport" defaultValue={task.issueReport} />
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="issueOpen" defaultChecked={task.issueOpen} />Issue still open</label>
            <Field label="Expected completion" name="expectedCompletionAt" type="datetime-local" defaultValue={task.expectedCompletionAt} />
            <Button disabled={busy} className="bg-[#287b6f]">Save update</Button>
          </form>
        ) : null}
        <div className="border-t pt-4">
          <h3 className="font-bold">Photos</h3>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {(task.photos ?? []).map((photo: any) => (
              <figure key={photo.id} className="relative overflow-hidden rounded-xl border bg-white">
                <a href={`/api/uploads/${photo.id}`} target="_blank" rel="noreferrer"><img src={`/api/uploads/${photo.id}`} alt={photo.originalName} className="aspect-square w-full object-cover" /></a>
                <button onClick={() => deletePhoto(photo.id)} className="absolute right-2 top-2 grid size-10 place-items-center rounded-full bg-white/90 text-red-700" aria-label={`Delete ${photo.originalName}`}><Trash2 className="size-4" /></button>
              </figure>
            ))}
          </div>
          {editable && <label className="mt-3 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold"><Upload className="size-4" />Upload photo<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={busy} onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], { choreId: task.id })} /></label>}
        </div>
        <div className="border-t pt-4">
          <h3 className="font-bold">Updates</h3>
          {(task.notes ?? []).map((note: any) => <p key={note.id} className="mt-2 rounded-xl bg-[#f1f5f1] p-3 text-sm"><Badge>{note.kind}</Badge> {note.body}</p>)}
          {editable && (
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'addNote', choreId: task.id, ...Object.fromEntries(new FormData(e.currentTarget)) }, 'Note added.'); e.currentTarget.reset(); }}>
              <select name="kind" className={fieldClass}><option value="progress">Progress</option><option value="issue">Issue</option><option value="completion">Completion</option></select>
              <Input name="body" required placeholder="Add an update" className="min-h-11" />
              <Button disabled={busy} className="bg-[#287b6f]">Add</Button>
            </form>
          )}
        </div>
        <DialogFooter>
          <div className="flex w-full flex-wrap gap-2">
            {task.status === 'open' && !task.assignedTo && <Button disabled={busy} onClick={() => mutate({ action: 'claim', choreId: task.id }, 'Task claimed.')}>Claim</Button>}
            {task.status === 'open' && task.assignedTo && <Button disabled={busy} onClick={() => mutate({ action: 'start', choreId: task.id }, 'Task started.')}>Start</Button>}
            {task.status === 'in_progress' && <Button disabled={busy} onClick={() => mutate({ action: 'complete', choreId: task.id }, 'Task completed.')} className="bg-[#287b6f]">Complete</Button>}
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDialog({ profile, manager, busy, onClose, submit, upload }: any) {
  if (!profile) return null;
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{manager ? `Edit ${profile.name}` : 'Edit your profile'}</DialogTitle>
          <DialogDescription>{manager ? 'Manager-only detailed care-worker record.' : 'Only the permitted self-service fields are available.'}</DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-3">
          <AvatarFor member={profile} className="size-16" />
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-4 text-sm font-semibold">
            <Upload className="size-4" />Photo<input className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], { profileMemberId: profile.id })} />
          </label>
        </div>
        <form className="grid gap-4" onSubmit={(e) => submit(e, 'updateProfile', 'Profile saved.', onClose)}>
          <input type="hidden" name="memberId" value={profile.id} />
          {manager && <><Field label="Name" name="name" defaultValue={profile.name} required /><Field label="Email" name="email" type="email" defaultValue={profile.email} /></>}
          <Field label="Phone" name="phone" type="tel" defaultValue={profile.phone} />
          <TextArea label="Availability" name="availability" defaultValue={profile.availability} />
          <TextArea label="Languages" name="languages" defaultValue={profile.languages} />
          {manager && <><TextArea label="Skills notes" name="skillsNotes" defaultValue={profile.skillsNotes} /><TextArea label="Certifications" name="certifications" defaultValue={profile.certifications} /><Field label="Emergency contact" name="emergencyContact" defaultValue={profile.emergencyContact} /></>}
          <Button disabled={busy} className="bg-[#287b6f]">Save profile</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateDialog({ open, workers, busy, onClose, submit }: any) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add task</DialogTitle>
          <DialogDescription>Create a clear, assignable household task.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => submit(e, 'createChore', 'Task created.', onClose)}>
          <Field label="Task title" name="title" required />
          <label className="text-sm font-semibold">Area<select name="area" className={fieldClass}>{areas.map(a => <option key={a}>{a}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><Field label="Due date" name="dueDate" type="date" /><Field label="Due time" name="dueTime" type="time" /></div>
          <label className="text-sm font-semibold">Priority<select name="priority" className={fieldClass}><option>low</option><option selected value="normal">normal</option><option>high</option><option>urgent</option></select></label>
          <TextArea label="Instructions" name="instructions" />
          <label className="text-sm font-semibold">Repeat<select name="recurrence" className={fieldClass}><option value="">Never</option><option>daily</option><option>weekly</option><option>monthly</option></select></label>
          <label className="text-sm font-semibold">Assign to<select name="assigneeId" className={fieldClass}><option value="">Available to claim</option>{workers.filter((w: Member) => w.status === 'active').map((w: Member) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <Field label="Reminder lead days" name="reminderLeadDays" type="number" defaultValue={1} />
          <Button disabled={busy} className="bg-[#287b6f]">Create task</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkerDialog({ open, busy, onClose, submit }: any) {
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add care worker</DialogTitle>
          <DialogDescription>Create a worker account with a temporary password.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={(e) => submit(e, 'addMember', 'Worker added.', onClose)}>
          <Field label="Full name" name="name" required />
          <Field label="Email" name="googleEmail" type="email" required />
          <Field label="Temporary password" name="temporaryPassword" type="password" required />
          <p className="text-xs text-[#687873]">Use at least 12 characters with upper/lowercase, a number, and a symbol.</p>
          <Button disabled={busy} className="bg-[#287b6f]">Add worker</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetDialog({ member, busy, onClose, submit }: any) {
  return (
    <Dialog open={Boolean(member)} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reset password</DialogTitle>
          <DialogDescription>Set a temporary password for {member?.name}. They must change it after signing in.</DialogDescription>
        </DialogHeader>
        {member && (
          <form className="grid gap-4" onSubmit={(e) => submit(e, 'resetMemberPassword', 'Temporary password updated.', onClose)}>
            <input type="hidden" name="memberId" value={member.id} />
            <Field label="Temporary password" name="temporaryPassword" type="password" required />
            <Button disabled={busy} className="bg-[#287b6f]">Reset password</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
