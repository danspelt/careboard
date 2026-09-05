export type AccountStatus = 'active' | 'disabled';
export type Role = 'manager' | 'worker';
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
  if (action === 'start') return task.status === 'open' && task.assignedTo === actorId;
  if (action === 'complete') return task.status === 'in_progress' && task.assignedTo === actorId;
  return false;
}

export function visibleTasks<T extends AccessTask>(member: AccessMember, tasks: T[]) {
  if (member.role === 'manager') return tasks;
  return tasks.filter((task) => task.assignedTo === member.id || (task.assignedTo === null && task.status === 'open'));
}

export function workerTaskGroups<T extends AccessTask>(member: AccessMember, tasks: T[]) {
  return [
    { id: 'my-tasks' as const, title: 'My Tasks' as const, tasks: tasks.filter((task) => task.assignedTo === member.id) },
    { id: 'available-tasks' as const, title: 'Available Tasks' as const, tasks: tasks.filter((task) => task.assignedTo === null && task.status === 'open') },
  ];
}
