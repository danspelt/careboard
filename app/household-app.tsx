'use client';
/* oxlint-disable typescript/no-explicit-any, next/no-img-element -- API photo URLs require authenticated, unoptimized requests; compact view prop types are intentionally structural. */

import { logOut } from '@/app/actions/auth';
import Link from 'next/link';
import { createElement, useEffect, useState } from 'react';
import { AlertTriangle, Bath, BedDouble, Bell, CalendarDays, Camera, Check, CheckCircle2, ChevronRight, CircleDollarSign, CircleDot, ClipboardList, Clock, Copy, FileDown, FileText, History, Home, Inbox, KeyRound, LayoutDashboard, LogOut, Megaphone, MessageSquareText, MoreHorizontal, Pencil, Play, Plus, ScanLine, Send, Settings, Shield, ShieldAlert, Sofa, Sprout, Trash2, Undo2, Upload, User, UserCheck, Users, UserX, Utensils, WashingMachine, X, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Chore, HouseholdState, Member, Message } from '@/lib/household-data';
import { attentionReasons, buildShiftHandoff } from '@/lib/shift-handoff';
import { buildManagerCommandCenter } from '@/lib/manager-command-center';
import { buildWeekSchedule } from '@/lib/schedule';
import { buildNotifications } from '@/lib/notifications';
import { buildProgressReport } from '@/lib/progress-report';
import { buildOnboarding } from '@/lib/onboarding';
import { suggestAssignments } from '@/lib/auto-assign';
import { formatShift, shiftsForDay, weekdayOf } from '@/lib/shifts';
import { formatMinutes, minutesInRange, openEntryFor, weekSummary } from '@/lib/time-tracking';
import { fundingSummary } from '@/lib/funding';
import { certDaysLeft, certStatus, certificationAlerts } from '@/lib/certifications';
import { addDaysISO } from '@/lib/operations';
import { attendanceLabel, buildAttendance } from '@/lib/shift-attendance';

const areas = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Laundry', 'Outside', 'Other'];
const areaIcons = new Map<string, typeof Home>([['Kitchen', Utensils], ['Bathroom', Bath], ['Bedroom', BedDouble], ['Living room', Sofa], ['Laundry', WashingMachine], ['Outside', Sprout], ['Other', Home]]);
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type ManagerSection = 'home' | 'tasks' | 'client' | 'schedule' | 'team' | 'messages' | 'more';
type WorkerSection = 'today' | 'tasks' | 'client' | 'schedule' | 'messages' | 'profile' | 'more';
type Section = ManagerSection | WorkerSection;

function initials(name: string) { return name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase(); }
function today() { return new Date().toISOString().slice(0, 10); }
function dateLabel(value: string | null) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) : 'No due date'; }
function AvatarFor({ member, className = '' }: { member: Member; className?: string }) {
  return <Avatar className={className}>{member.profilePhotoId ? <img src={`/api/uploads/${member.profilePhotoId}`} alt="" className="size-full object-cover" /> : <AvatarFallback style={{ backgroundColor: member.color, color: 'white' }}>{initials(member.name)}</AvatarFallback>}</Avatar>;
}
const fieldClass = 'field-control mt-1 min-h-11 w-full rounded-xl border border-[#d7dfd7] bg-white px-3 py-2 text-sm';
function Field({ label, name, defaultValue, type = 'text', required = false, readOnly = false, step }: { label: string; name: string; defaultValue?: string | number | null; type?: string; required?: boolean; readOnly?: boolean; step?: string }) {
  return <label className="block text-sm font-semibold">{label}<Input name={name} type={type} required={required} readOnly={readOnly} step={step} defaultValue={defaultValue ?? ''} className="field-control mt-1 h-11 rounded-xl bg-white" /></label>;
}
function TextArea({ label, name, defaultValue }: { label: string; name: string; defaultValue?: string }) {
  return <label className="block text-sm font-semibold">{label}<textarea name={name} defaultValue={defaultValue} rows={3} className={fieldClass} /></label>;
}

