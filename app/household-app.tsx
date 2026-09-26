'use client';
/* oxlint-disable typescript/no-explicit-any, next/no-img-element -- API photo URLs require authenticated, unoptimized requests; compact view prop types are intentionally structural. */

import { logOut } from '@/app/actions/auth';
import Link from 'next/link';
import { createContext, createElement, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

const RoleContext = createContext<'manager' | 'viewer' | 'worker'>('worker');
function useRole() { return useContext(RoleContext); }
function useIsClient() {
  return useSyncExternalStore(() => () => {}, () => true, () => false);
}
function subscribeLocalStorage(onStoreChange: () => void) {
  window.addEventListener('storage', onStoreChange);
  window.addEventListener('careboard-local-storage', onStoreChange);
  return () => {
    window.removeEventListener('storage', onStoreChange);
    window.removeEventListener('careboard-local-storage', onStoreChange);
  };
}
function readLocalStorage(key: string) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function writeLocalStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
    window.dispatchEvent(new Event('careboard-local-storage'));
  } catch { /* private mode */ }
}
function useLocalStorageValue(key: string, serverValue = '') {
  return useSyncExternalStore(subscribeLocalStorage, () => readLocalStorage(key) ?? serverValue, () => serverValue);
}
import { AlertTriangle, Award, Bath, BedDouble, Bell, BookOpen, Briefcase, CalendarDays, Camera, Check, CheckCircle2, ChevronRight, CircleDollarSign, CircleDot, ClipboardList, Clock, Copy, FileDown, FileText, HandHeart, HeartHandshake, History, Home, Inbox, KeyRound, LayoutDashboard, LogOut, Mail, MapPin, Megaphone, MessageSquareText, MoreHorizontal, Pencil, Pill, Play, Plus, RefreshCw, ScanLine, Send, Settings, Shield, ShieldAlert, ShoppingCart, Sofa, Sparkles, Sprout, Stethoscope, Trash2, Undo2, Upload, User, UserCheck, Users, UserX, Utensils, WashingMachine, WifiOff, X, XCircle } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import type { Chore, HouseholdState, Member, Message } from '@/lib/household-data';
import { attentionReasons, buildShiftHandoff } from '@/lib/shift-handoff';
import { incidentCategoryLabels, incidentSeverityLabels } from '@/lib/care-safety';
import { buildManagerCommandCenter } from '@/lib/manager-command-center';
import { buildWeekSchedule, nextTaskAction, workerDayPlan } from '@/lib/schedule';
import { buildNotifications } from '@/lib/notifications';
import { buildProgressReport } from '@/lib/progress-report';
import { buildOnboarding, firstLoginGuide, guideTopics, type FirstLoginGuideStep } from '@/lib/onboarding';
import { assistantPayrollSuggestions, payrollAskQuestions, payrollAskStorageKey, payrollFaq, type PayrollAskStep, type PayrollFaqItem, type PayrollHelpRole } from '@/lib/payroll-help';
import { buildHrAlerts, incompleteHireWorkerCount, memberOnApprovedLeave, unsignedRequiredDocCount } from '@/lib/hr';
import { payPeriodReadyToClose } from '@/lib/hr-payroll';
import { ManagerHrView, WorkerHrCards } from '@/app/hr-panel';
import { isEditableKeyboardTarget, shortcutsForRole } from '@/lib/dashboard-shortcuts';
import { suggestAssignments } from '@/lib/auto-assign';
import { cycleWeekOf, formatShift, shiftsForDay, weekdayOf, type Shift } from '@/lib/shifts';
import { formatMinutes, minutesInRange, openEntryFor, weekSummary } from '@/lib/time-tracking';
import { fundingSummary } from '@/lib/funding';
import { certDaysLeft, certStatus, certificationAlerts, type Certification } from '@/lib/certifications';
import { addDaysISO } from '@/lib/operations';
import { attendanceLabel, buildAttendance } from '@/lib/shift-attendance';
import { DashboardGrid } from '@/app/dashboard-grid';
import { layoutFor, appearanceFor, serializeAppearance, type AppearancePrefs, type WidgetItem } from '@/lib/dashboard-widgets';
import { CARE_PROFILE_FIELDS, KUDOS_BADGES, canCompleteAppointment, careProfileCompleteness, doseOutcomeLabels, kudosCounts, medicationRound, supplyList, supplyUrgencyLabels, upcomingAppointments } from '@/lib/care-plan';

const areas = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Laundry', 'Outside', 'Other'];
const areaIcons = new Map<string, typeof Home>([['Kitchen', Utensils], ['Bathroom', Bath], ['Bedroom', BedDouble], ['Living room', Sofa], ['Laundry', WashingMachine], ['Outside', Sprout], ['Other', Home]]);
const weekdayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const weekdayFull = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
type ManagerSection = 'home' | 'assistant' | 'tasks' | 'client' | 'schedule' | 'team' | 'hr' | 'messages' | 'more';
type WorkerSection = 'today' | 'assistant' | 'tasks' | 'client' | 'schedule' | 'messages' | 'profile' | 'more';
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
function TextArea({ label, name, defaultValue, required = false, placeholder }: { label: string; name: string; defaultValue?: string; required?: boolean; placeholder?: string }) {
  return <label className="block text-sm font-semibold">{label}<textarea name={name} defaultValue={defaultValue} required={required} placeholder={placeholder} rows={3} className={fieldClass} /></label>;
}

