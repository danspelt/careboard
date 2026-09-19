export type AssignableTask = {
  id: string;
  dueDate: string | null;
  status: string;
  assignedTo: string | null;
};

import { cycleWeekOf } from '@/lib/shifts';

export type AssignableWorker = { id: string; status: string };
export type WorkWindow = { memberId: string; weekday: number; cycleWeek?: number };

function dayOffset(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function weekdayOf(date: string) {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

// Pool preference: workers on shift that day > workers who declared that day available > workers with no declared availability > everyone.
function eligiblePool(active: AssignableWorker[], day: string, shifts: WorkWindow[], availability: WorkWindow[]) {
  const weekday = weekdayOf(day);
  const cycleWeek = cycleWeekOf(day);
  const onShift = active.filter((worker) => shifts.some((shift) => shift.memberId === worker.id && shift.weekday === weekday && (!shift.cycleWeek || shift.cycleWeek === cycleWeek)));
  if (onShift.length) return onShift;
  const declared = active.filter((worker) => availability.some((window) => window.memberId === worker.id));
  const available = declared.filter((worker) => availability.some((window) => window.memberId === worker.id && window.weekday === weekday));
  if (available.length) return available;
  const undeclared = active.filter((worker) => !declared.some((other) => other.id === worker.id));
  return undeclared.length ? undeclared : active;
}

export function suggestAssignments<T extends AssignableTask>(tasks: T[], workers: AssignableWorker[], startDate: string, days = 7, constraints: { shifts?: WorkWindow[]; availability?: WorkWindow[] } = {}) {
  const active = workers.filter((worker) => worker.status === 'active');
  if (!active.length) return [];
  const end = dayOffset(startDate, days - 1);
  const open = tasks.filter((task) => task.status !== 'complete');
  const dailyLoad = new Map<string, Map<string, number>>();
  const totalLoad = new Map<string, number>();
  const bump = (workerId: string, day: string, amount = 1) => {
    const byDay = dailyLoad.get(workerId) ?? new Map<string, number>();
    byDay.set(day, (byDay.get(day) ?? 0) + amount);
    dailyLoad.set(workerId, byDay);
    totalLoad.set(workerId, (totalLoad.get(workerId) ?? 0) + amount);
  };
  for (const task of open) {
    if (task.assignedTo && task.dueDate && task.dueDate <= end) bump(task.assignedTo, task.dueDate < startDate ? startDate : task.dueDate);
  }
  const candidates = open
    .filter((task) => task.assignedTo === null && task.dueDate !== null && task.dueDate <= end)
    .sort((a, b) => a.dueDate!.localeCompare(b.dueDate!) || a.id.localeCompare(b.id));
  const plan: Array<{ taskId: string; workerId: string; day: string }> = [];
  for (const task of candidates) {
    const day = task.dueDate! < startDate ? startDate : task.dueDate!;
    const pool = eligiblePool(active, day, constraints.shifts ?? [], constraints.availability ?? []);
    const pick = pool
      .map((worker) => ({ worker, daily: dailyLoad.get(worker.id)?.get(day) ?? 0, total: totalLoad.get(worker.id) ?? 0 }))
      .sort((a, b) => a.daily - b.daily || a.total - b.total || a.worker.id.localeCompare(b.worker.id))[0];
    plan.push({ taskId: task.id, workerId: pick.worker.id, day });
    bump(pick.worker.id, day);
  }
  return plan;
}
