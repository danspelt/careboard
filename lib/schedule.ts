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

export function buildWeekSchedule<T extends ScheduleTask>(tasks: T[], workers: ScheduleWorker[], startDate: string) {
  const dates = Array.from({ length: 7 }, (_, index) => dayOffset(startDate, index));
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