export function HouseholdApp({ initialState, authenticatedId, localDev = false }: { initialState: HouseholdState; authenticatedId: string; localDev?: boolean }) {
  const [state, setState] = useState(initialState);
  const member = state.members.find((item) => item.id === authenticatedId) ?? state.members[0];
  const manager = member?.role === 'manager';
  const viewer = member?.role === 'viewer';
  const role = manager ? 'manager' : viewer ? 'viewer' : 'worker';
  const [section, setSection] = useState<Section>(manager ? 'home' : 'today');
  const [task, setTask] = useState<Chore | null>(null);
  const [profile, setProfile] = useState<Member | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [resetMember, setResetMember] = useState<Member | null>(null);
  const [shiftWorker, setShiftWorker] = useState<Member | null>(null);
  const [availWorker, setAvailWorker] = useState<Member | null>(null);
  const [inviteUrl, setInviteUrl] = useState('');
  const [inviteEmailed, setInviteEmailed] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [connection, setConnection] = useState<'online' | 'refreshing' | 'offline' | 'error'>('online');
  const [feedOpen, setFeedOpen] = useState(false);
  const [feedSeen, setFeedSeen] = useState('');
  const [seenAtOverride, setSeenAtOverride] = useState<string | null>(null);
  const storedSeenAt = useLocalStorageValue('careboard-notifications-seen');
  const seenAt = seenAtOverride ?? storedSeenAt;
  const tourDone = useLocalStorageValue('careboard-onboarding-dismissed') === '1';
  const [guideStepsByMember, setGuideStepsByMember] = useState<Record<string, number>>({});
  const [guideDismissedIds, setGuideDismissedIds] = useState<string[]>([]);
  const [guideReplay, setGuideReplay] = useState(false);
  const [learnOpen, setLearnOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  useEffect(() => {
    document.body.dataset.role = role;
    return () => { delete document.body.dataset.role; };
  }, [role]);
  const guideSteps = firstLoginGuide(role);
  const guideStep = member ? (guideStepsByMember[member.id] ?? 0) : 0;
  const guideOpen = !!member && !viewer && guideSteps.length > 0 && (guideReplay || (!member.guideSeenAt && !guideDismissedIds.includes(member.id)));
  const activeGuideStep = guideOpen ? guideSteps[guideStep] : undefined;
  useEffect(() => {
    if (!member) return;
    const navIds = (manager
      ? ['home', 'assistant', 'tasks', 'client', 'schedule', 'team', 'hr', 'messages', 'more']
      : viewer
        ? ['today', 'client', 'tasks', 'schedule']
        : ['today', 'assistant', 'tasks', 'client', 'schedule', 'messages', 'profile', 'more']) as Section[];
    function moveGuide(index: number) {
      const next = Math.max(0, Math.min(guideSteps.length - 1, index));
      setGuideStepsByMember((steps) => ({ ...steps, [member.id]: next }));
      const step = guideSteps[next];
      if (step?.section) setSection(step.section as Section);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      const guideIsOpen = !viewer && guideSteps.length > 0 && (guideReplay || (!member.guideSeenAt && !guideDismissedIds.includes(member.id)));
      if (guideIsOpen) {
        if (event.key === 'Escape') { event.preventDefault(); dismissGuideFromKeyboard(); return; }
        if (event.key === 'ArrowRight' || event.key === 'Enter') {
          event.preventDefault();
          const index = guideStepsByMember[member.id] ?? 0;
          if (index >= guideSteps.length - 1) dismissGuideFromKeyboard();
          else moveGuide(index + 1);
          return;
        }
        if (event.key === 'ArrowLeft') {
          event.preventDefault();
          const index = guideStepsByMember[member.id] ?? 0;
          moveGuide(index - 1);
          return;
        }
      }
      if (isEditableKeyboardTarget(event.target)) return;
      if (event.key === 'Escape') {
        if (shortcutsOpen) { event.preventDefault(); setShortcutsOpen(false); return; }
        if (feedOpen) { event.preventDefault(); setFeedOpen(false); return; }
        if (createOpen) { event.preventDefault(); setCreateOpen(false); return; }
        if (addOpen) { event.preventDefault(); setAddOpen(false); return; }
        if (task) { event.preventDefault(); setTask(null); return; }
        if (profile) { event.preventDefault(); setProfile(null); return; }
        if (resetMember) { event.preventDefault(); setResetMember(null); return; }
        if (shiftWorker) { event.preventDefault(); setShiftWorker(null); return; }
        if (availWorker) { event.preventDefault(); setAvailWorker(null); return; }
        return;
      }
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      const digit = Number(event.key);
      if (digit >= 1 && digit <= navIds.length) {
        event.preventDefault();
        setSection(navIds[digit - 1]!);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === 'b') {
        event.preventDefault();
        setFeedSeen(seenAt);
        setFeedOpen(true);
        const now = new Date().toISOString();
        setSeenAtOverride(now);
        writeLocalStorage('careboard-notifications-seen', now);
        return;
      }
      if (key === 'h') { event.preventDefault(); setSection(manager ? 'home' : 'today'); return; }
      if (key === 't') { event.preventDefault(); setSection('tasks'); return; }
      if (key === 's') { event.preventDefault(); setSection('schedule'); return; }
      if (key === 'i' && !viewer) { event.preventDefault(); setSection('messages'); return; }
      if (key === 'p' && !manager && !viewer) { event.preventDefault(); setSection('profile'); return; }
      if (key === 'm' && manager) { event.preventDefault(); setSection('team'); return; }
      if (key === 'n' && manager) { event.preventDefault(); setSection('tasks'); setCreateOpen(true); return; }
      if (key === 'w' && manager) { event.preventDefault(); setSection('team'); setAddOpen(true); return; }
    }
    function dismissGuideFromKeyboard() {
      if (guideReplay) {
        setGuideReplay(false);
        return;
      }
      if (guideDismissedIds.includes(member.id) || member.guideSeenAt) return;
      setGuideDismissedIds((ids) => ids.includes(member.id) ? ids : [...ids, member.id]);
      void fetch('/api/household', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'dismissFirstLoginGuide' }) })
        .then(async (response) => {
          if (!response.ok) throw new Error('dismiss failed');
          const next = await response.json() as HouseholdState;
          setState(next);
        })
        .catch(() => { setGuideDismissedIds((ids) => ids.filter((id) => id !== member.id)); });
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [member, manager, viewer, guideDismissedIds, guideStepsByMember, guideSteps, guideReplay, shortcutsOpen, feedOpen, createOpen, addOpen, task, profile, resetMember, shiftWorker, availWorker, seenAt]);
  useEffect(() => {
    let active = true;
    let refreshing = false;
    const reload = async () => {
      if (refreshing || !navigator.onLine) { if (active) setConnection('offline'); return; }
      refreshing = true;
      try {
        const response = await fetch('/api/household', { cache: 'no-store' });
        if (!response.ok) throw new Error('refresh failed');
        const next = await response.json() as HouseholdState;
        if (active) { setState(next); setConnection('online'); }
      } catch { if (active) setConnection(navigator.onLine ? 'error' : 'offline'); }
      finally { refreshing = false; }
    };
    const poll = setInterval(() => { if (document.visibilityState === 'visible') void reload(); }, 30_000);
    const onFocus = () => void reload();
    const onOnline = () => void reload();
    const onOffline = () => setConnection('offline');
    window.addEventListener('focus', onFocus);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => { active = false; clearInterval(poll); window.removeEventListener('focus', onFocus); window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); };
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
  async function refresh(message = '') {
    setConnection('refreshing');
    try {
      const response = await fetch('/api/household', { cache: 'no-store' });
      const next = await response.json() as HouseholdState & { error?: string };
      if (!response.ok) throw new Error(next.error || 'CareBoard could not refresh.');
      setState(next); setTask((old) => old ? next.chores.find((item) => item.id === old.id) ?? null : null); setProfile((old) => old ? next.members.find((item) => item.id === old.id) ?? null : null); setConnection('online'); if (message) setNotice(message);
    } catch (error) {
      setConnection(navigator.onLine ? 'error' : 'offline');
      if (message) setNotice(error instanceof Error ? error.message : 'CareBoard could not refresh.');
      throw error;
    }
  }
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
    setSeenAtOverride(now);
    writeLocalStorage('careboard-notifications-seen', now);
  }
  const bell = <BellButton unread={unread} onClick={openFeed} />;
  const onboarding = buildOnboarding({ manager, viewerId: member.id, members: state.members, tasks: state.chores });
  function dismissTour() {
    writeLocalStorage('careboard-onboarding-dismissed', '1');
  }
  function dismissGuide() {
    if (guideReplay) {
      setGuideReplay(false);
      return;
    }
    if (guideDismissedIds.includes(member.id) || member.guideSeenAt) return;
    setGuideDismissedIds((ids) => ids.includes(member.id) ? ids : [...ids, member.id]);
    void mutate({ action: 'dismissFirstLoginGuide' }, '').catch(() => {
      setGuideDismissedIds((ids) => ids.filter((id) => id !== member.id));
    });
  }
  function openGuideAt(index: number) {
    const next = Math.max(0, Math.min(guideSteps.length - 1, index));
    setGuideStepsByMember((steps) => ({ ...steps, [member.id]: next }));
    const step = guideSteps[next];
    if (step?.section) setSection(step.section as Section);
    setLearnOpen(false);
    setGuideReplay(true);
  }
  function replayFullGuide() {
    setGuideStepsByMember((steps) => ({ ...steps, [member.id]: 0 }));
    const first = guideSteps[0];
    if (first?.section) setSection(first.section as Section);
    setLearnOpen(false);
    setGuideReplay(true);
  }
  function goGuideStep(index: number) {
    const next = Math.max(0, Math.min(guideSteps.length - 1, index));
    setGuideStepsByMember((steps) => ({ ...steps, [member.id]: next }));
    const step = guideSteps[next];
    if (step?.section) setSection(step.section as Section);
  }
  const appearance = appearanceFor(member.id, member.theme ?? null);
  const dashboard = {
    layout: layoutFor(role, member.dashboardLayout ?? null),
    appearance,
    saveLayout: (layout: WidgetItem[]) => { void mutate({ action: 'saveDashboard', layout }, 'Dashboard updated.').catch(() => {}); },
    saveAppearance: (prefs: AppearancePrefs) => { void mutate({ action: 'saveDashboard', theme: serializeAppearance(prefs) }, 'Look updated.').catch(() => {}); },
  };
  const nav = manager
    ? [['home', 'Overview', LayoutDashboard], ['assistant', 'Assistant', Sparkles], ['tasks', 'Tasks', ClipboardList], ['client', 'Care plan', HandHeart], ['schedule', 'Schedule', CalendarDays], ['team', 'Team', Users], ['hr', 'HR', Briefcase], ['messages', 'Inbox', Inbox], ['more', 'Settings', Settings]] as const
    : viewer
      ? [['today', 'Overview', LayoutDashboard], ['client', 'Care plan', HandHeart], ['tasks', 'Tasks', ClipboardList], ['schedule', 'Schedule', CalendarDays]] as const
      : [['today', 'Today', Home], ['assistant', 'Assistant', Sparkles], ['tasks', 'Tasks', ClipboardList], ['client', 'Care plan', HandHeart], ['schedule', 'Schedule', CalendarDays], ['messages', 'Inbox', Inbox], ['profile', 'Profile', User], ['more', 'More', MoreHorizontal]] as const;

  return (
    <RoleContext.Provider value={role}>
    <div className="careboard min-h-screen text-[#20312d]" data-role={role} data-density={appearance.density} data-radius={appearance.radius} style={{ ...appearance.vars, background: 'var(--role-surface)' } as React.CSSProperties}>
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-[#287b6f] focus:px-4 focus:py-2 focus:text-white">
        Skip to dashboard content
      </a>

      {/* Mobile header */}
      <header className="dashboard-mobile-header fixed left-0 right-0 top-0 z-30 flex h-16 items-center justify-between border-b border-[#dfe5dc] bg-[#fcfbf7]/95 px-4 backdrop-blur md:hidden">
        <button onClick={() => setSection(manager ? 'home' : 'today')} className="flex min-h-11 items-center gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
          <img src="/favicon.svg" alt="" width={36} height={36} className="size-9 shrink-0" />
          <span className="text-lg font-bold">CareBoard</span>
          <span className="hidden sm:inline-flex"><RoleBadge role={role} /></span>
        </button>
        <div className="flex items-center gap-2">
          {!viewer && (
            <button
              type="button"
              onClick={() => setLearnOpen(true)}
              aria-label="Learn CareBoard"
              className="grid size-11 shrink-0 place-items-center rounded-xl text-[#287b6f] transition hover:bg-[#e9efe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"
            >
              <BookOpen className="size-5" aria-hidden="true" />
            </button>
          )}
          {bell}
          <form action={logOut}><button aria-label="Sign out" className="inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#287b6f]"><LogOut className="size-4" aria-hidden="true" /><span className="hidden sm:inline">Sign out</span></button></form>
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
          {nav.map(([id, label, Icon], index) => (
            <button
              key={id}
              data-guide={`nav-${id}`}
              onClick={() => setSection(id)}
              aria-current={section === id ? 'page' : undefined}
              className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${section === id ? 'bg-[#287b6f] text-white' : 'text-[#52645f] hover:bg-[#f1f5f1]'}`}
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="flex-1">{label}</span>
              <kbd className="hidden rounded-md border border-current/20 px-1.5 py-0.5 text-[10px] font-semibold opacity-70 lg:inline">{index + 1}</kbd>
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
          <button type="button" onClick={() => setLearnOpen(true)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[#e8f1ec] px-3 text-sm font-semibold text-[#287b6f] transition hover:bg-[#dceae1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
            <BookOpen className="size-4" aria-hidden="true" />Learn CareBoard
          </button>
          <button type="button" onClick={() => setShortcutsOpen(true)} className="mt-2 flex min-h-10 w-full items-center justify-center gap-2 rounded-xl px-3 text-xs font-semibold text-[#687873] transition hover:bg-[#f1f5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
            Keyboard shortcuts <kbd className="rounded border border-[#d7dfd7] bg-white px-1.5 py-0.5">?</kbd>
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main id="main" tabIndex={-1} aria-busy={busy} className="dashboard-main min-h-screen pt-16 md:pl-64 md:pt-0">
        <div className="mx-auto max-w-screen-2xl px-4 py-5 sm:px-7 sm:py-7">
          {connection !== 'online' && <ConnectionBanner status={connection} onRetry={() => void refresh().catch(() => undefined)} />}
          {localDev && <div className="mb-5"><LocalDevRoleSwitcher currentMember={state.viewer.id} /></div>}
          {!viewer && ((!tourDone && onboarding.some((step) => !step.done)) || (guideOpen && activeGuideStep?.target === 'getting-started')) && <OnboardingCard steps={onboarding} onDone={dismissTour} />}
          {manager ? (
            <ManagerView section={section as ManagerSection} setSection={setSection} state={state} workers={workers} open={open} dueToday={dueToday} setTask={setTask} setProfile={setProfile} setCreateOpen={setCreateOpen} setAddOpen={setAddOpen} setResetMember={setResetMember} setShiftWorker={setShiftWorker} setAvailWorker={setAvailWorker} onInvited={(token: string, emailed: boolean) => { setInviteUrl(`${window.location.origin}/accept-invite?token=${token}`); setInviteEmailed(emailed); }} mutate={mutate} busy={busy} dashboard={dashboard} onOpenLearn={() => setLearnOpen(true)} focusHrPayroll={guideOpen && activeGuideStep?.target === 'panel-hr-payroll'} />
          ) : viewer ? (
            <ViewerView section={section} state={state} setTask={setTask} setSection={setSection} dashboard={dashboard} />
          ) : (
            <WorkerView section={section as WorkerSection} state={state} member={member} setSection={setSection} setTask={setTask} setProfile={setProfile} setAvailWorker={setAvailWorker} mutate={mutate} uploadClientNote={uploadClientNote} busy={busy} dashboard={dashboard} onOpenLearn={() => setLearnOpen(true)} />
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
              data-guide={`nav-${id}`}
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
      <FirstLoginGuideTour
        open={guideOpen}
        steps={guideSteps}
        stepIndex={guideStep}
        onStepIndex={goGuideStep}
        onDismiss={dismissGuide}
        mode={guideReplay ? 'refresher' : 'welcome'}
      />
      {!viewer && (
        <Dialog open={learnOpen} onOpenChange={setLearnOpen}>
          <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BookOpen className="size-5 text-[#287b6f]" aria-hidden="true" />Learn CareBoard</DialogTitle>
              <DialogDescription>
                Your always-on teacher. Replay the full welcome walkthrough, or open one subject when you need a refresher.
              </DialogDescription>
            </DialogHeader>
            <button
              type="button"
              onClick={replayFullGuide}
              className="flex w-full items-start gap-3 rounded-2xl border border-[#bcd4c9] bg-[#f2f7f1] p-4 text-left transition hover:border-[#97bba7] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#287b6f] text-white"><Play className="size-4" aria-hidden="true" /></span>
              <span>
                <span className="block text-sm font-bold text-[#20312d]">Replay full welcome tour</span>
                <span className="mt-1 block text-sm leading-6 text-[#52645f]">Walk every highlight again from the start — same tour new people see on first login.</span>
              </span>
            </button>
            <p className="mt-5 text-xs font-semibold uppercase tracking-[.14em] text-[#687873]">Refresh one subject</p>
            <ul className="mt-2 divide-y divide-[#e5eae4] rounded-2xl border border-[#e2e8e1] bg-white">
              {guideTopics(role).map((topic, index) => (
                <li key={topic.id}>
                  <button
                    type="button"
                    onClick={() => openGuideAt(index)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#f7f6f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-xs font-bold text-[#287b6f]">{index + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-semibold uppercase tracking-wide text-[#4d6b5e]">{topic.topic}</span>
                      <span className="mt-0.5 block text-sm font-semibold text-[#20312d]">{topic.title}</span>
                      <span className="mt-1 block text-sm leading-5 text-[#687873]">{topic.summary}</span>
                    </span>
                    <ChevronRight className="mt-2 size-4 shrink-0 text-[#687873]" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </DialogContent>
        </Dialog>
      )}
      {!viewer && section === 'more' && !guideOpen && (
        <PayrollAskQuestionnaire
          helpRole={manager ? 'manager' : 'worker'}
          memberId={member.id}
          settings={state.settings}
          mutate={mutate}
          busy={busy}
        />
      )}
      <Dialog open={shortcutsOpen} onOpenChange={setShortcutsOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Keyboard shortcuts</DialogTitle>
            <DialogDescription>Move around the dashboard without leaving the keyboard. Shortcuts are paused while you type in a field.</DialogDescription>
          </DialogHeader>
          <ul className="divide-y divide-[#e5eae4]">
            {shortcutsForRole(role).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                <span className="text-sm text-[#52645f]">{item.label}</span>
                <kbd className="rounded-lg border border-[#d7dfd7] bg-[#f7f6f1] px-2 py-1 text-xs font-semibold text-[#20312d]">{item.keys}</kbd>
              </li>
            ))}
            {guideOpen && (
              <>
                <li className="flex items-center justify-between gap-3 py-3"><span className="text-sm text-[#52645f]">Welcome guide: next step</span><kbd className="rounded-lg border border-[#d7dfd7] bg-[#f7f6f1] px-2 py-1 text-xs font-semibold">→ / Enter</kbd></li>
                <li className="flex items-center justify-between gap-3 py-3"><span className="text-sm text-[#52645f]">Welcome guide: previous step</span><kbd className="rounded-lg border border-[#d7dfd7] bg-[#f7f6f1] px-2 py-1 text-xs font-semibold">←</kbd></li>
              </>
            )}
          </ul>
        </DialogContent>
      </Dialog>
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
      <AddWorkerDialog open={addOpen} busy={busy} onClose={() => setAddOpen(false)} mutate={mutate} onInvited={(token: string, emailed: boolean) => { setInviteUrl(`${window.location.origin}/accept-invite?token=${token}`); setInviteEmailed(emailed); }} />
      <InviteLinkDialog url={inviteUrl} emailed={inviteEmailed} onClose={() => setInviteUrl('')} />
      <ResetDialog member={resetMember} busy={busy} onClose={() => setResetMember(null)} submit={submit} />
      {shiftWorker && <WindowDialog worker={shiftWorker} windows={(state.shifts ?? []).filter((shift: any) => shift.memberId === shiftWorker.id)} action="setShifts" title={`Two-week shifts for ${shiftWorker.name}`} description={`Set the days and times ${shiftWorker.name.split(' ')[0]} is scheduled. The schedule repeats every two weeks — a day on in both weeks means every week, on in one week means every other week.`} busy={busy} onClose={() => setShiftWorker(null)} mutate={mutate} />}
      {availWorker && <WindowDialog worker={availWorker} windows={(state.availability ?? []).filter((shift: any) => shift.memberId === availWorker.id)} action="setAvailability" title={`Weekly availability for ${availWorker.name}`} description={`The days and times ${availWorker.name.split(' ')[0]} is generally available. Auto-assign prefers these windows.`} busy={busy} onClose={() => setAvailWorker(null)} mutate={mutate} />}
      <output aria-live="polite" aria-atomic="true" className="dashboard-notice fixed inset-x-4 z-50 ml-auto max-w-sm md:bottom-6 md:left-auto">
        {busy && <span className="sr-only">Saving your update.</span>}
        {notice && <span className="flex items-center gap-3 rounded-2xl bg-[#20312d] p-3 pl-4 text-sm text-white shadow-xl">
          <span className="min-w-0 flex-1 break-words">{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Dismiss notification" className="grid size-11 shrink-0 place-items-center rounded-xl hover:bg-white/10"><X className="size-4" aria-hidden="true" /></button>
        </span>}
      </output>
    </div>
    </RoleContext.Provider>
  );
}

function ConnectionBanner({ status, onRetry }: { status: 'refreshing' | 'offline' | 'error'; onRetry: () => void }) {
  const refreshing = status === 'refreshing';
  return <div role={refreshing ? 'status' : 'alert'} className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[#d6dfd7] bg-white/95 p-3 pl-4 shadow-[var(--shadow-soft)]">
    <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]">{refreshing ? <RefreshCw className="size-5 animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <WifiOff className="size-5" aria-hidden="true" />}</span>
    <span className="min-w-52 flex-1"><strong className="block text-sm">{refreshing ? 'Refreshing CareBoard' : status === 'offline' ? 'You’re offline' : 'Updates are temporarily paused'}</strong><span className="block text-xs leading-5 text-[#52645f]">{refreshing ? 'Checking for the latest household updates.' : 'Your last loaded information is still available. Retry when your connection is ready.'}</span></span>
    {!refreshing && <Button type="button" variant="outline" size="sm" onClick={onRetry}><RefreshCw className="size-4" aria-hidden="true" />Retry</Button>}
  </div>;
}

function BellButton({ unread, onClick }: { unread: number; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'} className="relative grid size-11 shrink-0 place-items-center rounded-xl text-[#52645f] transition hover:bg-[#e9efe6] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
      <Bell className="size-5" aria-hidden="true" />
      {unread > 0 && <span className="absolute right-1 top-1 grid min-w-4.5 place-items-center rounded-full bg-[#b4532a] px-1 py-0.5 text-[10px] font-bold leading-none text-white">{unread}</span>}
    </button>
  );
}
type LocalPersona = 'manager' | 'worker' | 'worker2' | 'viewer';

function switchLocalDevRole(persona: LocalPersona) {
  document.cookie = `careboard-local-role=${persona}; path=/; max-age=86400`;
  window.location.reload();
}

function LocalDevRoleSwitcher({ currentMember }: { currentMember: string }) {
  const personas: Array<{ id: LocalPersona; memberId: string; label: string }> = [
    { id: 'manager', memberId: 'member-manager', label: 'Manager · Dana' },
    { id: 'worker', memberId: 'member-worker-1', label: 'Caregiver · Alex' },
    { id: 'worker2', memberId: 'member-worker-2', label: 'Caregiver · Maya' },
    { id: 'viewer', memberId: 'member-viewer-1', label: 'Viewer' },
  ];
  return (
    <div className="rounded-2xl border border-dashed border-[#c6d2c8] bg-[#f7f6f1] p-3">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[#687873]">Local preview</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {personas.map(({ id, memberId, label }) => (
          <button
            key={id}
            onClick={() => switchLocalDevRole(id)}
            aria-pressed={currentMember === memberId}
            className={`rounded-xl px-2 py-2 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f] ${currentMember === memberId ? 'bg-[#287b6f] text-white' : 'bg-white text-[#52645f] hover:bg-[#eef2ec]'}`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
function PayrollFaqPanel({ helpRole }: { helpRole: PayrollHelpRole }) {
  const items = payrollFaq(helpRole);
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDollarSign className="size-5 text-[#287b6f]" aria-hidden="true" />Payroll questions</h2>
      <p className="mt-1 text-sm text-[#687873]">{helpRole === 'manager' ? 'How hours become a bookkeeper-ready CSV.' : 'How clock-in, rates, and pay estimates work for you.'}</p>
      <div className="mt-4 divide-y divide-[#e5eae4] rounded-xl border border-[#e2e8e1] bg-white">
        {items.map((item: PayrollFaqItem) => (
          <details key={item.id} className="group px-4 py-3">
            <summary className="cursor-pointer list-none text-sm font-semibold text-[#20312d] marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-start justify-between gap-3">
                <span>{item.question}</span>
                <ChevronRight className="mt-0.5 size-4 shrink-0 text-[#687873] transition group-open:rotate-90" aria-hidden="true" />
              </span>
            </summary>
            <p className="mt-2 text-sm leading-6 text-[#687873]">{item.answer}</p>
          </details>
        ))}
      </div>
    </Card>
  );
}

function PayrollAskQuestionnaire({
  helpRole,
  memberId,
  settings,
  mutate,
  busy,
}: {
  helpRole: PayrollHelpRole;
  memberId: string;
  settings: HouseholdState['settings'];
  mutate: (payload: Record<string, unknown>, message?: string) => Promise<unknown>;
  busy: boolean;
}) {
  const storageKey = payrollAskStorageKey(memberId);
  const dismissed = useLocalStorageValue(storageKey) === '1';
  const steps = payrollAskQuestions(helpRole);
  const [index, setIndex] = useState(0);
  const bookkeeperEmail = settings?.bookkeeperEmail ?? '';
  const [email, setEmail] = useState(bookkeeperEmail);
  const open = !dismissed && steps.length > 0;
  const step: PayrollAskStep | undefined = steps[index];

  function finish() {
    writeLocalStorage(storageKey, '1');
  }

  async function goNext() {
    if (step?.field === 'bookkeeperEmail' && email.trim() && email.trim() !== bookkeeperEmail) {
      try {
        await mutate({
          action: 'updateHouseholdSettings',
          recurrenceHorizonDays: settings?.recurrenceHorizonDays ?? 30,
          reminderDefaultLeadDays: settings?.reminderDefaultLeadDays ?? 1,
          fundedHoursMonthly: settings?.fundedHoursMonthly ?? 0,
          fundingHourlyRate: settings?.fundingHourlyRate ?? 0,
          bookkeeperEmail: email.trim(),
        }, 'Bookkeeper email saved.');
      } catch { /* notice shown */ }
    }
    if (index >= steps.length - 1) finish();
    else setIndex((value) => value + 1);
  }

  if (!open || !step) return null;
  return (
    <Dialog open onOpenChange={(value) => { if (!value) finish(); }}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md" aria-describedby="payroll-ask-detail">
        <DialogHeader>
          <DialogTitle>{helpRole === 'manager' ? 'Payroll setup questions' : 'Your pay — quick questions'}</DialogTitle>
          <DialogDescription id="payroll-ask-detail">
            Step {index + 1} of {steps.length}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <h3 className="text-base font-bold text-[#20312d]">{step.question}</h3>
          <p className="text-sm leading-6 text-[#687873]">{step.detail}</p>
          {step.field === 'bookkeeperEmail' && (
            <label htmlFor="payroll-ask-bookkeeper" className="grid gap-1 text-sm font-semibold">
              Bookkeeper email
              <Input id="payroll-ask-bookkeeper" type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="bookkeeper@example.com" className="min-h-11" autoComplete="email" />
            </label>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" variant="outline" className="min-h-11" onClick={finish}>Skip</Button>
          <div className="flex flex-wrap gap-2">
            {index > 0 && <Button type="button" variant="outline" className="min-h-11" onClick={() => setIndex((value) => value - 1)}>Back</Button>}
            <Button type="button" disabled={busy} className="min-h-11 bg-[#287b6f]" onClick={() => void goNext()}>
              {index >= steps.length - 1 ? 'Done' : 'Next'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function OnboardingCard({ steps, onDone }: any) {
  const done = steps.filter((step: any) => step.done).length;
  return (
    <Card data-guide="getting-started" className="mb-6 border-[#bcd4c9] bg-[#f2f7f1]">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#e2efe5] text-[#287b6f]"><Sprout className="size-5" aria-hidden="true" /></span>
          <div>
            <h2 className="text-lg font-bold">Getting started</h2>
            <p className="text-xs font-semibold text-[#4d6b5e]">{done} of {steps.length} done — real actions that teach the board</p>
          </div>
        </div>
        <button onClick={onDone} aria-label="Dismiss getting started guide" className="grid size-11 shrink-0 place-items-center rounded-xl text-[#687873] transition hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"><X className="size-4" aria-hidden="true" /></button>
      </div>
      <p className="mt-3 text-sm leading-6 text-[#52645f]">These check off as you work. Need the spoken tour again later? Open <strong className="font-semibold text-[#20312d]">Learn CareBoard</strong> from the sidebar (book icon on mobile).</p>
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

function FirstLoginGuideTour({
  open,
  steps,
  stepIndex,
  onStepIndex,
  onDismiss,
  mode = 'welcome',
}: {
  open: boolean;
  steps: FirstLoginGuideStep[];
  stepIndex: number;
  onStepIndex: (index: number) => void;
  onDismiss: () => void;
  mode?: 'welcome' | 'refresher';
}) {
  const step = steps[stepIndex];
  const ready = useIsClient();
  const stepKey = `${open}:${stepIndex}:${step?.target ?? ''}`;
  const [targetFound, setTargetFound] = useState(false);
  const [measuredKey, setMeasuredKey] = useState(stepKey);
  if (measuredKey !== stepKey) {
    setMeasuredKey(stepKey);
    setTargetFound(false);
  }
  const highlightRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const veilRef = useRef<HTMLDivElement>(null);
  const activeElRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!ready || !open || !step) return;
    let cancelled = false;
    let attempts = 0;
    const clearActive = () => {
      if (activeElRef.current) {
        activeElRef.current.removeAttribute('data-guide-active');
        activeElRef.current = null;
      }
    };
    const place = (rect: DOMRect | null) => {
      const highlight = highlightRef.current;
      const panel = panelRef.current;
      const veil = veilRef.current;
      if (!highlight || !panel || !veil) return;
      const panelWidth = Math.min(380, window.innerWidth - 24);
      panel.style.width = `${panelWidth}px`;
      panel.style.maxHeight = `${Math.min(window.innerHeight - 24, 420)}px`;
      if (!rect) {
        highlight.hidden = true;
        veil.hidden = false;
        panel.style.top = '16px';
        panel.style.left = `${Math.max(12, (window.innerWidth - panelWidth) / 2)}px`;
        return;
      }
      const pad = 10;
      const top = Math.max(8, rect.top - pad);
      const left = Math.max(8, rect.left - pad);
      const width = Math.min(window.innerWidth - 16, rect.width + pad * 2);
      const height = Math.min(window.innerHeight - 16, rect.height + pad * 2);
      highlight.hidden = false;
      veil.hidden = true;
      highlight.style.top = `${top}px`;
      highlight.style.left = `${left}px`;
      highlight.style.width = `${width}px`;
      highlight.style.height = `${height}px`;
      const panelHeight = Math.min(panel.offsetHeight || 320, window.innerHeight - 24);
      const spaceBelow = window.innerHeight - (top + height);
      const spaceAbove = top;
      const preferBelow = spaceBelow >= Math.min(panelHeight + 16, 220) || spaceBelow >= spaceAbove;
      const panelTop = preferBelow
        ? Math.min(window.innerHeight - panelHeight - 12, top + height + 14)
        : Math.max(12, top - panelHeight - 14);
      let panelLeft = left;
      if (panelLeft + panelWidth > window.innerWidth - 12) panelLeft = window.innerWidth - panelWidth - 12;
      if (panelLeft < 12) panelLeft = 12;
      panel.style.top = `${panelTop}px`;
      panel.style.left = `${panelLeft}px`;
    };
    const measure = () => {
      if (cancelled) return;
      clearActive();
      const nodes = Array.from(document.querySelectorAll(`[data-guide="${step.target}"]`));
      const el = nodes.find((node) => node instanceof HTMLElement && node.getClientRects().length > 0) as HTMLElement | undefined;
      if (!el) {
        if (attempts++ < 20) window.setTimeout(measure, 60);
        else {
          setTargetFound(false);
          place(null);
        }
        return;
      }
      setTargetFound(true);
      el.setAttribute('data-guide-active', 'true');
      activeElRef.current = el;
      el.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'smooth' });
      window.setTimeout(() => {
        if (!cancelled) place(el.getBoundingClientRect());
      }, 180);
    };
    const frame = window.requestAnimationFrame(() => window.requestAnimationFrame(measure));
    const onRefresh = () => measure();
    window.addEventListener('resize', onRefresh);
    window.addEventListener('scroll', onRefresh, true);
    return () => {
      cancelled = true;
      clearActive();
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', onRefresh);
      window.removeEventListener('scroll', onRefresh, true);
    };
  }, [ready, open, step, stepIndex]);
  if (!ready || !open || !step) return null;
  const last = stepIndex >= steps.length - 1;
  return createPortal(
    <dialog open className="pointer-events-none fixed inset-0 z-[60] m-0 h-full max-h-none w-full max-w-none border-0 bg-transparent p-0 open:flex" aria-labelledby="first-login-guide-title">
      <div ref={veilRef} className="absolute inset-0 bg-[#102e25]/50" aria-hidden="true" />
      <div ref={highlightRef} hidden className="guide-spotlight absolute" aria-hidden="true" />
      <div ref={panelRef} className="pointer-events-auto absolute flex max-h-[min(420px,calc(100vh-24px))] w-[min(380px,calc(100vw-24px))] flex-col overflow-hidden rounded-3xl border border-[#cbdcd1] bg-[#fffefa] shadow-[var(--shadow-raised)]" style={{ top: 24, left: 24 }}>
        <div className="flex items-start justify-between gap-3 border-b border-[#e5eae4] px-4 pb-3 pt-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[.14em] text-[#4d6b5e]">
              {mode === 'refresher' ? 'Refresher' : 'Welcome tour'} · Looking at {step.topic} · {stepIndex + 1}/{steps.length}
            </p>
            <h2 id="first-login-guide-title" className="mt-1 text-lg font-bold leading-snug text-[#20312d]">{step.title}</h2>
            <p className="mt-1.5 text-sm font-semibold leading-5 text-[#287b6f]">{step.summary}</p>
            {!targetFound && <p className="mt-2 text-xs text-[#8b4e2c]">Opening that screen…</p>}
          </div>
          <button type="button" onClick={onDismiss} aria-label="Close guide" className="grid size-10 shrink-0 place-items-center rounded-xl text-[#687873] transition hover:bg-[#f1f5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"><X className="size-4" aria-hidden="true" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
          <p className="text-sm leading-6 text-[#52645f]">{step.body}</p>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#687873]">On this component</p>
            <ol className="mt-1.5 space-y-1.5">
              {step.howTo.slice(0, 3).map((line, index) => (
                <li key={line} className="flex gap-2.5 text-sm leading-5 text-[#20312d]">
                  <span className="grid size-5 shrink-0 place-items-center rounded-full bg-[#e8f1ec] text-[10px] font-bold text-[#287b6f]">{index + 1}</span>
                  <span>{line}</span>
                </li>
              ))}
            </ol>
          </div>
          {step.tryThis && (
            <div className="flex gap-2.5 rounded-xl border border-[#bcd4c9] bg-[#f2f7f1] p-2.5">
              <Play className="mt-0.5 size-3.5 shrink-0 text-[#287b6f]" aria-hidden="true" />
              <p className="text-sm leading-5 text-[#25654f]"><span className="font-semibold">Try this: </span>{step.tryThis}</p>
            </div>
          )}
        </div>
        <div className="border-t border-[#e5eae4] px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button type="button" variant="ghost" onClick={onDismiss}>{mode === 'refresher' ? 'Close' : 'Skip'}</Button>
            <div className="flex gap-2">
              <Button type="button" variant="outline" disabled={stepIndex === 0} onClick={() => onStepIndex(Math.max(0, stepIndex - 1))}>Back</Button>
              {last ? (
                <Button type="button" className="bg-[#287b6f]" onClick={onDismiss}>{mode === 'refresher' ? 'Done' : 'Finish'}</Button>
              ) : (
                <Button type="button" className="bg-[#287b6f]" onClick={() => onStepIndex(Math.min(steps.length - 1, stepIndex + 1))}>Continue</Button>
              )}
            </div>
          </div>
          <p className="mt-2 text-[11px] text-[#687873]">Continue moves the highlight to the next component · ← → / Enter · Esc</p>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
function Card({ children, className = '', ...props }: React.ComponentProps<'section'>) {
  return <section {...props} className={`dashboard-card rounded-2xl border border-[#dfe5dc] bg-[#fffefa] p-5 shadow-sm ${className}`}>{children}</section>;
}
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
    submitted: 'bg-[#fcf0dc] text-[#80531b]',
    reviewing: 'bg-[#e7eef8] text-[#3f5f92]',
    resolved: 'bg-[#e6f0eb] text-[#216b61]',
    low: 'bg-[#f0f0f0] text-[#687873]',
    medium: 'bg-[#fcf4e9] text-[#9e6b2e]',
    high: 'bg-[#f8e9dc] text-[#8b4e2c]',
    urgent: 'bg-[#f8e4dc] text-[#873d27]',
    hazard: 'bg-[#fcf4e9] text-[#9e6b2e]',
    injury: 'bg-[#f8e4dc] text-[#873d27]',
    violence_threat: 'bg-[#f8e4dc] text-[#873d27]',
    unsafe_home: 'bg-[#fcf0dc] text-[#80531b]',
    near_miss: 'bg-[#e7eef8] text-[#3f5f92]',
    given: 'bg-[#e6f0eb] text-[#216b61]',
    refused: 'bg-[#f8e4dc] text-[#873d27]',
    missed: 'bg-[#f8e4dc] text-[#873d27]',
    held: 'bg-[#ece9f7] text-[#5b4e94]',
    upcoming: 'bg-[#f0f0f0] text-[#687873]',
    due: 'bg-[#fcf4e9] text-[#9e6b2e]',
    overdue: 'bg-[#f8e4dc] text-[#873d27]',
    scheduled: 'bg-[#e7eef8] text-[#3f5f92]',
    done: 'bg-[#e6f0eb] text-[#216b61]',
    cancelled: 'bg-[#f0f0f0] text-[#687873]',
  };
  return <span data-status={status} className={`status-badge inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${styles[status] ?? 'bg-[#f0f0f0] text-[#687873]'}`}>{status.replace('_', ' ')}</span>;
}

function ManagerView({ section, setSection, state, workers, open, dueToday, setTask, setProfile, setCreateOpen, setAddOpen, setResetMember, setShiftWorker, setAvailWorker, onInvited, mutate, busy, dashboard, onOpenLearn, focusHrPayroll = false }: any) {
  const [taskQuery, setTaskQuery] = useState('');
  const [taskStatus, setTaskStatus] = useState<'all' | 'open' | 'in_progress' | 'complete'>('all');
  if (section === 'assistant') return <AssistantView state={state} setSection={setSection} />;
  if (section === 'hr') return <ManagerHrView state={state} setProfile={setProfile} mutate={mutate} busy={busy} focusPayroll={focusHrPayroll} />;
  if (section === 'tasks') {
    const query = taskQuery.trim().toLowerCase();
    const filtered = state.chores.filter((task: Chore) => {
      if (taskStatus !== 'all' && task.status !== taskStatus) return false;
      if (query && !task.title.toLowerCase().includes(query) && !(task.instructions ?? '').toLowerCase().includes(query)) return false;
      return true;
    });
    return (
      <div data-guide="panel-tasks">
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
      </div>
    );
  }
  if (section === 'team') return (
    <div data-guide="panel-team">
      <Title title="Care team" text="Detailed profiles are visible only to the household manager." action={<Button onClick={() => setAddOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add care worker</Button>} />
      {workers.length > 0 && <div className="mb-6"><KudosCard state={state} mutate={mutate} busy={busy} /></div>}
      {!workers.length && <Card><div className="flex flex-col items-center py-6 text-center"><span className="mb-4 grid size-14 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><Users className="size-6" aria-hidden="true" /></span><h2 className="text-lg font-semibold">Build your care team</h2><p className="mt-2 max-w-sm text-sm leading-6 text-[#52645f]">Add your first care worker to start sharing household tasks and coordinating care.</p><ul className="mt-4 space-y-2 text-sm text-[#687873]"><li>Invite by email — they set their own password</li><li>Set weekly shifts and availability</li><li>Track certifications and contact details</li></ul><Button onClick={() => setAddOpen(true)} className="mt-5 min-h-11 bg-[#287b6f]"><Plus className="size-4" />Add care worker</Button></div></Card>}
      <div className="grid gap-4 md:grid-cols-2">
        {workers.map((worker: Member) => {
          const workerShifts = (state.shifts ?? []).filter((shift: any) => shift.memberId === worker.id);
          const shiftText = workerShifts.length ? workerShifts.map((shift: any) => `${weekdayNames[shift.weekday]} ${formatShift(shift)}${shift.cycleWeek ? ` (wk ${'AB'[shift.cycleWeek - 1]})` : ''}`).join(' · ') : 'Not set';
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
              <p><span className="text-[#687873]">Two-week shifts:</span> {shiftText}</p>
              <p><span className="text-[#687873]">Languages:</span> {worker.languages || 'Not provided'}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setProfile(worker)}><Pencil className="size-4" />Profile</Button>
              <Button variant="outline" size="sm" onClick={() => setShiftWorker(worker)}><Clock className="size-4" />Shifts</Button>
              <Button variant="outline" size="sm" onClick={() => setAvailWorker(worker)}><CalendarDays className="size-4" />Availability</Button>
              {worker.status === 'invited' && <Button variant="outline" size="sm" disabled={busy} onClick={async () => { try { const result = await mutate({ action: 'reinviteMember', memberId: worker.id }, 'Invite link created.'); if (result?.inviteToken) onInvited(result.inviteToken, result?.inviteEmail === 'sent'); } catch { /* notice is shown */ } }}><UserCheck className="size-4" />Invite link</Button>}
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
                  {viewer.status === 'invited' && <Button variant="outline" size="sm" disabled={busy} onClick={async () => { try { const result = await mutate({ action: 'reinviteMember', memberId: viewer.id }, 'Invite link created.'); if (result?.inviteToken) onInvited(result.inviteToken, result?.inviteEmail === 'sent'); } catch { /* notice is shown */ } }}><UserCheck className="size-4" />Invite link</Button>}
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
    </div>
  );
  if (section === 'schedule') return <ScheduleView state={state} workers={workers} setTask={setTask} setCreateOpen={setCreateOpen} mutate={mutate} busy={busy} />;
  if (section === 'client') return <CarePlanView state={state} mutate={mutate} busy={busy} setSection={setSection} />;
  if (section === 'messages') return <InboxView state={state} mutate={mutate} busy={busy} />;
  if (section === 'more') return <MoreManager state={state} mutate={mutate} busy={busy} onOpenLearn={onOpenLearn} />;
  const command = buildManagerCommandCenter<Chore>(state.chores, workers, today());
  const homeNow = new Date();
  const nowTime = homeNow.toTimeString().slice(0, 5);
  const nowStamp = homeNow.toISOString();
  const attendance = buildAttendance({
    workers: command.activeWorkers,
    shifts: state.shifts ?? [],
    entries: state.timeEntries ?? [],
    date: today(),
    nowTime,
    now: nowStamp,
    onLeaveIds: command.activeWorkers.filter((worker: { id: string }) => memberOnApprovedLeave(state.leaveRequests ?? [], worker.id, today())).map((worker: { id: string }) => worker.id),
  });
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
  const openIncidents = (state.safetyIncidents ?? []).filter((incident: any) => incident.status !== 'resolved').length;
  const workloadWarningCount = (state.workloadWarnings ?? []).length;
  const clientNoteCount = (state.clientNoteQueue ?? []).filter((note: any) => note.status === 'pending').length;
  const scheduleRequests = state.scheduleRequests ?? [];
  const todayScheduleRequests = scheduleRequests.filter((item: any) => item.requestedDate === today() && item.status === 'open');
  const resolvedScheduleRequests = scheduleRequests.filter((item: any) => item.status === 'covered').slice(0, 5);
  const maxCompleted = Math.max(1, ...command.completionTrend.map((day) => day.completed));
  const proofPhotos = state.chores
    .flatMap((task: Chore) => (task.photos ?? []).map((photo: any) => ({ ...photo, task })))
    .sort((a: any, b: any) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 8);
  const decisionCount = safetyCount + clientNoteCount + command.awaitingReview.length + scheduleRequests.filter((item: any) => item.status === 'open').length + openIncidents + workloadWarningCount;
  const certAlerts = certificationAlerts(state.certifications ?? [], state.members, today());
  const openPayPeriod = (state.payPeriods ?? []).find((period: { status: string }) => period.status === 'open' || period.status === 'review');
  const hrAlerts = buildHrAlerts({
    pendingLeave: (state.leaveRequests ?? []).filter((request: { status: string }) => request.status === 'pending').length,
    unsignedRequiredDocs: unsignedRequiredDocCount(state.hrDocuments ?? [], state.hrDocumentAcks ?? [], workers.filter((worker: Member) => worker.status === 'active').map((worker: Member) => worker.id)),
    incompleteHireChecklists: incompleteHireWorkerCount(state.hireChecklistItems ?? [], workers, today()),
    certAlerts: certAlerts.length,
    payPeriodReady: payPeriodReadyToClose(openPayPeriod, today()),
    payPeriodLabel: openPayPeriod ? `${openPayPeriod.startOn} to ${openPayPeriod.endOn}` : undefined,
  });
  const cells: Record<string, React.ReactNode> = {
    hero: (
      <section className="manager-hero overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--role-primary)]">Today · {new Date(`${today()}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h2 className="mt-2 font-semibold tracking-tight" style={{ fontSize: 'var(--dash-title)' }}>Household at a glance</h2>
            <p className="mt-2 max-w-xl leading-6 text-[#52645f]" style={{ fontSize: 'var(--dash-body)' }}>{workers.length} care worker{workers.length === 1 ? '' : 's'} · {state.chores.length} household task{state.chores.length === 1 ? '' : 's'} · {command.attention.length} operational priorit{command.attention.length === 1 ? 'y' : 'ies'}</p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-[var(--dash-radius)] bg-[var(--role-primary)] text-white shadow-sm"><LayoutDashboard className="size-6" aria-hidden="true" /></span>
        </div>
      </section>
    ),
    metrics: (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="On duty now" value={onDutyCount} icon={Clock} tone={lateCount > 0 ? 'caution' : 'neutral'} />
        <Metric label="Due today" value={state.metrics?.dueToday ?? dueToday.length} icon={CalendarDays} />
        <Metric label="Needs attention" value={command.attention.length} icon={AlertTriangle} tone="caution" />
        <Metric label="Funded hours used" value={fundedConfigured ? `${fundedPct}%` : '—'} icon={CircleDollarSign} tone={fundedOverPace ? 'caution' : 'neutral'} />
      </div>
    ),
    decisions: decisionCount > 0 ? (
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="size-5 text-[#b4532a]" aria-hidden="true" />Needs your decision</h2>
          <p className="text-sm text-[#687873]">Items only the household manager can resolve</p>
          <div className="mt-4 space-y-2">
            {scheduleRequests.some((item: any) => item.status === 'open') && (
              <button onClick={() => setSection('messages')} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#d9c99d] bg-[#fff8e8] p-3 text-left text-[#6f5422] transition hover:border-[#c9ae6d]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fcf0dc]"><CalendarDays className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Schedule change and day-off requests</span>
                <span className="rounded-full bg-[#fcf0dc] px-2 py-1 text-xs font-bold">{scheduleRequests.filter((item: any) => item.status === 'open').length}</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            )}
            {safetyCount > 0 && (
              <button onClick={() => setSection('messages')} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2b69f] bg-[#fff8f4] p-3 text-left text-[#8f3f25] transition hover:border-[#cf9873]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f8e9dc]"><ShieldAlert className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Safety alerts to review</span>
                <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold">{safetyCount}</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            )}
            {openIncidents > 0 && (
              <button onClick={() => document.getElementById('safety-reports')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2b69f] bg-[#fff8f4] p-3 text-left text-[#8f3f25] transition hover:border-[#cf9873]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#f8e9dc]"><ShieldAlert className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Safety reports to triage</span>
                <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold">{openIncidents}</span>
                <ChevronRight className="size-4 shrink-0" aria-hidden="true" />
              </button>
            )}
            {workloadWarningCount > 0 && (
              <button onClick={() => document.getElementById('workload-signals')?.scrollIntoView({ behavior: 'smooth', block: 'start' })} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#d9c99d] bg-[#fff8e8] p-3 text-left text-[#6f5422] transition hover:border-[#c9ae6d]">
                <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#fcf0dc]"><AlertTriangle className="size-4" aria-hidden="true" /></span>
                <span className="min-w-0 flex-1 text-sm font-semibold">Workload signals on the team</span>
                <span className="rounded-full bg-[#fcf0dc] px-2 py-1 text-xs font-bold">{workloadWarningCount}</span>
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
    ) : null,
    priorities: (
        <Card className="p-0">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#dfe5dc] px-5 py-4"><div><h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="size-5 text-[#287b6f]" aria-hidden="true" />Operational priorities</h2><p className="text-sm text-[#687873]">Ranked by open issue, overdue date, urgency, and assignment</p></div>{command.unassignedDueToday > 0 && <span className="rounded-full bg-[#f8e9dc] px-3 py-1 text-xs font-semibold text-[#8b4e2c]">{command.unassignedDueToday} unassigned today</span>}</div>
          <TaskList tasks={command.attention.slice(0, 8)} members={state.members} onOpen={setTask} />
          {command.attention.length > 8 && <p className="px-5 pb-5 text-center text-xs text-[#687873]">Showing 8 of {command.attention.length} priorities. Open Tasks for the full list.</p>}
        </Card>
    ),
    attendance: (
        <Card className="manager-coverage">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />Today’s attendance</h2><p className="text-sm text-[#687873]">Scheduled and clock-in status, kept separate from reported day-off requests</p>
          {todayScheduleRequests.length > 0 && <div className="mt-4 rounded-xl border border-[#d9c99d] bg-[#fff8e8] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#8a5a1d]">Reported not coming / day off requested</p><ul className="mt-2 space-y-2">{todayScheduleRequests.map((request: any) => { const person = state.members.find((item: Member) => item.id === request.requesterId); return <li key={request.id} className="text-sm"><span className="font-semibold">{person?.name ?? 'Care worker'}</span><span className="text-[#6f5422]"> — request received; schedule not yet changed</span></li>; })}</ul></div>}
          {resolvedScheduleRequests.length > 0 && <div className="mt-3 rounded-xl border border-[#bcd4c9] bg-[#f2f7f1] p-3"><p className="text-xs font-bold uppercase tracking-wide text-[#287b6f]">Resolved coverage changes</p><ul className="mt-2 space-y-2">{resolvedScheduleRequests.map((request: any) => { const original = state.members.find((item: Member) => item.id === request.requesterId); const covering = state.members.find((item: Member) => item.id === request.acceptedBy); return <li key={request.id} className="text-sm"><span className="font-semibold">{request.requestedDate}</span><span className="text-[#52645f]"> — {covering?.name ?? 'Care worker'} covers for {original?.name ?? 'care worker'}</span></li>; })}</ul></div>}
          <div className="mt-4 space-y-3">{attendance.length ? attendance.map((row) => { const worker = workers.find((item: Member) => item.id === row.workerId); if (!worker) return null; const coverage = command.coverage.find((item: any) => item.workerId === row.workerId) ?? { dueToday: 0, inProgress: 0, overdue: 0 }; const pillClass = row.status === 'late' ? 'bg-[#f8e9dc] text-[#8b4e2c]' : row.status === 'on_duty' || row.status === 'unscheduled_on_duty' ? 'bg-[#e4f0e8] text-[#25654f]' : row.status === 'upcoming' ? 'bg-[#eef2ec] text-[#52645f]' : 'bg-[#f1f5f1] text-[#687873]'; return <button key={worker.id} onClick={() => setProfile(worker)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3 text-left transition hover:border-[#aac3b3]"><AvatarFor member={worker} className="size-10" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-2"><span className="truncate text-sm font-semibold">{worker.name}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pillClass}`}>{attendanceLabel(row)}</span></span><span className="block text-xs text-[#687873]">{coverage.dueToday} due today · {coverage.inProgress} in progress</span></span>{coverage.overdue > 0 && <span className="rounded-full bg-[#f8e9dc] px-2 py-1 text-xs font-bold text-[#8b4e2c]">{coverage.overdue} late</span>}</button>; }) : <EmptyHandoff icon={Users} title="No active care workers" text="Add or reactivate a care worker to plan coverage." compact />}</div>
          <form className="mt-4 flex gap-2 border-t border-[#e5eae4] pt-4" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'announce', ...Object.fromEntries(new FormData(form)) }, 'Announcement posted to the team.'); form.reset(); }}>
            <Input name="body" required maxLength={500} placeholder="Broadcast to the team…" aria-label="Announcement message" className="min-h-11 flex-1" />
            <Button type="submit" disabled={busy} aria-label="Post announcement" className="bg-[#287b6f]"><Megaphone className="size-4" /></Button>
          </form>
        </Card>
    ),
    safety: <div id="safety-reports" className="scroll-mt-20"><SafetyTriageCard state={state} mutate={mutate} busy={busy} /></div>,
    workload: <div id="workload-signals" className="scroll-mt-20"><WorkloadWarnings warnings={state.workloadWarnings ?? []} members={state.members} /></div>,
    handofflog: <ShiftHandoffLog state={state} />,
    medsround: <MedicationRoundCard state={state} mutate={mutate} busy={busy} />,
    appointments: <AppointmentsCard state={state} mutate={mutate} busy={busy} compact />,
    supplies: <SuppliesCard state={state} mutate={mutate} busy={busy} />,
    kudos: <KudosCard state={state} mutate={mutate} busy={busy} />,
    funding: (
      <Card>
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
    ),
    review: command.awaitingReview.length > 0 ? (
        <Card className="border-[#bcd4c9]">
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
    ) : null,
    certs: certAlerts.length > 0 ? (
          <Card className="border-[#eadbc6]">
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
    ) : null,
    handoffs: <Card><h2 className="flex items-center gap-2 text-lg font-bold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Recent handoffs</h2><p className="text-sm text-[#687873]">Latest progress, completion, and issue notes</p>{command.recentHandoffs.length ? <ol className="mt-4 divide-y divide-[#e5eae4]">{command.recentHandoffs.map(({ task, ...note }) => { const author = state.members.find((item: Member) => item.id === note.memberId)?.name ?? 'Team member'; return <li key={note.id}><button onClick={() => setTask(task)} className="w-full rounded-xl px-2 py-3 text-left transition hover:bg-[#f1f5f1]"><span className="flex items-center justify-between gap-3"><span className="truncate text-sm font-semibold">{task.title}</span><Badge>{note.kind}</Badge></span><span className="mt-1 line-clamp-2 block text-sm text-[#52645f]">{note.body}</span><span className="mt-2 block text-xs text-[#687873]">{author} · {new Date(note.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></button></li>; })}</ol> : <EmptyHandoff icon={MessageSquareText} title="No handoffs yet" text="Care worker notes will appear here as the team shares progress." compact />}</Card>,
    pulse: <Card><h2 className="flex items-center gap-2 text-lg font-bold"><CheckCircle2 className="size-5 text-[#287b6f]" aria-hidden="true" />Seven-day completion pulse</h2><p className="text-sm text-[#687873]">Completed household tasks by day</p><p className="sr-only">Seven-day completions: {command.completionTrend.map((day) => `${day.date}, ${day.completed}`).join('; ')}</p><div className="mt-6 grid h-40 grid-cols-7 items-end gap-2" aria-hidden="true">{command.completionTrend.map((day) => <div key={day.date} className="flex h-full min-w-0 flex-col items-center justify-end gap-2"><span className="text-xs font-semibold tabular-nums">{day.completed}</span><span className="w-full max-w-10 rounded-t-lg bg-[#67a193]" style={{ height: `${Math.max(8, (day.completed / maxCompleted) * 96)}px` }} /><span className="text-[11px] text-[#687873]">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}</span></div>)}</div><div className="mt-5 flex items-center justify-between rounded-xl bg-[#f1f5f1] p-3 text-sm"><span className="text-[#52645f]">Unresolved issues</span><strong className="tabular-nums text-[#8b4e2c]">{command.issues.length}</strong></div></Card>,
    photos: proofPhotos.length > 0 ? (
        <Card>
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
    ) : null,
    activity: (
      <Card>
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
    ),
    payroll: (
      <Card data-guide="payroll">
        <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDollarSign className="size-5 text-[#287b6f]" aria-hidden="true" />Payroll &amp; bookkeeper</h2>
        <p className="mt-1 text-sm leading-6 text-[#687873]">Close pay periods in HR, or download an ad-hoc CSV for your bookkeeper.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <a href="/api/payroll" download className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white transition hover:bg-[#216b61]"><FileDown className="size-4" aria-hidden="true" />Download CSV</a>
          <Button type="button" variant="outline" size="sm" className="min-h-11" onClick={() => setSection('hr')}><Briefcase className="size-4" aria-hidden="true" />Open HR payroll</Button>
        </div>
      </Card>
    ),
    hralerts: hrAlerts.length ? (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Briefcase className="size-5 text-[#287b6f]" aria-hidden="true" />HR alerts</h2>
        <p className="text-sm text-[#687873]">Leave, documents, hire checklists, certifications, and pay periods</p>
        <div className="mt-4 space-y-2">
          {hrAlerts.map((alert) => (
            <button key={alert.id} type="button" onClick={() => setSection('hr')} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3 text-left transition hover:border-[#aac3b3]">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{alert.title}</span>
                <span className="block text-xs text-[#687873]">{alert.detail}</span>
              </span>
              <ChevronRight className="size-4 shrink-0 text-[#687873]" aria-hidden="true" />
            </button>
          ))}
        </div>
      </Card>
    ) : null,
    hrexpanding: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Briefcase className="size-5 text-[#287b6f]" aria-hidden="true" />HR hub</h2>
        <p className="mt-1 text-sm text-[#687873]">People, time off, policies, hire checklists, and payroll in one place.</p>
        <Button type="button" className="mt-4 min-h-11 bg-[#287b6f]" onClick={() => setSection('hr')}><Briefcase className="size-4" aria-hidden="true" />Open HR</Button>
      </Card>
    ),
    team: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />Care team</h2>
        <p className="text-sm text-[#687873]">Open a profile to manage shifts, records, and certifications</p>
        <div className="mt-4 space-y-2">
          {workers.length ? workers.map((worker: Member) => (
            <button key={worker.id} onClick={() => setProfile(worker)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3 text-left transition hover:border-[#aac3b3]">
              <AvatarFor member={worker} className="size-10" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{worker.name}</span><span className="block text-xs text-[#687873]">{worker.jobTitle || 'Care worker'}</span></span>
              <StatusBadge status={worker.status} />
            </button>
          )) : <EmptyHandoff icon={Users} title="No care workers" text="Add a care worker to build the team." compact />}
        </div>
      </Card>
    ),
    inboxpreview: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Inbox className="size-5 text-[#287b6f]" aria-hidden="true" />Latest inbox items</h2>
        <p className="text-sm text-[#687873]">Newest care-team messages and note updates</p>
        {(state.inbox ?? []).length ? (
          <>
            <ol className="mt-4 space-y-2">
              {(state.inbox ?? []).slice(0, 5).map((item: any) => {
                const sender = state.members.find((item2: Member) => item2.id === item.createdBy)?.name ?? 'Team member';
                return <li key={item.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3"><p className="line-clamp-2 text-sm leading-5">{item.body}</p><p className="mt-1 text-xs text-[#687873]">{sender} · {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p></li>;
              })}
            </ol>
            <div className="mt-4"><Button variant="outline" size="sm" onClick={() => setSection('messages')}>Open inbox</Button></div>
          </>
        ) : <EmptyHandoff icon={Inbox} title="Inbox is clear" text="Team messages will appear here." compact />}
      </Card>
    ),
    schedulepreview: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-[#287b6f]" aria-hidden="true" />Next few days</h2>
        <p className="text-sm text-[#687873]">Scheduled coverage today and the next two days</p>
        <div className="mt-4 space-y-3">
          {[0, 1, 2].map((offset) => {
            const day = addDaysISO(today(), offset);
            const dayShifts = shiftsForDay(state.shifts ?? [], day);
            return (
              <div key={day} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
                <p className="text-xs font-bold uppercase tracking-wide text-[#687873]">{offset === 0 ? 'Today' : dateLabel(day)}</p>
                {dayShifts.length ? (
                  <ul className="mt-2 space-y-1.5">{dayShifts.map((shift: any) => { const person = state.members.find((item: Member) => item.id === shift.memberId); return <li key={shift.id} className="flex items-center gap-2 text-sm"><span className="size-2 rounded-full" style={{ backgroundColor: person?.color ?? '#287b6f' }} /><span className="min-w-0 flex-1 truncate font-semibold">{person?.name ?? 'Care worker'}</span><span className="tabular-nums text-xs text-[#687873]">{formatShift(shift)}</span></li>; })}</ul>
                ) : <p className="mt-1 text-sm text-[#687873]">No shifts scheduled</p>}
              </div>
            );
          })}
        </div>
      </Card>
    ),
    quickactions: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="size-5 text-[#287b6f]" aria-hidden="true" />Quick actions</h2>
        <p className="text-sm text-[#687873]">Common manager jobs, one tap away</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <Button variant="outline" className="min-h-12 justify-start" onClick={() => setCreateOpen(true)}><Plus className="size-4" />Add task</Button>
          <Button variant="outline" className="min-h-12 justify-start" onClick={() => setAddOpen(true)}><UserCheck className="size-4" />Add care worker</Button>
          <Button variant="outline" className="min-h-12 justify-start" onClick={() => setSection('schedule')}><CalendarDays className="size-4" />Two-week schedule</Button>
          <Button variant="outline" className="min-h-12 justify-start" onClick={() => setSection('team')}><Users className="size-4" />Team directory</Button>
          <Button variant="outline" className="min-h-12 justify-start" onClick={() => setSection('messages')}><Inbox className="size-4" />Team inbox</Button>
          <Button variant="outline" className="min-h-12 justify-start" onClick={() => setSection('more')}><FileDown className="size-4" />Reports &amp; payroll</Button>
        </div>
      </Card>
    ),
  };
  return (
    <div data-guide="panel-home">
      <Title title="Manager command center" text="Coverage, exceptions, and recent handoffs for today’s household work." action={<div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => setAddOpen(true)}><UserCheck className="size-4" />Add care worker</Button><Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button></div>} />
      <DashboardGrid audience="manager" items={dashboard.layout} appearance={dashboard.appearance} renderWidget={(id) => cells[id] ?? null} onSaveLayout={dashboard.saveLayout} onSaveAppearance={dashboard.saveAppearance} busy={busy} />
    </div>
  );
}

function MoreManager({ state, mutate, busy, onOpenLearn }: any) {
  // Learn CareBoard lives in the sidebar / book icon — keep Settings focused on household config.
  const [weekStart] = useState(() => new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10));
  const [payFrom, setPayFrom] = useState(() => new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10));
  const [payTo, setPayTo] = useState(() => today());
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
      <Title title="Settings & reports" text="Household settings, monthly reports, and immutable audit history. Open Learn CareBoard from the sidebar anytime for a refresher." />
      <Card className="mb-6 border-[#bcd4c9] bg-[#f2f7f1]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#287b6f] text-white"><BookOpen className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-bold">Learn CareBoard</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[#52645f]">The welcome tour is your teacher — reopen the full walkthrough or jump to one subject (Overview, Team, Tasks, Payroll, and more) whenever you need a clear refresher.</p>
            </div>
          </div>
          <p className="text-sm font-semibold text-[#287b6f]">Use the Learn CareBoard button in the sidebar →</p>
          <Button type="button" className="bg-[#287b6f]" onClick={() => onOpenLearn?.()}><BookOpen className="size-4" aria-hidden="true" />Open Learn</Button>
        </div>
      </Card>
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
            <Field label="Bookkeeper email — receives the payroll report every two weeks" name="bookkeeperEmail" type="email" defaultValue={settings?.bookkeeperEmail ?? ''} />
            <Field label="Default vacation hours for new care workers" name="defaultVacationHours" type="number" step="any" defaultValue={settings?.defaultVacationHours ?? 80} />
            <Field label="Pay period length (days)" name="payPeriodDays" type="number" defaultValue={settings?.payPeriodDays ?? 14} />
            <Field label="Pay period anchor date" name="payPeriodAnchor" type="date" defaultValue={settings?.payPeriodAnchor ?? '2025-01-06'} />
            <p className="text-sm text-[#687873]">Close pay runs and download wage statements from the HR → Payroll tab. Settings keep the bookkeeper email and period defaults.</p>
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
      <Card className="mt-6" data-guide="payroll-bookkeeper">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-bold"><FileDown className="size-5 text-[#287b6f]" aria-hidden="true" />Bookkeeper payroll report</h2>
            <p className="mt-1 text-sm text-[#687873]">Every worker’s clock-ins by day for the pay period — ready to hand to your bookkeeper. Defaults to the last two weeks.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/payroll?from=${payFrom}&to=${payTo}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#287b6f] px-4 text-sm font-semibold text-white transition hover:bg-[#216b61]"><FileDown className="size-4" aria-hidden="true" />Download CSV</a>
            <button type="button" disabled={busy} onClick={() => mutate({ action: 'sendPayrollReport', from: payFrom, to: payTo }, 'Payroll report emailed to the bookkeeper.')} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#d7dfd7] px-4 text-sm font-semibold text-[#52645f] transition hover:bg-[#f1f5f1] disabled:opacity-60"><Mail className="size-4" aria-hidden="true" />Email to bookkeeper</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label htmlFor="payroll-from" className="grid gap-1 text-sm font-semibold">From<Input id="payroll-from" type="date" value={payFrom} onChange={(e) => setPayFrom(e.target.value)} className="min-h-11 w-44" /></label>
          <label htmlFor="payroll-to" className="grid gap-1 text-sm font-semibold">To<Input id="payroll-to" type="date" value={payTo} onChange={(e) => setPayTo(e.target.value)} className="min-h-11 w-44" /></label>
          <button type="button" onClick={() => { const end = today(); setPayTo(end); setPayFrom(new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)); }} className="min-h-11 rounded-xl border border-[#d7dfd7] px-3 text-xs font-semibold text-[#52645f] transition hover:bg-[#f1f5f1]">Last 14 days</button>
        </div>
      </Card>
      <div className="mt-6"><PayrollFaqPanel helpRole="manager" /></div>
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

function MyScheduleView({ state, member, setTask, mutate, busy }: any) {
  const date = today();
  const dayPlan = workerDayPlan<Chore>(state.chores, member.id, date);
  const comingUp = buildWeekSchedule<Chore>(state.chores, [], date, 7).days.slice(1)
    .map((day) => ({
      ...day,
      tasks: day.tasks.filter((task) => task.assignedTo === member.id || (task.status === 'open' && task.assignedTo === null)),
    }))
    .filter((day) => day.tasks.length > 0 || shiftsForDay(state.shifts ?? [], day.date).some((shift) => shift.memberId === member.id));
  const memberFor = (id: string | null) => state.members.find((item: Member) => item.id === id);
  const myShiftFor = (day: string) => (state.shifts ?? []).find((shift: Shift) => shift.memberId === member.id && shiftsForDay([shift], day).length > 0) ?? null;
  const coveringToday = (state.scheduleRequests ?? []).filter((request: any) => request.status === 'covered' && request.requestedDate === date && request.acceptedBy === member.id);
  const askedToday = (state.scheduleRequests ?? []).some((request: any) => request.status === 'open' && request.requesterId === member.id && request.requestedDate === date);
  const unscheduled = state.chores.filter((task: Chore) => task.status !== 'complete' && task.dueDate === null && (task.assignedTo === member.id || task.assignedTo === null));
  const runAction = async (event: React.MouseEvent, task: Chore, action: 'claim' | 'start' | 'complete') => {
    event.stopPropagation();
    try {
      await mutate({ action, choreId: task.id }, action === 'claim' ? `${task.title} claimed.` : action === 'start' ? `${task.title} started.` : `${task.title} completed.`);
    } catch { /* live notice reports the error */ }
  };
  const taskRow = (task: Chore, note?: string) => {
    const action = nextTaskAction(task, member.id);
    return (
      <div key={task.id} className={`flex items-center gap-3 rounded-xl border p-3 ${task.status === 'complete' ? 'border-[#e2e8e1] bg-[#f4f7f2] opacity-70' : task.issueOpen ? 'border-[#eccab6] bg-[#fdf3ec]' : 'border-[#dfe5dc] bg-white'}`}>
        <span className="w-12 shrink-0 text-xs font-semibold tabular-nums text-[#52645f]">{task.dueTime ?? '—'}</span>
        <button onClick={() => setTask(task)} className="min-w-0 flex-1 rounded-lg text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">
          <span className={`block truncate text-sm font-semibold ${task.status === 'complete' ? 'line-through' : ''}`}>{task.title}</span>
          <span className="block truncate text-xs text-[#687873]">{note ?? (task.assignedTo === member.id ? 'Yours' : 'Open to claim')}{task.issueOpen ? ' · issue open' : ''}</span>
        </button>
        {task.status === 'complete' && <Check className="size-4 shrink-0 text-[#216b61]" aria-label="Done" />}
        {action === 'claim' && <Button size="sm" variant="outline" disabled={busy} onClick={(e) => runAction(e, task, 'claim')}><UserCheck className="size-4" />Claim</Button>}
        {action === 'start' && <Button size="sm" disabled={busy} onClick={(e) => runAction(e, task, 'start')} className="bg-[#287b6f]"><Play className="size-4" />Start</Button>}
        {action === 'complete' && <Button size="sm" disabled={busy} onClick={(e) => runAction(e, task, 'complete')} className="bg-[#287b6f]"><Check className="size-4" />Done</Button>}
      </div>
    );
  };
  const todayShift = myShiftFor(date);
  return (
    <div data-guide="panel-schedule">
      <Title title="My schedule" text="Clock in, work through today, and see what’s coming." />
      <TimeClock member={member} entries={state.timeEntries ?? []} shifts={state.shifts ?? []} mutate={mutate} busy={busy} />
      <Card className="mt-6">
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-[#287b6f]" aria-hidden="true" />Today — {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
        <p className="mt-1 text-sm text-[#687873]">{todayShift ? `Your shift ${formatShift(todayShift)}` : 'No shift scheduled today'}</p>
        {coveringToday.map((request: any) => (
          <p key={request.id} className="mt-2 flex items-center gap-1.5 rounded-xl bg-[#eef4ef] p-2.5 text-xs font-semibold text-[#287b6f]"><HeartHandshake className="size-3.5 shrink-0" aria-hidden="true" />You’re covering {memberFor(request.requesterId)?.name.split(' ')[0] ?? 'a teammate'} · {request.startTime}–{request.endTime}</p>
        ))}
        {askedToday && <p className="mt-2 text-xs font-semibold italic text-[#8b5e1f]">Cover requested · waiting on a yes</p>}
        <div className="mt-4 space-y-2">
          {dayPlan.carriedOver.map((task) => taskRow(task, `Still needs doing — was due ${dateLabel(task.dueDate)}`))}
          {dayPlan.today.map((task) => taskRow(task))}
          {!dayPlan.carriedOver.length && !dayPlan.today.length && <EmptyHandoff icon={CheckCircle2} title="All clear today" text="Nothing is due for you today. Check coming up below to get ahead." compact />}
        </div>
      </Card>
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-[#287b6f]" aria-hidden="true" />Coming up</h2>
          <p className="text-sm text-[#687873]">Your next six days — tap a task for details</p>
          <div className="mt-4 space-y-4">
            {comingUp.length ? comingUp.map((day) => {
              const shift = myShiftFor(day.date);
              const label = day.date === addDaysISO(date, 1) ? 'Tomorrow' : new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
              return (
                <section key={day.date} aria-label={`Schedule for ${day.date}`}>
                  <p className="text-xs font-bold uppercase tracking-wide text-[#52645f]">{label}{shift ? ` · ${formatShift(shift)}` : ''}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {day.tasks.length ? day.tasks.map((task) => taskRow(task)) : <p className="rounded-xl border border-dashed border-[#d7dfd7] p-3 text-center text-xs text-[#8a978f]">On shift — no tasks due</p>}
                  </div>
                </section>
              );
            }) : <EmptyHandoff icon={CalendarDays} title="Nothing coming up" text="The next six days are clear for you." compact />}
          </div>
        </Card>
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDot className="size-5 text-[#287b6f]" aria-hidden="true" />Not scheduled yet</h2>
          <p className="text-sm text-[#687873]">Open work without a date — claim it or tap to pick a day</p>
          <div className="mt-4 space-y-2">
            {unscheduled.length ? unscheduled.map((task: Chore) => taskRow(task)) : <EmptyHandoff icon={CheckCircle2} title="Nothing unscheduled" text="Every open task has a due date." compact />}
          </div>
        </Card>
      </div>
    </div>
  );
}

function ScheduleView({ state, workers, readOnly = false, setTask, setCreateOpen, mutate, busy }: any) {
  const schedule = buildWeekSchedule<Chore>(state.chores, workers, today(), 14);
  const plan = readOnly ? [] : suggestAssignments<Chore>(state.chores, workers, today(), 14, { shifts: state.shifts ?? [], availability: state.availability ?? [] });
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
    <div data-guide="panel-schedule">
      <Title title="Two-week schedule" text={readOnly ? 'Fourteen days of household work and who is on shift.' : 'Fourteen days of household work — reschedule or reassign any task from its details.'} action={readOnly ? undefined : <div className="flex flex-wrap gap-2">{plan.length > 0 && <Button variant="outline" disabled={assigning || busy} onClick={autoAssign}><UserCheck className="size-4" />Auto-assign {plan.length} open task{plan.length === 1 ? '' : 's'}</Button>}<Button onClick={() => setCreateOpen(true)} className="bg-[#287b6f]"><Plus className="size-4" />Add task</Button></div>} />
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
                <div><p className={`text-xs font-bold uppercase tracking-wide ${isToday ? 'text-[#287b6f]' : 'text-[#687873]'}`}>{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}</p><p className="flex items-center gap-1.5 text-sm font-semibold">{new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}<span className="rounded bg-[#eef2ec] px-1 text-[9px] font-bold uppercase text-[#687873]" title={`Week ${'AB'[cycleWeekOf(day.date) - 1]} of the two-week cycle`}>Wk {'AB'[cycleWeekOf(day.date) - 1]}</span></p></div>
                {isToday && <span className="rounded-full bg-[#287b6f] px-2 py-0.5 text-[10px] font-bold uppercase text-white">Today</span>}
              </header>
              {dayShifts.length > 0 && (
                <div className="mb-2 space-y-1">
                  {dayShifts.slice(0, 2).map((shift) => {
                    const person = memberFor(shift.memberId);
                    const covered = (state.scheduleRequests ?? []).find((request: any) => request.status === 'covered' && request.requestedDate === day.date && request.shiftId === shift.id);
                    const covering = covered ? memberFor(covered.acceptedBy) : null;
                    const shown = covering ?? person;
                    const label = covering ? `${covering.id === state.viewer.id ? 'You' : covering.name.split(' ')[0]} for ${shift.memberId === state.viewer.id ? 'you' : person.name.split(' ')[0]}` : person.name.split(' ')[0];
                    return <p key={shift.id} className="flex items-center gap-1.5 text-[11px] font-semibold text-[#4d6b5e]" title={covering ? `${shown.name} is covering this shift` : undefined}><span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: shown.color }} aria-hidden="true" />{label} · {formatShift(shift)}</p>;
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
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><Users className="size-5 text-[#287b6f]" aria-hidden="true" />Care worker load — next two weeks</h2>
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
        <Card>
          <h2 className="flex items-center gap-2 text-lg font-bold"><CircleDot className="size-5 text-[#287b6f]" aria-hidden="true" />Unscheduled work</h2>
          <p className="text-sm text-[#687873]">Open tasks without a due date — open one to pick a day</p>
          <div className="mt-4 space-y-2">
            {schedule.unscheduled.length ? schedule.unscheduled.map((task) => scheduled(task)) : <EmptyHandoff icon={CheckCircle2} title="Nothing unscheduled" text="Every open task has a due date." compact />}
          </div>
        </Card>
      </div>
    </div>
  );
}

type ChatMessage = { role: 'user' | 'assistant'; content: string };

function AssistantView({ state, setSection }: { state: HouseholdState; setSection: (section: Section) => void }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const role = state.viewer.role;
  const suggestions = [
    'What tasks should I focus on today?',
    'Which days do I have off?',
    'How can I coordinate schedule coverage?',
    ...assistantPayrollSuggestions(role),
  ];

  async function ask(question: string) {
    const content = question.trim();
    if (!content || sending) return;
    const next = [...messages.slice(-10), { role: 'user' as const, content }];
    setMessages(next); setDraft(''); setError(''); setSending(true);
    try {
      const response = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const result = await response.json() as { answer?: string; error?: string };
      if (!response.ok || !result.answer) throw new Error(result.error || 'The assistant could not answer right now.');
      setMessages((current) => [...current, { role: 'assistant', content: result.answer as string }]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'The assistant could not answer right now.');
    } finally { setSending(false); }
  }

  return (
    <>
      <Title title="CareBoard assistant" text="Ask about the CareBoard tasks and schedule you’re authorized to see." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card className="flex min-h-[32rem] flex-col p-0">
          <div className="flex items-start gap-3 border-b border-[#dfe5dc] bg-[#f2f7f1] px-5 py-4">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#287b6f] text-white"><Sparkles className="size-5" aria-hidden="true" /></span>
            <div><h2 className="font-bold">Your private AI assistant</h2><p className="mt-1 text-sm leading-5 text-[#52645f]">Separate from the team inbox. It can explain information, but it cannot change CareBoard records.</p></div>
          </div>
          <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5" aria-live="polite" aria-busy={sending}>
            {!messages.length && (
              <div className="mx-auto max-w-lg py-8 text-center">
                <span className="mx-auto grid size-14 place-items-center rounded-2xl bg-[#e8f1ec] text-[#287b6f]"><MessageSquareText className="size-6" aria-hidden="true" /></span>
                <h3 className="mt-4 text-lg font-bold">How can I help?</h3>
                <p className="mt-2 text-sm leading-6 text-[#687873]">Ask for a task summary, schedule help, an explanation of what’s on your dashboard, or a general question.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">{suggestions.map((suggestion) => <button key={suggestion} type="button" onClick={() => void ask(suggestion)} className="min-h-11 rounded-xl border border-[#cbd8cf] bg-white px-3 py-2 text-left text-sm font-semibold text-[#287b6f] transition hover:bg-[#f1f5f1] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]">{suggestion}</button>)}</div>
              </div>
            )}
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[88%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 sm:max-w-[75%] ${message.role === 'user' ? 'bg-[#287b6f] text-white' : 'border border-[#dfe5dc] bg-[#f8faf7] text-[#20312d]'}`}>
                  <span className="sr-only">{message.role === 'user' ? 'You' : 'CareBoard assistant'}:</span>{message.content}
                </div>
              </div>
            ))}
            {sending && <output className="flex items-center gap-2 text-sm text-[#687873]"><RefreshCw className="size-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />CareBoard assistant is thinking…</output>}
            {error && <div role="alert" className="rounded-xl border border-[#e7c4b5] bg-[#fff5f0] p-3 text-sm text-[#873d27]">{error}</div>}
          </div>
          <form className="border-t border-[#dfe5dc] p-4" onSubmit={(event) => { event.preventDefault(); void ask(draft); }}>
            <label htmlFor="assistant-message" className="sr-only">Message the CareBoard assistant</label>
            <div className="flex items-end gap-2">
              <textarea id="assistant-message" value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={2000} rows={2} placeholder="Ask about your tasks or schedule…" className={`${fieldClass} mt-0 min-h-14 resize-none`} />
              <Button type="submit" disabled={sending || !draft.trim()} aria-label="Send message" className="min-h-14 shrink-0 bg-[#287b6f] px-4"><Send className="size-5" aria-hidden="true" /></Button>
            </div>
            <p className="mt-2 text-xs text-[#687873]">AI can make mistakes. Check important details in CareBoard and follow your care plan.</p>
          </form>
        </Card>
        <aside className="space-y-4" aria-label="Assistant privacy information">
          <Card><h2 className="flex items-center gap-2 font-bold"><Shield className="size-5 text-[#287b6f]" aria-hidden="true" />Privacy by role</h2><p className="mt-2 text-sm leading-6 text-[#687873]">The assistant receives only a limited view of tasks and shifts already authorized for your role. It does not receive contact details, pay, reports, settings, or audit records.</p></Card>
          <Card><h2 className="font-bold">Read-only help</h2><p className="mt-2 text-sm leading-6 text-[#687873]">To make a change, use the normal CareBoard task and schedule controls. The assistant will never make changes for you.</p></Card>
          {state.viewer.role === 'worker' && <Card>
            <h2 className="flex items-center gap-2 font-bold"><HeartHandshake className="size-5 text-[#287b6f]" aria-hidden="true" />Need cover for a shift?</h2>
            <p className="mt-2 text-sm leading-6 text-[#687873]">The <strong>Shift cover</strong> card on your Today dashboard asks every teammate at once — and keeps the ask up until someone says yes.</p>
            <Button type="button" variant="outline" className="mt-3 min-h-11 w-full" onClick={() => setSection('today')}><HeartHandshake className="size-4" aria-hidden="true" />Open shift cover</Button>
          </Card>}
        </aside>
      </div>
    </>
  );
}

function ViewerView({ section, state, setTask, setSection, dashboard }: any) {
  const workers = state.members.filter((item: Member) => item.role === 'worker' && item.status === 'active');
  if (section === 'schedule') return <ScheduleView state={state} workers={workers} readOnly setTask={setTask} />;
  if (section === 'client') return <CarePlanView state={state} mutate={() => Promise.resolve()} busy={false} />;
  if (section === 'tasks') return (
    <>
      <Title title="Household tasks" text="The full care plan — read-only." />
      <Card className="p-0"><TaskList tasks={state.chores} members={state.members} onOpen={setTask} /></Card>
    </>
  );
  const onShiftToday = shiftsForDay(state.shifts ?? [], today());
  const dueToday = state.chores.filter((chore: Chore) => chore.status !== 'complete' && chore.dueDate === today());
  const doneToday = state.chores.filter((chore: Chore) => chore.completedAt?.slice(0, 10) === today());
  const cells: Record<string, React.ReactNode> = {
    announcements: <AnnouncementBanner items={state.announcements ?? []} />,
    metrics: (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Metric label="Due today" value={dueToday.length} icon={CalendarDays} />
        <Metric label="Completed today" value={doneToday.length} icon={Check} tone="success" />
        <Metric label="On shift today" value={onShiftToday.length} icon={Clock} />
      </div>
    ),
    onshift: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />On shift today</h2>
        <div className="mt-4 space-y-2">
          {onShiftToday.length ? onShiftToday.map((shift: any) => {
            const person = state.members.find((item: Member) => item.id === shift.memberId);
            return person ? <div key={shift.id} className="flex items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3"><AvatarFor member={person} className="size-9" /><span className="min-w-0 flex-1 truncate text-sm font-semibold">{person.name}</span><span className="text-xs tabular-nums text-[#687873]">{formatShift(shift)}</span></div> : null;
          }) : <EmptyHandoff icon={Clock} title="No one on shift" text="No care worker is scheduled today." compact />}
        </div>
      </Card>
    ),
    duetoday: (
      <Card className="p-0">
        <div className="border-b border-[#dfe5dc] px-5 py-4"><h2 className="flex items-center gap-2 font-semibold"><CalendarDays className="size-4 text-[#287b6f]" aria-hidden="true" />Due today</h2></div>
        <TaskList tasks={dueToday} members={state.members} onOpen={setTask} compact />
      </Card>
    ),
    medsround: <MedicationRoundCard state={state} readOnly />,
    aboutme: <CareProfileCard state={state} compact setSection={setSection} />,
    appointments: <AppointmentsCard state={state} compact />,
    supplies: <SuppliesCard state={state} readOnly />,
  };
  return (
    <>
      <Title title="Household overview" text="A read-only look at today’s care plan." />
      <DashboardGrid audience="viewer" items={dashboard.layout} appearance={dashboard.appearance} renderWidget={(id) => cells[id] ?? null} onSaveLayout={dashboard.saveLayout} onSaveAppearance={dashboard.saveAppearance} busy={false} />
    </>
  );
}

function WorkerView({ section, state, member, setSection, setTask, setProfile, setAvailWorker, mutate, uploadClientNote, busy, dashboard, onOpenLearn }: any) {
  const [taskQuery, setTaskQuery] = useState('');
  const [taskFilter, setTaskFilter] = useState<'all' | 'mine' | 'available' | 'in_progress' | 'complete'>('all');
  if (section === 'assistant') return <AssistantView state={state} setSection={setSection} />;
  if (section === 'schedule') return <MyScheduleView state={state} member={member} setTask={setTask} mutate={mutate} busy={busy} />;
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
      <Title title="More" text="Account, pay, privacy, and Learn CareBoard refreshers." />
      <Card className="mb-6 border-[#bcd4c9] bg-[#f2f7f1]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#287b6f] text-white"><BookOpen className="size-5" aria-hidden="true" /></span>
            <div>
              <h2 className="text-lg font-bold">Need a refresher?</h2>
              <p className="mt-1 max-w-xl text-sm leading-6 text-[#52645f]">Replay the welcome tour or open one subject — Today, Tasks, handoffs, Care plan, Inbox, or Your pay — in plain language.</p>
            </div>
          </div>
          <Button type="button" className="bg-[#287b6f]" onClick={() => onOpenLearn?.()}><BookOpen className="size-4" aria-hidden="true" />Open Learn</Button>
        </div>
      </Card>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card data-guide="your-pay">
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
      <div className="mt-6"><PayrollFaqPanel helpRole="worker" /></div>
      <WorkerHrCards state={state} member={member} mutate={mutate} busy={busy} />
    </>
    );
  }
  if (section === 'client') return <CarePlanView state={state} mutate={mutate} busy={busy} uploadClientNote={uploadClientNote} setSection={setSection} />;
  if (section === 'messages') return <InboxView state={state} mutate={mutate} busy={busy} />;
  if (section === 'today') return (
    <WorkerDashboard state={state} member={member} setSection={setSection} setTask={setTask} setAvailWorker={setAvailWorker} mutate={mutate} busy={busy} dashboard={dashboard} />
  );
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
    <div data-guide="panel-tasks">
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
    </div>
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
    <div data-guide="panel-messages">
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
    </div>
  );
}

function ClientRecordView({ state, mutate, uploadClientNote, busy, embedded = false }: any) {
  const isManager = state.viewer.role === 'manager';
  const manager = state.members.find((item: Member) => item.role === 'manager');
  const notes = state.clientNotes ?? [];
  const queue = state.clientNoteQueue ?? [];
  const memberFor = (id: string) => state.members.find((item: Member) => item.id === id);
  return <>
    {embedded ? <p className="-mt-1 mb-4 text-sm leading-6 text-[#52645f]">{isManager ? 'Review OCR drafts before explicitly adding them to the official client record.' : 'Capture a hard-copy note for manager review and read approved client notes.'}</p> : <Title title="Client record" text={isManager ? 'Review OCR drafts before explicitly adding them to the official client record.' : 'Capture a hard-copy note for manager review and read approved client notes.'} />}
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
    <Card className="flex flex-wrap items-center justify-between gap-4">
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

function WorkerDashboard({ state, member, setSection, setTask, setAvailWorker, mutate, busy, dashboard }: any) {
  const date = today();
  const handoff = buildShiftHandoff<Chore>(state.chores, member.id, date);
  const outstanding = handoff.assigned.filter((task: Chore) => task.status !== 'complete');
  const warnings = state.workloadWarnings ?? [];
  const mondayISO = addDaysISO(date, -((weekdayOf(date) + 6) % 7));
  const weekMinutes = minutesInRange(state.timeEntries ?? [], member.id, mondayISO, date, new Date().toISOString());
  const todayMinutes = minutesInRange(state.timeEntries ?? [], member.id, date, date, new Date().toISOString());
  const myCerts = (state.certifications ?? []).filter((cert: Certification) => cert.memberId === member.id);
  const myShifts = (state.shifts ?? []) as Shift[];
  const shiftsByWeek: Record<number, Shift[]> = { 0: [], 1: [], 2: [] };
  for (const shift of myShifts) shiftsByWeek[shift.cycleWeek ?? 0].push(shift);
  const runAction = async (event: React.MouseEvent, task: Chore, action: 'start' | 'complete') => {
    event.stopPropagation();
    try { await mutate({ action, choreId: task.id }, action === 'start' ? `${task.title} started.` : `${task.title} completed.`); } catch { /* live notice reports the error */ }
  };
  const cells: Record<string, React.ReactNode> = {
    hero: (
      <section className="worker-hero overflow-hidden shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--role-primary)]">Today · {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h2 className="mt-2 font-semibold tracking-tight" style={{ fontSize: 'var(--dash-title)' }}>Ready for your shift, {member.name.split(/\s+/)[0]}</h2>
            <p className="mt-2 max-w-xl leading-6 text-[#52645f]" style={{ fontSize: 'var(--dash-body)' }}>Clock in, check your priorities, and record handoff notes so the next caregiver can pick up where you left off.</p>
          </div>
          <span className="grid size-12 shrink-0 place-items-center rounded-[var(--dash-radius)] bg-[var(--role-primary)] text-white shadow-sm"><Home className="size-6" aria-hidden="true" /></span>
        </div>
      </section>
    ),
    announcements: <AnnouncementBanner items={state.announcements ?? []} />,
    coverage: <CoverageCard state={state} member={member} mutate={mutate} busy={busy} />,
    timeclock: <TimeClock member={member} entries={state.timeEntries ?? []} shifts={state.shifts ?? []} mutate={mutate} busy={busy} />,
    shiftbrief: (
      <>
      <section aria-labelledby="shift-summary" className="overflow-hidden rounded-[var(--dash-radius-lg)] bg-[var(--role-primary-dark)] p-5 text-white shadow-lg sm:p-6" style={{ padding: 'var(--dash-hero-pad)' }}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div><p className="text-xs font-semibold uppercase tracking-[.16em] text-[var(--role-primary-soft)]">Today · {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</p><h2 id="shift-summary" className="mt-2 font-semibold" style={{ fontSize: 'var(--dash-title)' }}>{handoff.attention.length ? `${handoff.attention.length} ${handoff.attention.length === 1 ? 'item needs' : 'items need'} attention` : 'You’re ready for the shift'}</h2><p className="mt-2 max-w-xl leading-6 text-white/80" style={{ fontSize: 'var(--dash-body)' }}>{handoff.attention.length ? 'Prioritized from due dates, task priority, and open issues already recorded by your care team.' : outstanding.length ? 'No urgent or overdue work. Continue with today’s plan.' : 'No assigned work is due today. Available work remains in Tasks.'}</p></div>
          <div aria-label={`${handoff.completed.length} of ${handoff.assigned.length + handoff.completed.length} shift tasks completed`} className="min-w-40 rounded-[var(--dash-radius)] bg-white/10 p-4"><p className="text-3xl font-semibold tabular-nums">{handoff.completed.length}<span className="text-base text-[var(--role-primary-soft)]"> / {handoff.assigned.length + handoff.completed.length}</span></p><p className="mt-1 text-xs text-white/75">completed today</p></div>
        </div>
      </section>
      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Metric label="Completed today" value={handoff.completed.length} icon={CheckCircle2} tone="success" />
        <Metric label="In progress" value={state.chores.filter((task: Chore) => task.assignedTo === member.id && task.status === 'in_progress').length} icon={CircleDot} />
        <Metric label="Due today" value={outstanding.length} icon={CalendarDays} />
        <Metric label="Available to claim" value={state.chores.filter((task: Chore) => task.assignedTo === null && task.status === 'open').length} icon={ClipboardList} />
      </div>
      </>
    ),
    workload: warnings.length ? <WorkloadWarnings warnings={warnings} members={state.members} /> : null,
    priorities: (
          <Card className="p-0">
            <div className="flex items-start gap-3 border-b border-[#dfe5dc] px-5 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#f8e9dc] text-[#98552e]"><AlertTriangle className="size-5" aria-hidden="true" /></span><div><h2 className="font-bold">Priority briefing</h2><p className="text-sm text-[#687873]">Why these tasks should come first</p></div></div>
            {handoff.attention.length ? <div className="grid gap-3 p-4">{handoff.attention.map((task: Chore) => <HandoffTask key={task.id} task={task} member={member} reasons={attentionReasons(task, date)} setTask={setTask} busy={busy} runAction={runAction} />)}</div> : <EmptyHandoff icon={CheckCircle2} title="Nothing needs immediate attention" text="Urgent, overdue, and issue-flagged assignments will appear here." />}
          </Card>
    ),
    mytasks: (
          <Card className="p-0">
            <div className="flex items-start gap-3 border-b border-[#dfe5dc] px-5 py-4"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]"><CalendarDays className="size-5" aria-hidden="true" /></span><div><h2 className="font-bold">Today’s assignments</h2><p className="text-sm text-[#687873]">{handoff.assigned.length} open {handoff.assigned.length === 1 ? 'task' : 'tasks'} due today</p></div></div>
            {handoff.assigned.length ? <div className="grid gap-3 p-4">{handoff.assigned.map((task: Chore) => <HandoffTask key={task.id} task={task} member={member} reasons={[]} setTask={setTask} busy={busy} runAction={runAction} />)}</div> : <EmptyHandoff icon={CalendarDays} title="No assigned tasks due today" text="You’re caught up. Check Tasks if you want to claim available work." />}
          </Card>
    ),
    notes: (
          <Card>
            <h2 className="flex items-center gap-2 font-bold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Latest handoff notes</h2><p className="mt-1 text-sm text-[#687873]">Recent updates on your assigned work</p>
            {handoff.latestNotes.length ? <ol className="mt-4 space-y-3">{handoff.latestNotes.map(({ task, ...note }: any) => <li key={note.id}><button onClick={() => setTask(task)} className="w-full rounded-xl border border-[#dfe5dc] bg-white p-3 text-left transition hover:border-[#aac3b3] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#287b6f]"><span className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{task.title}</span><Badge>{note.kind}</Badge></span><span className="mt-2 line-clamp-3 block text-sm leading-5 text-[#52645f]">{note.body}</span><time className="mt-2 block text-xs text-[#687873]">{new Date(note.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time></button></li>)}</ol> : <EmptyHandoff icon={MessageSquareText} title="No handoff notes yet" text="Progress and issue notes from your assigned tasks will collect here." compact />}
          </Card>
    ),
    snapshot: (
          <Card>
            <h2 className="flex items-center gap-2 font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />Shift snapshot</h2><div className="mt-4 space-y-4">
              <ProgressRow label="Completed today" value={handoff.completed.length} icon={CheckCircle2} />
              <ProgressRow label="In progress" value={state.chores.filter((task: Chore) => task.assignedTo === member.id && task.status === 'in_progress').length} icon={CircleDot} />
              <ProgressRow label="Still due today" value={outstanding.length} icon={CalendarDays} />
            </div>
          </Card>
    ),
    handoffform: <div data-guide="handoffs-safety"><ShiftHandoffComposer mutate={mutate} busy={busy} /></div>,
    handofflog: <ShiftHandoffLog state={state} personal />,
    medsround: <MedicationRoundCard state={state} mutate={mutate} busy={busy} />,
    aboutme: <CareProfileCard state={state} compact setSection={setSection} />,
    appointments: <AppointmentsCard state={state} mutate={mutate} busy={busy} compact />,
    supplies: <SuppliesCard state={state} mutate={mutate} busy={busy} />,
    kudos: <KudosCard state={state} mutate={mutate} busy={busy} />,
    safetyform: <div data-guide="handoffs-safety"><SafetyReportForm mutate={mutate} busy={busy} /></div>,
    safetylog: <SafetyReportList state={state} />,
    schedule: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><CalendarDays className="size-5 text-[#287b6f]" aria-hidden="true" />Your shifts</h2>
        <p className="mt-1 text-sm text-[#687873]">Your two-week recurring schedule</p>
        <div className="mt-4 space-y-3">
          {([0, 1, 2] as const).map((week) => {
            const list = shiftsByWeek[week].sort((a, b) => a.weekday - b.weekday || a.startTime.localeCompare(b.startTime));
            return list.length ? (
              <div key={week}>
                <p className="text-xs font-bold uppercase tracking-wide text-[#687873]">{week === 0 ? 'Every week' : week === 1 ? 'Week A' : 'Week B'}</p>
                <ul className="mt-1.5 space-y-1.5">{list.map((shift) => <li key={shift.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#edf0eb] bg-white px-3 py-2 text-sm"><span className="font-semibold">{weekdayFull[shift.weekday]}</span><span className="tabular-nums text-[#687873]">{formatShift(shift)}</span></li>)}</ul>
              </div>
            ) : null;
          })}
          {!myShifts.length && <EmptyHandoff icon={CalendarDays} title="No shifts yet" text="Your manager sets your recurring schedule — update your availability to help them plan." compact />}
        </div>
        <div className="mt-4"><Button variant="outline" size="sm" onClick={() => setAvailWorker(member)}><Pencil className="size-4" />Edit my availability</Button></div>
      </Card>
    ),
    weektime: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Clock className="size-5 text-[#287b6f]" aria-hidden="true" />Your hours this week</h2>
        <p className="mt-1 text-sm text-[#687873]">Clocked time since Monday</p>
        <p className="mt-3 text-3xl font-semibold tabular-nums">{formatMinutes(weekMinutes)}</p>
        <p className="mt-1 text-sm text-[#687873]">{formatMinutes(todayMinutes)} clocked today</p>
      </Card>
    ),
    certs: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Shield className="size-5 text-[#287b6f]" aria-hidden="true" />Your certifications</h2>
        <p className="mt-1 text-sm text-[#687873]">Expiry status for your recorded certifications</p>
        {myCerts.length ? (
          <ul className="mt-4 space-y-2">{myCerts.map((cert: Certification) => {
            const status = certStatus(cert.expiresOn, date);
            const pill = status === 'expired' ? 'bg-[#f8e9dc] text-[#8b4e2c]' : status === 'expiring' ? 'bg-[#fcf0dc] text-[#8b5e1f]' : 'bg-[#e4f0e8] text-[#25654f]';
            return <li key={cert.id} className="flex items-center justify-between gap-2 rounded-lg border border-[#edf0eb] bg-white px-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate font-semibold">{cert.name}</span><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${pill}`}>{status === 'expired' ? `Expired ${Math.abs(certDaysLeft(cert.expiresOn, date))}d ago` : status === 'expiring' ? `${certDaysLeft(cert.expiresOn, date)}d left` : `Valid until ${dateLabel(cert.expiresOn)}`}</span></li>;
          })}</ul>
        ) : <EmptyHandoff icon={Shield} title="No certifications recorded" text="Your manager can record certifications in your profile." compact />}
      </Card>
    ),
    inboxpreview: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Inbox className="size-5 text-[#287b6f]" aria-hidden="true" />Latest inbox items</h2>
        <p className="mt-1 text-sm text-[#687873]">Newest direct messages and note updates for you</p>
        {(state.inbox ?? []).length ? (
          <>
            <ol className="mt-4 space-y-2">
              {(state.inbox ?? []).slice(0, 5).map((item: any) => {
                const sender = state.members.find((item2: Member) => item2.id === item.createdBy)?.name ?? 'Team member';
                return <li key={item.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3"><p className="line-clamp-2 text-sm leading-5">{item.body}</p><p className="mt-1 text-xs text-[#687873]">{sender} · {new Date(item.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p></li>;
              })}
            </ol>
            <div className="mt-4"><Button variant="outline" size="sm" onClick={() => setSection('messages')}>Open inbox</Button></div>
          </>
        ) : <EmptyHandoff icon={Inbox} title="Nothing new" text="Direct messages and note updates will appear here." compact />}
      </Card>
    ),
    quicklinks: (
      <Card>
        <h2 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="size-5 text-[#287b6f]" aria-hidden="true" />Quick links</h2>
        <p className="mt-1 text-sm text-[#687873]">Jump straight to what you need</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {([['tasks', 'Tasks', ClipboardList], ['schedule', 'Schedule', CalendarDays], ['client', 'Care plan', HandHeart], ['profile', 'My profile', User]] as const).map(([target, label, LinkIcon]) => (
            <Button key={target} type="button" variant="outline" size="sm" className="min-h-11 justify-start" onClick={() => setSection(target)}><LinkIcon className="size-4" aria-hidden="true" />{label}</Button>
          ))}
        </div>
      </Card>
    ),
  };
  return (
    <div data-guide="panel-today">
      <DashboardGrid audience="worker" items={dashboard.layout} appearance={dashboard.appearance} renderWidget={(id) => cells[id] ?? null} onSaveLayout={dashboard.saveLayout} onSaveAppearance={dashboard.saveAppearance} busy={busy} />
    </div>
  );
}

function CoverageCard({ state, member, mutate, busy }: any) {
  const [asking, setAsking] = useState(false);
  const [sending, setSending] = useState(false);
  const requests = state.scheduleRequests ?? [];
  const asksFromOthers = requests.filter((request: any) => request.status === 'open' && request.requesterId !== member.id);
  const myOpen = requests.find((request: any) => request.status === 'open' && request.requesterId === member.id);
  const myCovered = requests.filter((request: any) => request.status === 'covered' && request.requesterId === member.id).slice(0, 2);
  const covering = requests.filter((request: any) => request.status === 'covered' && request.acceptedBy === member.id && request.requestedDate >= today()).slice(0, 3);
  const memberFor = (id: string) => state.members.find((item: Member) => item.id === id);
  const teammateCount = state.members.filter((item: Member) => item.role === 'worker' && item.status === 'active' && item.id !== member.id).length;
  const askedCount = teammateCount + 1; // coworkers plus the manager
  return (
    <Card className="border-[#cfe3d8]">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e4f0e8] text-[#25654f]"><HeartHandshake className="size-5" aria-hidden="true" /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-bold">Shift cover</h2>
          <p className="text-sm text-[#687873]">Asks go to every teammate and stay up until someone says yes — first yes takes the shift.</p>
        </div>
      </div>
      {asksFromOthers.length > 0 && (
        <ul className="mt-4 space-y-3">
          {asksFromOthers.map((request: any) => {
            const asker = memberFor(request.requesterId);
            return (
              <li key={request.id} className="rounded-xl border border-[#d9c99d] bg-[#fffdf4] p-3">
                <div className="flex items-center gap-2.5">
                  {asker && <AvatarFor member={asker} className="size-8" />}
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{asker?.name.split(' ')[0] ?? 'A teammate'} could use a hand</p>
                    <p className="text-xs text-[#687873]">{dateLabel(request.requestedDate)} · {request.startTime}–{request.endTime}</p>
                  </div>
                </div>
                {request.reason && <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6f5422]">“{request.reason}”</p>}
                <Button type="button" size="sm" className="mt-3 min-h-11 w-full bg-[#287b6f]" disabled={busy} onClick={() => void mutate({ action: 'acceptScheduleCoverage', requestId: request.id }, `You said yes — ${dateLabel(request.requestedDate)} is your shift now. Thank you!`)}><Check className="size-4" aria-hidden="true" />I can take it</Button>
              </li>
            );
          })}
        </ul>
      )}
      {myOpen && (
        <div className="mt-4 rounded-xl border border-[#bcd4c9] bg-[#f2f7f1] p-3">
          <p className="text-sm font-semibold text-[#25654f]">Your ask is out · {dateLabel(myOpen.requestedDate)} {myOpen.startTime}–{myOpen.endTime}</p>
          <p className="mt-1 text-xs leading-5 text-[#466457]">{askedCount} teammate{askedCount === 1 ? '' : 's'} and your manager have it — it stays up until someone says yes.</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11 w-full" disabled={busy} onClick={() => void mutate({ action: 'nudgeCoverageRequest', requestId: myOpen.id }, 'Your teammates got another nudge.')}><Bell className="size-4" aria-hidden="true" />Nudge the team again</Button>
        </div>
      )}
      {myCovered.map((request: any) => (
        <p key={request.id} className="mt-3 flex items-start gap-2 rounded-xl bg-[#eef4ec] px-3 py-2.5 text-xs font-semibold text-[#25654f]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />{memberFor(request.acceptedBy)?.name.split(' ')[0] ?? 'A teammate'} said yes — your {dateLabel(request.requestedDate)} shift is covered.</p>
      ))}
      {covering.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {covering.map((request: any) => (
            <li key={request.id} className="flex items-center gap-2 rounded-lg border border-[#edf0eb] bg-white px-3 py-2 text-xs"><HeartHandshake className="size-3.5 shrink-0 text-[#287b6f]" aria-hidden="true" /><span className="font-semibold">You’re covering {memberFor(request.requesterId)?.name.split(' ')[0] ?? 'a teammate'}</span><span className="ml-auto tabular-nums text-[#687873]">{dateLabel(request.requestedDate)} · {request.startTime}–{request.endTime}</span></li>
          ))}
        </ul>
      )}
      {asking ? (
        <form className="mt-4 space-y-3 rounded-xl border border-[#e2e8e1] bg-[#fafbf7] p-3" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const data = new FormData(form); setSending(true); try { await mutate({ action: 'requestScheduleChange', date: data.get('date'), shiftId: data.get('shiftId'), reason: data.get('reason') }, 'Your teammates have been asked — this stays up until someone says yes.'); form.reset(); setAsking(false); } catch { /* live notice reports the error */ } finally { setSending(false); } }}>
          <label htmlFor="cover-date" className="block text-sm font-semibold">Shift date<Input id="cover-date" name="date" type="date" required className="mt-1 h-11 rounded-xl bg-white" /></label>
          <label htmlFor="cover-shift" className="block text-sm font-semibold">Which shift<select id="cover-shift" name="shiftId" required className={fieldClass}><option value="">Choose a shift</option>{(state.shifts ?? []).map((shift: Shift) => <option key={shift.id} value={shift.id}>{weekdayFull[shift.weekday]} · {formatShift(shift)}{shift.cycleWeek ? ` · week ${'AB'[shift.cycleWeek - 1]}` : ''}</option>)}</select></label>
          <label htmlFor="cover-reason" className="block text-sm font-semibold">A note for the team<textarea id="cover-reason" name="reason" required maxLength={500} rows={2} placeholder="Something came up — can anyone take it?" className={fieldClass} /></label>
          <div className="flex gap-2"><Button type="submit" disabled={sending || busy} className="min-h-11 flex-1 bg-[#287b6f]"><Send className="size-4" aria-hidden="true" />{sending ? 'Asking…' : 'Ask the team'}</Button><Button type="button" variant="outline" className="min-h-11" onClick={() => setAsking(false)}>Cancel</Button></div>
          <p className="text-[11px] leading-4 text-[#687873]">Your schedule will not change automatically — it updates the moment a teammate says yes, and your manager is notified.</p>
        </form>
      ) : (
        <Button type="button" variant="outline" className="mt-4 min-h-11 w-full" onClick={() => setAsking(true)}><HeartHandshake className="size-4" aria-hidden="true" />Need cover? Ask the team</Button>
      )}
    </Card>
  );
}

