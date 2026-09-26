export type OnboardingTask = {
  id: string;
  status: string;
  assignedTo: string | null;
  notes?: Array<{ id: string; memberId?: string }>;
};

export type OnboardingStep = { id: string; title: string; detail: string; done: boolean };

export type FirstLoginGuideStep = {
  id: string;
  /** Short topic label for the Learn library. */
  topic: string;
  title: string;
  /** One plain sentence — the point of this stop. */
  summary: string;
  /** Fuller explanation in everyday language. */
  body: string;
  /** Why this matters for the household. */
  why: string;
  /** Concrete how-to bullets the user can follow later. */
  howTo: string[];
  /** Optional tip for common mistakes. */
  tip?: string;
  /** Optional “try this now” nudge. */
  tryThis?: string;
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
      {
        id: 'add-worker',
        title: 'Invite your first care worker',
        detail: 'Open Team → Add care worker. They get an email link to set a password and join this home.',
        done: members.some((member) => member.role === 'worker'),
      },
      {
        id: 'create-task',
        title: 'Create one household task',
        detail: 'Open Tasks → New task. Give it a clear name, area, and due date so the team knows what “done” looks like.',
        done: tasks.length > 0,
      },
      {
        id: 'assign-task',
        title: 'Assign that task (or leave it open)',
        detail: 'Point it at a care worker, or leave it unassigned so someone can claim it on Today.',
        done: tasks.some((task) => task.assignedTo !== null),
      },
      {
        id: 'first-note',
        title: 'Leave a handoff note on a task',
        detail: 'Open any task and add a short note. The next shift should understand what happened without calling you.',
        done: tasks.some((task) => (task.notes ?? []).length > 0),
      },
      {
        id: 'first-complete',
        title: 'Mark a task complete',
        detail: 'When work is finished, complete it. You can approve it from Overview if it needs your review.',
        done: tasks.some((task) => task.status === 'complete'),
      },
    ];
  }
  const mine = tasks.filter((task) => task.assignedTo === viewerId);
  const me = members.find((member) => member.id === viewerId);
  return [
    {
      id: 'profile',
      title: 'Add a phone number on Profile',
      detail: 'Open Profile and save a number the household can reach in an urgent moment.',
      done: !!me?.phone,
    },
    {
      id: 'assignment',
      title: 'Get (or claim) your first task',
      detail: 'Your manager may assign work, or you can claim an open task from Tasks / Today.',
      done: mine.length > 0,
    },
    {
      id: 'start',
      title: 'Start a task when you begin',
      detail: 'Tap Start so the board shows work in progress — not still waiting.',
      done: mine.some((task) => task.status === 'in_progress' || task.status === 'complete'),
    },
    {
      id: 'note',
      title: 'Add a progress note',
      detail: 'Write one short update on the task. Your manager and the next shift read this instead of chasing texts.',
      done: mine.some((task) => (task.notes ?? []).some((note) => note.memberId === viewerId)),
    },
    {
      id: 'complete',
      title: 'Complete a task when finished',
      detail: 'Mark it complete (and add a proof photo if the task asks for one). That closes the loop for the household.',
      done: mine.some((task) => task.status === 'complete'),
    },
  ];
}

