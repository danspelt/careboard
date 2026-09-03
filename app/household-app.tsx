'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Home,
  Plus,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { Chore, HouseholdState, Member } from '@/lib/household-data';

declare global {
  interface Document {
    modelContext?: {
      registerTool: (
        tool: {
          name: string;
          title?: string;
          description: string;
          inputSchema: Record<string, unknown>;
          execute: (input: Record<string, unknown>) => unknown | Promise<unknown>;
          annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean };
        },
        options?: { signal?: AbortSignal },
      ) => void | Promise<void>;
    };
  }
}

const areas = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Laundry', 'Outside', 'Other'];

function initials(name: string) {
  return name
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function dayLabel(dateValue: string | null) {
  if (!dateValue) return 'No due date';
  const due = new Date(`${dateValue}T12:00:00`);
  const today = new Date();
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const dueKey = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
  const days = Math.round((dueKey - todayKey) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function timeLabel(value: string) {
  const date = new Date(value);
  const diff = Date.now() - date.getTime();
  const minutes = Math.max(0, Math.round(diff / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1_440) return `${Math.round(minutes / 60)}h ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function MemberAvatar({ member, className = '' }: { member: Member; className?: string }) {
  return (
    <Avatar className={className}>
      <AvatarFallback style={{ backgroundColor: member.color, color: 'white' }}>
        {initials(member.name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function HouseholdApp({ initialState }: { initialState: HouseholdState }) {
  const [state, setState] = useState(initialState);
  const [currentId, setCurrentId] = useState(
    initialState.members.find((member) => member.role === 'manager')?.id ?? initialState.members[0]?.id,
  );
  const [view, setView] = useState<'open' | 'mine' | 'done'>('open');
  const [createOpen, setCreateOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const stateRef = useRef(state);

  const currentMember = state.members.find((member) => member.id === currentId) ?? state.members[0];
  const workers = state.members.filter((member) => member.role === 'worker');
  stateRef.current = state;

  useEffect(() => {
    const saved = window.localStorage.getItem('careboard-profile');
    if (saved && state.members.some((member) => member.id === saved)) setCurrentId(saved);
  }, [state.members]);

  function chooseProfile(id: string) {
    setCurrentId(id);
    window.localStorage.setItem('careboard-profile', id);
    const member = state.members.find((item) => item.id === id);
    if (member) setNotice(`Viewing CareBoard as ${member.name}.`);
  }

  async function mutate(payload: Record<string, unknown>, success: string) {
    if (!currentMember) throw new Error('Choose a profile first.');
    const response = await fetch('/api/household', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...payload, actorId: currentMember.id }),
    });
    const result = (await response.json()) as HouseholdState & { error?: string };
    if (!response.ok) throw new Error(result.error || 'That update could not be saved.');
    setState(result);
    stateRef.current = result;
    setNotice(success);
    return result;
  }

  async function runAction(chore: Chore, action: 'claim' | 'complete' | 'unclaim', success: string) {
    setBusyId(chore.id);
    try {
      await mutate({ action, choreId: chore.id }, success);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'That update could not be saved.');
    } finally {
      setBusyId(null);
    }
  }

  useEffect(() => {
    const context = document.modelContext;
    if (!context?.registerTool || !currentMember) return;
    const lifecycle = new AbortController();
    const invoke = async (payload: Record<string, unknown>) => {
      const response = await fetch('/api/household', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...payload, actorId: currentMember.id }),
      });
      const result = (await response.json()) as HouseholdState & { error?: string };
      if (!response.ok) throw new Error(result.error || 'Update failed.');
      setState(result);
      stateRef.current = result;
      return result;
    };

    const registrations = [
      context.registerTool(
        {
          name: 'list_careboard_chores',
          title: 'List care chores',
          description: 'List the current open chores, assignees, and due dates on the care-team board.',
          inputSchema: { type: 'object', properties: {}, additionalProperties: false },
          annotations: { readOnlyHint: true, untrustedContentHint: false },
          execute: () => ({
            chores: stateRef.current.chores
              .filter((chore) => chore.status === 'open')
              .map(({ id, title, area, dueDate, assignedTo }) => ({ id, title, area, dueDate, assignedTo })),
          }),
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: 'claim_careboard_chore',
          title: 'Claim a care chore',
          description: 'Claim one currently unassigned household chore for the active care-worker profile.',
          inputSchema: {
            type: 'object',
            properties: { choreId: { type: 'string', description: 'The chore ID from list_careboard_chores.' } },
            required: ['choreId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async ({ choreId }) => {
            if (typeof choreId !== 'string' || !choreId) throw new Error('A chore ID is required.');
            const result = await invoke({ action: 'claim', choreId });
            return { claimed: choreId, openChores: result.chores.filter((chore) => chore.status === 'open').length };
          },
        },
        { signal: lifecycle.signal },
      ),
      context.registerTool(
        {
          name: 'complete_careboard_chore',
          title: 'Complete a care chore',
          description: 'Mark one assigned or unclaimed household chore complete as the active profile.',
          inputSchema: {
            type: 'object',
            properties: { choreId: { type: 'string', description: 'The chore ID from list_careboard_chores.' } },
            required: ['choreId'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: async ({ choreId }) => {
            if (typeof choreId !== 'string' || !choreId) throw new Error('A chore ID is required.');
            const result = await invoke({ action: 'complete', choreId });
            return { completed: choreId, completedCount: result.chores.filter((chore) => chore.status === 'complete').length };
          },
        },
        { signal: lifecycle.signal },
      ),
    ];
    registrations.forEach((registration) => Promise.resolve(registration).catch(() => undefined));
    return () => lifecycle.abort();
  }, [currentMember]);

  const visibleChores = useMemo(() => {
    if (view === 'done') return state.chores.filter((chore) => chore.status === 'complete');
    if (view === 'mine') {
      if (currentMember?.role === 'manager') {
        return state.chores.filter((chore) => chore.status === 'open' && chore.assignedTo);
      }
      return state.chores.filter((chore) => chore.status === 'open' && chore.assignedTo === currentMember?.id);
    }
    return state.chores.filter((chore) => chore.status === 'open');
  }, [currentMember, state.chores, view]);

  const openCount = state.chores.filter((chore) => chore.status === 'open').length;
  const unassignedCount = state.chores.filter((chore) => chore.status === 'open' && !chore.assignedTo).length;
  const completedCount = state.chores.filter((chore) => chore.status === 'complete').length;

  async function createChore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId('create');
    try {
      await mutate(
        {
          action: 'createChore',
          title: form.get('title'),
          area: form.get('area'),
          dueDate: form.get('dueDate'),
          assigneeId: form.get('assigneeId'),
        },
        'Chore added to the board.',
      );
      setCreateOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The chore could not be added.');
    } finally {
      setBusyId(null);
    }
  }

  async function addWorker(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusyId('member');
    try {
      await mutate({ action: 'addMember', name: form.get('name') }, 'Care-worker profile added.');
      setMemberOpen(false);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'The profile could not be added.');
    } finally {
      setBusyId(null);
    }
  }

  if (!currentMember) return null;

  return (
    <div className="min-h-screen bg-[#f7f4ed] text-[#20312d]">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2">
        Skip to chores
      </a>
      <header className="border-b border-[#dfe5dc] bg-[#fcfbf7]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-5 py-4 sm:px-8 lg:px-10">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-2xl bg-[#287b6f] text-white shadow-[0_7px_20px_rgba(40,123,111,.22)]">
              <Home className="size-5" aria-hidden="true" />
            </span>
            <div>
              <p className="text-lg font-bold tracking-[-0.035em]">CareBoard</p>
              <p className="hidden text-xs text-[#6d7e79] sm:block">Household care, clearly coordinated</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            {currentMember.role === 'manager' && (
              <Dialog open={memberOpen} onOpenChange={setMemberOpen}>
                <DialogTrigger render={<Button variant="outline" className="hidden h-10 rounded-xl border-[#d7dfd7] bg-white px-3 sm:inline-flex" />}>
                  <UserPlus aria-hidden="true" /> Add worker
                </DialogTrigger>
                <DialogContent className="rounded-3xl border-[#dbe1da] bg-[#fffefa] p-6 sm:max-w-md">
                  <form onSubmit={addWorker}>
                    <DialogHeader>
                      <DialogTitle className="text-xl font-bold tracking-tight">Add a care worker</DialogTitle>
                      <DialogDescription>Create a profile so assignments and completed work stay clearly attributed.</DialogDescription>
                    </DialogHeader>
                    <label className="mt-6 block text-sm font-semibold" htmlFor="worker-name">Full name</label>
                    <Input id="worker-name" name="name" required autoFocus placeholder="e.g. Jordan Lee" className="mt-2 h-11 rounded-xl bg-white" />
                    <DialogFooter className="mt-6 border-[#e4e7df] bg-[#f7f4ed]">
                      <Button type="submit" disabled={busyId === 'member'} className="h-10 rounded-xl bg-[#287b6f] px-5">
                        {busyId === 'member' ? 'Adding…' : 'Add profile'}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
            <Select value={currentMember.id} onValueChange={(value) => chooseProfile(String(value))}>
              <SelectTrigger aria-label="Switch profile" className="h-11 min-w-[142px] rounded-xl border-[#d7dfd7] bg-white px-2.5 shadow-sm">
                <MemberAvatar member={currentMember} className="size-7" />
                <SelectValue>{currentMember.name}</SelectValue>
              </SelectTrigger>
              <SelectContent align="end" className="rounded-xl bg-white">
                {state.members.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    <MemberAvatar member={member} className="size-6" />
                    <span>{member.name}</span>
                    {member.role === 'manager' && <span className="text-xs text-[#74827d]">Manager</span>}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto grid max-w-[1440px] gap-7 px-5 py-7 sm:px-8 lg:grid-cols-[minmax(0,1fr)_340px] lg:px-10 lg:py-9">
        <section>
          <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-[#287b6f]">
                <Sparkles className="size-4" aria-hidden="true" />
                {currentMember.role === 'manager' ? 'Manager overview' : 'Care-worker view'}
              </div>
              <h1 className="text-3xl font-bold tracking-[-0.045em] sm:text-4xl">
                {currentMember.role === 'manager' ? 'Today’s household care' : `Welcome, ${currentMember.name}`}
              </h1>
              <p className="mt-2 max-w-2xl text-[15px] leading-6 text-[#64746f]">
                {currentMember.role === 'manager'
                  ? 'Assign each chore once, then see exactly what’s claimed and completed.'
                  : 'Claim an open chore, then check it off when the work is complete.'}
              </p>
            </div>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger render={<Button className="h-12 rounded-xl bg-[#287b6f] px-5 text-[15px] shadow-[0_8px_22px_rgba(40,123,111,.2)] hover:bg-[#236d63]" />}>
                <Plus className="size-5" aria-hidden="true" /> Add chore
              </DialogTrigger>
              <DialogContent className="rounded-3xl border-[#dbe1da] bg-[#fffefa] p-6 sm:max-w-md">
                <form onSubmit={createChore}>
                  <DialogHeader>
                    <DialogTitle className="text-xl font-bold tracking-tight">Add a household chore</DialogTitle>
                    <DialogDescription>Make ownership clear now so the work is only done once.</DialogDescription>
                  </DialogHeader>
                  <div className="mt-6 grid gap-4">
                    <div>
                      <label className="text-sm font-semibold" htmlFor="chore-title">What needs doing?</label>
                      <Input id="chore-title" name="title" required autoFocus placeholder="e.g. Mop the kitchen floor" className="mt-2 h-11 rounded-xl bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-sm font-semibold" htmlFor="chore-area">Area</label>
                        <select id="chore-area" name="area" defaultValue="Kitchen" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm outline-none focus:ring-3 focus:ring-[#75a99f]/35">
                          {areas.map((area) => <option key={area}>{area}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="text-sm font-semibold" htmlFor="chore-due">Due</label>
                        <Input id="chore-due" type="date" name="dueDate" className="mt-2 h-11 rounded-xl bg-white" />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-semibold" htmlFor="chore-assignee">Assign now <span className="font-normal text-[#7a8884]">(optional)</span></label>
                      <select id="chore-assignee" name="assigneeId" defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-[#d7dfd7] bg-white px-3 text-sm outline-none focus:ring-3 focus:ring-[#75a99f]/35">
                        <option value="">Leave open to claim</option>
                        {workers.map((worker) => <option key={worker.id} value={worker.id}>{worker.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <DialogFooter className="mt-6 border-[#e4e7df] bg-[#f7f4ed]">
                    <Button type="submit" disabled={busyId === 'create'} className="h-10 rounded-xl bg-[#287b6f] px-5">
                      {busyId === 'create' ? 'Adding…' : 'Add to board'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </div>

          <div className="mt-7 grid grid-cols-3 gap-3">
            <Metric label="Open" value={openCount} icon={<ClipboardCheck />} tone="green" />
            <Metric label="Unassigned" value={unassignedCount} icon={<Users />} tone="gold" />
            <Metric label="Completed" value={completedCount} icon={<CheckCircle2 />} tone="blue" />
          </div>

          <div className="mt-7 rounded-3xl border border-[#dfe5dc] bg-[#fffefa] shadow-[0_12px_40px_rgba(39,62,55,.055)]">
            <div className="flex flex-col gap-4 border-b border-[#e5e9e2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-bold tracking-tight">Chore board</h2>
                <p className="mt-0.5 text-sm text-[#74827d]">One owner per task, no duplicated work.</p>
              </div>
              <div className="flex rounded-xl bg-[#f0f2ec] p-1" role="tablist" aria-label="Chore filters">
                {([
                  ['open', 'Open'],
                  ['mine', currentMember.role === 'manager' ? 'Assigned' : 'My tasks'],
                  ['done', 'Completed'],
                ] as const).map(([value, label]) => (
                  <button key={value} type="button" role="tab" aria-selected={view === value} onClick={() => setView(value)} className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${view === value ? 'bg-white text-[#20312d] shadow-sm' : 'text-[#697873] hover:text-[#20312d]'}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="divide-y divide-[#e8ebe5]">
              {visibleChores.length ? (
                visibleChores.map((chore) => (
                  <ChoreRow
                    key={chore.id}
                    chore={chore}
                    members={state.members}
                    currentMember={currentMember}
                    busy={busyId === chore.id}
                    onRun={runAction}
                    onAssign={async (assigneeId) => {
                      setBusyId(chore.id);
                      try {
                        const assignee = state.members.find((member) => member.id === assigneeId);
                        await mutate({ action: 'assign', choreId: chore.id, assigneeId }, `Assigned to ${assignee?.name ?? 'care worker'}.`);
                      } catch (error) {
                        setNotice(error instanceof Error ? error.message : 'The assignment could not be saved.');
                      } finally {
                        setBusyId(null);
                      }
                    }}
                  />
                ))
              ) : (
                <div className="px-6 py-14 text-center">
                  <span className="mx-auto grid size-12 place-items-center rounded-2xl bg-[#e8f2ed] text-[#287b6f]"><Check className="size-6" /></span>
                  <h3 className="mt-4 font-bold">All clear here</h3>
                  <p className="mt-1 text-sm text-[#71807b]">There are no chores in this view right now.</p>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="rounded-3xl bg-[#183e37] p-6 text-white shadow-[0_16px_40px_rgba(24,62,55,.18)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#a8cdc4]">Care team</p>
                <h2 className="mt-1 text-xl font-bold tracking-tight">{workers.length} workers</h2>
              </div>
              <div className="flex -space-x-2">
                {workers.map((worker) => <MemberAvatar key={worker.id} member={worker} className="ring-2 ring-[#183e37]" />)}
              </div>
            </div>
            <div className="mt-5 space-y-2.5">
              {workers.map((worker) => {
                const active = state.chores.filter((chore) => chore.status === 'open' && chore.assignedTo === worker.id).length;
                return (
                  <div key={worker.id} className="flex items-center gap-3 rounded-2xl bg-white/[.07] px-3 py-3">
                    <MemberAvatar member={worker} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{worker.name}</p>
                      <p className="text-xs text-[#b6d1cb]">{active ? `${active} active ${active === 1 ? 'chore' : 'chores'}` : 'Available'}</p>
                    </div>
                    <span className={`size-2 rounded-full ${active ? 'bg-[#f0b36f]' : 'bg-[#78c5a9]'}`} aria-hidden="true" />
                  </div>
                );
              })}
            </div>
            {currentMember.role === 'manager' && (
              <Button variant="ghost" onClick={() => setMemberOpen(true)} className="mt-3 h-10 w-full justify-between rounded-xl px-3 text-[#dcebe7] hover:bg-white/10 hover:text-white sm:hidden">
                Add care worker <ChevronRight />
              </Button>
            )}
          </section>

          <section className="rounded-3xl border border-[#dfe5dc] bg-[#fffefa] p-5 shadow-[0_12px_40px_rgba(39,62,55,.045)]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#7d8b86]">Activity</p>
                <h2 className="mt-1 text-lg font-bold tracking-tight">Recent updates</h2>
              </div>
              <Clock3 className="size-5 text-[#8b9994]" aria-hidden="true" />
            </div>
            <ol className="mt-5 space-y-4">
              {state.activity.slice(0, 7).map((item) => {
                const member = state.members.find((candidate) => candidate.id === item.memberId);
                if (!member) return null;
                return (
                  <li key={item.id} className="flex gap-3">
                    <MemberAvatar member={member} className="mt-0.5 size-7" />
                    <div className="min-w-0 flex-1 text-sm leading-5">
                      <p><span className="font-semibold">{member.name}</span> <span className="text-[#687772]">{item.detail}</span></p>
                      <time className="text-xs text-[#95a19d]" dateTime={item.createdAt}>{timeLabel(item.createdAt)}</time>
                    </div>
                  </li>
                );
              })}
            </ol>
          </section>
        </aside>
      </main>
      <output aria-live="polite" aria-atomic="true" className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2">
        {notice && (
          <button type="button" onClick={() => setNotice('')} className="rounded-xl bg-[#20312d] px-4 py-3 text-sm font-medium text-white shadow-xl">
            {notice}
          </button>
        )}
      </output>
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: 'green' | 'gold' | 'blue' }) {
  const colors = {
    green: 'bg-[#e5f1eb] text-[#287b6f]',
    gold: 'bg-[#f7ecd7] text-[#a46c17]',
    blue: 'bg-[#e8ecf7] text-[#556da9]',
  };
  return (
    <div className="rounded-2xl border border-[#dfe5dc] bg-[#fffefa] p-3.5 sm:flex sm:items-center sm:gap-3 sm:p-4">
      <span className={`grid size-9 place-items-center rounded-xl [&>svg]:size-4 ${colors[tone]}`}>{icon}</span>
      <div className="mt-2 sm:mt-0">
        <p className="text-2xl font-bold leading-none tracking-tight">{value}</p>
        <p className="mt-1 text-xs font-medium text-[#71807b] sm:text-sm">{label}</p>
      </div>
    </div>
  );
}

function ChoreRow({
  chore,
  members,
  currentMember,
  busy,
  onRun,
  onAssign,
}: {
  chore: Chore;
  members: Member[];
  currentMember: Member;
  busy: boolean;
  onRun: (chore: Chore, action: 'claim' | 'complete' | 'unclaim', success: string) => void;
  onAssign: (assigneeId: string) => void;
}) {
  const assigned = members.find((member) => member.id === chore.assignedTo);
  const completed = members.find((member) => member.id === chore.completedBy);
  const canComplete = chore.status === 'open' && (currentMember.role === 'manager' || !assigned || assigned.id === currentMember.id);
  const due = dayLabel(chore.dueDate);
  const overdue = chore.dueDate ? chore.dueDate < new Date().toISOString().slice(0, 10) && chore.status === 'open' : false;

  return (
    <article className="group px-5 py-5 transition hover:bg-[#fcfcf8] sm:px-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <button
          type="button"
          disabled={!canComplete || busy || chore.status === 'complete'}
          onClick={() => onRun(chore, 'complete', `${chore.title} marked complete.`)}
          className={`grid size-10 shrink-0 place-items-center rounded-xl border-2 transition focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-[#75a99f]/40 ${chore.status === 'complete' ? 'border-[#287b6f] bg-[#287b6f] text-white' : canComplete ? 'border-[#b9c9c3] bg-white text-transparent hover:border-[#287b6f] hover:text-[#287b6f]' : 'cursor-not-allowed border-[#e0e4df] bg-[#f2f3ef] text-transparent'}`}
          aria-label={chore.status === 'complete' ? `${chore.title} is complete` : `Mark ${chore.title} complete`}
        >
          <Check className="size-5" aria-hidden="true" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-bold tracking-[-0.015em] ${chore.status === 'complete' ? 'text-[#7d8a86] line-through decoration-[#a9b4b0]' : ''}`}>{chore.title}</h3>
            {chore.status === 'open' && !assigned && <Badge className="bg-[#f7ecd7] text-[#936016]">Open to claim</Badge>}
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[#74827d]">
            <span className="flex items-center gap-1.5"><Home className="size-3.5" aria-hidden="true" />{chore.area}</span>
            <span className={`flex items-center gap-1.5 ${overdue ? 'font-semibold text-[#bd5b45]' : ''}`}><CalendarDays className="size-3.5" aria-hidden="true" />{due}</span>
            {chore.status === 'complete' && completed && <span>Done by {completed.name}</span>}
          </div>
        </div>
        <div className="flex min-w-[184px] items-center justify-end gap-2 self-stretch sm:self-auto">
          {chore.status === 'complete' && completed ? (
            <div className="flex items-center gap-2 rounded-xl bg-[#edf4f0] px-3 py-2 text-sm font-semibold text-[#287b6f]"><MemberAvatar member={completed} className="size-6" />{completed.name}</div>
          ) : assigned ? (
            <>
              <div className="flex items-center gap-2 rounded-xl border border-[#dde4dc] bg-white px-3 py-2 text-sm font-semibold"><MemberAvatar member={assigned} className="size-6" />{assigned.name}</div>
              {(assigned.id === currentMember.id || currentMember.role === 'manager') && (
                <Button variant="ghost" size="icon" title="Release assignment" disabled={busy} onClick={() => onRun(chore, 'unclaim', `${chore.title} is open to claim.`)} className="rounded-xl text-[#7c8b86]">×<span className="sr-only">Release {chore.title}</span></Button>
              )}
            </>
          ) : currentMember.role === 'manager' ? (
            <Select onValueChange={(value) => onAssign(String(value))} disabled={busy}>
              <SelectTrigger aria-label={`Assign ${chore.title}`} className="h-10 w-full rounded-xl border-[#d7dfd7] bg-white sm:w-[184px]"><SelectValue placeholder="Assign worker" /></SelectTrigger>
              <SelectContent className="rounded-xl bg-white">
                {members.filter((member) => member.role === 'worker').map((worker) => (
                  <SelectItem key={worker.id} value={worker.id}><MemberAvatar member={worker} className="size-6" />{worker.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Button disabled={busy} onClick={() => onRun(chore, 'claim', `${chore.title} claimed.`)} className="h-10 w-full rounded-xl bg-[#287b6f] px-4 sm:w-auto">Claim chore</Button>
          )}
        </div>
      </div>
    </article>
  );
}