function HandoffTask({ task, member, reasons, setTask, busy, runAction }: any) {
  const AreaIcon = areaIcons.get(task.area) ?? Home;
  return <article className="rounded-2xl border border-[#dfe5dc] bg-white p-4 shadow-sm"><button onClick={() => setTask(task)} className="w-full text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#287b6f]" aria-label={`Open ${task.title}`}><span className="flex items-start gap-3"><span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#e8f1ec] text-[#287b6f]">{createElement(AreaIcon, { className: 'size-5', 'aria-hidden': true })}</span><span className="min-w-0 flex-1"><span className="flex flex-wrap items-start justify-between gap-2"><span className="font-semibold">{task.title}</span><StatusBadge status={task.status} /></span><span className="mt-1 block text-xs text-[#52645f]">{task.area} · {dateLabel(task.dueDate)}{task.dueTime ? ` at ${task.dueTime}` : ''}</span></span></span>{reasons.length > 0 && <span className="mt-3 flex flex-wrap gap-1.5">{reasons.map((reason: string) => <span key={reason} className="rounded-full bg-[#f8e9dc] px-2.5 py-1 text-xs font-semibold text-[#8b4e2c]">{reason}</span>)}</span>}{(task.issueReport || task.progressNotes || task.instructions) && <span className="mt-3 line-clamp-2 block text-sm leading-5 text-[#52645f]">{task.issueReport || task.progressNotes || task.instructions}</span>}</button><div className="mt-3 flex flex-wrap gap-2 border-t border-[#edf0eb] pt-3">{task.status === 'open' && task.assignedTo === member.id && <Button size="sm" disabled={busy} onClick={(event) => runAction(event, task, 'start')}><Play className="size-4" />Start task</Button>}{task.status === 'in_progress' && <Button size="sm" disabled={busy} onClick={(event) => runAction(event, task, 'complete')} className="bg-[#287b6f]"><Check className="size-4" />Mark complete</Button>}<Button size="sm" variant="outline" onClick={() => setTask(task)}><MessageSquareText className="size-4" />Add handoff note</Button></div></article>;
}