export function firstLoginGuide(role: FirstLoginGuideRole): FirstLoginGuideStep[] {
  if (role === 'viewer') return [];
  if (role === 'manager') {
    return [
      {
        id: 'welcome',
        topic: 'Welcome',
        title: 'Welcome — you run this home’s care board',
        summary: 'CareBoard is the shared board for this household’s care team.',
        body: 'You are the household manager. Everything your care workers see comes from what you set up here: people, tasks, schedule, care plan, and pay hours. This short tour shows each main area once. You can reopen any topic later from Learn CareBoard whenever you need a refresher.',
        why: 'A clear first walkthrough means new managers are never guessing where to click under pressure.',
        howTo: [
          'Press Continue to move the spotlight onto each main screen component.',
          'Press ← or → (or Enter) if you prefer the keyboard.',
          'Skip anytime — you can reopen the full tour or a single topic from Learn CareBoard.',
        ],
        tip: 'Family viewers have a read-only view. Care workers do the day-to-day work. You approve, assign, and keep the household safe.',
        tryThis: 'Look at the highlighted Overview board — that is your daily desk.',
        target: 'panel-home',
        section: 'home',
      },
      {
        id: 'overview',
        topic: 'Overview',
        title: 'Overview: what needs you today',
        summary: 'Start every day on Overview — it surfaces coverage, tickets, and proof photos.',
        body: 'Overview is your command desk. It shows who is on duty, what is overdue, schedule or safety items waiting for a decision, and recent proof photos. You do not need to dig through every section first — Overview tells you where to go.',
        why: 'Managers who open Overview first catch missed coverage and open issues before a shift starts.',
        howTo: [
          'Look at the highlighted Overview board — that whole area is your daily desk.',
          'Read “Needs your decision” first — those items only you can resolve.',
          'Check attendance and any open schedule-change requests.',
          'Scroll for proof photos and recent handoffs when you want evidence, not just status.',
        ],
        tip: 'If Overview feels quiet, that is good — it means nothing is stuck waiting on you.',
        tryThis: 'Tap one decision row (if any). It will take you to the place to act.',
        target: 'panel-home',
        section: 'home',
      },
      {
        id: 'team',
        topic: 'Team',
        title: 'Team: invite people and set rates',
        summary: 'Add care workers and family viewers, then send invite links.',
        body: 'Team is where people join this household. Invite a care worker with their email — they set a password and appear on the board. Set each worker’s hourly rate here so payroll hours can show a gross estimate later. You can also disable someone who should no longer sign in.',
        why: 'Without a team, tasks have nowhere to go. Rates on Team feed bookkeeper-ready hour reports.',
        howTo: [
          'The highlighted Team screen is where people live.',
          'Use Add care worker (or invite a family viewer).',
          'Enter name and email, then send the invite.',
          'Open a worker’s profile to set hourly rate, phone, and certifications.',
        ],
        tip: 'CareBoard does not pay people. It tracks hours and rates so you (or your bookkeeper) can pay outside the app.',
        tryThis: 'Invite a test worker or open an existing profile and confirm the hourly rate is set.',
        target: 'panel-team',
        section: 'team',
      },
      {
        id: 'tasks',
        topic: 'Tasks',
        title: 'Tasks: create work and review what is done',
        summary: 'Tasks are the household’s to-do list — create, assign, and approve.',
        body: 'Every chore, med reminder, and errand should live as a task. Give a clear title, area, due date, and optional instructions. Assign it or leave it open to claim. When a worker marks something complete, you may see it under review on Overview so you can approve or send it back.',
        why: 'Written tasks replace “I thought you were doing that” — the board is the shared memory.',
        howTo: [
          'Look at the highlighted Tasks list — this is the household work queue.',
          'Use Add task / New task.',
          'Write a title a stranger could understand (“Refill Metformin — pharmacy pickup”).',
          'Assign a care worker, or leave unassigned for someone to claim.',
        ],
        tip: 'Recurring tasks need a first due date. CareBoard then creates the next copies for you.',
        tryThis: 'Create one real task due today and assign it.',
        target: 'panel-tasks',
        section: 'tasks',
      },
      {
        id: 'schedule',
        topic: 'Schedule',
        title: 'Schedule: who works when',
        summary: 'Set two-week shift patterns so coverage is visible.',
        body: 'Schedule shows who is expected on which days. From Team you set each worker’s two-week shift pattern. Workers can ask for a day-off coverage swap; teammates can accept. Overview attendance uses this schedule, so keep it truthful.',
        why: 'Funding and safety both depend on knowing who should be in the home.',
        howTo: [
          'The highlighted Schedule calendar is the coverage map.',
          'From Team, choose a care worker and edit their shifts.',
          'Mark days for week A and week B of the two-week cycle.',
          'Watch Inbox / Overview when someone requests coverage.',
        ],
        tip: 'A day marked on both weeks means every week. One week only means every other week.',
        tryThis: 'Confirm at least one worker has shifts for today or tomorrow.',
        target: 'panel-schedule',
        section: 'schedule',
      },
      {
        id: 'care-plan',
        topic: 'Care plan',
        title: 'Care plan: know the person you support',
        summary: 'Medications, appointments, About me, and supplies live here.',
        body: 'The care plan is the shared picture of the client: how to support them, medication rounds, upcoming appointments, and supply needs. Care workers log doses and can complete appointments they accompany. Keep About me current — it is what new staff should read first.',
        why: 'Good care starts with knowing the person, not only the task list.',
        howTo: [
          'The highlighted Care plan panel is the client’s story.',
          'Fill About me in plain language (likes, dislikes, how to help).',
          'Add medications with times; workers log given / refused / held.',
          'Add appointments and assign who is accompanying.',
        ],
        tip: 'Refused or held doses can alert you in Inbox — treat those as clinical communication, not noise.',
        tryThis: 'Open About me and fix one sentence that a new worker would need.',
        target: 'panel-client',
        section: 'client',
      },
      {
        id: 'inbox',
        topic: 'Inbox',
        title: 'Inbox: talk with the team',
        summary: 'Direct messages, safety follow-up, and client-note reviews land here.',
        body: 'Inbox is how you and care workers talk inside CareBoard — no new push notifications yet, so check it during the day. You can message one person or the whole team. Safety alerts and client notes waiting for approval also show up here for you to clear.',
        why: 'A single place for follow-up beats scattered texts when something urgent happens.',
        howTo: [
          'The highlighted Inbox is the care-team message board.',
          'Use the composer to message a care worker or post to the team.',
          'Review any safety items and mark them reviewed when handled.',
          'Approve or reject client notes so they become part of the record.',
        ],
        tip: 'Workers only see their own safety reports. You see what needs triage.',
        tryThis: 'Send yourself a short team message so you know how it looks on their side.',
        target: 'panel-messages',
        section: 'messages',
      },
      {
        id: 'hr',
        topic: 'HR & payroll',
        title: 'HR: people, leave, documents, pay runs',
        summary: 'HR is for roster admin, leave, policies, hire checklists, and hour review.',
        body: 'HR gathers people ops: leave requests to approve, documents workers must acknowledge, hire checklists for new staff, and Payroll for pay periods. Closing a pay run builds gross wage statements from clocked hours and rates. Download CSV or email your bookkeeper — CareBoard does not issue paychecks or calculate CRA deductions.',
        why: 'Hours and paperwork stay beside the care board so you are not juggling three spreadsheets.',
        howTo: [
          'The highlighted HR payroll area is where hours become a pay run.',
          'Open HR and skim People, Leave, Documents, Onboarding, Payroll.',
          'Set rates on Team first if Payroll estimates look empty.',
          'Use Payroll to review hours, start review, then close a pay run when ready.',
        ],
        tip: 'If a worker asks “where is my paycheck?” — point them to More → Your pay for estimates and statements, and clarify pay happens outside CareBoard.',
        tryThis: 'Open HR → Payroll and read the current pay period status.',
        target: 'panel-hr-payroll',
        section: 'hr',
      },
      {
        id: 'checklist',
        topic: 'Checklist',
        title: 'Getting started checklist',
        summary: 'The green checklist tracks your first real actions in this home.',
        body: 'Under Overview you will see Getting started. It checks off as you invite someone, create and assign a task, leave a note, and complete work. Dismiss it when you no longer need the nudge — the Learn CareBoard library stays available forever.',
        why: 'A short checklist turns the tour into muscle memory with real household data.',
        howTo: [
          'Look at the highlighted Getting started card.',
          'Work through any unchecked items at your own pace.',
          'Dismiss the card when you are comfortable — you can still open Learn CareBoard anytime.',
        ],
        tip: 'Dismissing the checklist does not delete your data. It only hides the reminder card.',
        tryThis: 'Complete one unchecked item before you close this tour.',
        target: 'getting-started',
        section: 'home',
      },
    ];
  }
  return [
    {
      id: 'welcome',
      topic: 'Welcome',
      title: 'Welcome — you are on this household’s care team',
      summary: 'CareBoard shows your work for this home: tasks, schedule, care plan, and messages.',
      body: 'You are a care worker. Your manager set up this board. Each day: clock in, do your tasks, leave notes, and clock out. This tour highlights the places you will use most. You can reopen any topic later from Learn CareBoard if you forget a step.',
      why: 'Clear first steps mean you spend time with the client, not hunting menus.',
      howTo: [
        'Press Continue to move the spotlight to the next screen component.',
        'Use ← → or Enter on a keyboard, Esc to finish early.',
        'Reopen Learn CareBoard anytime for a refresher on one subject.',
      ],
      tip: 'You only see your own pay details and your own safety reports — teammates do not.',
      tryThis: 'Look at Today on the menu. That is your shift home base.',
      target: 'panel-today',
      section: 'today',
    },
    {
      id: 'today',
      topic: 'Today',
      title: 'Today: clock in and see your shift',
      summary: 'Clock in when you arrive. Today lists what you owe this shift.',
      body: 'Today is your landing page. Clock in at the start of the shift and clock out when you leave — that is how hours are recorded for payroll review. You will also see assignments, handoff forms, and safety reporting on this screen.',
      why: 'Clock-in is how the household proves coverage and how your hours are counted.',
      howTo: [
        'The highlighted Today board is your shift home base.',
        'Tap Clock in when your shift starts (Clock out when it ends).',
        'Scan your assigned tasks for the day.',
        'Use handoff and safety forms before you leave if something important happened.',
      ],
      tip: 'You can only have one open clock-in at a time. Clock out before starting another.',
      tryThis: 'If you are on shift now, clock in. If not, just find the Clock in button so you know where it lives.',
      target: 'panel-today',
      section: 'today',
    },
    {
      id: 'tasks',
      topic: 'Tasks',
      title: 'Tasks: start, note, finish, photo',
      summary: 'Open a task → Start → add a note → Complete (photo if asked).',
      body: 'Tasks are your work list. Start a task when you begin so the board shows progress. Add a short note whenever the next person needs context. Complete when finished. If the manager asked for proof, use the camera or photo upload on the task.',
      why: 'Notes and completion status replace “Did you…?” texts between shifts.',
      howTo: [
        'The highlighted Tasks list is your work queue.',
        'Tap Start when you begin.',
        'Add a progress note in plain language.',
        'Tap Complete when done; attach a proof photo if required.',
      ],
      tip: 'Claim open tasks only if you can finish them this shift.',
      tryThis: 'Open one assigned task and read the instructions end to end.',
      target: 'panel-tasks',
      section: 'tasks',
    },
    {
      id: 'handoffs-safety',
      topic: 'Handoffs & safety',
      title: 'Handoffs and safety reports',
      summary: 'Leave a shift handoff. Report hazards or injuries right away.',
      body: 'Before you leave, record a shift handoff: what you finished, what is still open, and what you noticed. If something is unsafe — a hazard, injury, threat, or near miss — submit a safety report. Your manager triages it. You only see your own reports.',
      why: 'The next shift and your manager depend on honest handoffs and fast safety reporting.',
      howTo: [
        'The highlighted handoff / safety block sits on Today.',
        'Write completed care, outstanding tasks, and observations.',
        'For danger or injury, use Report a safety issue immediately.',
        'Do not wait until you are home if someone is at risk — report, then call emergency services if needed.',
      ],
      tip: 'CareBoard is not a substitute for 911. Use emergency services first when someone is in immediate danger.',
      tryThis: 'Find both the handoff form and the safety form on Today so muscle memory is there later.',
      target: 'handoffs-safety',
      section: 'today',
    },
    {
      id: 'care-plan',
      topic: 'Care plan',
      title: 'Care plan: meds, appointments, About me',
      summary: 'Read About me. Log medication doses. Check appointments you accompany.',
      body: 'Care plan holds the client’s story and clinical rhythm. Read About me before your first solo shift. Log each medication dose as given, refused, held, or other. If you accompany an appointment, mark it done with a short outcome note.',
      why: 'Accurate dose logs and a current About me keep the client safer when staff change.',
      howTo: [
        'The highlighted Care plan is the client’s shared record.',
        'Read About me.',
        'Open the medication round and log doses for your shift.',
        'Check appointments you are assigned to accompany.',
      ],
      tip: 'Refused or held doses may notify your manager — that is intentional.',
      tryThis: 'Open About me and note one support preference you will use today.',
      target: 'panel-client',
      section: 'client',
    },
    {
      id: 'schedule-profile',
      topic: 'Schedule & profile',
      title: 'Schedule and your Profile',
      summary: 'See your shifts. Keep phone and availability up to date.',
      body: 'Schedule shows when you are expected. Profile is your card: phone number, availability, and certifications. A current phone number matters when the household needs you quickly. Ask your manager if a shift looks wrong — they own the pattern.',
      why: 'Wrong contact info or silent schedule gaps create coverage risk.',
      howTo: [
        'The highlighted Schedule shows when you are expected.',
        'Open Profile and add or update your phone number.',
        'Set availability windows if your manager uses them for auto-assign.',
        'Ask for coverage through the schedule tools if you cannot make a day.',
      ],
      tip: 'Do not invent a shift change in chat only — use the coverage request so the board stays accurate.',
      tryThis: 'Save a phone number on Profile if it is empty.',
      target: 'panel-schedule',
      section: 'schedule',
    },
    {
      id: 'inbox',
      topic: 'Inbox',
      title: 'Inbox: message your manager',
      summary: 'Send a direct message or read team updates here.',
      body: 'Inbox is in-app talk with your manager and teammates. There are no phone push alerts yet, so check Inbox during breaks and at handoff. You can message the manager directly or post to the whole care team.',
      why: 'Keeping care talk on the board keeps context with the household record.',
      howTo: [
        'The highlighted Inbox is where care-team talk lives.',
        'Choose who to message (manager or teammate) and send a clear note.',
        'Read team-wide messages at the bottom of the feed.',
        'Check back after you request coverage — replies often land here.',
      ],
      tip: 'Urgent safety still means call your manager (and 911 if needed) — then log it in CareBoard.',
      tryThis: 'Send a short hello to your manager so you know the path works.',
      target: 'panel-messages',
      section: 'messages',
    },
    {
      id: 'payroll',
      topic: 'Your pay',
      title: 'Hours and pay estimate',
      summary: 'Clocked hours and your rate create estimates — not a paycheck.',
      body: 'More → Your pay shows your hourly rate (if set), hours in the open pay period, a rough gross estimate, and wage statements after your manager closes a pay run. CareBoard does not deposit money. Questions about take-home pay go to your employer or bookkeeper.',
      why: 'You deserve a clear view of recorded hours without seeing anyone else’s pay.',
      howTo: [
        'The highlighted Your pay card shows hours and estimates.',
        'Clock in and out on Today every shift.',
        'After a pay run closes, open wage statements for that period.',
        'Ask your manager if a rate or hour looks wrong.',
      ],
      tip: 'Other workers never see your pay. Keep rate conversations with your manager.',
      tryThis: 'Open Your pay once so you know where it lives.',
      target: 'your-pay',
      section: 'more',
    },
    {
      id: 'checklist',
      topic: 'Checklist',
      title: 'Getting started checklist',
      summary: 'The checklist tracks your first profile, task, note, and completion.',
      body: 'On Today you will see Getting started. It checks off as you add a phone number, get a task, start it, leave a note, and complete work. Dismiss it when you are comfortable. Learn CareBoard stays available whenever you want a refresher on one subject.',
      why: 'Small first actions build the habit the household relies on.',
      howTo: [
        'Look at the highlighted Getting started card.',
        'Finish any unchecked items when you have a quiet minute.',
        'Dismiss the card when ready — reopen topics from Learn CareBoard anytime.',
      ],
      tip: 'Skipping the tour is fine. Skipping clock-in and notes is not — those keep the home safe and paid accurately.',
      tryThis: 'Tick off one checklist item before you end this tour.',
      target: 'getting-started',
      section: 'today',
    },
  ];
}

/** Topic index for the Learn library (same order as the tour). */
export function guideTopics(role: FirstLoginGuideRole): Array<{ id: string; topic: string; title: string; summary: string }> {
  return firstLoginGuide(role).map(({ id, topic, title, summary }) => ({ id, topic, title, summary }));
}