export function HouseholdApp({ initialState, authenticatedId }: { initialState: HouseholdState; authenticatedId: string }) {
  const [state, setState] = useState(initialState);
  const member = state.members.find((item) => item.id === authenticatedId) ?? state.members[0];
  const manager = member?.role === 'manager';
  const viewer = member?.role === 'viewer';
  const [section, setSection] = useState<Section>(manager ? 'home' : 'today');
  const [task, setTask] = useState<Chore | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [shiftWorker, setShiftWorker] = useState<Member | null>(null);
  const [availWorker, setAvailWorker] = useState<Member | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedOpen, setFeedOpen] = useState(false);
  const [seenAt, setSeenAt] = useState(() => { try { return localStorage.getItem('careboard-notifications-seen') ?? ''; } catch { return ''; } });
  const [feedSeen, setFeedSeen] = useState('');
  const [tourDone, setTourDone] = useState(() => { try { return localStorage.getItem('careboard-onboarding-dismissed') === '1'; } catch { return false; } });
  useEffect(() => {
    const reload = async () => {
      const response = await fetch('/api/household', { cache: 'no-store' });
      if (response.ok) setState(await response.json() as HouseholdState);
    };
    const poll = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 30_000);
    const onFocus = () => void reload();
    window.addEventListener('focus', onFocus);
    return () => { clearInterval(poll); window.removeEventListener('focus', onFocus); };
  }, []);
  if (!member) return null;

  async function mutate(payload: Record<string, unknown>, message = 'Saved.') {
    setBusy(true);
    try {
      const response = await fetch('/api/household', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
      const result = await response.json() as HouseholdState & { error?: string; inviteToken?: string };
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
  async function uploadClientNote(file: File, clientMemberId: string) {
    const data = new FormData(); data.set('photo', file); data.set('clientMemberId', clientMemberId);
    setBusy(true);
    try {
      const response = await fetch('/api/client-notes', { method: 'POST', body: data });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'The client note could not be submitted.');
      await refresh('Client note submitted for manager review.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Client note upload failed.'); throw error; }
    finally { setBusy(false); }
  }
  async function refresh(message = '') { const response = await fetch('/api/household', { cache: 'no-store' }); const next = await response.json() as HouseholdState; setState(next); setTask((old) => old ? next.chores.find((item) => item.id === old.id) ?? null : null); setProfile((old) => old ? next.members.find((item) => item.id === old.id) ?? null : null); if (message) setNotice(message); }
  async function deletePhoto(id: string) { setBusy(true); try { const response = await fetch(`/api/uploads/${id}`, { method: 'DELETE' }); if (!response.ok) throw new Error('Photo could not be deleted.'); await refresh('Photo deleted.'); } catch (error) { setNotice(error instanceof Error ? error.message : 'Delete failed.'); } finally { setBusy(false); } }

  const workers = state.members.filter((item) => item.role === 'worker');
  const open = state.chores.filter((item) => item.status !== 'complete');
  const dueToday = open.filter((item) => item.dueDate === today());
  const notifications = buildNotifications({ viewerId: member.id, manager, viewer, activity: state.activity ?? [], tasks: state.chores, members: state.members, announcements: state.announcements ?? [] });
  const unread = notifications.filter((item) => item.createdAt > seenAt).length;
  function openFeed() {
    setFeedSeen(seenAt);
    setFeedOpen(true);
    const now = new Date().toISOString();
    setSeenAt(now);
    try { localStorage.setItem('careboard-notifications-seen', now); } catch { /* private mode */ }
  }
  const bell = <BellButton unread={unread} onClick={openFeed} />;
  const onboarding = buildOnboarding({ manager, viewerId: member.id, members: state.members, tasks: state.chores });
  function dismissTour() {
    setTourDone(true);
    try { localStorage.setItem('careboard-onboarding-dismissed', '1'); } catch { /* private mode */ }
  }
  const nav = manager
    ? [['home', 'Overview', LayoutDashboard], ['tasks', 'Tasks', ClipboardList], ['client', 'Client', FileText], ['schedule', 'Schedule', CalendarDays], ['team', 'Team', Users], ['messages', 'Inbox', Inbox], ['more', 'Settings', Settings]] as const
    : viewer
      ? [['today', 'Overview', LayoutDashboard], ['tasks', 'Tasks', ClipboardList], ['schedule', 'Schedule', CalendarDays]] as const
      : [['today', 'Today', Home], ['tasks', 'Tasks', ClipboardList], ['client', 'Client', FileText], ['schedule', 'Schedule', CalendarDays], ['messages', 'Inbox', Inbox], ['profile', 'Profile', User], ['more', 'More', MoreHorizontal]] as const;

  return (
    <div className="careboard min-h-screen bg-[#f7f6f1] text-[#20312d]">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#287b6f] focus:px-4 focus:py-2 focus:text-white">
        Skip to dashboard content
      </a>

      {/* Mobile header */}
      <header className="dashboard-mobile-header fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#dfe5dc] bg-[#fcfbf7]/95 px-4 backdrop-blur md:hidden">
        <button onClick={() => setSection(manager ? 'home' : 'today')} className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
          <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
          <span className="text-lg font-bold">CareBoard</span>
        </button>
        <div className="flex items-center gap-2">
          {bell}
          <form action={logOut}><button className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#287b6f]"><LogOut className="size-4" aria-hidden="true" />Sign out</button></form>
          <AvatarFor member={member} className="size-9" />
        </div>
      </header>

      {/* Desktop sidebar */}
      <aside className="dashboard-sidebar fixed left-0 top-0 hidden h-screen w-64 flex-col overflow-y-auto border-r border-[#dfe5dc] bg-[#fffefa] md:flex" aria-label="Main navigation">
        <div className="flex h-16 items-center gap-3 border-b border-[#dfe5dc] px-5">
          <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
          <span className="text-lg font-bold">CareBoard</span>
        </div>
        <nav className="dashboard-nav flex flex-1 flex-col gap-1 p-4">
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
              <p className="truncate text-xs text-[#687873]">{manager ? 'Manager' : viewer ? 'Family viewer' : 'Care worker'}</p>
            </div>
            {bell}
          </div>
          <form action={logOut} className="mt-3">
            <button className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm font-semibold text-[#52645f] transition hover:bg-[#f1f5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
              <LogOut className="size-4" aria-hidden="true" />Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Main content */}
      <main id="main" tabIndex={-1} aria-busy={busy} className="dashboard-main min-h-screen pt-16 md:pl-64 md:pt-0">
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-7 sm:py-7">
          {!viewer && !tourDone && onboarding.some((step) => !step.done) && <OnboardingCard steps={onboarding} onDone={dismissTour} />}
          {manager ? (
            <ManagerView section={section as ManagerSection} setSection={setSection} state={state} workers={workers} open={open} dueToday={dueToday} setTask={setTask} setProfile={setProfile} setCreateOpen={setCreateOpen} setAddOpen={setAddOpen} setResetMember={setResetMember} setShiftWorker={setShiftWorker} setAvailWorker={setAvailWorker} onInvited={(token: string) => setInviteUrl(`${window.location.origin}/accept-invite?token=${token}`)} mutate={mutate} busy={busy} />
          ) : viewer ? (
            <ViewerView section={section} state={state} setTask={setTask} />
          ) : (
            <WorkerView section={section as WorkerSection} state={state} member={member} setTask={setTask} setProfile={setProfile} setAvailWorker={setAvailWorker} mutate={mutate} uploadClientNote={uploadClientNote} busy={busy} />
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="dashboard-mobile-nav fixed inset-x-0 bottom-0 z-40 border-t border-[#d7dfd7] bg-white/95 px-2 pb-[max(.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_24px_rgba(32,49,45,.08)] backdrop-blur md:hidden" aria-label="Mobile navigation">
        <ul className="mx-auto flex max-w-full snap-x gap-1 overflow-x-auto">
          {nav.map(([id, label, Icon]) => (
            <li key={id} className="min-w-16 flex-1 snap-center">
            <button
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex min-h-14 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${section === id ? 'bg-[#e6f0eb] text-[#287b6f]' : 'text-[#687873]'}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              {label}
            </button>
            </li>
          ))}
        </ul>
      </nav>

      <TaskDialog task={task} manager={manager} readOnly={viewer} memberId={member.id} workers={workers} busy={busy} onClose={() => setTask(null)} mutate={mutate} upload={upload} deletePhoto={deletePhoto} />
      <Dialog open={feedOpen} onOpenChange={(open) => !open && setFeedOpen(false)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Notifications</DialogTitle>
            <DialogDescription>{manager ? 'Latest household activity from the care team.' : 'Updates on your tasks and newly available work.'}</DialogDescription>
          </DialogHeader>
          {notifications.length ? (
            <ol className="divide-y divide-[#e5eae4]">
              {notifications.map((item) => {
                const linked = item.choreId ? state.chores.find((chore: Chore) => chore.id === item.choreId) : null;
                const Icon = item.kind === 'completed' ? CheckCircle2 : item.kind === 'announcement' || item.kind === 'posted_message' ? Megaphone : item.kind.startsWith('note_') ? MessageSquareText : item.kind === 'available' ? CircleDot : ClipboardList;
                return (
                  <li key={item.id}>
                    <button onClick={() => { setFeedOpen(false); if (linked) setTask(linked); }} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-[#f1f5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
                      <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${item.createdAt > feedSeen ? 'bg-[#e8f1ec] text-[#287b6f]' : 'bg-[#f1f5f1] text-[#687873]'}`}><Icon className="size-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium leading-5">{item.text}</span>
                        <span className="mt-1 block text-xs text-[#687873]">{item.actor} · {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                      </span>
                      {linked && <ChevronRight className="size-4 shrink-0 text-[#687873]" aria-hidden="true" />}
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : <EmptyHandoff icon={Bell} title="All caught up" text="New household activity will show up here." compact />}
        </DialogContent>
      </Dialog>
      <ProfileDialog profile={profile} manager={manager} busy={busy} onClose={() => setProfile(null)} submit={submit} upload={upload} certs={(state.certifications ?? []).filter((cert: any) => cert.memberId === profile?.id)} mutate={mutate} />
      <CreateDialog open={createOpen} workers={workers} busy={busy} onClose={() => setCreateOpen(false)} submit={submit} />
      <AddWorkerDialog open={addOpen} busy={busy} onClose={() => setAddOpen(false)} mutate={mutate} onInvited={(token: string) => setInviteUrl(`${window.location.origin}/accept-invite?token=${token}`)} />
      <InviteLinkDialog url={inviteUrl} onClose={() => setInviteUrl('')} />
      <ResetDialog member={resetMember} busy={busy} onClose={() => setResetMember(null)} submit={submit} />
      {shiftWorker && <WindowDialog worker={shiftWorker} windows={(state.shifts ?? []).filter((shift: any) => shift.memberId === shiftWorker.id)} action="setShifts" title={`Weekly shifts for ${shiftWorker.name}`} description={`Set the days and times ${shiftWorker.name.split(' ')[0]} is scheduled each week. This repeats automatically.`} busy={busy} onClose={() => setShiftWorker(null)} mutate={mutate} />}
      {availWorker && <WindowDialog worker={availWorker} windows={(state.availability ?? []).filter((shift: any) => shift.memberId === availWorker.id)} action="setAvailability" title={`Weekly availability for ${availWorker.name}`} description={`The days and times ${availWorker.name.split(' ')[0]} is generally available. Auto-assign prefers these windows.`} busy={busy} onClose={() => setAvailWorker(null)} mutate={mutate} />}
      <output aria-live="polite" aria-atomic="true" className="dashboard-notice fixed inset-x-4 z-50 ml-auto max-w-sm md:bottom-6 md:left-auto">
        {busy && <span className="sr-only">Saving your update.</span>}
        {notice && <span className="flex items-center gap-3 rounded-2xl bg-[#20312d] p-3 pl-4 text-sm text-white shadow-xl">
          <span className="min-w-0 flex-1 break-words">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss notification" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/10"><X className="size-4" aria-hidden="true" /></button>
        </span>}
      </output>
    </div>
  );
}

function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative grid size-11 shrink-0 place-items-center rounded-xl text-[#52645f] transition hover:bg-[#e9efe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 && <span className="absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-[#b4532a] px-1 py-0.5 text-[10px] font-bold leading-none text-white">{unread}</span>}
    </button>
  );
}
function OnboardingCard({ steps, onDone }: any) {
  const done = steps.filter((step: any) => step.done).length;
  return (
    <Card className="mb-6 border-[#bcd4c9] bg-[#f2f7f1]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e2efe5] text-[#287b6f]"><Sprout className="size-5" aria-hidden="true" /></span>
          <div><h2 className="text-lg font-bold">Getting started</h2><p className="text-xs font-semibold text-[#4d6b5e]">{done} of {steps.length} done — these check off as you work</p></div>
        </div>
        <button onClick={onDone} aria-label="Dismiss getting started guide" className="grid size-11 shrink-0 place-items-center rounded-xl text-[#687873] transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"><X className="size-4" aria-hidden="true" /></button>
      </div>
      <progress value={done} max={steps.length} aria-label={`${done} of ${steps.length} onboarding steps complete`} className="mt-3 h-2 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#dfe5dc] [&::-webkit-progress-value]:rounded-full [&::-moz-progress-bar]:bg-[#287b6f] [&::-webkit-progress-value]:bg-[#287b6f]" />
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {steps.map((step: any) => (
          <li key={step.id} className={`flex items-start gap-3 rounded-xl border p-3 ${step.done ? 'border-[#cfe0d3] bg-white/60' : 'border-[#dfe5dc] bg-white'}`}>
            <span className={`mt-0.5 grid size-6 shrink-0 place-items-center rounded-full ${step.done ? 'bg-[#287b6f] text-white' : 'border-2 border-[#c6d2c8] text-transparent'}`}>{step.done ? <Check className="size-3.5" aria-hidden="true" /> : null}</span>
            <span className="min-w-0"><span className={`block text-sm font-semibold ${step.done ? 'text-[#687873] line-through' : ''}`}>{step.title}</span><span className="mt-0.5 block text-xs leading-5 text-[#687873]">{step.detail}</span></span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) { return <section className={`dashboard-card rounded-2xl border border-[#dfe5dc] bg-[#fffefa] p-5 shadow-sm ${className}`}>{children}</section>; }
function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    open: 'bg-[#e8f1ec] text-[#287b6f]',
    in_progress: 'bg-[#fcf4e9] text-[#9e6b2e]',
    complete: 'bg-[#e6f0eb] text-[#216b61]',
    disabled: 'bg-[#f0f0f0] text-[#687873]',
    invited: 'bg-[#ece9f7] text-[#5b4e94]',
    pending: 'bg-[#fcf0dc] text-[#80531b]',
    approved: 'bg-[#e6f0eb] text-[#216b61]',
    rejected: 'bg-[#f8e4dc] text-[#873d27]',
    direct_message: 'bg-[#e7eef8] text-[#3f5f92]',
    manager_message: 'bg-[#ece9f7] text-[#5b4e94]',
    abuse: 'bg-[#f8e4dc] text-[#873d27]',
    threat: 'bg-[#f8e4dc] text-[#873d27]',
    medication: 'bg-[#fcf0dc] text-[#80531b]',
    emergency: 'bg-[#f8e4dc] text-[#873d27]',
  };
  return <span data-status={status} className={`status-badge inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] ?? 'bg-[#f0f0f0] text-[#687873]'}`}>{status.replace('_', ' ')}</span>;
}

function ManagerView({ section, setSection, state, workers, open, dueToday, setTask, setProfile, setCreateOpen, setAddOpen, setResetMember, setShiftWorker, setAvailWorker, onInvited, mutate, busy }: any) {
  const [taskQuery, setTaskQuery] = useState('');
  const [taskStatus, setTaskStatus] = useState<'all' | 'open' | 'in_progress' | 'complete'>('all');
  if (section === 'tasks') {
    const query = taskQuery.trim().toLowerCase();
    const filtered = state.chores.filter((task: Chore) => {
      if (taskStatus !== 'all' && task.status !== taskStatus) return false;
      if (query && !task.title.toLowerCase().includes(query) && !(task.instructions ?? '').toLowerCase().includes(query)) return false;
      return true;
    });
    return (
      <>
        <Title title="Tasks" text="Plan, assign, edit, and review household work." action={<Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button>} />
        <Card className="p-0">
          <div className="border-b border-[#dfe5dc] px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div><h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-4 text-[#287b6f]" aria-hidden="true" />All household tasks</h2><p className="text-sm text-[#687873]">{filtered.length} shown · {state.chores.length} total · {open.length} open</p></div>
              <div className="flex flex-wrap gap-2">
                <Input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" className="h-10 w-full flex-1 sm:w-52 sm:flex-none" />
                <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value as any)} aria-label="Filter by status" className="field-control h-10 w-auto rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm">
                  <option value="all">All statuses</option>
                  <option value="open">Open</option>
                  <option value="in_progress">In progress</option>
                  <option value="complete">Complete</option>
                </select>
              </div>
            </div>
          </div>
          <TaskList tasks={filtered} members={state.members} onOpen={setTask} />
        </Card>
      </>
    );
  }
  if (section === 'team') return (
    <>
      <Title title="Care team" text="Detailed profiles are visible only to the household manager." action={<Button onClick={() => setAddOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add care worker</Button>} />
      {!workers.length && <Card><div className="flex flex-col items-center py-6 text-center"><span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><Users className="size-6" aria-hidden="true" /></span><h2 className="text-lg font-semibold">Build your care team</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#52645f]">Add your first care worker to start sharing household tasks and coordinating care.</p><ul className="mt-4 space-y-2 text-sm text-[#687873]"><li>Invite by email — they set their own password</li><li>Set weekly shifts and availability</li><li>Track certifications and contact details</li></ul><Button onClick={() => setAddOpen(true)} className="mt-5 min-h-11 bg-[#287b6f]"><Plus className="size-4" />Add care worker</Button></div></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {workers.map((worker: Member) => {
          const workerShifts = (state.shifts ?? []).filter((shift: any) => shift.memberId === worker.id);
          const shiftText = workerShifts.length ? workerShifts.map((shift: any) => `${weekdayNames[shift.weekday]} ${formatShift(shift)}`).join(' · ') : 'Not set';
          const workerAvail = (state.availability ?? []).filter((shift: any) => shift.memberId === worker.id);
          const availText = workerAvail.length ? workerAvail.map((shift: any) => `${weekdayNames[shift.weekday]} ${formatShift(shift)}`).join(' · ') : 'Not set';
          return (
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
              <p><span className="text-[#687873]">Availability:</span> {availText}</p>
              <p><span className="text-[#687873]">Weekly shifts:</span> {shiftText}</p>
              <p><span className="text-[#687873]">Languages:</span> {worker.languages || 'Not provided'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setProfile(worker)}><Pencil className="size-4" />Profile</Button>
              <Button variant="outline" size="sm" onClick={() => setShiftWorker(worker)}><Clock className="size-4" />Shifts</Button>
              <Button variant="outline" size="sm" onClick={() => setAvailWorker(worker)}><CalendarDays className="size-4" />Availability</Button>
              {worker.status === 'invited' && <Button variant="outline" size="sm" disabled={busy} onClick={async () => { try { const result = await mutate({ action: 'reinviteMember', memberId: worker.id }, 'Invite link created.'); if (result?.inviteToken) onInvited(result.inviteToken); } catch { /* notice is shown */ } }}><UserCheck className="size-4" />Invite link</Button>}
              {worker.status !== 'invited' && <Button variant="outline" size="sm" onClick={() => setResetMember(worker)}><KeyRound className="size-4" />Reset password</Button>}
              <Button variant="outline" size="sm" disabled={busy} onClick={() => mutate({ action: worker.status === 'disabled' ? 'reactivateMember' : 'disableMember', memberId: worker.id }, worker.status === 'disabled' ? 'Care worker reactivated.' : 'Care worker disabled.')}>
                {worker.status === 'disabled' ? <><UserCheck className="size-4" />Reactivate</> : <><UserX className="size-4" />Disable</>}
              </Button>
            </div>
          </Card>
          );
        })}
      </div>
      {state.members.some((item: Member) => item.role === 'viewer') && (
        <>
          <h2 className="mt-8 flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />Family viewers</h2>
          <p className="mt-1 text-sm text-[#687873]">Read-only access to the care plan and schedule.</p>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {state.members.filter((item: Member) => item.role === 'viewer').map((viewer: Member) => (
              <Card key={viewer.id}>
                <div className="flex items-start gap-3">
                  <AvatarFor member={viewer} className="size-12" />
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold">{viewer.name}</h3>
                    <p className="truncate text-sm text-[#687873]">{viewer.email}</p>
                    <div className="mt-1"><StatusBadge status={viewer.status} /></div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {viewer.status === 'invited' && <Button variant="outline" size="sm" disabled={busy} onClick={async () => { try { const result = await mutate({ action: 'reinviteMember', memberId: viewer.id }, 'Invite link created.'); if (result?.inviteToken) onInvited(result.inviteToken); } catch { /* notice is shown */ } }}><UserCheck className="size-4" />Invite link</Button>}
                  {viewer.status !== 'invited' && <Button variant="outline" size="sm" onClick={() => setResetMember(viewer)}><KeyRound className="size-4" />Reset password</Button>}
                  <Button variant="outline" size="sm" disabled={busy} onClick={() => mutate({ action: viewer.status === 'disabled' ? 'reactivateMember' : 'disableMember', memberId: viewer.id }, viewer.status === 'disabled' ? 'Family viewer reactivated.' : 'Family viewer disabled.')}>
                    {viewer.status === 'disabled' ? <><UserCheck className="size-4" />Reactivate</> : <><UserX className="size-4" />Disable</>}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </>
  );
  if (section === 'schedule') return <ScheduleView state={state} workers={workers} setTask={setTask} setCreateOpen={setCreateOpen} mutate={mutate} busy={busy} />;
  if (section === 'client') return <ClientRecordView state={state} mutate={mutate} busy={busy} />;
  if (section === 'messages') return <InboxView state={state} mutate={mutate} busy={busy} />;
  if (section === 'more') return <MoreManager state={state} mutate={mutate} busy={busy} />;
  const command = buildManagerCommandCenter<Chore>(state.chores, workers, today());
  const homeNow = new Date();
  const nowTime = homeNow.toTimeString().slice(0, 5);
  const nowStamp = homeNow.toISOString();
  const attendance = buildAttendance({ workers: command.activeWorkers, shifts: state.shifts ?? [], entries: state.timeEntries ?? [], date: today(), nowTime, now: nowStamp });
  const onDutyCount = attendance.filter((row) => row.status === 'on_duty' || row.status === 'unscheduled_on_duty').length;
  const lateCount = attendance.filter((row) => row.status === 'late').length;
  const homeFunding = fundingSummary({
    entries: state.timeEntries ?? [],
    workers: workers.map((worker: Member) => ({ id: worker.id, hourlyRate: worker.hourlyRate })),
    fundedHoursMonthly: state.settings?.fundedHoursMonthly ?? 0,
    fundingHourlyRate: state.settings?.fundingHourlyRate ?? 0,
    month: today().slice(0, 7),
  });
  const fundedConfigured = homeFunding.fundedMinutes > 0;
  const fundedPct = fundedConfigured ? Math.min(999, Math.round((homeFunding.usedMinutes / homeFunding.fundedMinutes) * 100)) : 0;
  const fundedOverPace = fundedConfigured && homeFunding.projectedMinutes > homeFunding.fundedMinutes;
  const safetyCount = (state.safetyAlerts ?? []).filter((alert: any) => !alert.safetyReviewedAt).length;
  const clientNoteCount = (state.clientNoteQueue ?? []).filter((note: any) => note.status === 'pending').length;
  const maxCompleted = Math.max(1, ...command.completionTrend.map((day) => day.completed));
  const proofPhotos = state.chores
    .flatMap((task: Chore) => (task.photos ?? []).map((photo: any) => ({ ...photo, task })))
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  return (
    <>
      <Title title="Manager command center" text="Coverage, exceptions, and recent handoffs for today’s household work." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setAddOpen(true)}><UserCheck className="size-4" />Add care worker</Button><Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button></div>} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="On duty now" value={onDutyCount} icon={Clock} tone={lateCount > 0 ? 'caution' : 'neutral'} />
        <Metric label="Due today" value={state.metrics?.dueToday ?? dueToday.length} icon={CalendarDays} />
        <Metric label="Needs attention" value={command.attention.length} icon={AlertTriangle} tone="caution" />
        <Metric label="Funded hours used" value={fundedConfigured ? `${fundedPct}%` : '—'} icon={CircleDollarSign} tone={fundedOverPace ? 'caution' : 'neutral'} />
      </div>
      {(safetyCount + clientNoteCount + command.awaitingReview.length) > 0 && (
        <Card className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="size-5 text-[#b4532a]" aria-hidden="true" />Needs your decision</h2>
          <p className="text-sm text-[#687873]">Items only the household manager can resolve</p>
          <div className="mt-4 space-y-2">
            {safetyCount > 0 && (
              <button onClick={() => setSection('messages')} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2b69f] bg-[#fff8f4] p-3 text-left text-[#8f3f25] transition hover:border-[#cf9873]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f8e9dc]"><ShieldAlert className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Safety alerts to review</span>
                <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold">{safetyCount}</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            )}
            {clientNoteCount > 0 && (
              <button onClick={() => setSection('client')} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3 text-left transition hover:border-[#aac3b3]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><ScanLine className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Client notes awaiting approval</span>
                <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold text-[#8b4e2c]">{clientNoteCount}</span>
                <ChevronRight className="size-4 shrink-0 text-[#687873]" aria-hidden="true" />
              </button>
            )}
            {command.awaitingReview.length > 0 && (
              <div className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><Shield className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Completions awaiting your review</span>
                <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold text-[#8b4e2c]">{command.awaitingReview.length}</span>
              </div>
            )}
          </div>
        </Card>
      )}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(19rem,.85fr)]">
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe5dc] px-5 py-4"><div><h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="size-5 text-[#287b6f]" aria-hidden="true" />Operational priorities</h2><p className="text-sm text-[#687873]">Ranked by open issue, overdue date, urgency, and assignment</p></div>{command.unassignedDueToday > 0 && <span className="rounded-full bg-[#f8e9dc] px-3 py-1 text-xs font-semibold text-[#8b4e2c]">{command.unassignedDueToday} unassigned today</span>}</div>
          <TaskList tasks={command.attention.slice(0, 8)} members={state.members} onOpen={setTask} />
          {command.attention.length > 8 && <p className="px-5 pb-5 text-center text-xs text-[#687873]">Showing 8 of {command.attention.length} priorities. Open Tasks for the full list.</p>}
        </Card>
        <Card className="manager-coverage">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />Today’s attendance</h2><p className="text-sm text-[#687873]">Shift status and workload for each active care worker</p>
          <div className="mt-4 space-y-3">{attendance.length ? attendance.map((row) => { const worker = workers.find((item: Member) => item.id === row.workerId); if (!worker) return null; const coverage = command.coverage.find((item: any) => item.workerId === row.workerId) ?? { dueToday: 0, inProgress: 0, overdue: 0 }; const pillClass = row.status === 'late' ? 'bg-[#f8e9dc] text-[#8b4e2c]' : row.status === 'on_duty' || row.status === 'unscheduled_on_duty' ? 'bg-[#e4f0e8] text-[#25654f]' : row.status === 'upcoming' ? 'bg-[#eef2ec] text-[#52645f]' : 'bg-[#f1f5f1] text-[#687873]'; return <button key={worker.id} onClick={() => setProfile(worker)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3 text-left transition hover:border-[#aac3b3]"><AvatarFor member={worker} className="size-10" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{worker.name}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}>{attendanceLabel(row)}</span></span><span className="block text-xs text-[#687873]">{coverage.dueToday} due today · {coverage.inProgress} in progress</span></span>{coverage.overdue > 0 && <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold text-[#8b4e2c]">{coverage.overdue} late</span>}</button>; }) : <EmptyHandoff icon={Users} title="No active care workers" text="Add or reactivate a care worker to plan coverage." compact />}</div>
          <form className="mt-4 flex gap-2 border-t border-[#e5eae4] pt-4" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'announce', ...Object.fromEntries(new FormData(form)) }, 'Announcement posted to the team.'); form.reset(); }}>
            <Input name="body" required maxLength={500} placeholder="Broadcast to the team…" aria-label="Announcement message" className="min-h-11 flex-1" />
            <Button type="submit" disabled={busy} aria-label="Post announcement" className="bg-[#287b6f]"><Megaphone className="size-4" /></Button>
          </form>
        </Card>
      </div>
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDollarSign className="size-5 text-[#287b6f]" aria-hidden="true" />CSIL funding — this month</h2>
        {fundedConfigured ? (
          <>
            <p className="mt-2 text-sm text-[#687873]">{formatMinutes(homeFunding.usedMinutes)} of {formatMinutes(homeFunding.fundedMinutes)} funded hours used · projected {formatMinutes(homeFunding.projectedMinutes)}</p>
            <progress
              value={Math.round(Math.min(100, (homeFunding.usedMinutes / homeFunding.fundedMinutes) * 100))}
              max={100}
              aria-label="Share of funded hours used"
              className={`mt-4 h-3 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#eef2ec] [&::-webkit-progress-value]:rounded-full ${fundedOverPace ? '[&::-moz-progress-bar]:bg-[#b4532a] [&::-webkit-progress-value]:bg-[#b4532a]' : '[&::-moz-progress-bar]:bg-[#287b6f] [&::-webkit-progress-value]:bg-[#287b6f]'}`}
            />
            <div className="mt-4"><Button variant="outline" size="sm" onClick={() => setSection('more')}>Open funding details</Button></div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm leading-6 text-[#687873]">Set your monthly funded hours and CSIL rate to track your budget here.</p>
            <div className="mt-4"><Button variant="outline" size="sm" onClick={() => setSection('more')}>Open settings</Button></div>
          </>
        )}
      </Card>
      {command.awaitingReview.length > 0 && (
        <Card className="mt-6 border-[#bcd4c9]">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Shield className="size-5 text-[#287b6f]" aria-hidden="true" />Awaiting your review</h2>
          <p className="text-sm text-[#687873]">Work the care team marked complete — approve it or send it back</p>
          <div className="mt-4 space-y-2">
            {command.awaitingReview.map((task: Chore) => {
              const finisher = state.members.find((item: Member) => item.id === task.completedBy);
              return (
                <div key={task.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
                  <button onClick={() => setTask(task)} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
                    <span className="block truncate text-sm font-semibold">{task.title}</span>
                    <span className="block text-xs text-[#687873]">{finisher?.name ?? 'Care worker'} · {task.completedAt ? new Date(task.completedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}</span>
                  </button>
                  <Button size="sm" disabled={busy} onClick={() => mutate({ action: 'approveTask', choreId: task.id }, 'Review approved.')} className="bg-[#287b6f]"><Check className="size-4" />Approve</Button>
                  <Button size="sm" variant="outline" disabled={busy} onClick={() => mutate({ action: 'reopenTask', choreId: task.id }, 'Sent back for rework.')}><Undo2 className="size-4" />Send back</Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}
      {(() => {
        const certAlerts = certificationAlerts(state.certifications ?? [], state.members, today());
        return certAlerts.length > 0 && (
          <Card className="mt-6 border-[#eadbc6]">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Shield className="size-5 text-[#b4532a]" aria-hidden="true" />Certification alerts</h2>
            <p className="text-sm text-[#687873]">Care worker certifications that are expired or expiring within 30 days — open a profile to update them</p>
            <div className="mt-4 space-y-2">
              {certAlerts.map((alert) => {
                const worker = state.members.find((item: Member) => item.id === alert.certification.memberId);
                if (!worker) return null;
                return (
                  <button key={alert.certification.id} onClick={() => setProfile(worker)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3 text-left transition hover:border-[#aac3b3]">
                    <AvatarFor member={worker} className="size-10" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{worker.name} — {alert.certification.name}</span>
                      <span className="block text-xs text-[#687873]">{alert.status === 'expired' ? `Expired ${Math.abs(alert.daysLeft)} day${Math.abs(alert.daysLeft) === 1 ? '' : 's'} ago` : `Expires in ${alert.daysLeft} day${alert.daysLeft === 1 ? '' : 's'}`} ({alert.certification.expiresOn})</span>
                    </span>
                    <Badge className={alert.status === 'expired' ? 'bg-[#f8e9dc] text-[#8b4e2c]' : 'bg-[#fcf4e9] text-[#805322]'}>{alert.status}</Badge>
                  </button>
                );
              })}
            </div>
          </Card>
        );
      })()}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card><h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Recent handoffs</h2><p className="text-sm text-[#687873]">Latest progress, completion, and issue notes</p>{command.recentHandoffs.length ? <ol className="mt-4 divide-y divide-[#e5eae4]">{command.recentHandoffs.map(({ task, ...note }) => { const author = state.members.find((item: Member) => item.id === note.memberId)?.name ?? 'Team member'; return <li key={note.id}><button onClick={() => setTask(task)} className="w-full rounded-xl px-2 py-3 text-left transition hover:bg-[#f1f5f1]"><span className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{task.title}</span><Badge>{note.kind}</Badge></span><span className="mt-1 line-clamp-2 block text-sm text-[#52645f]">{note.body}</span><span className="mt-2 block text-xs text-[#687873]">{author} · {new Date(note.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></button></li>; })}</ol> : <EmptyHandoff icon={MessageSquareText} title="No handoffs yet" text="Care worker notes will appear here as the team shares progress." compact />}</Card>
        <Card><h2 className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="size-5 text-[#287b6f]" aria-hidden="true" />Seven-day completion pulse</h2><p className="text-sm text-[#687873]">Completed household tasks by day</p><p className="sr-only">Seven-day completions: {command.completionTrend.map((day) => `${day.date}, ${day.completed}`).join('; ')}</p><div className="mt-6 grid h-40 grid-cols-7 items-end gap-2" aria-hidden="true">{command.completionTrend.map((day) => <div key={day.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold tabular-nums">{day.completed}</span><span className="w-full max-w-10 rounded-t-lg bg-[#67a193]" style={{ height: `${Math.max(8, (day.completed / maxCompleted) * 96)}px` }} /><span className="text-[11px] text-[#687873]">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>)}</div><div className="mt-5 flex items-center justify-between rounded-xl bg-[#f1f5f1] p-3 text-sm"><span className="text-[#52645f]">Unresolved issues</span><strong className="tabular-nums text-[#8b4e2c]">{command.issues.length}</strong></div></Card>
      </div>
      {proofPhotos.length > 0 && (
        <Card className="mt-6">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Upload className="size-5 text-[#287b6f]" aria-hidden="true" />Latest proof photos</h2>
          <p className="text-sm text-[#687873]">Recent uploads from the care team — open one to review the task</p>
          <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
            {proofPhotos.map((photo: any) => {
              const uploader = state.members.find((item: Member) => item.id === photo.uploadedBy)?.name ?? 'Team member';
              return (
                <button key={photo.id} onClick={() => setTask(photo.task)} className="w-28 shrink-0 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
                  <img src={`/api/uploads/${photo.id}`} alt={photo.originalName} className="aspect-square w-full rounded-xl border border-[#dfe5dc] object-cover" />
                  <span className="mt-1.5 block truncate text-xs font-semibold">{photo.task.title}</span>
                  <span className="block truncate text-[11px] text-[#687873]">{uploader} · {new Date(photo.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </button>
              );
            })}
          </div>
        </Card>
      )}
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />Recent activity</h2>
        <p className="text-sm text-[#687873]">Latest household actions across tasks, team, and settings</p>
        <ol className="mt-4 divide-y divide-[#e5eae4]">
          {(state.activity ?? []).length ? (state.activity ?? []).slice(0, 8).map((item: any) => {
            const actor = state.members.find((m: Member) => m.id === item.memberId)?.name ?? 'Household';
            const Icon = item.action === 'announcement' ? Megaphone : item.action === 'completed' ? CheckCircle2 : item.action === 'assigned' ? UserCheck : item.action === 'created' ? Plus : item.action === 'updated' ? Pencil : item.action === 'disabled' ? Shield : item.action === 'reactivated' ? UserCheck : ClipboardList;
            return (
              <li key={item.id} className="flex items-center gap-3 py-2">
                <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-[#f1f5f1] text-[#287b6f]"><Icon className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{item.action.replace(/_/g, ' ')}{item.detail ? ` — ${item.detail}` : ''}</span>
                  <span className="block text-xs text-[#687873]">{actor} · {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span>
                </span>
              </li>
            );
          }) : <li><EmptyHandoff icon={Clock} title="No activity yet" text="Household actions will appear here as your team works." compact /></li>}
        </ol>
      </Card>
    </>
  );
}

function MoreManager({ state, mutate, busy }: any) {
  const [weekStart] = useState(() => new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10));
  const settings = state.settings;
  const month = today().slice(0, 7);
  const reportWorkers = state.members.filter((item: Member) => item.role === 'worker');
  const report = buildProgressReport<Chore>(state.chores, reportWorkers, today(), 30);
  const maxWeekly = Math.max(1, ...report.weekly.map((week) => week.completed));
  const maxArea = Math.max(1, ...report.byArea.map((area) => area.count));
  const funding = fundingSummary({
    entries: state.timeEntries ?? [],
    workers: reportWorkers.map((worker: Member) => ({ id: worker.id, hourlyRate: worker.hourlyRate })),
    fundedHoursMonthly: settings?.fundedHoursMonthly ?? 0,
    fundingHourlyRate: settings?.fundingHourlyRate ?? 0,
    month,
  });
  const usedPct = funding.fundedMinutes > 0 ? Math.min(100, (funding.usedMinutes / funding.fundedMinutes) * 100) : 0;
  const overPace = funding.fundedMinutes > 0 && funding.projectedMinutes > funding.fundedMinutes;
  return (
    <>
      <Title title="Settings & reports" text="Household settings, monthly reports, and immutable audit history." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Settings className="size-5 text-[#287b6f]" aria-hidden="true" />Settings</h2>
          <p className="text-sm text-[#687873]">Tune automation without changing privacy policy.</p>
          <form className="mt-4 grid gap-4" onSubmit={(e) => { e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget)); mutate({ action: 'updateHouseholdSettings', ...data, retentionDays: 90 }, 'Settings saved.'); }}>
            <Field label="Recurrence horizon (days)" name="recurrenceHorizonDays" type="number" defaultValue={settings?.recurrenceHorizonDays ?? 30} />
            <Field label="Default reminder lead (days)" name="reminderDefaultLeadDays" type="number" defaultValue={settings?.reminderDefaultLeadDays ?? 1} />
            <Field label="Photo retention (days, fixed privacy policy)" name="retentionDays" type="number" defaultValue={90} readOnly />
            <Field label="CSIL funded hours per month" name="fundedHoursMonthly" type="number" step="any" defaultValue={settings?.fundedHoursMonthly ?? 0} />
            <Field label="CSIL funding rate ($ per hour)" name="fundingHourlyRate" type="number" step="any" defaultValue={settings?.fundingHourlyRate ?? 0} />
            <Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f]"><Check className="size-4" />Save settings</Button>
          </form>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><FileDown className="size-5 text-[#287b6f]" aria-hidden="true" />Monthly export</h2>
          <p className="mt-2 text-sm text-[#687873]">Download tasks, assignments, completion details, issues, notes, and team records as CSV.</p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Metric label="On time (30d)" value={report.onTime} icon={Check} tone="success" />
            <Metric label="Open issues" value={report.openIssues} icon={Shield} tone="caution" />
          </div>
          <a href={`/api/export?from=${month}-01&to=${today()}`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white transition hover:bg-[#216b61]">
            <FileDown className="size-4" />Download monthly CSV
          </a>
        </Card>
      </div>
      <Card className="mt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div><h2 className="flex items-center gap-2 text-lg font-bold"><FileDown className="size-5 text-[#287b6f]" aria-hidden="true" />Care plan progress — last 30 days</h2><p className="mt-1 text-sm text-[#687873]">{dateLabel(report.start)} – {dateLabel(report.end)}</p></div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Metric label="Completed" value={report.completed} icon={CheckCircle2} tone="success" />
          <Metric label="On-time rate" value={report.onTimeRate ?? 0} icon={Check} />
          <Metric label="Issues opened" value={report.issuesOpened} icon={AlertTriangle} tone="caution" />
          <Metric label="Still open" value={report.openIssues} icon={Shield} tone="caution" />
        </div>
        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold"><CheckCircle2 className="size-4 text-[#287b6f]" aria-hidden="true" />Completions per week</h3>
            <p className="sr-only">Weekly completions: {report.weekly.map((week) => `${week.start} to ${week.end}, ${week.completed}`).join('; ')}</p>
            <div className="mt-3 grid h-32 grid-cols-5 items-end gap-2" aria-hidden="true">
              {report.weekly.map((week) => <div key={week.start} className="flex h-full min-w-0 flex-col items-center justify-end gap-1.5"><span className="text-xs font-semibold tabular-nums">{week.completed}</span><span className="w-full max-w-12 rounded-t-lg bg-[#67a193]" style={{ height: `${Math.max(8, (week.completed / maxWeekly) * 88)}px` }} /><span className="text-[10px] text-[#687873]">{new Date(`${week.start}T12:00:00`).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' })}</span></div>)}
            </div>
            <h3 className="mt-6 flex items-center gap-2 text-sm font-bold"><Home className="size-4 text-[#287b6f]" aria-hidden="true" />By area</h3>
            <div className="mt-3 space-y-2">
              {report.byArea.length ? report.byArea.map((area) => (
                <div key={area.area} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 truncate text-xs font-semibold">{area.area}</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-[#eef2ec]"><span className="block h-full rounded-full bg-[#67a193]" style={{ width: `${(area.count / maxArea) * 100}%` }} /></span>
                  <span className="w-8 shrink-0 text-right text-xs font-bold tabular-nums">{area.count}</span>
                </div>
              )) : <p className="rounded-xl bg-[#f7f6f1] p-4 text-center text-sm text-[#687873]">No completions in this window yet.</p>}
            </div>
          </div>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-bold"><Users className="size-4 text-[#287b6f]" aria-hidden="true" />Per care worker</h3>
            <div className="mt-3 space-y-2">
              {report.perWorker.length ? report.perWorker.map((row) => {
                const worker = reportWorkers.find((item: Member) => item.id === row.workerId);
                if (!worker) return null;
                return (
                  <div key={worker.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
                    <AvatarFor member={worker} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{worker.name}</p>
                      <p className="text-xs text-[#687873]">{row.completed} completed{row.onTimeRate !== null ? ` · ${row.onTimeRate}% on time` : ''}{row.issues ? ` · ${row.issues} issue${row.issues === 1 ? '' : 's'}` : ''}</p>
                    </div>
                    <span className="h-2.5 w-20 shrink-0 overflow-hidden rounded-full bg-[#eef2ec]" aria-hidden="true"><span className="block h-full rounded-full bg-[#287b6f]" style={{ width: `${Math.min(100, (row.completed / Math.max(1, report.completed)) * 100)}%` }} /></span>
                  </div>
                );
              }) : <EmptyHandoff icon={Users} title="No active care workers" text="Add care workers to see per-person progress." compact />}
            </div>
          </div>
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDollarSign className="size-5 text-[#287b6f]" aria-hidden="true" />CSIL funding — this month</h2>
        {funding.fundedMinutes > 0 ? (
          <>
            <p className="mt-1 text-sm text-[#687873]">Tracked hours against your monthly funded amount{overPace ? ' — current pace projects over the funded hours' : ''}.</p>
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              <Metric label="Hours used" value={formatMinutes(funding.usedMinutes)} icon={Clock} />
              <Metric label="Funded" value={formatMinutes(funding.fundedMinutes)} icon={CircleDollarSign} />
              <Metric label="Remaining" value={formatMinutes(Math.max(0, funding.remainingMinutes))} icon={Check} tone={funding.remainingMinutes < 0 ? 'caution' : 'success'} />
              <Metric label="Projected" value={formatMinutes(funding.projectedMinutes)} icon={AlertTriangle} tone={overPace ? 'caution' : 'neutral'} />
            </div>
            <progress
              value={Math.round(usedPct)}
              max={100}
              aria-label="Share of funded hours used"
              className={`mt-4 h-3 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:rounded-full [&::-webkit-progress-bar]:rounded-full [&::-webkit-progress-bar]:bg-[#eef2ec] [&::-webkit-progress-value]:rounded-full ${overPace ? '[&::-moz-progress-bar]:bg-[#b4532a] [&::-webkit-progress-value]:bg-[#b4532a]' : '[&::-moz-progress-bar]:bg-[#287b6f] [&::-webkit-progress-value]:bg-[#287b6f]'}`}
            />
            <div className="mt-5 space-y-2">
              {funding.perWorker.map((row) => {
                const worker = reportWorkers.find((item: Member) => item.id === row.workerId);
                if (!worker) return null;
                return (
                  <div key={worker.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
                    <AvatarFor member={worker} className="size-9" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{worker.name}</p>
                      <p className="text-xs text-[#687873]">{formatMinutes(row.minutes)} tracked{row.cost !== null ? ` · est. $${row.cost.toFixed(2)}` : ' · no pay rate set'}</p>
                    </div>
                    <a href={`/api/timesheets?memberId=${worker.id}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d7dfd7] px-3 text-xs font-semibold text-[#52645f] transition hover:bg-[#f1f5f1]"><FileDown className="size-4" aria-hidden="true" />Timesheet CSV</a>
                  </div>
                );
              })}
            </div>
            <p className="mt-4 text-xs text-[#687873]">Funded value ${funding.fundedValue.toFixed(2)}/month · labor cost so far ${funding.laborCost.toFixed(2)}{settings?.fundingHourlyRate ? '' : ' — set the CSIL rate in Settings for the dollar total'}</p>
          </>
        ) : (
          <p className="mt-2 text-sm leading-6 text-[#687873]">Set your funded hours per month and the CSIL funding rate in Settings above to track your budget against the hours your care team actually works.</p>
        )}
      </Card>
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />Hours tracked — last 7 days</h2>
        <p className="mt-1 text-sm text-[#687873]">Care workers clock in and out from their Today view. Open shifts count toward the total live.</p>
        <div className="mt-4 space-y-2">
          {weekSummary(state.timeEntries ?? [], reportWorkers.map((worker: Member) => worker.id), weekStart).map((row) => {
            const worker = reportWorkers.find((item: Member) => item.id === row.workerId);
            if (!worker) return null;
            return (
              <div key={worker.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
                <AvatarFor member={worker} className="size-9" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{worker.name}</p>
                  <p className="text-xs text-[#687873]">{row.clockedIn ? 'On the clock now' : 'Not clocked in'}</p>
                </div>
                <span className="rounded-full bg-[#e8f1ec] px-2.5 py-1 text-xs font-bold tabular-nums text-[#287b6f]">{formatMinutes(row.minutes)}</span>
              </div>
            );
          })}
          {!reportWorkers.length && <EmptyHandoff icon={Clock} title="No care workers" text="Time entries appear once care workers clock in." compact />}
        </div>
        {(state.timeEntries ?? []).length > 0 && (
          <div className="mt-4 border-t border-[#e5eae4] pt-4">
            <h3 className="flex items-center gap-2 text-sm font-bold"><Clock className="size-4 text-[#287b6f]" aria-hidden="true" />Recent entries</h3>
            <ol className="mt-2 divide-y divide-[#e5eae4]">
              {(state.timeEntries ?? []).slice(0, 8).map((entry: any) => {
                const worker = state.members.find((item: Member) => item.id === entry.memberId);
                return (
                  <li key={entry.id} className="flex items-center gap-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 truncate font-medium">{worker?.name ?? 'Care worker'}</span>
                    <span className="text-xs tabular-nums text-[#687873]">{new Date(entry.startedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })} → {entry.endedAt ? new Date(entry.endedAt).toLocaleString(undefined, { hour: 'numeric', minute: '2-digit' }) : 'now'}</span>
                    <button onClick={() => mutate({ action: 'deleteTimeEntry', entryId: entry.id }, 'Time entry removed.')} aria-label={`Delete time entry for ${worker?.name ?? 'care worker'}`} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#687873] transition hover:bg-[#f1f5f1] hover:text-[#934c37]"><Trash2 className="size-4" aria-hidden="true" /></button>
                  </li>
                );
              })}
            </ol>
          </div>
        )}
      </Card>
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><History className="size-5 text-[#287b6f]" aria-hidden="true" />Audit history</h2>
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

function ScheduleView({ state, workers, personal = false, readOnly = false, setTask, setCreateOpen, mutate, busy }: any) {
  const schedule = buildWeekSchedule<Chore>(state.chores, workers, today());
  const plan = personal || readOnly ? [] : suggestAssignments<Chore>(state.chores, workers, today(), 7, { shifts: state.shifts ?? [], availability: state.availability ?? [] });
  const claimable = schedule.days.flatMap((day) => day.tasks).filter((task) => task.assignedTo === null && task.status === 'open');
  const [assigning, setAssigning] = useState(false);
  async function autoAssign() {
    setAssigning(true);
    try {
      for (const item of plan) await mutate({ action: 'assign', choreId: item.taskId, assigneeId: item.workerId }, `Auto-assigned ${plan.length} task${plan.length === 1 ? '' : 's'} across the team.`);
    } finally { setAssigning(false); }
  }
  const memberFor = (id: string | null) => state.members.find((item: Member) => item.id === id);
  const scheduled = (task: Chore, dense = false) => {
    const assignee = memberFor(task.assignedTo);
    return (
      <button key={task.id} onClick={() => setTask(task)} className={`flex w-full items-center gap-2 rounded-xl border p-2.5 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${task.status === 'complete' ? 'border-[#e2e8e1] bg-[#f4f7f2] opacity-70' : task.issueOpen ? 'border-[#eccab6] bg-[#fdf3ec] hover:border-[#d9a67e]' : 'border-[#dfe5dc] bg-white hover:border-[#aac3b3]'} ${dense ? 'min-h-11' : 'min-h-12'}`}>
        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-[#52645f]">{task.dueTime ?? '—'}</span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-xs font-semibold ${task.status === 'complete' ? 'line-through' : ''}`}>{task.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#687873]">
            {assignee && <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: assignee.color }} aria-hidden="true" />}
            <span className="truncate">{assignee?.name ?? 'Unassigned'}</span>
          </span>
        </span>
        {task.issueOpen && <AlertTriangle className="size-3.5 shrink-0 text-[#8b4e2c]" aria-label="Open issue" />}
        {task.status === 'complete' && <Check className="size-3.5 shrink-0 text-[#216b61]" aria-label="Complete" />}
      </button>
    );
  };
  return (
    <>
      <Title title={personal ? 'My week' : 'Weekly schedule'} text={personal ? 'Your assignments and work you can claim for the next seven days.' : readOnly ? 'Seven days of household work and who is on shift.' : 'Seven days of household work — reschedule or reassign any task from its details.'} action={personal || readOnly ? undefined : <div className="flex flex-wrap gap-2">{plan.length > 0 && <Button variant="outline" disabled={assigning || busy} onClick={autoAssign}><UserCheck className="size-4" />Auto-assign {plan.length} open task{plan.length === 1 ? '' : 's'}</Button>}<Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button></div>} />
      {schedule.overdue.length > 0 && (
        <Card className="mb-6 border-[#eccab6] bg-[#fdf8f2]">
          <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="size-5 text-[#8b4e2c]" aria-hidden="true" />Overdue — needs rescheduling</h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">{schedule.overdue.map((task) => (
            <button key={task.id} onClick={() => setTask(task)} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-[#eccab6] bg-white p-2.5 text-left transition hover:border-[#d9a67e] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{task.title}</span><span className="block text-xs text-[#8b4e2c]">Due {dateLabel(task.dueDate)} · {memberFor(task.assignedTo)?.name ?? 'Unassigned'}</span></span>
              <ChevronRight className="size-4 shrink-0 text-[#8b4e2c]" aria-hidden="true" />
            </button>
          ))}</div>
        </Card>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {schedule.days.map((day) => {
          const isToday = day.date === today();
          const dayShifts = shiftsForDay(state.shifts ?? [], day.date).filter((shift) => memberFor(shift.memberId));
          return (
            <section key={day.date} aria-label={`Schedule for ${day.date}`} className={`flex min-h-32 flex-col rounded-2xl border p-3 ${isToday ? 'border-[#287b6f] bg-[#eef4ef]' : 'border-[#dfe5dc] bg-[#fffefa]'}`}>
              <header className="mb-2 flex items-center justify-between gap-2">
                <div><p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-[#287b6f]' : 'text-[#687873]'}`}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</p><p className="text-sm font-semibold">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</p></div>
                {isToday && <span className="rounded-full bg-[#287b6f] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Today</span>}
              </header>
              {dayShifts.length > 0 && (
                <div className="mb-2 space-y-1">
                  {dayShifts.slice(0, 2).map((shift) => {
                    const person = memberFor(shift.memberId);
                    return <p key={shift.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4d6b5e]"><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: person.color }} aria-hidden="true" />{personal ? 'Your shift' : person.name.split(' ')[0]} · {formatShift(shift)}</p>;
                  })}
                  {dayShifts.length > 2 && <p className="text-[11px] font-semibold text-[#4d6b5e]">+{dayShifts.length - 2} more on shift</p>}
                </div>
              )}
              <div className="flex flex-1 flex-col gap-1.5">
                {day.tasks.map((task) => scheduled(task, true))}
                {day.tasks.length === 0 && <p className="rounded-xl border border-dashed border-[#d7dfd7] p-3 text-center text-xs text-[#8a978f]">No work due</p>}
              </div>
              {(day.unassigned > 0 || day.issues > 0) && <p className="mt-2 text-[11px] font-semibold text-[#8b4e2c]">{[day.unassigned > 0 ? `${day.unassigned} unassigned` : '', day.issues > 0 ? `${day.issues} issue${day.issues === 1 ? '' : 's'}` : ''].filter(Boolean).join(' · ')}</p>}
            </section>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {personal ? (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDot className="size-5 text-[#287b6f]" aria-hidden="true" />Open to claim this week</h2>
          <p className="text-sm text-[#687873]">Unassigned work due in the next seven days — open one to claim it</p>
          <div className="mt-4 space-y-2">
            {claimable.length ? claimable.map((task) => scheduled(task)) : <EmptyHandoff icon={CheckCircle2} title="Nothing to claim" text="All scheduled work is already assigned." compact />}
          </div>
        </Card>
        ) : (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />Care worker load this week</h2>
          <p className="text-sm text-[#687873]">Assigned open tasks per day for each active care worker</p>
          <div className="mt-4 space-y-3">
            {schedule.workload.length ? schedule.workload.map((load) => {
              const worker = workers.find((item: Member) => item.id === load.workerId);
              if (!worker) return null;
              return (
                <div key={worker.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
                  <div className="flex items-center gap-3">
                    <AvatarFor member={worker} className="size-9" />
                    <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{worker.name}</p><p className="truncate text-xs text-[#687873]">{(() => { const windows = (state.availability ?? []).filter((item: any) => item.memberId === worker.id); return windows.length ? windows.map((item: any) => `${weekdayNames[item.weekday]} ${formatShift(item)}`).join(' · ') : 'Availability not set'; })()}</p></div>
                    <span className="rounded-full bg-[#e8f1ec] px-2.5 py-1 text-xs font-bold tabular-nums text-[#287b6f]">{load.total} task{load.total === 1 ? '' : 's'}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-7 gap-1" aria-label={`Daily load for ${worker.name}`}>
                    {load.byDay.map((count: number, index: number) => (
                      <span key={schedule.days[index].date} className={`rounded-lg py-1.5 text-center text-xs font-semibold tabular-nums ${count > 0 ? 'bg-[#e8f1ec] text-[#216b61]' : 'bg-[#f4f6f2] text-[#9aa6a0]'}`} title={`${schedule.days[index].date}: ${count} task${count === 1 ? '' : 's'}`}>{count}</span>
                    ))}
                  </div>
                </div>
              );
            }) : <EmptyHandoff icon={Users} title="No active care workers" text="Add a care worker to start balancing the weekly load." compact />}
          </div>
        </Card>
        )}
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDot className="size-5 text-[#287b6f]" aria-hidden="true" />{personal ? 'Your unscheduled work' : 'Unscheduled work'}</h2>
          <p className="text-sm text-[#687873]">Open tasks without a due date — open one to pick a day</p>
          <div className="mt-4 space-y-2">
            {schedule.unscheduled.length ? schedule.unscheduled.map((task) => scheduled(task)) : <EmptyHandoff icon={CheckCircle2} title="Nothing unscheduled" text="Every open task has a due date." compact />}
          </div>
        </Card>
      </div>
    </>
  );
}

function ViewerView({ section, state, setTask }: any) {
  const workers = state.members.filter((item: Member) => item.role === 'worker' && item.status === 'active');
  if (section === 'schedule') return <ScheduleView state={state} workers={workers} readOnly setTask={setTask} />;
  if (section === 'tasks') return (
    <>
      <Title title="Household tasks" text="The full care plan — read-only." />
      <Card className="p-0"><TaskList tasks={state.chores} members={state.members} onOpen={setTask} /></Card>
    </>
  );
  const onShiftToday = shiftsForDay(state.shifts ?? [], today());
  const dueToday = state.chores.filter((chore: Chore) => chore.status !== 'complete' && chore.dueDate === today());
  const doneToday = state.chores.filter((chore: Chore) => chore.completedAt?.slice(0, 10) === today());
  return (
    <>
      <AnnouncementBanner items={state.announcements ?? []} />
      <Title title="Household overview" text="A read-only look at today’s care plan." />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="Due today" value={dueToday.length} icon={CalendarDays} />
        <Metric label="Completed today" value={doneToday.length} icon={Check} tone="success" />
        <Metric label="On shift today" value={onShiftToday.length} icon={Clock} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />On shift today</h2>
          <div className="mt-4 space-y-2">
            {onShiftToday.length ? onShiftToday.map((shift: any) => {
              const person = state.members.find((item: Member) => item.id === shift.memberId);
              return person ? <div key={shift.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3"><AvatarFor member={person} className="size-9" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.name}</span><span className="text-xs tabular-nums text-[#687873]">{formatShift(shift)}</span></div> : null;
            }) : <EmptyHandoff icon={Clock} title="No one on shift" text="No care worker is scheduled today." compact />}
          </div>
        </Card>
        <Card className="p-0">
          <div className="border-b border-[#dfe5dc] px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-[#287b6f]" aria-hidden="true" />Due today</h2></div>
          <TaskList tasks={dueToday} members={state.members} onOpen={setTask} compact />
        </Card>
      </div>
    </>
  );
}

function WorkerView({ section, state, member, setTask, setProfile, setAvailWorker, mutate, uploadClientNote, busy }: any) {
  const [taskQuery, setTaskQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'mine' | 'available' | 'in_progress' | 'complete'>('all');
  if (section === 'schedule') return <ScheduleView state={state} workers={[]} personal setTask={setTask} />;
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
          <p><span className="text-[#687873]">Availability:</span> {(state.availability ?? []).length ? (state.availability ?? []).map((shift: any) => `${weekdayNames[shift.weekday]} ${formatShift(shift)}`).join(' · ') : 'Not set'}</p>
          <p><span className="text-[#687873]">Availability notes:</span> {member.availability || 'Not provided'}</p>
          <p><span className="text-[#687873]">Languages:</span> {member.languages || 'Not provided'}</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => setProfile(member)} className="min-h-11 bg-[#287b6f]"><Pencil className="size-4" />Edit your profile</Button>
          <Button variant="outline" onClick={() => setAvailWorker(member)} className="min-h-11"><CalendarDays className="size-4" />Edit availability</Button>
        </div>
      </Card>
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><Shield className="size-5 text-[#287b6f]" aria-hidden="true" />Certifications</h2>
        <p className="text-sm text-[#687873]">Your current certifications and expiry dates</p>
        <div className="mt-4 space-y-2">
          {(state.certifications ?? []).length ? (state.certifications ?? []).map((cert: any) => {
            const status = certStatus(cert.expiresOn, today());
            return (
              <div key={cert.id} className="flex items-center justify-between gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{cert.name}</p><p className="text-xs text-[#687873]">{status === 'expired' ? 'Expired' : `Expires ${cert.expiresOn}`}</p></div>
                <Badge className={status === 'expired' ? 'bg-[#f8e9dc] text-[#8b4e2c]' : status === 'expiring' ? 'bg-[#fcf4e9] text-[#805322]' : 'bg-[#e8f1ec] text-[#287b6f]'}>{status}</Badge>
              </div>
            );
          }) : <EmptyHandoff icon={Shield} title="No certifications" text="Your manager can add certifications to your profile." compact />}
        </div>
      </Card>
    </>
  );
  if (section === 'more') {
    const todayStr = today();
    const monthMinutes = minutesInRange(state.timeEntries ?? [], member.id, `${todayStr.slice(0, 7)}-01`, todayStr, new Date().toISOString());
    const estimatedPay = member.hourlyRate != null ? (monthMinutes / 60) * member.hourlyRate : null;
    return (
    <>
      <Title title="More" text="Account, pay, and privacy." />
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><CircleDollarSign className="size-5" aria-hidden="true" /></span>
            <h2 className="font-bold">Your pay</h2>
          </div>
          <div className="mt-3 space-y-2 text-sm">
            <p className="flex items-center justify-between gap-3"><span className="text-[#687873]">Pay rate</span><span className="font-semibold">{member.hourlyRate != null ? `$${member.hourlyRate.toFixed(2)}/hr` : 'Not set by your manager'}</span></p>
            <p className="flex items-center justify-between gap-3"><span className="text-[#687873]">Hours this month</span><span className="font-semibold">{formatMinutes(monthMinutes)}</span></p>
            {estimatedPay != null && (
              <p className="flex items-center justify-between gap-3 border-t border-[#e2e8e1] pt-2"><span className="text-[#687873]">Estimated pay</span><span className="font-semibold">${estimatedPay.toFixed(2)}</span></p>
            )}
          </div>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><Shield className="size-5" aria-hidden="true" /></span>
            <h2 className="font-bold">Privacy</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#687873]">You can see your profile, your own pay rate and hours, tasks assigned to you, unfinished work you can take over, tasks available to claim, and the team chat. Other care workers’ pay, contact details, activity, reports, settings, and audit records remain private.</p>
        </Card>
        <Card>
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><User className="size-5" aria-hidden="true" /></span>
            <h2 className="font-bold">Account</h2>
          </div>
          <p className="mt-3 text-sm leading-6 text-[#687873]">Manage your password and sign out.</p>
          <div className="mt-4 grid gap-2">
            <Link href="/change-password" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#d7dfd7] bg-white px-4 text-sm font-semibold text-[#52645f] transition hover:bg-[#f1f5f1]"><KeyRound className="size-4" />Change password</Link>
            <form action={logOut}><button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white transition hover:bg-[#216b61]"><LogOut className="size-4" />Sign out</button></form>
          </div>
        </Card>
      </div>
    </>
    );
  }
  if (section === 'client') return <ClientRecordView state={state} uploadClientNote={uploadClientNote} busy={busy} />;
  if (section === 'messages') return <InboxView state={state} mutate={mutate} busy={busy} />;
  if (section === 'today') return <><AnnouncementBanner items={state.announcements ?? []} /><TimeClock member={member} entries={state.timeEntries ?? []} shifts={state.shifts ?? []} mutate={mutate} busy={busy} /><ShiftHandoff state={state} member={member} setTask={setTask} mutate={mutate} busy={busy} /></>;
  const tasks = state.chores;
  const query = taskQuery.trim().toLowerCase();
  const filtered = tasks.filter((task: Chore) => {
    if (taskFilter === 'mine' && task.assignedTo !== member.id) return false;
    if (taskFilter === 'available' && !(task.assignedTo === null && task.status === 'open')) return false;
    if (taskFilter === 'in_progress' && task.status !== 'in_progress') return false;
    if (taskFilter === 'complete' && task.status !== 'complete') return false;
    if (query && !task.title.toLowerCase().includes(query) && !(task.instructions ?? '').toLowerCase().includes(query)) return false;
    return true;
  });
  return (
    <>
      <Title title="Tasks" text="Your assigned work and tasks available to claim." />
      <Card className="p-0">
        <div className="border-b border-[#dfe5dc] px-5 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 className="flex items-center gap-2 font-semibold"><ClipboardList className="size-4 text-[#287b6f]" aria-hidden="true" />Your task list</h2><p className="text-sm text-[#687873]">{filtered.length} shown · {tasks.length} total</p></div>
            <div className="flex flex-wrap gap-2">
              <Input value={taskQuery} onChange={(e) => setTaskQuery(e.target.value)} placeholder="Search tasks…" aria-label="Search tasks" className="h-10 w-full flex-1 sm:w-52 sm:flex-none" />
              <select value={taskFilter} onChange={(e) => setTaskFilter(e.target.value as any)} aria-label="Filter tasks" className="field-control h-10 w-auto rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm">
                <option value="all">All tasks</option>
                <option value="mine">Assigned to me</option>
                <option value="available">Available to claim</option>
                <option value="in_progress">In progress</option>
                <option value="complete">Complete</option>
              </select>
            </div>
          </div>
        </div>
        <TaskList tasks={filtered} members={[member]} onOpen={setTask} />
      </Card>
    </>
  );
}

function InboxView({ state, mutate, busy }: any) {
  const me = state.viewer.id;
  const isManager = state.viewer.role === 'manager';
  const inbox = state.inbox ?? [];
  const people = state.members.filter((item: Member) => item.status === 'active' && item.id !== me && item.role !== 'viewer' && (!isManager || item.role === 'worker'));
  const memberFor = (id: string) => state.members.find((item: Member) => item.id === id);
  const alerts = (state.safetyAlerts ?? []).filter((item: any) => !item.safetyReviewedAt);
  const statusKind = (kind: string) => kind.startsWith('client_note_');
  return (
    <>
      <Title title="Care team inbox" text={isManager ? 'All direct care-team messages, worker note updates, and advisory safety alerts.' : 'Direct messages and your note updates. The manager can read all team messages.'} />
      {!isManager && <div role="note" className="mb-5 flex items-start gap-3 rounded-2xl border border-[#d9c99d] bg-[#fff8e8] p-4 text-sm text-[#6f5422]"><Shield className="mt-0.5 size-5 shrink-0" aria-hidden="true" /><p><strong>Monitored team inbox.</strong> Messages are visible to participants and the household manager. Unrelated workers cannot read them.</p></div>}
      {isManager && alerts.length > 0 && <Card className="mb-6 border-[#e2b69f] bg-[#fff8f4]">
        <div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#f8dfd1] text-[#8f3f25]"><ShieldAlert className="size-5" aria-hidden="true" /></span><div><h2 className="font-bold">Advisory safety alerts</h2><p className="mt-1 text-sm leading-6 text-[#6d5a51]">Local automated triage found wording that may need prompt manager review. It does not diagnose or take clinical action.</p></div></div>
        <ol className="mt-4 space-y-3">{alerts.map((alert: any) => <li key={alert.id} className="rounded-xl border border-[#ead1c4] bg-white p-4"><div className="flex flex-wrap items-center justify-between gap-2"><StatusBadge status={alert.safetyCategory} /><time className="text-xs text-[#687873]">{new Date(alert.createdAt).toLocaleString()}</time></div><p className="mt-2 text-sm font-semibold">{alert.safetyReason}</p><p className="mt-2 break-words rounded-lg bg-[#f7f6f1] p-3 text-sm leading-6">{alert.body}</p><Button type="button" variant="outline" className="mt-3 min-h-11" disabled={busy} onClick={() => mutate({ action: 'acknowledgeSafetyAlert', messageId: alert.id }, 'Safety alert marked reviewed.')}><Check className="size-4" aria-hidden="true" />Mark reviewed</Button></li>)}</ol>
      </Card>}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,.6fr)]">
        <Card className="p-0">
          <div className="border-b border-[#dfe5dc] px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><Inbox className="size-5 text-[#287b6f]" aria-hidden="true" />Personal and monitored messages</h2><p className="mt-1 text-sm text-[#687873]">{inbox.length ? `${inbox.length} item${inbox.length === 1 ? '' : 's'}` : 'No inbox items yet'}</p></div>
          <div className="max-h-[60vh] overflow-y-auto p-4">
            {inbox.length ? <ol className="space-y-3">{inbox.map((item: any) => {
              const sender = memberFor(item.createdBy); const recipient = memberFor(item.workerId); const mine = item.createdBy === me;
              return <li key={item.id} className={`rounded-2xl border p-4 ${statusKind(item.kind) ? 'border-[#cbdccf] bg-[#f2f7f1]' : mine ? 'border-[#bcd4c9] bg-[#eef4ec]' : 'border-[#e2e8e1] bg-white'}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{statusKind(item.kind) ? 'Client note update' : `${sender?.name ?? 'Former member'} → ${recipient?.name ?? 'Former member'}`}</p><StatusBadge status={item.kind.replace('client_note_', '')} /></div>
                <p className="mt-2 break-words text-sm leading-6">{item.body}</p><time className="mt-2 block text-xs text-[#687873]">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
              </li>;
            })}</ol> : <EmptyHandoff icon={Inbox} title="Your inbox is clear" text="Direct messages and client-note review updates will appear here." compact />}
          </div>
        </Card>
        <Card className="h-fit">
          <h2 className="flex items-center gap-2 font-bold"><Send className="size-5 text-[#287b6f]" aria-hidden="true" />Send a direct message</h2>
          <p className="mt-1 text-sm leading-6 text-[#687873]">Participants and the manager can read it. Automated triage may flag urgent wording for manager review.</p>
          <form className="mt-4 space-y-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'sendInboxMessage', ...Object.fromEntries(new FormData(form)) }, 'Inbox message sent.').then(() => form.reset()).catch(() => {}); }}>
            <label className="block text-sm font-semibold">Recipient<select name="recipientId" required className={fieldClass}><option value="">Choose a team member</option>{people.map((person: Member) => <option key={person.id} value={person.id}>{person.name} · {person.role === 'manager' ? 'Manager' : 'Care worker'}</option>)}</select></label>
            <TextArea label="Message" name="body" />
            <Button type="submit" disabled={busy || people.length === 0} className="min-h-11 w-full bg-[#287b6f]"><Send className="size-4" aria-hidden="true" />Send message</Button>
          </form>
        </Card>
      </div>
      <Card className="mt-6 p-0">
        <div className="border-b border-[#dfe5dc] px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Team-wide chat</h2><p className="mt-1 text-sm text-[#687873]">Visible to the full care team and retained for existing team coordination.</p></div>
        <div className="max-h-80 overflow-y-auto p-4">{(state.messages ?? []).length ? <ol className="space-y-3">{(state.messages as Message[]).map((msg) => <li key={msg.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{memberFor(msg.memberId)?.name ?? 'Former member'}{msg.memberId === me ? ' (you)' : ''}</span><time className="text-xs text-[#687873]">{new Date(msg.createdAt).toLocaleString()}</time></div><p className="mt-1 break-words text-sm leading-6">{msg.body}</p></li>)}</ol> : <EmptyHandoff icon={MessageSquareText} title="No team-wide messages" text="Use this shared space for information intended for everyone." compact />}</div>
        <form className="flex gap-2 border-t border-[#dfe5dc] p-4" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'postMessage', ...Object.fromEntries(new FormData(form)) }, 'Team message sent.').then(() => form.reset()).catch(() => {}); }}><Input name="body" required maxLength={1000} placeholder="Message the full care team…" aria-label="Team-wide message" className="min-h-11 flex-1" /><Button type="submit" disabled={busy} aria-label="Send team-wide message" className="min-h-11 bg-[#287b6f]"><Send className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Send</span></Button></form>
      </Card>
    </>
  );
}

function ClientRecordView({ state, mutate, uploadClientNote, busy }: any) {
  const isManager = state.viewer.role === 'manager';
  const manager = state.members.find((item: Member) => item.role === 'manager');
  const notes = state.clientNotes ?? [];
  const queue = state.clientNoteQueue ?? [];
  const memberFor = (id: string) => state.members.find((item: Member) => item.id === id);
  return <>
    <Title title="Client record" text={isManager ? 'Review OCR drafts before explicitly adding them to the official client record.' : 'Capture a hard-copy note for manager review and read approved client notes.'} />
    {!isManager && <Card className="mb-6 border-[#bcd4c9] bg-[#f2f7f1]"><div className="flex items-start gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#dfece3] text-[#287b6f]"><ScanLine className="size-5" aria-hidden="true" /></span><div><h2 className="font-bold">Submit a paper note</h2><p className="mt-1 text-sm leading-6 text-[#52645f]">Take a clear, well-lit photo or choose an image. Text is read locally on the CareBoard server and stays pending until the manager reviews it.</p></div></div>
      <form className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={async (e) => { e.preventDefault(); const form = e.currentTarget; const file = new FormData(form).get('photo'); if (!(file instanceof File) || !file.size || !manager) return; try { await uploadClientNote(file, manager.id); form.reset(); } catch { /* live notice reports error */ } }}>
        <label htmlFor="client-note-photo" className="block text-sm font-semibold">Photo of note<Input id="client-note-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" required className="mt-1 min-h-12 bg-white file:mr-3 file:rounded-lg file:border-0 file:bg-[#e8f1ec] file:px-3 file:py-2 file:font-semibold file:text-[#287b6f]" /></label>
        <Button type="submit" disabled={busy || !manager} className="min-h-12 bg-[#287b6f]"><Upload className="size-5" aria-hidden="true" />Scan and submit</Button>
      </form>
    </Card>}
    {isManager && <Card className="mb-6 p-0"><div className="flex items-center justify-between gap-3 border-b border-[#dfe5dc] px-5 py-4"><div><h2 className="flex items-center gap-2 font-bold"><ClipboardList className="size-5 text-[#287b6f]" aria-hidden="true" />Pending review queue</h2><p className="mt-1 text-sm text-[#687873]">Edit OCR text if needed, then explicitly approve or reject.</p></div><span className="rounded-full bg-[#fcf0dc] px-3 py-1 text-sm font-bold text-[#8a5a1d]">{queue.length}</span></div>
      {queue.length ? <div className="grid gap-4 p-4">{queue.map((note: any) => <form key={note.id} className="grid gap-4 rounded-2xl border border-[#dfe5dc] bg-white p-4 lg:grid-cols-[12rem_1fr]" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'reviewClientNote', submissionId: note.id, decision: 'approve', ...Object.fromEntries(new FormData(e.currentTarget)) }, 'Client note approved.').catch(() => {}); }}>
        <a href={note.sourcePhotoId ? `/api/uploads/${note.sourcePhotoId}` : undefined} target="_blank" rel="noreferrer" className="group overflow-hidden rounded-xl border border-[#dfe5dc] bg-[#f7f6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">{note.sourcePhotoId ? <img src={`/api/uploads/${note.sourcePhotoId}`} alt="Original submitted client note" className="aspect-[4/3] size-full object-cover transition group-hover:scale-[1.02]" /> : <span className="grid aspect-[4/3] place-items-center text-sm text-[#687873]">Source image expired</span>}</a>
        <div><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">Submitted by {memberFor(note.submittedBy)?.name ?? 'Former worker'}</p><time className="text-xs text-[#687873]">{new Date(note.createdAt).toLocaleString()}</time></div><label className="mt-3 block text-sm font-semibold">Reviewed note text<textarea name="reviewedText" required defaultValue={note.ocrText} rows={7} className={fieldClass} /></label><div className="mt-3 flex flex-wrap gap-2"><Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f]"><CheckCircle2 className="size-4" aria-hidden="true" />Approve to record</Button><Button type="button" variant="outline" disabled={busy} className="min-h-11 border-[#d7a995] text-[#873d27]" onClick={() => mutate({ action: 'reviewClientNote', submissionId: note.id, decision: 'reject' }, 'Client note rejected.')}><XCircle className="size-4" aria-hidden="true" />Reject</Button></div></div>
      </form>)}</div> : <EmptyHandoff icon={CheckCircle2} title="Review queue is clear" text="New worker submissions will appear here before they can enter the client record." />}
    </Card>}
    <Card className="p-0"><div className="border-b border-[#dfe5dc] px-5 py-4"><h2 className="flex items-center gap-2 font-bold"><FileText className="size-5 text-[#287b6f]" aria-hidden="true" />Approved notes</h2><p className="mt-1 text-sm text-[#687873]">The official record includes approved content only.</p></div>{notes.length ? <ol className="divide-y divide-[#e5eae4]">{notes.map((note: any) => <li key={note.id} className="p-5"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold">{memberFor(note.submittedBy)?.name ?? 'Former worker'}</p><StatusBadge status="approved" /></div><p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7">{note.body}</p><p className="mt-3 text-xs text-[#687873]">Approved {note.reviewedAt ? new Date(note.reviewedAt).toLocaleString() : ''}{note.editedDuringReview ? ' · Edited during manager review' : ''}</p></li>)}</ol> : <EmptyHandoff icon={FileText} title="No approved notes yet" text="Pending and rejected submissions never appear in the official client record." />}</Card>
  </>;
}

function TimeClock({ member, entries, shifts, mutate, busy }: any) {
  const [now, setNow] = useState(() => new Date().toISOString());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date().toISOString()), 30_000);
    return () => clearInterval(timer);
  }, []);
  const open = openEntryFor(entries, member.id);
  const todayMinutes = minutesInRange(entries, member.id, today(), today(), now);
  const elapsed = open ? Math.max(0, (new Date(now).getTime() - new Date(open.startedAt).getTime()) / 60000) : 0;
  const shift = shiftsForDay(shifts, today()).find((item: any) => item.memberId === member.id) ?? null;
  const mondayISO = addDaysISO(today(), -((weekdayOf(today()) + 6) % 7));
  const weekMinutes = minutesInRange(entries, member.id, mondayISO, today(), now);
  const attendanceRow = buildAttendance({ workers: [member], shifts, entries, date: today(), nowTime: new Date(now).toTimeString().slice(0, 5), now })[0];
  return (
    <Card className="mb-6 flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${open ? 'bg-[#287b6f] text-white' : 'bg-[#e8f1ec] text-[#287b6f]'}`}><Clock className="size-5" aria-hidden="true" /></span>
        <div>
          <h2 className="font-bold">{open ? 'You’re on the clock' : 'Time clock'}</h2>
          <p className="text-sm text-[#687873]">{open ? `Clocked in at ${new Date(open.startedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · ${formatMinutes(elapsed)} so far` : `Tracked today: ${formatMinutes(todayMinutes)}`}</p>
          <p className="mt-1 text-xs text-[#687873]">{shift ? `Shift today ${formatShift(shift)}` : 'No shift scheduled today'} · This week {formatMinutes(weekMinutes)}</p>
          {attendanceRow?.status === 'late' && <p className="mt-1 text-xs font-semibold text-[#98552e]">Your shift started at {shift?.startTime} — don’t forget to clock in.</p>}
        </div>
      </div>
      <Button disabled={busy} onClick={() => mutate({ action: open ? 'clockOut' : 'clockIn' }, open ? 'Clocked out.' : 'Clocked in.')} className={`min-h-11 ${open ? '' : 'bg-[#287b6f]'}`} variant={open ? 'outline' : 'default'}>{open ? <><Check className="size-4" />Clock out</> : <><Clock className="size-4" />Clock in</>}</Button>
    </Card>
  );
}

function ShiftHandoff({ state, member, setTask, mutate, busy }: any) {
  const date = today();
  const handoff = buildShiftHandoff<Chore>(state.chores, member.id, date);
  const firstName = member.name.split(/\s+/)[0];
  const outstanding = handoff.assigned.filter((task: Chore) => task.status !== 'complete');
  const runAction = async (event: React.MouseEvent, task: Chore, action: 'start' | 'complete') => {
    event.stopPropagation();
    try { await mutate({ action, choreId: task.id }, action === 'start' ? `${task.title} started.` : `${task.title} completed.`); } catch { /* live notice reports the error */ }
  };
  return (
    <>
      <Title title={`Shift handoff for ${firstName}`} text="Your assignments, important updates, and next actions in one place." />
      <section aria-labelledby="shift-summary" className="mb-6 overflow-hidden rounded-3xl bg-[#203f36] p-5 text-white shadow-lg sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[#bcd9ca]">Today · {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2 id="shift-summary" className="mt-2 text-2xl font-semibold">{handoff.attention.length ? `${handoff.attention.length} ${handoff.attention.length === 1 ? 'item needs' : 'items need'} attention` : 'You’re ready for the shift'}</h2><p className="mt-2 max-w-xl text-sm leading-6 text-[#d8e7df]">{handoff.attention.length ? 'Prioritized from due dates, task priority, and open issues already recorded by your care team.' : outstanding.length ? 'No urgent or overdue work. Continue with today’s plan.' : 'No assigned work is due today. Available work remains in Tasks.'}</p></div>
          <div aria-label={`${handoff.completed.length} of ${handoff.assigned.length + handoff.completed.length} shift tasks completed`} className="min-w-40 rounded-2xl bg-white/10 p-4"><p className="text-3xl font-semibold tabular-nums">{handoff.completed.length}<span className="text-base text-[#bcd9ca]"> / {handoff.assigned.length + handoff.completed.length}</span></p><p className="mt-1 text-xs text-[#d8e7df]">completed today</p></div>
        </div>
      </section>
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Completed today" value={handoff.completed.length} icon={CheckCircle2} tone="success" />
        <Metric label="In progress" value={state.chores.filter((task: Chore) => task.assignedTo === member.id && task.status === 'in_progress').length} icon={CircleDot} />
        <Metric label="Due today" value={outstanding.length} icon={CalendarDays} />
        <Metric label="Available to claim" value={state.chores.filter((task: Chore) => task.assignedTo === null && task.status === 'open').length} icon={ClipboardList} />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.45fr_.85fr]">
        <div className="space-y-6">
          <Card className="p-0">
            <div className="flex items-start gap-3 border-b border-[#dfe5dc] px-5 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f8e9dc] text-[#98552e]"><AlertTriangle className="size-5" aria-hidden="true" /></span><div><h2 className="font-bold">Priority briefing</h2><p className="text-sm text-[#687873]">Why these tasks should come first</p></div></div>
            {handoff.attention.length ? <div className="grid gap-3 p-4">{handoff.attention.map((task: Chore) => <HandoffTask key={task.id} task={task} member={member} reasons={attentionReasons(task, date)} setTask={setTask} busy={busy} runAction={runAction} />)}</div> : <EmptyHandoff icon={CheckCircle2} title="Nothing needs immediate attention" text="Urgent, overdue, and issue-flagged assignments will appear here." />}
          </Card>
          <Card className="p-0">
            <div className="flex items-start gap-3 border-b border-[#dfe5dc] px-5 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><CalendarDays className="size-5" aria-hidden="true" /></span><div><h2 className="font-bold">Today’s assignments</h2><p className="text-sm text-[#687873]">{handoff.assigned.length} open {handoff.assigned.length === 1 ? 'task' : 'tasks'} due today</p></div></div>
            {handoff.assigned.length ? <div className="grid gap-3 p-4">{handoff.assigned.map((task: Chore) => <HandoffTask key={task.id} task={task} member={member} reasons={[]} setTask={setTask} busy={busy} runAction={runAction} />)}</div> : <EmptyHandoff icon={CalendarDays} title="No assigned tasks due today" text="You’re caught up. Check Tasks if you want to claim available work." />}
          </Card>
        </div>
        <aside className="space-y-6" aria-label="Shift updates and progress">
          <Card>
            <h2 className="flex items-center gap-2 font-bold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Latest handoff notes</h2><p className="mt-1 text-sm text-[#687873]">Recent updates on your assigned work</p>
            {handoff.latestNotes.length ? <ol className="mt-4 space-y-3">{handoff.latestNotes.map(({ task, ...note }: any) => <li key={note.id}><button onClick={() => setTask(task)} className="w-full rounded-xl border border-[#dfe5dc] bg-white p-3 text-left transition hover:border-[#aac3b3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{task.title}</span><Badge>{note.kind}</Badge></span><span className="mt-2 line-clamp-3 block text-sm leading-5 text-[#52645f]">{note.body}</span><time className="mt-2 block text-xs text-[#687873]">{new Date(note.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></button></li>)}</ol> : <EmptyHandoff icon={MessageSquareText} title="No handoff notes yet" text="Progress and issue notes from your assigned tasks will collect here." compact />}
          </Card>
          <Card>
            <h2 className="flex items-center gap-2 font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />Shift snapshot</h2><div className="mt-4 space-y-4">
              <ProgressRow label="Completed today" value={handoff.completed.length} icon={CheckCircle2} />
              <ProgressRow label="In progress" value={state.chores.filter((task: Chore) => task.assignedTo === member.id && task.status === 'in_progress').length} icon={CircleDot} />
              <ProgressRow label="Still due today" value={outstanding.length} icon={CalendarDays} />
            </div>
          </Card>
        </aside>
      </div>
    </>
  );
}

function HandoffTask({ task, member, reasons, setTask, busy, runAction }: any) {
  const AreaIcon = areaIcons.get(task.area) ?? Home;
  return <article className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><button onClick={() => setTask(task)} className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]" aria-label={`Open ${task.title}`}><span className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]">{createElement(AreaIcon, { className: 'size-5', 'aria-hidden': true })}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold">{task.title}</span><StatusBadge status={task.status} /></span><span className="mt-1 block text-xs text-[#52645f]">{task.area} · {dateLabel(task.dueDate)}{task.dueTime ? ` at ${task.dueTime}` : ''}</span></span></span>{reasons.length > 0 && <span className="mt-3 flex flex-wrap gap-1.5">{reasons.map((reason: string) => <span key={reason} className="rounded-full bg-[#f8e9dc] px-2.5 py-1 text-xs font-semibold text-[#8b4e2c]">{reason}</span>)}</span>}{(task.issueReport || task.progressNotes || task.instructions) && <span className="mt-3 line-clamp-2 block text-sm leading-5 text-[#52645f]">{task.issueReport || task.progressNotes || task.instructions}</span>}</button><div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf0eb] pt-3">{task.status === 'open' && task.assignedTo === member.id && <Button size="sm" disabled={busy} onClick={(event) => runAction(event, task, 'start')}><Play className="size-4" />Start task</Button>}{task.status === 'in_progress' && <Button size="sm" disabled={busy} onClick={(event) => runAction(event, task, 'complete')} className="bg-[#287b6f]"><Check className="size-4" />Mark complete</Button>}<Button size="sm" variant="outline" onClick={() => setTask(task)}><MessageSquareText className="size-4" />Add handoff note</Button></div></article>;
}

function AnnouncementBanner({ items }: { items: Array<{ id: string; detail: string; createdAt: string }> }) {
  if (!items.length) return null;
  return (
    <Card className="mb-6 border-[#bcd4c9] bg-[#eef4ec]">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-[#287b6f]"><Megaphone className="size-4" aria-hidden="true" />From your manager</h2>
      <ul className="mt-3 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="rounded-xl bg-white/70 p-3">
            <p className="text-sm font-medium leading-6">{item.detail}</p>
            <time className="mt-1 block text-xs text-[#687873]">{new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
          </li>
        ))}
      </ul>
    </Card>
  );
}
function EmptyHandoff({ icon: Icon, title, text, compact = false }: any) { return <div className={`flex flex-col items-center px-5 text-center ${compact ? 'py-7' : 'py-10'}`}><span className="mb-3 grid size-12 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><Icon className="size-6" aria-hidden="true" /></span><p className="font-semibold">{title}</p><p className="mt-1 max-w-sm text-sm leading-6 text-[#52645f]">{text}</p></div>; }
function ProgressRow({ label, value, icon: Icon }: any) { return <div className="flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><Icon className="size-4" aria-hidden="true" /></span><span className="flex-1 text-sm text-[#52645f]">{label}</span><strong className="text-lg tabular-nums">{value}</strong></div>; }

function Title({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) { return <div className="welcome-banner mb-6 flex flex-wrap items-end justify-between gap-5"><div className="min-w-0 flex-1 basis-64"><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-[#287b6f]">Your household, connected</p><h1 className="welcome-title break-words text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#52645f]">{text}</p></div>{action && <div className="shrink-0 [&_button]:min-h-11">{action}</div>}</div>; }
function Metric({ label, value, icon: Icon, tone = 'neutral' }: { label: string; value: number | string; icon?: React.ComponentType<{ className?: string }>; tone?: 'neutral' | 'caution' | 'success' }) {
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
              <span className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1"><StatusBadge status={task.status} />{task.reviewStatus === 'pending' && <span className="rounded-full bg-[#fcf4e9] px-2.5 py-0.5 text-xs font-semibold text-[#9e6b2e]">awaiting review</span>}{task.reviewStatus === 'approved' && <span className="rounded-full bg-[#e6f0eb] px-2.5 py-0.5 text-xs font-semibold text-[#216b61]">reviewed</span>}<span className="text-xs text-[#52645f]">{assigned?.name ?? 'Available'}</span>{priorityOrder[task.priority] <= 1 && <span className={`text-xs font-semibold capitalize ${priorityClass}`}>{task.priority} priority</span>}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-[#687873] transition group-hover:text-[#287b6f]" aria-hidden="true" />
          </button>
        );
      })}
    </div>
  );
}

function TaskDialog({ task, manager, readOnly = false, memberId, workers, busy, onClose, mutate, upload, deletePhoto }: any) {
  if (!task) return null;
  const editable = !readOnly && (manager || (task.assignedTo === memberId && task.status !== 'complete'));
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
            <Button type="submit" disabled={busy} className="bg-[#287b6f]"><Check className="size-4" />Save task changes</Button>
          </form>
        ) : editable ? (
          <form className="grid gap-4" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'updateTask', choreId: task.id, ...Object.fromEntries(new FormData(e.currentTarget)), issueOpen: new FormData(e.currentTarget).get('issueOpen') === 'on' }, 'Task update saved.'); }}>
            <TextArea label="Progress notes" name="progressNotes" defaultValue={task.progressNotes} />
            <TextArea label="Completion notes" name="completionNotes" defaultValue={task.completionNotes} />
            <TextArea label="Issue or blocker" name="issueReport" defaultValue={task.issueReport} />
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="issueOpen" defaultChecked={task.issueOpen} />Issue still open</label>
            <Field label="Expected completion" name="expectedCompletionAt" type="datetime-local" defaultValue={task.expectedCompletionAt} />
            <Button type="submit" disabled={busy} className="bg-[#287b6f]"><Check className="size-4" />Save update</Button>
          </form>
        ) : null}
        <div className="border-t pt-4">
          <h3 className="flex items-center gap-2 font-bold"><Camera className="size-5 text-[#287b6f]" aria-hidden="true" />Photos</h3>
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
          <h3 className="flex items-center gap-2 font-bold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Updates</h3>
          {(task.notes ?? []).map((note: any) => <p key={note.id} className="mt-2 rounded-xl bg-[#f1f5f1] p-3 text-sm"><Badge>{note.kind}</Badge> {note.body}</p>)}
          {editable && (
            <form className="mt-3 flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'addNote', choreId: task.id, ...Object.fromEntries(new FormData(e.currentTarget)) }, 'Note added.'); e.currentTarget.reset(); }}>
              <select name="kind" className={fieldClass}><option value="progress">Progress</option><option value="issue">Issue</option><option value="completion">Completion</option></select>
              <Input name="body" required placeholder="Add an update" className="min-h-11" />
              <Button type="submit" disabled={busy} className="bg-[#287b6f]"><Plus className="size-4" />Add</Button>
            </form>
          )}
        </div>
        <DialogFooter>
          <div className="flex w-full flex-wrap gap-2">
            {!readOnly && task.status === 'open' && !task.assignedTo && <Button disabled={busy} onClick={() => mutate({ action: 'claim', choreId: task.id }, 'Task claimed.')}><UserCheck className="size-4" />Claim</Button>}
            {!manager && !readOnly && task.assignedTo && task.assignedTo !== memberId && task.status !== 'complete' && <Button disabled={busy} onClick={() => mutate({ action: 'takeover', choreId: task.id }, 'Task is yours now — start it when you are ready.')} className="bg-[#287b6f]"><UserCheck className="size-4" />Take over</Button>}
            {!readOnly && task.status === 'open' && task.assignedTo && <Button disabled={busy} onClick={() => mutate({ action: 'start', choreId: task.id }, 'Task started.')}><Play className="size-4" />Start</Button>}
            {!readOnly && task.status === 'in_progress' && <Button disabled={busy} onClick={() => mutate({ action: 'complete', choreId: task.id }, 'Task completed.')} className="bg-[#287b6f]"><Check className="size-4" />Complete</Button>}
            {manager && task.reviewStatus === 'pending' && (
              <>
                <Button disabled={busy} onClick={() => mutate({ action: 'approveTask', choreId: task.id }, 'Review approved.')} className="bg-[#287b6f]"><Check className="size-4" />Approve</Button>
                <Button variant="outline" disabled={busy} onClick={() => mutate({ action: 'reopenTask', choreId: task.id }, 'Sent back for rework.')}><Undo2 className="size-4" />Send back</Button>
              </>
            )}
            {!manager && task.reviewStatus === 'pending' && <span className="self-center text-xs font-semibold text-[#9e6b2e]">Awaiting manager review</span>}
            {!manager && task.reviewStatus === 'approved' && <span className="self-center text-xs font-semibold text-[#216b61]">Approved by the manager</span>}
            <Button variant="outline" onClick={onClose}><X className="size-4" />Close</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileDialog({ profile, manager, busy, onClose, submit, upload, certs = [], mutate }: any) {
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
          <TextArea label="Availability notes" name="availability" defaultValue={profile.availability} />
          <TextArea label="Languages" name="languages" defaultValue={profile.languages} />
          {manager && <><Field label="Hourly pay rate ($)" name="hourlyRate" type="number" step="any" defaultValue={profile.hourlyRate ?? ''} /><TextArea label="Skills notes" name="skillsNotes" defaultValue={profile.skillsNotes} /><TextArea label="Certifications" name="certifications" defaultValue={profile.certifications} /><Field label="Emergency contact" name="emergencyContact" defaultValue={profile.emergencyContact} /></>}
          <Button type="submit" disabled={busy} className="bg-[#287b6f]"><Check className="size-4" />Save profile</Button>
        </form>
        {(manager || certs.length > 0) && (
          <div className="border-t border-[#e5eae4] pt-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold"><Shield className="size-4 text-[#287b6f]" aria-hidden="true" />Certification records</h3>
            {certs.length ? (
              <ul className="mt-2 space-y-2">
                {certs.map((cert: any) => {
                  const status = certStatus(cert.expiresOn, today());
                  const daysLeft = certDaysLeft(cert.expiresOn, today());
                  return (
                    <li key={cert.id} className="flex items-center gap-2 rounded-xl border border-[#e2e8e1] bg-white p-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{cert.name}</span>
                        <span className="block text-xs text-[#687873]">{status === 'expired' ? `Expired ${Math.abs(daysLeft)}d ago` : status === 'expiring' ? `Expires in ${daysLeft}d` : 'Valid'} · {cert.expiresOn}</span>
                      </span>
                      <Badge className={status === 'expired' ? 'bg-[#f8e9dc] text-[#8b4e2c]' : status === 'expiring' ? 'bg-[#fcf4e9] text-[#805322]' : 'bg-[#e8f4ef] text-[#216b61]'}>{status}</Badge>
                      {manager && <button type="button" disabled={busy} aria-label={`Delete ${cert.name}`} onClick={() => mutate({ action: 'deleteCertification', id: cert.id }, 'Certification removed.')} className="grid size-9 shrink-0 place-items-center rounded-lg text-[#8b4e2c] transition hover:bg-[#f8e9dc]"><Trash2 className="size-4" /></button>}
                    </li>
                  );
                })}
              </ul>
            ) : <p className="mt-1 text-xs text-[#687873]">No certification records on file yet.</p>}
            {manager && (
              <form className="mt-3 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'saveCertification', memberId: profile.id, ...Object.fromEntries(new FormData(form)) }, 'Certification saved.'); form.reset(); }}>
                <Input name="name" required maxLength={200} placeholder="e.g. First aid, criminal record check" aria-label="Certification name" className="min-h-11 min-w-0 flex-1" />
                <Input name="expiresOn" type="date" required aria-label="Expiry date" className="min-h-11 w-40" />
                <Button type="submit" disabled={busy} aria-label="Add certification" className="bg-[#287b6f]"><Plus className="size-4" /></Button>
              </form>
            )}
          </div>
        )}
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
          <label className="text-sm font-semibold">Priority<select name="priority" defaultValue="normal" className={fieldClass}><option>low</option><option value="normal">normal</option><option>high</option><option>urgent</option></select></label>
          <TextArea label="Instructions" name="instructions" />
          <label className="text-sm font-semibold">Repeat<select name="recurrence" className={fieldClass}><option value="">Never</option><option>daily</option><option>weekly</option><option>monthly</option></select></label>
          <label className="text-sm font-semibold">Assign to<select name="assigneeId" className={fieldClass}><option value="">Available to claim</option>{workers.filter((w: Member) => w.status === 'active').map((w: Member) => <option key={w.id} value={w.id}>{w.name}</option>)}</select></label>
          <Field label="Reminder lead days" name="reminderLeadDays" type="number" defaultValue={1} />
          <Button type="submit" disabled={busy} className="bg-[#287b6f]"><Plus className="size-4" />Create task</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddWorkerDialog({ open, busy, onClose, mutate, onInvited }: any) {
  const [method, setMethod] = useState<'invite' | 'password'>('invite');
  async function handleSubmit(event: { preventDefault(): void; currentTarget: HTMLFormElement }) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      if (method === 'invite') {
        const result = await mutate({ action: 'inviteMember', ...values }, 'Invite link created.');
        if (result?.inviteToken) onInvited(result.inviteToken);
      } else {
        await mutate({ action: 'addMember', ...values }, 'Care worker added.');
      }
      onClose();
    } catch { /* notice is shown */ }
  }
  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add care worker</DialogTitle>
          <DialogDescription>Invite them with a link so they choose their own password, or set a temporary one yourself.</DialogDescription>
        </DialogHeader>
        <form className="grid gap-4" onSubmit={handleSubmit}>
          <Field label="Full name" name="name" required />
          <Field label="Email" name="googleEmail" type="email" required />
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="sr-only">Sign-in method</legend>
            <button type="button" onClick={() => setMethod('invite')} aria-pressed={method === 'invite'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${method === 'invite' ? 'border-[#287b6f] bg-[#e8f1ec] text-[#287b6f]' : 'border-[#dfe5dc] text-[#52645f]'}`}><UserCheck className="size-4" aria-hidden="true" />Invite link</button>
            <button type="button" onClick={() => setMethod('password')} aria-pressed={method === 'password'} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${method === 'password' ? 'border-[#287b6f] bg-[#e8f1ec] text-[#287b6f]' : 'border-[#dfe5dc] text-[#52645f]'}`}><KeyRound className="size-4" aria-hidden="true" />Temporary password</button>
          </fieldset>
          {method === 'invite' ? (
            <>
              <label className="text-sm font-semibold">Role<select name="role" defaultValue="worker" className={fieldClass}><option value="worker">Care worker</option><option value="viewer">Family viewer (read-only)</option></select></label>
              <p className="text-xs leading-5 text-[#687873]">You’ll get a link to share — text, email, or read it out. It expires in 7 days and they pick their own password.</p>
            </>
          ) : (
            <>
              <Field label="Temporary password" name="temporaryPassword" type="password" required />
              <p className="text-xs text-[#687873]">Use at least 12 characters with upper/lowercase, a number, and a symbol.</p>
            </>
          )}
          <Button type="submit" disabled={busy} className="bg-[#287b6f]">{method === 'invite' ? <><UserCheck className="size-4" />Create invite link</> : <><Plus className="size-4" />Add care worker</>}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkDialog({ url, onClose }: any) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* select the field instead */ }
  }
  return (
    <Dialog open={Boolean(url)} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite link ready</DialogTitle>
          <DialogDescription>Share this link with the care worker — by text, email, or in person. It expires in 7 days.</DialogDescription>
        </DialogHeader>
        <Input readOnly value={url} aria-label="Invite link" onFocus={(e) => e.target.select()} className="min-h-11 text-xs" />
        <DialogFooter>
          <Button variant="outline" onClick={copy} className="min-h-11">{copied ? <><Check className="size-4" />Copied</> : <><Copy className="size-4" />Copy link</>}</Button>
          <Button onClick={onClose} className="bg-[#287b6f]"><Check className="size-4" />Done</Button>
        </DialogFooter>
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
            <Button type="submit" disabled={busy} className="bg-[#287b6f]"><KeyRound className="size-4" />Reset password</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function WindowDialog({ worker, windows, action, title, description, busy, onClose, mutate }: any) {
  const [rows, setRows] = useState(() => weekdayFull.map((_, weekday) => {
    const win = windows.find((item: any) => item.weekday === weekday);
    return { weekday, on: Boolean(win), startTime: win?.startTime ?? '09:00', endTime: win?.endTime ?? '17:00' };
  }));
  function update(weekday: number, patch: Record<string, unknown>) {
    setRows((current) => current.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)));
  }
  async function save() {
    const key = action === 'setShifts' ? 'shifts' : 'windows';
    try {
      await mutate({ action, memberId: worker.id, [key]: JSON.stringify(rows.filter((row) => row.on).map(({ weekday, startTime, endTime }) => ({ weekday, startTime, endTime }))) }, `Saved for ${worker.name}.`);
      onClose();
    } catch { /* notice is shown */ }
  }
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          {rows.map((row) => (
            <div key={row.weekday} className={`flex items-center gap-3 rounded-xl border p-2.5 ${row.on ? 'border-[#bcd4c9] bg-[#f4f8f3]' : 'border-[#e2e8e1]'}`}>
              <label className="flex min-h-11 w-24 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={row.on} onChange={(e) => update(row.weekday, { on: e.target.checked })} className="size-4 accent-[#287b6f]" />
                {weekdayFull[row.weekday].slice(0, 3)}
              </label>
              <div className="flex flex-1 items-center gap-2">
                <Input type="time" aria-label={`${weekdayFull[row.weekday]} start time`} value={row.startTime} disabled={!row.on} onChange={(e) => update(row.weekday, { startTime: e.target.value })} className="min-h-11 flex-1" />
                <span className="text-xs font-semibold text-[#687873]">to</span>
                <Input type="time" aria-label={`${weekdayFull[row.weekday]} end time`} value={row.endTime} disabled={!row.on} onChange={(e) => update(row.weekday, { endTime: e.target.value })} className="min-h-11 flex-1" />
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="size-4" />Cancel</Button>
          <Button disabled={busy} onClick={save} className="bg-[#287b6f]"><Check className="size-4" />Save shifts</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