function WorkloadWarnings({ warnings, members, className = '' }: { warnings: Array<{ memberId: string; code: string; title: string; explanation: string }>; members: Member[]; className?: string }) {
  const nameFor = (id: string) => members.find((item) => item.id === id)?.name ?? 'Care worker';
  return (
    <Card className={`border-[#eadbc6] ${className}`}>
      <h2 className="flex items-center gap-2 text-lg font-bold"><AlertTriangle className="size-5 text-[#b4532a]" aria-hidden="true" />Workload signals</h2>
      <p className="text-sm text-[#687873]">Warnings derived from schedules and task load — a prompt to rebalance work, not a medical judgment</p>
      {warnings.length ? (
        <ul className="mt-4 space-y-2">
          {warnings.map((warning, index) => (
            <li key={`${warning.memberId}-${warning.code}-${index}`} className="rounded-xl border border-[#eadbc6] bg-[#fcf8f0] p-3">
              <p className="text-sm font-semibold">{warning.title} <span className="font-normal text-[#687873]">· {nameFor(warning.memberId)}</span></p>
              <p className="mt-1 text-xs leading-5 text-[#6d5a3f]">{warning.explanation}</p>
            </li>
          ))}
        </ul>
      ) : <EmptyHandoff icon={CheckCircle2} title="No workload signals" text="Schedules and task load are within the configured thresholds." compact />}
    </Card>
  );
}

