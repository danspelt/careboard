export type HandoffTask = {
  id: string;
  status: string;
  priority: string;
  dueDate: string | null;
  dueTime?: string | null;
  assignedTo: string | null;
  issueOpen?: boolean;
  instructions?: string;
  progressNotes?: string;
  issueReport?: string;
  completedAt?: string | null;
  notes?: Array<{ id: string; kind: string; body: string; createdAt: string }>;
};

export type AttentionReason = 'Open issue' | 'Overdue' | 'Urgent priority' | 'Due today';

export function attentionReasons(task: HandoffTask, date: string): AttentionReason[] {
  if (task.status === 'complete') return [];
  const reasons: AttentionReason[] = [];
  if (task.issueOpen) reasons.push('Open issue');
  if (task.dueDate && task.dueDate < date) reasons.push('Overdue');
  if (task.priority === 'urgent') reasons.push('Urgent priority');
  if (task.dueDate === date) reasons.push('Due today');
  return reasons;
}

export function buildShiftHandoff<T extends HandoffTask>(tasks: T[], workerId: string, date: string) {
  const mine = tasks.filter((task) => task.assignedTo === workerId);
  const assigned = mine.filter((task) => task.status !== 'complete' && task.dueDate === date);
  const attention = mine
    .filter((task) => attentionReasons(task, date).length > 0)
    .sort((a, b) => {
      const score = (task: T) => (task.issueOpen ? 8 : 0) + (task.dueDate && task.dueDate < date ? 4 : 0) + (task.priority === 'urgent' ? 2 : 0) + (task.dueDate === date ? 1 : 0);
      return score(b) - score(a) || (a.dueTime ?? '99:99').localeCompare(b.dueTime ?? '99:99');
    });
  const completed = mine.filter((task) => task.status === 'complete' && task.completedAt?.slice(0, 10) === date);
  const latestNotes = mine
    .flatMap((task) => (task.notes ?? []).map((note) => ({ ...note, task })))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);
  return { assigned, attention, completed, latestNotes };
}
