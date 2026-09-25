export type ScheduleTask = {
  id: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  status: string;
  priority: string;
  assignedTo: string | null;
  issueOpen?: boolean;
};

export type ScheduleWorker = { id: string; status: string };

const priorityRank: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

function dayOffset(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function orderTasks<T extends ScheduleTask>(tasks: T[]) {
  return [...tasks].sort((a, b) =>
    (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99')
    || (priorityRank[a.priority] ?? 4) - (priorityRank[b.priority] ?? 4)
    || a.title.localeCompare(b.title),
  );
}

export type TaskAction = 'claim' | 'start' | 'complete';

/** The single next thing a caregiver can do with a task — mirrors the claim → start → complete guards in the backend. */
export function nextTaskAction<T extends ScheduleTask>(task: T, memberId: string): TaskAction | null {
  if (task.status === 'complete') return null;
  if (task.assignedTo === null) return task.status === 'open' ? 'claim' : null;
  if (task.assignedTo !== memberId) return null;
  if (task.status === 'open') return 'start';
  if (task.status === 'in_progress') return 'complete';
  return null;
}

/** A caregiver's day: their unfinished work carried over from earlier days, plus today's tasks (theirs and claimable). */
export function workerDayPlan<T extends ScheduleTask>(tasks: T[], memberId: string, date: string) {
  const open = tasks.filter((task) => task.status !== 'complete');
  return {
    carriedOver: orderTasks(open.filter((task) => task.assignedTo === memberId && task.dueDate !== null && task.dueDate < date)),
    today: orderTasks(
      tasks.filter((task) => task.dueDate === date && (task.assignedTo === memberId || (task.status === 'open' && task.assignedTo === null))),
    ),
  };
}

export function buildWeekSchedule<T extends ScheduleTask>(tasks: T[], workers: ScheduleWorker[], startDate: string, dayCount = 7) {
  const dates = Array.from({ length: dayCount }, (_, index) => dayOffset(startDate, index));
  const open = tasks.filter((task) => task.status !== 'complete');
  const days = dates.map((date) => ({
    date,
    tasks: orderTasks(tasks.filter((task) => task.dueDate === date)),
    unassigned: open.filter((task) => task.dueDate === date && !task.assignedTo).length,
    issues: open.filter((task) => task.dueDate === date && task.issueOpen).length,
  }));
  return {
    days,
    overdue: orderTasks(open.filter((task) => task.dueDate !== null && task.dueDate < startDate)),
    unscheduled: orderTasks(open.filter((task) => task.dueDate === null)),
    workload: workers
      .filter((worker) => worker.status === 'active')
      .map((worker) => {
        const byDay = dates.map((date) => open.filter((task) => task.assignedTo === worker.id && task.dueDate === date).length);
        return { workerId: worker.id, byDay, total: byDay.reduce((sum, count) => sum + count, 0) };
      }),
  };
}
