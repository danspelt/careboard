export type NotificationSource = {
  id: string;
  choreId: string | null;
  memberId: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type NotificationTask = {
  id: string;
  title: string;
  status: string;
  assignedTo: string | null;
  createdBy?: string;
  createdAt?: string;
  notes?: Array<{ id: string; memberId?: string; kind: string; body: string; createdAt: string }>;
};

export type NotificationItem = {
  id: string;
  choreId: string | null;
  kind: string;
  text: string;
  actor: string;
  createdAt: string;
};

function memberName(members: Array<{ id: string; name: string }>, id: string | null | undefined) {
  return members.find((member) => member.id === id)?.name ?? 'Team member';
}

export function buildNotifications(options: {
  viewerId: string;
  manager: boolean;
  activity: NotificationSource[];
  tasks: NotificationTask[];
  members: Array<{ id: string; name: string }>;
  since?: string;
}) {
  const { viewerId, manager, activity, tasks, members, since } = options;
  const items: NotificationItem[] = [];
  if (manager) {
    for (const entry of activity) {
      items.push({
        id: entry.id,
        choreId: entry.choreId,
        kind: entry.action,
        text: entry.detail || entry.action.replace(/_/g, ' '),
        actor: memberName(members, entry.memberId),
        createdAt: entry.createdAt,
      });
    }
  } else {
    for (const task of tasks) {
      if (task.assignedTo !== viewerId) continue;
      for (const note of task.notes ?? []) {
        if (note.memberId === viewerId) continue;
        items.push({
          id: note.id,
          choreId: task.id,
          kind: `note_${note.kind}`,
          text: `${note.kind} note on “${task.title}”: ${note.body}`,
          actor: memberName(members, note.memberId),
          createdAt: note.createdAt,
        });
      }
    }
    const cutoff = since ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    for (const task of tasks) {
      if (task.assignedTo !== null || task.status !== 'open' || task.createdBy === viewerId) continue;
      if (!task.createdAt || task.createdAt < cutoff) continue;
      items.push({
        id: `available-${task.id}`,
        choreId: task.id,
        kind: 'available',
        text: `New task available to claim: “${task.title}”`,
        actor: memberName(members, task.createdBy),
        createdAt: task.createdAt,
      });
    }
  }
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 12);
}