function ShiftHandoffComposer({ mutate, busy }: any) {
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-bold"><MessageSquareText className="size-5 text-[#287b6f]" aria-hidden="true" />Share an end-of-shift handoff</h2>
      <p className="mt-1 text-sm leading-6 text-[#687873]">Summarize the shift so the next caregiver knows where things stand. Your manager can read every handoff; a worker who covers this shift date can read it too.</p>
      <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'recordShiftHandoff', ...Object.fromEntries(new FormData(form)) }, 'Shift handoff shared.').then(() => form.reset()).catch(() => {}); }}>
        <Field label="Shift date" name="shiftDate" type="date" defaultValue={today()} required />
        <TextArea label="Care completed" name="completedCare" required placeholder="What you finished during the shift" />
        <TextArea label="Outstanding tasks for the next shift" name="outstandingTasks" placeholder="Anything left to pick up" />
        <TextArea label="Observations or concerns" name="observations" placeholder="Changes in condition, mood, or the home" />
        <TextArea label="Handoff checklist — one item per line" name="checklist" placeholder={'Medication given\nMeals documented\nIssues flagged'} />
        <Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f]"><Send className="size-4" aria-hidden="true" />Share handoff</Button>
      </form>
    </Card>
  );
}

function ShiftHandoffLog({ state, personal = false }: any) {
  const handoffs = (state.shiftHandoffs ?? []).slice(0, 10);
  const nameFor = (id: string) => state.members.find((item: Member) => item.id === id)?.name ?? 'Care worker';
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-bold"><History className="size-5 text-[#287b6f]" aria-hidden="true" />End-of-shift handoffs</h2>
      <p className="mt-1 text-sm text-[#687873]">{personal ? 'Your handoffs, plus handoffs for shift dates you covered' : 'End-of-shift notes from the care team'}</p>
      {handoffs.length ? <ol className="mt-4 space-y-3">{handoffs.map((handoff: any) => (
        <li key={handoff.id} className="rounded-xl border border-[#e2e8e1] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold">{nameFor(handoff.authorId)} · {dateLabel(handoff.shiftDate)}</p>
            <time className="text-xs text-[#687873]">{new Date(handoff.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time>
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{handoff.completedCare}</p>
          {handoff.outstandingTasks ? <p className="mt-2 break-words text-sm leading-6 text-[#52645f]"><strong>Still to do:</strong> {handoff.outstandingTasks}</p> : null}
          {handoff.observations ? <p className="mt-2 break-words text-sm leading-6 text-[#52645f]"><strong>Observations:</strong> {handoff.observations}</p> : null}
          {handoff.checklist?.length ? <ul className="mt-2 space-y-1">{handoff.checklist.map((item: string, index: number) => <li key={index} className="flex items-start gap-2 break-words text-sm text-[#52645f]"><Check className="mt-0.5 size-4 shrink-0 text-[#287b6f]" aria-hidden="true" />{item}</li>)}</ul> : null}
        </li>
      ))}</ol> : <EmptyHandoff icon={History} title="No handoffs yet" text="End-of-shift notes shared by the care team will appear here." compact />}
    </Card>
  );
}

function SafetyReportForm({ mutate, busy }: any) {
  return (
    <Card className="border-[#e2b69f]">
      <h2 className="flex items-center gap-2 font-bold"><ShieldAlert className="size-5 text-[#8f3f25]" aria-hidden="true" />Report a safety concern</h2>
      <p className="mt-1 text-sm leading-6 text-[#687873]">Report hazards, injuries, threats, unsafe conditions, or near misses. Only you and the household manager can see your reports, and the manager reviews every one.</p>
      <form className="mt-4 grid gap-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'reportSafetyIncident', ...Object.fromEntries(new FormData(form)) }, 'Safety report sent to your manager.').then(() => form.reset()).catch(() => {}); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm font-semibold">Type of concern<select name="category" required className={fieldClass}>{Object.entries(incidentCategoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <label className="block text-sm font-semibold">Severity<select name="severity" required className={fieldClass}>{Object.entries(incidentSeverityLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="When it happened" name="occurredAt" type="datetime-local" required />
          <Field label="Where it happened" name="location" required />
        </div>
        <TextArea label="What happened" name="description" required />
        <TextArea label="Immediate action taken" name="immediateAction" placeholder="First aid given, area made safe, manager called…" />
        <Button type="submit" disabled={busy} className="min-h-11 bg-[#287b6f]"><ShieldAlert className="size-4" aria-hidden="true" />Submit safety report</Button>
      </form>
    </Card>
  );
}

function SafetyReportList({ state }: any) {
  const incidents = state.safetyIncidents ?? [];
  return (
    <Card>
      <h2 className="flex items-center gap-2 font-bold"><Shield className="size-5 text-[#287b6f]" aria-hidden="true" />Your safety reports</h2>
      <p className="mt-1 text-sm text-[#687873]">Private to you and the household manager</p>
      {incidents.length ? <ol className="mt-4 space-y-3">{incidents.slice(0, 10).map((incident: any) => (
        <li key={incident.id} className="rounded-xl border border-[#e2e8e1] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={incident.category} /><StatusBadge status={incident.severity} /><StatusBadge status={incident.status} /></div>
          <p className="mt-2 text-sm font-semibold">{incident.location} · {new Date(incident.occurredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[#52645f]">{incident.description}</p>
          {incident.followUp ? <p className="mt-2 break-words rounded-lg bg-[#f2f7f1] p-2.5 text-sm leading-6 text-[#4d6b5e]"><strong>Manager follow-up:</strong> {incident.followUp}</p> : null}
        </li>
      ))}</ol> : <EmptyHandoff icon={Shield} title="No safety reports" text="If something unsafe happens on shift, report it with the form above." compact />}
    </Card>
  );
}

function SafetyTriageCard({ state, mutate, busy }: any) {
  const incidents = state.safetyIncidents ?? [];
  const nameFor = (id: string | null) => state.members.find((item: Member) => item.id === id)?.name ?? 'Care team';
  const assignable = state.members.filter((item: Member) => item.status === 'active' && item.role !== 'viewer');
  const triage = (incidentId: string, status: 'reviewing' | 'resolved', form: HTMLFormElement | null) => {
    if (!form) return;
    void mutate({ action: 'triageSafetyIncident', incidentId, status, ...Object.fromEntries(new FormData(form)) }, status === 'resolved' ? 'Safety report resolved.' : 'Safety report moved to review.').catch(() => {});
  };
  return (
    <Card className="h-fit">
      <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldAlert className="size-5 text-[#8f3f25]" aria-hidden="true" />Safety reports</h2>
      <p className="text-sm text-[#687873]">Worker-submitted hazards, injuries, threats, and near misses — assign follow-up and resolve</p>
      {incidents.length ? <ol className="mt-4 space-y-3">{incidents.slice(0, 12).map((incident: any) => (
        <li key={incident.id} className="rounded-xl border border-[#e2e8e1] bg-white p-4">
          <div className="flex flex-wrap items-center gap-2"><StatusBadge status={incident.category} /><StatusBadge status={incident.severity} /><StatusBadge status={incident.status} /><span className="ml-auto text-xs text-[#687873]">{nameFor(incident.reporterId)} · {new Date(incident.occurredAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</span></div>
          <p className="mt-2 text-sm font-semibold">{incident.location}</p>
          <p className="mt-1 break-words text-sm leading-6 text-[#52645f]">{incident.description}</p>
          {incident.immediateAction ? <p className="mt-1 break-words text-sm leading-6 text-[#52645f]"><strong>Immediate action:</strong> {incident.immediateAction}</p> : null}
          {incident.status === 'resolved' ? (
            <p className="mt-2 break-words rounded-lg bg-[#f2f7f1] p-2.5 text-sm leading-6 text-[#4d6b5e]">Resolved {incident.resolvedAt ? new Date(incident.resolvedAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : ''}{incident.assignedTo ? ` · follow-up with ${nameFor(incident.assignedTo)}` : ''}{incident.followUp ? ` — ${incident.followUp}` : ''}</p>
          ) : (
            <form className="mt-3 grid gap-2 border-t border-[#edf0eb] pt-3" onSubmit={(e) => e.preventDefault()}>
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="block text-xs font-semibold">Follow-up owner<select name="assignedTo" defaultValue={incident.assignedTo ?? ''} className={`${fieldClass} min-h-10`}><option value="">Unassigned</option>{assignable.map((person: Member) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
                <label className="block text-xs font-semibold">Follow-up note<input name="followUp" defaultValue={incident.followUp} maxLength={2000} placeholder="What happens next" className={`${fieldClass} min-h-10`} /></label>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" disabled={busy} onClick={(e) => triage(incident.id, 'reviewing', e.currentTarget.form)}>Mark reviewing</Button>
                <Button type="button" size="sm" disabled={busy} onClick={(e) => triage(incident.id, 'resolved', e.currentTarget.form)} className="bg-[#287b6f]"><Check className="size-4" />Resolve</Button>
              </div>
            </form>
          )}
        </li>
      ))}</ol> : <EmptyHandoff icon={Shield} title="No safety reports" text="Worker safety reports will appear here for triage." compact />}
    </Card>
  );
}

// ---- Care plan: medication round, About me, appointments, shout-outs, supplies ----

/** The caregiver's local calendar date — dose times are local wall-clock times. */
function localToday() { const now = new Date(); return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10); }
function localTime() { return new Date().toTimeString().slice(0, 5); }
function timeLabel(value: string) { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }
const primaryButton = 'min-h-11 bg-[#287b6f]';

function CardHeading({ icon: Icon, title, text, tone = 'text-[#287b6f]', aside }: { icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' }>; title: string; text?: string; tone?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-bold"><Icon className={`size-5 ${tone}`} aria-hidden="true" />{title}</h2>{text && <p className="mt-1 text-sm text-[#687873]">{text}</p>}</div>
      {aside}
    </div>
  );
}

function MedicationRoundCard({ state, mutate, busy, readOnly = false }: any) {
  const [now, setNow] = useState(localTime);
  const [openSlot, setOpenSlot] = useState('');
  useEffect(() => { const timer = setInterval(() => setNow(localTime()), 60_000); return () => clearInterval(timer); }, []);
  const date = localToday();
  const round = medicationRound(state.medications ?? [], state.medicationLogs ?? [], date, now);
  const nameFor = (id: string) => state.members.find((item: Member) => item.id === id)?.name ?? 'Care team';
  const log = (payload: Record<string, unknown>, message: string) => mutate({ action: 'logMedicationDose', doseDate: date, ...payload }, message).then(() => setOpenSlot('')).catch(() => {});
  const summary = round.counts.total ? `${round.counts.given} of ${round.counts.total} scheduled doses given today` : 'No scheduled doses today';
  return (
    <Card>
      <CardHeading icon={Pill} title="Medication round" text={summary} aside={<div className="flex flex-wrap gap-1.5">{round.counts.overdue > 0 && <StatusBadge status="overdue" />}{round.counts.exceptions > 0 && <span className="status-badge inline-flex rounded-full bg-[#f8e4dc] px-2.5 py-0.5 text-xs font-semibold text-[#873d27]">{round.counts.exceptions} not given</span>}</div>} />
      {round.counts.total > 0 && <progress value={round.counts.given} max={round.counts.total} aria-label="Doses given today" className="mt-3 block h-2 w-full appearance-none overflow-hidden rounded-full bg-[#eef2ec] [&::-moz-progress-bar]:bg-[#287b6f] [&::-webkit-progress-bar]:bg-[#eef2ec] [&::-webkit-progress-value]:rounded-full [&::-webkit-progress-value]:bg-[#287b6f]" />}
      {round.slots.length === 0 && round.prnMedications.length === 0 ? (
        <EmptyHandoff icon={Pill} title="No medications on the round" text={readOnly ? 'The manager has not added any medications yet.' : 'The manager adds medications and dose times on the Care plan page.'} compact />
      ) : (
        <ol className="mt-4 space-y-2">
          {round.slots.map((slot) => {
            const key = `${slot.medication.id}-${slot.scheduledTime}`;
            return (
              <li key={key} className={`rounded-xl border p-3 ${slot.status === 'overdue' ? 'border-[#e2b69f] bg-[#fff8f4]' : slot.status === 'given' ? 'border-[#cbdccf] bg-[#f5faf5]' : 'border-[#e2e8e1] bg-white'}`}>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-12 shrink-0 text-sm font-bold tabular-nums">{slot.scheduledTime}</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{slot.medication.name}{slot.medication.dose ? <span className="font-normal text-[#687873]"> · {slot.medication.dose}</span> : null}</p>{slot.medication.instructions && <p className="truncate text-xs text-[#687873]">{slot.medication.instructions}</p>}</div>
                  <StatusBadge status={slot.status} />
                  {!readOnly && !slot.log && (
                    <div className="flex gap-1.5">
                      <Button type="button" size="sm" disabled={busy} className="bg-[#287b6f]" onClick={() => log({ medicationId: slot.medication.id, scheduledTime: slot.scheduledTime, outcome: 'given' }, `${slot.medication.name} logged as given.`)}><Check className="size-4" aria-hidden="true" />Given</Button>
                      <Button type="button" size="sm" variant="outline" disabled={busy} aria-expanded={openSlot === key} onClick={() => setOpenSlot(openSlot === key ? '' : key)}>Not given</Button>
                    </div>
                  )}
                </div>
                {slot.log && <p className="mt-1.5 pl-15 text-xs text-[#687873]">{nameFor(slot.log.loggedBy)} · {new Date(slot.log.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}{slot.log.note ? ` — ${slot.log.note}` : ''}</p>}
                {openSlot === key && !slot.log && (
                  <form className="mt-3 grid gap-2 border-t border-[#edf0eb] pt-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); log({ medicationId: slot.medication.id, scheduledTime: slot.scheduledTime, ...Object.fromEntries(new FormData(e.currentTarget)) }, `${slot.medication.name} exception logged. Your manager has been notified.`); }}>
                    <label className="block text-xs font-semibold">What happened<select name="outcome" className={`${fieldClass} min-h-10`}>{(['refused', 'missed', 'held'] as const).map((outcome) => <option key={outcome} value={outcome}>{doseOutcomeLabels[outcome]}</option>)}</select></label>
                    <label className="block text-xs font-semibold">Reason (required)<input name="note" required maxLength={500} placeholder="e.g. Asleep, felt nauseous, doctor advised" className={`${fieldClass} min-h-10`} /></label>
                    <Button type="submit" size="sm" disabled={busy} className="min-h-10 bg-[#287b6f]">Save</Button>
                  </form>
                )}
              </li>
            );
          })}
          {round.prnMedications.map((medication) => {
            const given = round.prnLogs.filter((entry) => entry.medicationId === medication.id);
            const key = `prn-${medication.id}`;
            return (
              <li key={key} className="rounded-xl border border-dashed border-[#d7dfd7] bg-[#fbfcf9] p-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="w-12 shrink-0 text-xs font-bold uppercase text-[#687873]">As needed</span>
                  <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{medication.name}{medication.dose ? <span className="font-normal text-[#687873]"> · {medication.dose}</span> : null}</p><p className="truncate text-xs text-[#687873]">{medication.instructions || 'As-needed medication'}{given.length ? ` · ${given.length} logged today` : ''}</p></div>
                  {!readOnly && <Button type="button" size="sm" variant="outline" disabled={busy} aria-expanded={openSlot === key} onClick={() => setOpenSlot(openSlot === key ? '' : key)}><Plus className="size-4" aria-hidden="true" />Log dose</Button>}
                </div>
                {given.length > 0 && <ul className="mt-1.5 space-y-0.5 pl-15">{given.map((entry) => <li key={entry.id} className="text-xs text-[#687873]">{new Date(entry.loggedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })} · {entry.outcome} by {nameFor(entry.loggedBy)} — {entry.note}</li>)}</ul>}
                {openSlot === key && (
                  <form className="mt-3 grid gap-2 border-t border-[#edf0eb] pt-3 sm:grid-cols-[8rem_1fr_auto] sm:items-end" onSubmit={(e) => { e.preventDefault(); log({ medicationId: medication.id, ...Object.fromEntries(new FormData(e.currentTarget)) }, `${medication.name} dose logged.`); }}>
                    <label className="block text-xs font-semibold">Outcome<select name="outcome" className={`${fieldClass} min-h-10`}><option value="given">Given</option><option value="refused">Refused</option></select></label>
                    <label className="block text-xs font-semibold">Reason (required)<input name="note" required maxLength={500} placeholder="e.g. Headache, knee pain" className={`${fieldClass} min-h-10`} /></label>
                    <Button type="submit" size="sm" disabled={busy} className="min-h-10 bg-[#287b6f]">Save</Button>
                  </form>
                )}
              </li>
            );
          })}
        </ol>
      )}
      {!readOnly && round.counts.total > 0 && <p className="mt-3 text-xs text-[#687873]">Logging a refused, missed, or held dose notifies the manager. Follow the care plan and call for clinical help if something is wrong.</p>}
    </Card>
  );
}

function MedicationForm({ medication, busy, onSubmit, onCancel }: any) {
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.currentTarget)), e.currentTarget); }}>
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Medication" name="name" defaultValue={medication?.name} required /><Field label="Dose" name="dose" defaultValue={medication?.dose} /></div>
      <Field label="Dose times (24-hour, comma separated)" name="times" defaultValue={medication?.times?.join(', ')} />
      <TextArea label="Instructions" name="instructions" defaultValue={medication?.instructions} placeholder="With food, crush, check blood sugar first…" />
      <label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="prn" defaultChecked={medication?.prn} className="size-4 accent-[#287b6f]" />As needed (PRN) — no fixed schedule</label>
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} className={primaryButton}><Check className="size-4" aria-hidden="true" />{medication ? 'Save changes' : 'Add medication'}</Button>{onCancel && <Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>Cancel</Button>}</div>
    </form>
  );
}

function MedicationManager({ state, mutate, busy }: any) {
  const [editing, setEditing] = useState('');
  const [adding, setAdding] = useState(false);
  const medications = (state.medications ?? []).filter((item: any) => item.active);
  const since = addDaysISO(localToday(), -7);
  const exceptions = (state.medicationLogs ?? []).filter((log: any) => log.outcome !== 'given' && log.doseDate >= since);
  const medName = (id: string) => (state.medications ?? []).find((item: any) => item.id === id)?.name ?? 'Medication';
  const nameFor = (id: string) => state.members.find((item: Member) => item.id === id)?.name ?? 'Care team';
  const save = (values: Record<string, unknown>, medicationId?: string) => mutate({ action: 'saveMedication', medicationId, prn: false, ...values }, medicationId ? 'Medication updated.' : 'Medication added to the round.').then(() => { setEditing(''); setAdding(false); }).catch(() => {});
  return (
    <Card>
      <CardHeading icon={Pill} title="Medication list" text="The round workers see each shift. Changes apply from the next dose." aside={!adding && <Button type="button" onClick={() => setAdding(true)} className={primaryButton}><Plus className="size-4" aria-hidden="true" />Add medication</Button>} />
      {adding && <div className="mt-4 rounded-2xl border border-[#bcd4c9] bg-[#f5faf5] p-4"><MedicationForm busy={busy} onSubmit={(values: Record<string, unknown>) => save(values)} onCancel={() => setAdding(false)} /></div>}
      {medications.length ? <ul className="mt-4 space-y-2">{medications.map((medication: any) => (
        <li key={medication.id} className="rounded-xl border border-[#e2e8e1] bg-white p-3">
          {editing === medication.id ? <MedicationForm medication={medication} busy={busy} onSubmit={(values: Record<string, unknown>) => save(values, medication.id)} onCancel={() => setEditing('')} /> : (
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{medication.name}{medication.dose ? <span className="font-normal text-[#687873]"> · {medication.dose}</span> : null}</p><p className="text-xs text-[#687873]">{medication.prn ? 'As needed' : medication.times.join(' · ')}{medication.instructions ? ` — ${medication.instructions}` : ''}</p></div>
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(medication.id)}><Pencil className="size-4" aria-hidden="true" />Edit</Button>
              <Button type="button" size="sm" variant="outline" disabled={busy} className="border-[#d7a995] text-[#873d27]" onClick={() => { if (window.confirm(`Remove ${medication.name} from the medication round? Past logs are kept.`)) mutate({ action: 'archiveMedication', medicationId: medication.id }, `${medication.name} removed from the round.`).catch(() => {}); }}><Trash2 className="size-4" aria-hidden="true" />Remove</Button>
            </div>
          )}
        </li>
      ))}</ul> : !adding && <EmptyHandoff icon={Pill} title="No medications yet" text="Add each medication with its dose times so workers can log every dose." compact />}
      <div className="mt-5 border-t border-[#e5eae4] pt-4">
        <h3 className="flex items-center gap-2 text-sm font-bold"><AlertTriangle className="size-4 text-[#8f3f25]" aria-hidden="true" />Doses not given — last 7 days</h3>
        {exceptions.length ? <ul className="mt-2 space-y-1.5">{exceptions.slice(0, 12).map((log: any) => <li key={log.id} className="flex flex-wrap items-center gap-2 text-sm"><StatusBadge status={log.outcome} /><span className="font-semibold">{medName(log.medicationId)}</span><span className="text-[#687873]">{dateLabel(log.doseDate)}{log.scheduledTime ? ` ${log.scheduledTime}` : ' (as needed)'} · {nameFor(log.loggedBy)} — {log.note}</span></li>)}</ul> : <p className="mt-2 text-sm text-[#687873]">Every logged dose was given. Repeated refusals or misses will show here.</p>}
      </div>
    </Card>
  );
}

function CareProfileCard({ state, mutate, busy, compact = false, setSection }: any) {
  const [editing, setEditing] = useState(false);
  const isManager = state.viewer.role === 'manager';
  const profile = state.careProfile ?? {};
  const completeness = careProfileCompleteness(profile);
  const filled = CARE_PROFILE_FIELDS.filter((field) => field.key !== 'preferredName' && (profile[field.key] ?? '').trim());
  const shown = compact ? filled.filter((field) => ['importantToKnow', 'howToSupport', 'communication'].includes(field.key)) : filled;
  const title = profile.preferredName ? `About ${profile.preferredName}` : 'About the person';
  if (editing) return (
    <Card>
      <CardHeading icon={HandHeart} title="Edit the About me profile" text="Write it in their voice where you can. Everyone on the care team and family viewers can read it." />
      <form className="mt-4 grid gap-3 md:grid-cols-2" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'saveCareProfile', ...Object.fromEntries(new FormData(e.currentTarget)) }, 'About me profile saved.').then(() => setEditing(false)).catch(() => {}); }}>
        {CARE_PROFILE_FIELDS.map((field) => field.key === 'preferredName'
          ? <Field key={field.key} label={field.label} name={field.key} defaultValue={profile[field.key]} />
          : <label key={field.key} className="block text-sm font-semibold">{field.label}<textarea name={field.key} defaultValue={profile[field.key] ?? ''} maxLength={field.max} rows={3} placeholder={field.hint} className={fieldClass} /></label>)}
        <div className="flex flex-wrap gap-2 md:col-span-2"><Button type="submit" disabled={busy} className={primaryButton}><Check className="size-4" aria-hidden="true" />Save profile</Button><Button type="button" variant="outline" className="min-h-11" onClick={() => setEditing(false)}>Cancel</Button></div>
      </form>
    </Card>
  );
  return (
    <Card>
      <CardHeading icon={HandHeart} title={title} text={compact ? 'The essentials for today’s shift' : 'A one-page profile so every caregiver — including new and substitute staff — supports them the way they want.'} aside={isManager && !compact ? <div className="flex items-center gap-3"><span className="text-xs text-[#687873]">{completeness.filled} of {completeness.total} sections filled</span><Button type="button" onClick={() => setEditing(true)} className={primaryButton}><Pencil className="size-4" aria-hidden="true" />{completeness.filled ? 'Edit profile' : 'Create profile'}</Button></div> : undefined} />
      {shown.length ? (
        <dl className={`mt-4 grid gap-3 ${compact ? '' : 'md:grid-cols-2'}`}>
          {shown.map((field) => (
            <div key={field.key} className={`rounded-xl border p-3 ${field.key === 'importantToKnow' ? 'border-[#e2b69f] bg-[#fff8f4]' : 'border-[#e2e8e1] bg-white'}`}>
              <dt className={`text-xs font-bold uppercase tracking-wide ${field.key === 'importantToKnow' ? 'text-[#8f3f25]' : 'text-[#287b6f]'}`}>{field.label}</dt>
              <dd className={`mt-1 whitespace-pre-wrap break-words text-sm leading-6 ${compact ? 'line-clamp-3' : ''}`}>{profile[field.key]}</dd>
            </div>
          ))}
        </dl>
      ) : <EmptyHandoff icon={HandHeart} title="No profile yet" text={isManager ? 'Create a one-page profile: what matters to them, how to support them, and key contacts.' : 'The manager has not written the profile yet.'} compact />}
      {compact && setSection && filled.length > 0 && <Button type="button" variant="outline" size="sm" className="mt-3 min-h-10" onClick={() => setSection('client')}>Read the full profile<ChevronRight className="size-4" aria-hidden="true" /></Button>}
      {!compact && profile.updatedAt && <p className="mt-3 text-xs text-[#687873]">Last updated {timeLabel(profile.updatedAt)}</p>}
    </Card>
  );
}

function AppointmentForm({ state, busy, onSubmit, onCancel }: any) {
  const workers = state.members.filter((item: Member) => item.role === 'worker' && item.status === 'active');
  return (
    <form className="grid gap-3" onSubmit={(e) => { e.preventDefault(); onSubmit(Object.fromEntries(new FormData(e.currentTarget))); }}>
      <Field label="What is it for?" name="title" required />
      <div className="grid gap-3 sm:grid-cols-2"><Field label="Date" name="date" type="date" defaultValue={localToday()} required /><Field label="Time" name="time" type="time" /></div>
      <Field label="Location" name="location" />
      <label className="block text-sm font-semibold">Care worker going along<select name="accompanyingId" className={fieldClass}><option value="">No one assigned yet</option>{workers.map((worker: Member) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}</select></label>
      <TextArea label="Notes" name="notes" placeholder="What to bring, questions to ask, transport…" />
      <div className="flex flex-wrap gap-2"><Button type="submit" disabled={busy} className={primaryButton}><CalendarDays className="size-4" aria-hidden="true" />Schedule appointment</Button><Button type="button" variant="outline" className="min-h-11" onClick={onCancel}>Cancel</Button></div>
    </form>
  );
}

function AppointmentsCard({ state, mutate, busy, compact = false }: any) {
  const [adding, setAdding] = useState(false);
  const [closing, setClosing] = useState('');
  const role = state.viewer.role;
  const memberId = state.viewer.id;
  const upcoming = upcomingAppointments(state.appointments ?? [], localToday(), compact ? 14 : 60);
  const recent = (state.appointments ?? []).filter((item: any) => item.status === 'done').sort((a: any, b: any) => b.date.localeCompare(a.date)).slice(0, 4);
  const person = (id: string | null) => (id ? state.members.find((item: Member) => item.id === id) : null);
  const shown = compact ? upcoming.slice(0, 3) : upcoming;
  return (
    <Card>
      <CardHeading icon={Stethoscope} title="Upcoming appointments" text={upcoming.length ? `${upcoming.length} in the next ${compact ? 'two weeks' : '60 days'}` : 'Nothing scheduled'} aside={role === 'manager' && !compact && !adding ? <Button type="button" onClick={() => setAdding(true)} className={primaryButton}><Plus className="size-4" aria-hidden="true" />Schedule</Button> : undefined} />
      {adding && <div className="mt-4 rounded-2xl border border-[#bcd4c9] bg-[#f5faf5] p-4"><AppointmentForm state={state} busy={busy} onCancel={() => setAdding(false)} onSubmit={(values: Record<string, unknown>) => mutate({ action: 'saveAppointment', ...values }, 'Appointment scheduled.').then(() => setAdding(false)).catch(() => {})} /></div>}
      {shown.length ? <ol className="mt-4 space-y-2">{shown.map((appointment: any) => {
        const companion = person(appointment.accompanyingId);
        const canClose = canCompleteAppointment(role, memberId, appointment);
        const mine = appointment.accompanyingId === memberId;
        return (
          <li key={appointment.id} className={`rounded-xl border p-3 ${mine ? 'border-[#bcd4c9] bg-[#f2f7f1]' : 'border-[#e2e8e1] bg-white'}`}>
            <div className="flex items-start gap-3">
              <div className="grid w-12 shrink-0 place-items-center rounded-lg bg-[#e8f1ec] py-1.5 text-center text-[#287b6f]"><span className="text-[10px] font-bold uppercase leading-none">{new Date(`${appointment.date}T12:00:00`).toLocaleDateString(undefined, { month: 'short' })}</span><span className="text-lg font-bold leading-tight">{appointment.date.slice(8)}</span></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{appointment.title}</p>
                <p className="text-xs text-[#687873]">{new Date(`${appointment.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long' })}{appointment.time ? ` · ${appointment.time}` : ''}</p>
                {appointment.location && <p className="mt-0.5 flex items-center gap-1 text-xs text-[#52645f]"><MapPin className="size-3.5 shrink-0" aria-hidden="true" />{appointment.location}</p>}
                <p className="mt-0.5 text-xs text-[#52645f]">{companion ? `${mine ? 'You are' : `${companion.name} is`} going along` : 'No care worker assigned yet'}</p>
                {!compact && appointment.notes && <p className="mt-1 break-words text-xs leading-5 text-[#52645f]">{appointment.notes}</p>}
              </div>
            </div>
            {(canClose || role === 'manager') && closing !== appointment.id && (
              <div className="mt-2 flex flex-wrap gap-1.5 pl-15">
                {canClose && <Button type="button" size="sm" variant="outline" onClick={() => setClosing(appointment.id)}><Check className="size-4" aria-hidden="true" />Mark done</Button>}
                {role === 'manager' && <Button type="button" size="sm" variant="outline" disabled={busy} className="border-[#d7a995] text-[#873d27]" onClick={() => { if (window.confirm(`Cancel ${appointment.title}?`)) mutate({ action: 'cancelAppointment', appointmentId: appointment.id }, 'Appointment cancelled.').catch(() => {}); }}><X className="size-4" aria-hidden="true" />Cancel</Button>}
              </div>
            )}
            {closing === appointment.id && (
              <form className="mt-3 grid gap-2 border-t border-[#edf0eb] pt-3" onSubmit={(e) => { e.preventDefault(); mutate({ action: 'completeAppointment', appointmentId: appointment.id, ...Object.fromEntries(new FormData(e.currentTarget)) }, 'Appointment marked done.').then(() => setClosing('')).catch(() => {}); }}>
                <label className="block text-xs font-semibold">How did it go? (optional)<textarea name="outcome" rows={2} maxLength={1000} placeholder="Follow-ups, prescription changes, next visit…" className={fieldClass} /></label>
                <div className="flex gap-2"><Button type="submit" size="sm" disabled={busy} className="bg-[#287b6f]">Save</Button><Button type="button" size="sm" variant="outline" onClick={() => setClosing('')}>Back</Button></div>
              </form>
            )}
          </li>
        );
      })}</ol> : !adding && <EmptyHandoff icon={CalendarDays} title="No upcoming appointments" text={role === 'manager' ? 'Schedule medical and personal appointments so the right person goes along.' : 'Appointments the manager schedules will appear here.'} compact />}
      {!compact && recent.length > 0 && (
        <div className="mt-5 border-t border-[#e5eae4] pt-4">
          <h3 className="text-sm font-bold">Recently completed</h3>
          <ul className="mt-2 space-y-1.5">{recent.map((appointment: any) => <li key={appointment.id} className="text-sm"><span className="font-semibold">{appointment.title}</span><span className="text-[#687873]"> · {dateLabel(appointment.date)}{appointment.outcome ? ` — ${appointment.outcome}` : ''}</span></li>)}</ul>
        </div>
      )}
    </Card>
  );
}

function KudosCard({ state, mutate, busy }: any) {
  const me = state.viewer.id;
  const kudos = state.kudos ?? [];
  const teammates = state.members.filter((item: Member) => item.id !== me && item.status === 'active' && (item.role === 'worker' || item.role === 'manager'));
  const counts = kudosCounts(kudos, addDaysISO(localToday(), -30));
  const mine = counts.get(me) ?? 0;
  const nameFor = (id: string) => state.members.find((item: Member) => item.id === id)?.name ?? 'Former teammate';
  return (
    <Card>
      <CardHeading icon={Award} title="Team shout-outs" text={mine ? `You received ${mine} shout-out${mine === 1 ? '' : 's'} in the last 30 days` : 'Recognize a teammate for great care'} tone="text-[#9a6a24]" />
      <form className="mt-4 grid gap-2 rounded-2xl border border-[#e6d2a8] bg-[#fbf8f2] p-3" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'sendKudos', ...Object.fromEntries(new FormData(form)) }, 'Shout-out sent!').then(() => form.reset()).catch(() => {}); }}>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="block text-xs font-semibold">Teammate<select name="recipientId" required className={`${fieldClass} min-h-10`}><option value="">Choose…</option>{teammates.map((person: Member) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
          <label className="block text-xs font-semibold">For<select name="badge" required className={`${fieldClass} min-h-10`}>{Object.entries(KUDOS_BADGES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        </div>
        <div className="flex gap-2"><Input name="message" maxLength={280} placeholder="Say thanks (optional)" aria-label="Shout-out message" className="min-h-10 flex-1 bg-white" /><Button type="submit" disabled={busy || teammates.length === 0} className="min-h-10 bg-[#9a6a24] hover:bg-[#7f5720]"><Send className="size-4" aria-hidden="true" />Send</Button></div>
      </form>
      {kudos.length ? <ol className="mt-4 space-y-2">{kudos.slice(0, 6).map((item: any) => (
        <li key={item.id} className={`rounded-xl border p-3 ${item.recipientId === me ? 'border-[#e6d2a8] bg-[#fdf9f0]' : 'border-[#e2e8e1] bg-white'}`}>
          <div className="flex flex-wrap items-center gap-2"><span className="inline-flex items-center gap-1 rounded-full bg-[#f6efdf] px-2.5 py-0.5 text-xs font-semibold text-[#7f5720]"><Award className="size-3.5" aria-hidden="true" />{KUDOS_BADGES[item.badge as keyof typeof KUDOS_BADGES] ?? 'Shout-out'}</span><span className="text-sm font-semibold">{item.recipientId === me ? 'You' : nameFor(item.recipientId)}</span><span className="ml-auto text-xs text-[#687873]">from {item.senderId === me ? 'you' : nameFor(item.senderId)} · {dateLabel(item.createdAt.slice(0, 10))}</span></div>
          {item.message && <p className="mt-1.5 break-words text-sm leading-6 text-[#52645f]">“{item.message}”</p>}
        </li>
      ))}</ol> : <EmptyHandoff icon={Award} title="No shout-outs yet" text="Be the first to thank a teammate — recognition helps great caregivers stay." compact />}
    </Card>
  );
}

function SuppliesCard({ state, mutate, busy, readOnly = false }: any) {
  const list = supplyList(state.supplies ?? [], new Date().toISOString());
  const nameFor = (id: string | null) => state.members.find((item: Member) => item.id === id)?.name ?? 'Care team';
  const urgencyClass: Record<string, string> = { out: 'bg-[#f8e4dc] text-[#873d27]', soon: 'bg-[#fcf4e9] text-[#9e6b2e]', normal: 'bg-[#eef2ec] text-[#52645f]' };
  return (
    <Card>
      <CardHeading icon={ShoppingCart} title="Supplies list" text={list.needed.length ? `${list.needed.length} item${list.needed.length === 1 ? '' : 's'} needed` : 'Nothing needed right now'} />
      {!readOnly && (
        <form className="mt-4 grid gap-2 sm:grid-cols-[1fr_7rem_8.5rem_auto]" onSubmit={(e) => { e.preventDefault(); const form = e.currentTarget; mutate({ action: 'addSupplyItem', ...Object.fromEntries(new FormData(form)) }, 'Added to the supplies list.').then(() => form.reset()).catch(() => {}); }}>
          <Input name="name" required maxLength={120} placeholder="What’s running low?" aria-label="Item" className="min-h-10 bg-white" />
          <Input name="quantity" maxLength={60} placeholder="Qty" aria-label="Quantity" className="min-h-10 bg-white" />
          <select name="urgency" defaultValue="soon" aria-label="How urgent" className="field-control min-h-10 rounded-xl border border-[#d7dfd7] bg-white px-2 text-sm">{Object.entries(supplyUrgencyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          <Button type="submit" disabled={busy} className="min-h-10 bg-[#287b6f]"><Plus className="size-4" aria-hidden="true" />Add</Button>
        </form>
      )}
      {list.needed.length ? <ul className="mt-4 space-y-2">{list.needed.map((item: any) => (
        <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-[#e2e8e1] bg-white p-3">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${urgencyClass[item.urgency]}`}>{supplyUrgencyLabels[item.urgency as keyof typeof supplyUrgencyLabels]}</span>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{item.name}{item.quantity ? <span className="font-normal text-[#687873]"> · {item.quantity}</span> : null}</p><p className="text-xs text-[#687873]">Added by {nameFor(item.addedBy)}</p></div>
          {!readOnly && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => mutate({ action: 'markSupplyPurchased', itemId: item.id }, `${item.name} marked as bought.`).catch(() => {})}><Check className="size-4" aria-hidden="true" />Bought</Button>}
        </li>
      ))}</ul> : <EmptyHandoff icon={ShoppingCart} title="All stocked up" text={readOnly ? 'The care team adds items here when supplies run low.' : 'Add gloves, wipes, groceries, or anything else that is running low.'} compact />}
      {list.recentlyBought.length > 0 && <p className="mt-3 text-xs text-[#687873]">Recently bought: {list.recentlyBought.slice(0, 5).map((item: any) => `${item.name} (${nameFor(item.purchasedBy)})`).join(' · ')}</p>}
    </Card>
  );
}

function CarePlanView({ state, mutate, busy, uploadClientNote, setSection }: any) {
  const role = state.viewer.role;
  const readOnly = role === 'viewer';
  return (
    <div data-guide="panel-client">
      <Title title="Care plan" text={role === 'manager' ? 'The person at the centre of care: their profile, medications, appointments, supplies, and approved notes.' : readOnly ? 'A read-only view of the profile, today’s medication round, appointments, and supplies.' : 'Who you are caring for, today’s medication round, upcoming appointments, and supplies.'} />
      <div className="grid gap-6">
        <CareProfileCard state={state} mutate={mutate} busy={busy} setSection={setSection} />
        <div className="grid gap-6 xl:grid-cols-2">
          <MedicationRoundCard state={state} mutate={mutate} busy={busy} readOnly={readOnly} />
          <AppointmentsCard state={state} mutate={mutate} busy={busy} />
        </div>
        {role === 'manager' && <MedicationManager state={state} mutate={mutate} busy={busy} />}
        <SuppliesCard state={state} mutate={mutate} busy={busy} readOnly={readOnly} />
        {!readOnly && <section aria-labelledby="client-notes-heading"><h2 id="client-notes-heading" className="mb-3 mt-2 flex items-center gap-2 text-xl font-semibold"><FileText className="size-5 text-[#287b6f]" aria-hidden="true" />Client notes</h2><ClientRecordView state={state} mutate={mutate} uploadClientNote={uploadClientNote} busy={busy} embedded /></section>}
      </div>
    </div>
  );
}

function AnnouncementBanner({ items }: { items: Array<{ id: string; detail: string; createdAt: string }> }) {
  if (!items.length) return null;
  return (
    <Card className="border-[#bcd4c9] bg-[#eef4ec]">
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

function RoleBadge({ role }: { role: 'manager' | 'viewer' | 'worker' }) {
  const labels = { manager: 'Manager', viewer: 'Family viewer', worker: 'Caregiver' };
  return <span className={`role-badge role-badge-${role}`}>{labels[role]}</span>;
}
function Title({ title, text, action }: { title: string; text: string; action?: React.ReactNode }) {
  const role = useRole();
  const eyebrow = role === 'manager' ? 'Household command center' : role === 'worker' ? 'Your shift dashboard' : 'Household overview';
  return <div className="welcome-banner mb-6 flex flex-wrap items-end justify-between gap-5"><div className="min-w-0 flex-1 basis-64"><p className="mb-3 text-xs font-semibold uppercase tracking-[.16em] text-[#287b6f]">{eyebrow}</p><h1 className="welcome-title break-words text-3xl font-semibold tracking-tight">{title}</h1><p className="mt-3 max-w-xl text-sm leading-6 text-[#52645f]">{text}</p></div>{action && <div className="shrink-0 [&_button]:min-h-11">{action}</div>}</div>;
}
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
          <input type="hidden" name="smsOptIn" value="off" /><label htmlFor="sms-opt-in" className="flex items-start gap-3 rounded-xl border border-[#d7dfd7] bg-white p-3 text-sm"><input id="sms-opt-in" aria-label="Opt in to SMS schedule alerts" type="checkbox" name="smsOptIn" defaultChecked={profile.smsOptIn} className="mt-1 size-4" /><span><strong className="block">SMS schedule alerts</strong><span className="text-[#687873]">I consent to receive CareBoard coverage texts at the E.164 phone number above. Message rates may apply.</span></span></label>
          <TextArea label="Availability notes" name="availability" defaultValue={profile.availability} />
          <TextArea label="Languages" name="languages" defaultValue={profile.languages} />
          {manager && <><Field label="Hourly pay rate ($)" name="hourlyRate" type="number" step="any" defaultValue={profile.hourlyRate ?? ''} /><Field label="Job title" name="jobTitle" defaultValue={profile.jobTitle} /><Field label="Employment start date" name="employmentStartedOn" type="date" defaultValue={profile.employmentStartedOn ?? ''} /><Field label="Date of birth" name="dateOfBirth" type="date" defaultValue={profile.dateOfBirth ?? ''} /><TextArea label="Home address" name="address" defaultValue={profile.address} /><TextArea label="Skills notes" name="skillsNotes" defaultValue={profile.skillsNotes} /><TextArea label="Certifications" name="certifications" defaultValue={profile.certifications} /><Field label="Emergency contact" name="emergencyContact" defaultValue={profile.emergencyContact} /></>}
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
        if (result?.inviteToken) onInvited(result.inviteToken, result?.inviteEmail === 'sent');
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
              <p className="text-xs leading-5 text-[#687873]">If email is set up, we send the invite straight to their inbox — you’ll also get a copyable link as a backup. It expires in 7 days and they pick their own password.</p>
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

function InviteLinkDialog({ url, emailed, onClose }: any) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); } catch { /* select the field instead */ }
  }
  return (
    <Dialog open={Boolean(url)} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{emailed ? 'Invite emailed' : 'Invite link ready'}</DialogTitle>
          <DialogDescription>{emailed ? 'We emailed this link to them — they have 7 days to accept. You can also copy it to share another way.' : 'Email isn’t configured, so no message was sent. Share this link with the care worker — by text, email, or in person. It expires in 7 days.'}</DialogDescription>
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
  const biweekly = action === 'setShifts';
  const [rows, setRows] = useState(() => (biweekly ? [1, 2] : [0]).flatMap((cycleWeek) => weekdayFull.map((_, weekday) => {
    const win = windows.find((item: any) => item.weekday === weekday && ((item.cycleWeek ?? 0) === 0 || item.cycleWeek === cycleWeek));
    return { weekday, cycleWeek, on: Boolean(win), startTime: win?.startTime ?? '09:00', endTime: win?.endTime ?? '17:00' };
  })));
  function update(weekday: number, cycleWeek: number, patch: Record<string, unknown>) {
    setRows((current) => current.map((row) => (row.weekday === weekday && row.cycleWeek === cycleWeek ? { ...row, ...patch } : row)));
  }
  async function save() {
    const key = action === 'setShifts' ? 'shifts' : 'windows';
    const on = rows.filter((row) => row.on);
    const out: Array<Record<string, unknown>> = [];
    for (const row of on) {
      const pair = biweekly && on.find((other) => other.weekday === row.weekday && other.cycleWeek !== row.cycleWeek && other.startTime === row.startTime && other.endTime === row.endTime);
      if (pair && row.cycleWeek === 2) continue;
      out.push(biweekly ? { weekday: row.weekday, startTime: row.startTime, endTime: row.endTime, cycleWeek: pair ? 0 : row.cycleWeek } : { weekday: row.weekday, startTime: row.startTime, endTime: row.endTime });
    }
    try {
      await mutate({ action, memberId: worker.id, [key]: JSON.stringify(out) }, `Saved for ${worker.name}.`);
      onClose();
    } catch { /* notice is shown */ }
  }
  const windowRow = (row: { weekday: number; cycleWeek: number; on: boolean; startTime: string; endTime: string }) => (
    <div key={`${row.cycleWeek}-${row.weekday}`} className={`flex items-center gap-3 rounded-xl border p-2.5 ${row.on ? 'border-[#bcd4c9] bg-[#f4f8f3]' : 'border-[#e2e8e1]'}`}>
      <label className="flex min-h-11 w-24 shrink-0 cursor-pointer items-center gap-2 text-sm font-semibold">
        <input type="checkbox" checked={row.on} onChange={(e) => update(row.weekday, row.cycleWeek, { on: e.target.checked })} className="size-4 accent-[#287b6f]" />
        {weekdayFull[row.weekday].slice(0, 3)}
      </label>
      <div className="flex flex-1 items-center gap-2">
        <Input type="time" aria-label={`Week ${'AB'[row.cycleWeek - 1] ?? ''} ${weekdayFull[row.weekday]} start time`} value={row.startTime} disabled={!row.on} onChange={(e) => update(row.weekday, row.cycleWeek, { startTime: e.target.value })} className="min-h-11 flex-1" />
        <span className="text-xs font-semibold text-[#687873]">to</span>
        <Input type="time" aria-label={`Week ${'AB'[row.cycleWeek - 1] ?? ''} ${weekdayFull[row.weekday]} end time`} value={row.endTime} disabled={!row.on} onChange={(e) => update(row.weekday, row.cycleWeek, { endTime: e.target.value })} className="min-h-11 flex-1" />
      </div>
    </div>
  );
  return (
    <Dialog open onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-3xl bg-[#fffefa] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {biweekly ? (
          <div className="grid gap-4">
            {[1, 2].map((cycleWeek) => (
              <div key={cycleWeek} className="grid gap-2">
                <h3 className={`flex items-center gap-2 text-sm font-bold ${cycleWeekOf(today()) === cycleWeek ? 'text-[#287b6f]' : 'text-[#52645f]'}`}>Week {'AB'[cycleWeek - 1]}{cycleWeekOf(today()) === cycleWeek && <span className="rounded-full bg-[#287b6f] px-2 py-0.5 text-[10px] font-bold uppercase text-white">this week</span>}</h3>
                {rows.filter((row) => row.cycleWeek === cycleWeek).map(windowRow)}
              </div>
            ))}
          </div>
        ) : (
          <div className="grid gap-2">{rows.map(windowRow)}</div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}><X className="size-4" />Cancel</Button>
          <Button disabled={busy} onClick={save} className="bg-[#287b6f]"><Check className="size-4" />Save shifts</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
