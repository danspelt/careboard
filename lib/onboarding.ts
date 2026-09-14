export type OnboardingTask = {
  id: string;
  status: string;
  assignedTo: string | null;
  notes?: Array<{ id: string; memberId?: string }>;
};

export type OnboardingStep = { id: string; title: string; detail: string; done: boolean };

export function buildOnboarding(options: {
  manager: boolean;
  viewerId: string;
  members: Array<{ id: string; role: string; phone?: string | null }>;
  tasks: OnboardingTask[];
}): OnboardingStep[] {
  const { manager, viewerId, members, tasks } = options;
  if (manager) {
    return [
      { id: 'add-worker', title: 'Add a care worker', detail: 'Build the team that shares household work.', done: members.some((member) => member.role === 'worker') },
      { id: 'create-task', title: 'Create a household task', detail: 'Give the team its first piece of work.', done: tasks.length > 0 },
      { id: 'assign-task', title: 'Assign a task', detail: 'Point work at a specific worker or leave it open to claim.', done: tasks.some((task) => task.assignedTo !== null) },
      { id: 'first-note', title: 'Share a handoff note', detail: 'Notes keep everyone oriented between shifts.', done: tasks.some((task) => (task.notes ?? []).length > 0) },
      { id: 'first-complete', title: 'Complete a task', detail: 'The completion pulse starts counting once work is done.', done: tasks.some((task) => task.status === 'complete') },
    ];
  }
  const mine = tasks.filter((task) => task.assignedTo === viewerId);
  const me = members.find((member) => member.id === viewerId);
  return [
    { id: 'profile', title: 'Complete your profile', detail: 'A phone number helps the household reach you.', done: !!me?.phone },
    { id: 'assignment', title: 'Get your first assignment', detail: 'Your manager assigns work, or you can claim open tasks.', done: mine.length > 0 },
    { id: 'start', title: 'Start a task', detail: 'Let the household see work in progress.', done: mine.some((task) => task.status === 'in_progress' || task.status === 'complete') },
    { id: 'note', title: 'Add a progress note', detail: 'Keep your manager in the loop without a phone call.', done: mine.some((task) => (task.notes ?? []).some((note) => note.memberId === viewerId)) },
    { id: 'complete', title: 'Complete a task', detail: 'Finished work shows up in the shift handoff.', done: mine.some((task) => task.status === 'complete') },
  ];
}
