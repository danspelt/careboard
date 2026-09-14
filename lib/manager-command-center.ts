export type ManagerTask = {
  id: string;
  status: string;
  priority: string;
  dueDate: string | null;
  assignedTo: string | null;
  issueOpen?: boolean;
  completedAt?: string | null;
  notes?: Array<{ id: string; memberId?: string; kind: string; body: string; createdAt: string }>;
};

export type ManagerWorker = { id: string; status: string };

function dayOffset(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

export function buildManagerCommandCenter<T extends ManagerTask>(tasks: T[], workers: ManagerWorker[], date: string) {
  const activeWorkers = workers.filter((worker) => worker.status === 'active');
  const open = tasks.filter((task) => task.status !== 'complete');
  const attention = open
    .filter((task) => task.issueOpen || task.priority === 'urgent' || (task.dueDate !== null && task.dueDate <= date))
    .sort((a, b) => {
      const score = (task: T) => (task.issueOpen ? 16 : 0) + (task.dueDate && task.dueDate < date ? 8 : 0) + (task.priority === 'urgent' ? 4 : 0) + (task.dueDate === date ? 2 : 0) + (!task.assignedTo ? 1 : 0);
      return score(b) - score(a) || (a.dueDate ?? '9999-12-31').localeCompare(b.dueDate ?? '9999-12-31');
    });
  const issues = open.filter((task) => task.issueOpen);
  const coverage = activeWorkers.map((worker) => ({
    workerId: worker.id,
    dueToday: open.filter((task) => task.assignedTo === worker.id && task.dueDate === date).length,
    inProgress: open.filter((task) => task.assignedTo === worker.id && task.status === 'in_progress').length,
    overdue: open.filter((task) => task.assignedTo === worker.id && task.dueDate !== null && task.dueDate < date).length,
  }));
  const recentHandoffs = tasks
    .flatMap((task) => (task.notes ?? []).map((note) => ({ ...note, task })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);
  const completionTrend = Array.from({ length: 7 }, (_, index) => {
    const day = dayOffset(date, index - 6);
    return { date: day, completed: tasks.filter((task) => task.completedAt?.slice(0, 10) === day).length };
  });
  return {
    activeWorkers,
    coverage,
    attention,
    issues,
    recentHandoffs,
    completionTrend,
    unassignedDueToday: open.filter((task) => !task.assignedTo && task.dueDate === date).length,
    completedToday: tasks.filter((task) => task.completedAt?.slice(0, 10) === date).length,
  };
}
