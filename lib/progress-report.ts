export type ReportTask = {
  id: string;
  area: string;
  status: string;
  dueDate: string | null;
  assignedTo: string | null;
  completedBy: string | null;
  completedAt: string | null;
  issueOpen?: boolean;
  notes?: Array<{ id: string; memberId?: string; kind: string; createdAt: string }>;
};

export type ReportWorker = { id: string; status: string };

function dayOffset(date: string, offset: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

const inRange = (day: string | null | undefined, start: string, end: string) => !!day && day >= start && day <= end;

export function buildProgressReport<T extends ReportTask>(tasks: T[], workers: ReportWorker[], endDate: string, days = 30) {
  const start = dayOffset(endDate, -(days - 1));
  const completed = tasks.filter((task) => task.status === 'complete' && inRange(task.completedAt?.slice(0, 10), start, endDate));
  const onTime = completed.filter((task) => task.dueDate && task.completedAt!.slice(0, 10) <= task.dueDate);
  const issueNotes = tasks.flatMap((task) => (task.notes ?? []).map((note) => ({ ...note, task }))).filter((note) => note.kind === 'issue' && inRange(note.createdAt.slice(0, 10), start, endDate));
  const openIssues = tasks.filter((task) => task.issueOpen && task.status !== 'complete');
  const byArea = new Map<string, number>();
  for (const task of completed) byArea.set(task.area, (byArea.get(task.area) ?? 0) + 1);
  const weeks = Math.ceil(days / 7);
  const weekly = Array.from({ length: weeks }, (_, week) => {
    const weekStart = dayOffset(start, week * 7);
    const weekEnd = dayOffset(start, Math.min(days - 1, week * 7 + 6));
    return { start: weekStart, end: weekEnd, completed: completed.filter((task) => inRange(task.completedAt!.slice(0, 10), weekStart, weekEnd)).length };
  });
  const perWorker = workers
    .filter((worker) => worker.status === 'active')
    .map((worker) => {
      const done = completed.filter((task) => (task.completedBy ?? task.assignedTo) === worker.id);
      const timely = done.filter((task) => task.dueDate && task.completedAt!.slice(0, 10) <= task.dueDate);
      const issues = issueNotes.filter((note) => note.memberId === worker.id).length;
      return { workerId: worker.id, completed: done.length, onTime: timely.length, issues, onTimeRate: done.length ? Math.round((timely.length / done.length) * 100) : null };
    });
  return {
    start,
    end: endDate,
    completed: completed.length,
    onTime: onTime.length,
    onTimeRate: completed.length ? Math.round((onTime.length / completed.length) * 100) : null,
    issuesOpened: issueNotes.length,
    openIssues: openIssues.length,
    byArea: [...byArea.entries()].map(([area, count]) => ({ area, count })).sort((a, b) => b.count - a.count || a.area.localeCompare(b.area)),
    weekly,
    perWorker,
  };
}
