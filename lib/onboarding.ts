export type OnboardingTask = {
  id: string;
  status: string;
  assignedTo: string | null;
  notes?: Array<{ id: string; memberId?: string }>;
};

export type OnboardingStep = { id: string; title: string; detail: string; done: boolean };

export type FirstLoginGuideStep = {
  id: string;
  title: string;
  body: string;
  /** Matches `[data-guide="…"]` in the dashboard. */
  target: string;
  /** Section to open before highlighting the target. */
  section: string;
};

export type FirstLoginGuideRole = 'manager' | 'worker' | 'viewer';

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
      { id: 'assign-task', title: 'Assign a task', detail: 'Point work at a specific care worker or leave it open to claim.', done: tasks.some((task) => task.assignedTo !== null) },
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

export function firstLoginGuide(role: FirstLoginGuideRole): FirstLoginGuideStep[] {
  if (role === 'viewer') return [];
  if (role === 'manager') {
    return [
      {
        id: 'overview',
        title: 'Your Overview',
        body: 'Coverage, open issues, and today’s handoffs start here so you can see what needs attention first.',
        target: 'nav-home',
        section: 'home',
      },
      {
        id: 'team',
        title: 'Build your Team',
        body: 'Add care workers, set their shifts, and send invites so everyone can sign in.',
        target: 'nav-team',
        section: 'team',
      },
      {
        id: 'tasks',
        title: 'Create and assign Tasks',
        body: 'Create household work, assign it to the right person, and review what is finished.',
        target: 'nav-tasks',
        section: 'tasks',
      },
      {
        id: 'inbox',
        title: 'Watch your Inbox',
        body: 'Messages, safety follow-up, and client notes land here for you to triage.',
        target: 'nav-messages',
        section: 'messages',
      },
      {
        id: 'payroll',
        title: 'Payroll for your bookkeeper',
        body: 'Set each worker’s hourly rate on Team, save a bookkeeper email in Settings, then download or email the two-week CSV. CareBoard tracks hours — it does not issue paychecks.',
        target: 'payroll-bookkeeper',
        section: 'more',
      },
      {
        id: 'checklist',
        title: 'Getting started checklist',
        body: 'The checklist underneath checks off as the household gets moving, and you can dismiss it on its own.',
        target: 'getting-started',
        section: 'home',
      },
    ];
  }
  return [
    {
      id: 'today',
      title: 'Start on Today',
      body: 'Clock in, see your assignments, and leave a handoff when your shift ends.',
      target: 'nav-today',
      section: 'today',
    },
    {
      id: 'tasks',
      title: 'Work your Tasks',
      body: 'Start and finish work, and add a progress note so the next shift knows where things stand.',
      target: 'nav-tasks',
      section: 'tasks',
    },
    {
      id: 'handoffs-safety',
      title: 'Handoffs and safety',
      body: 'Both live on Today. You only see your own safety reports.',
      target: 'handoffs-safety',
      section: 'today',
    },
    {
      id: 'schedule-profile',
      title: 'Schedule and Profile',
      body: 'Your shifts are on Schedule. A phone number on Profile lets the household reach you.',
      target: 'nav-schedule',
      section: 'schedule',
    },
    {
      id: 'payroll',
      title: 'Hours and pay estimate',
      body: 'Clock in on Today. More → Your pay shows your rate (set by your manager), hours this month, and an estimate — not a paycheck. Other workers never see your pay.',
      target: 'your-pay',
      section: 'more',
    },
    {
      id: 'checklist',
      title: 'Getting started checklist',
      body: 'The checklist stays until those first steps are done, or until you dismiss it.',
      target: 'getting-started',
      section: 'today',
    },
  ];
}
