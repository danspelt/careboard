export type AccountStatus = 'active' | 'disabled' | 'invited';
export type Role = 'manager' | 'worker' | 'viewer';
export type TaskStatus = 'open' | 'in_progress' | 'complete';

export type AccessMember = { id: string; role: Role; status: AccountStatus };
export type AccessTask = { assignedTo: string | null; status: TaskStatus };

export function canAuthenticate(status: AccountStatus) {
  return status === 'active';
}

export function canAssignTo(status: AccountStatus) {
  return status === 'active';
}

export function workerCan(action: string, actorId: string, task: AccessTask) {
  if (action === 'claim') return task.status === 'open' && task.assignedTo === null;
  if (action === 'takeover') return task.status !== 'complete' && task.assignedTo !== null && task.assignedTo !== actorId;
  if (action === 'start') return task.status === 'open' && task.assignedTo === actorId;
  if (action === 'complete') return task.status === 'in_progress' && task.assignedTo === actorId;
  return false;
}

export function visibleTasks<T extends AccessTask>(member: AccessMember, tasks: T[]) {
  if (member.role === 'manager' || member.role === 'viewer') return tasks;
  // Workers see all unfinished work so the next shift can take over what was not completed, plus their own completed tasks.
  return tasks.filter((task) => task.assignedTo === member.id || task.status !== 'complete');
}

export function workerTaskGroups<T extends AccessTask>(member: AccessMember, tasks: T[]) {
  return [
    { id: 'my-tasks' as const, title: 'My Tasks' as const, tasks: tasks.filter((task) => task.assignedTo === member.id) },
    { id: 'available-tasks' as const, title: 'Available Tasks' as const, tasks: tasks.filter((task) => task.assignedTo === null && task.status === 'open') },
  ];
}
