import 'server-only';
import { cookies } from 'next/headers';
import type { AuthenticatedAccess } from '@/lib/auth-access';
import type { HouseholdState, Member, Chore, Shift, TimeEntry, Message, AuditEntry, ActivityItem, ClientNoteSubmission } from '@/lib/household-data';
import type { InboxItem } from '@/lib/client-notes';
import { triageSafetyIncident, validateSafetyIncident, validateShiftHandoff } from '@/lib/care-safety';
import { coverageAcceptedMessage, coverageAskMessage, scheduleChangeRequest } from '@/lib/client-notes';
import { cycleWeekOf } from '@/lib/shifts';
import type { Certification } from '@/lib/certifications';
import type { Role } from '@/lib/access-policy';
import { normalizeLayout, randomThemeId, themeById } from '@/lib/dashboard-widgets';

const now = new Date().toISOString();
const today = now.slice(0, 10);

const manager: Member = {
  id: 'member-manager',
  name: 'Dana',
  role: 'manager',
  status: 'active',
  email: 'local@example.com',
  color: '#287b6f',
  createdAt: now,
  phone: null,
  availability: 'Anytime',
  skillsNotes: '',
  emergencyContact: null,
  certifications: '',
  languages: 'English',
  profilePhotoId: null,
  hourlyRate: null,
  theme: 'teal',
  dashboardLayout: null,
};

const worker: Member = {
  id: 'member-worker-1',
  name: 'Alex',
  role: 'worker',
  status: 'active',
  email: 'alex@example.com',
  color: '#d36f4e',
  createdAt: now,
  phone: null,
  availability: 'Weekdays after 2pm',
  skillsNotes: 'First aid certified',
  emergencyContact: null,
  certifications: 'First aid',
  languages: 'English, French',
  profilePhotoId: null,
  hourlyRate: 22,
  dateOfBirth: '1990-04-12',
  address: '123 Example St, Vancouver, BC',
  jobTitle: 'Care worker',
  employmentStartedOn: '2025-01-15',
  theme: 'forest',
  dashboardLayout: null,
};

const worker2: Member = {
  id: 'member-worker-2',
  name: 'Maya',
  role: 'worker',
  status: 'active',
  email: 'maya@example.com',
  color: '#986ca5',
  createdAt: now,
  phone: null,
  availability: 'Weekends and evenings',
  skillsNotes: 'Dementia care',
  emergencyContact: null,
  certifications: '',
  languages: 'English',
  profilePhotoId: null,
  hourlyRate: 24,
  dateOfBirth: '1995-08-02',
  address: '45 Demo Ave, Vancouver, BC',
  jobTitle: 'Care worker',
  employmentStartedOn: '2025-06-01',
  theme: 'plum',
  dashboardLayout: null,
};

const viewerMember: Member = {
  id: 'member-viewer-1',
  name: 'Jordan',
  role: 'viewer',
  status: 'active',
  email: 'jordan@example.com',
  color: '#5b72b8',
  createdAt: now,
  phone: null,
  availability: '',
  skillsNotes: '',
  emergencyContact: null,
  certifications: '',
  languages: '',
  profilePhotoId: null,
  hourlyRate: null,
  theme: 'plum',
  dashboardLayout: null,
};

function makeChore(overrides: Partial<Chore> & Pick<Chore, 'id' | 'title' | 'area' | 'dueDate' | 'priority' | 'status' | 'assignedTo'>): Chore {
  return {
    dueTime: null,
    instructions: '',
    recurrence: null,
    reviewStatus: null,
    createdBy: manager.id,
    completedBy: null,
    createdAt: now,
    startedAt: null,
    completedAt: null,
    progressNotes: '',
    completionNotes: '',
    issueReport: '',
    issueOpen: false,
    reminderLeadDays: 1,
    expectedCompletionAt: null,
    photos: [],
    notes: [],
    ...overrides,
  } as Chore;
}

type RawLocalState = Omit<HouseholdState, 'clientNotes' | 'clientNoteQueue' | 'inbox' | 'safetyAlerts' | 'viewer' | 'taskGroups' | 'metrics' | 'reminders' | 'announcements'> & {
  clientNoteSubmissions: ClientNoteSubmission[];
  inboxItems: InboxItem[];
};

const mockState: RawLocalState = {
  members: [manager, worker, worker2, viewerMember],
  chores: [
    makeChore({ id: 'chore-1', title: 'Prepare breakfast', area: 'Kitchen', dueDate: today, dueTime: '08:00', priority: 'normal', status: 'open', assignedTo: worker.id }),
    makeChore({ id: 'chore-2', title: 'Take out recycling', area: 'Outside', dueDate: today, priority: 'high', status: 'open', assignedTo: null }),
    makeChore({ id: 'chore-3', title: 'Medication reminder', area: 'Other', dueDate: today, dueTime: '09:00', priority: 'urgent', status: 'in_progress', assignedTo: worker.id, startedAt: now, progressNotes: 'Started on time.' }),
    makeChore({ id: 'chore-4', title: 'Change bed sheets', area: 'Bedroom', dueDate: today, dueTime: '10:00', priority: 'normal', status: 'complete', assignedTo: worker.id, completedBy: worker.id, startedAt: now, completedAt: now, reviewStatus: 'pending' }),
  ],
  activity: [],
  audit: [],
  settings: { householdId: 'default', recurrenceHorizonDays: 30, reminderDefaultLeadDays: 1, retentionDays: 90, fundedHoursMonthly: 120, fundingHourlyRate: 25, bookkeeperEmail: '', payrollLastSent: '', updatedAt: now },
  shifts: [
    { id: 'shift-1', memberId: worker.id, weekday: new Date().getDay(), startTime: '08:00', endTime: '16:00', cycleWeek: 0, createdAt: now },
    { id: 'shift-2', memberId: worker2.id, weekday: (new Date().getDay() + 1) % 7, startTime: '09:00', endTime: '17:00', cycleWeek: 0, createdAt: now },
  ],
  availability: [{ id: 'avail-1', memberId: worker.id, weekday: 1, startTime: '14:00', endTime: '20:00', cycleWeek: 0, createdAt: now }],
  timeEntries: [],
  certifications: [],
  messages: [],
  clientNoteSubmissions: [],
  inboxItems: [],
  shiftHandoffs: [],
  safetyIncidents: [],
  scheduleRequests: [],
};

type LocalPersona = 'manager' | 'worker' | 'worker2' | 'viewer';

async function localDevPersona(): Promise<LocalPersona> {
  const cookieStore = await cookies();
  const cookie = cookieStore.get('careboard-local-role')?.value;
  if (cookie === 'worker' || cookie === 'worker2' || cookie === 'viewer' || cookie === 'manager') return cookie;
  return 'manager';
}

function memberForPersona(persona: LocalPersona): Member {
  if (persona === 'worker') return worker;
  if (persona === 'worker2') return worker2;
  if (persona === 'viewer') return viewerMember;
  return manager;
}

export async function localDevAccess(): Promise<AuthenticatedAccess> {
  const member = memberForPersona(await localDevPersona());
  return {
    memberId: member.id,
    email: member.email ?? 'local@example.com',
    role: member.role,
    credentialLogin: false,
    mustChangePassword: false,
  };
}

export function getLocalDevRawState(): RawLocalState {
  return mockState;
}

function logUnhandled(action: string, input: Record<string, unknown>) {
  // eslint-disable-next-line no-console
  console.log('[local-dev] Unhandled action:', action, input);
}

function pushActivity(action: string, detail: string) {
  const item: ActivityItem = { id: crypto.randomUUID(), choreId: null, memberId: manager.id, action, detail, createdAt: new Date().toISOString() };
  mockState.activity = [item, ...(mockState.activity ?? [])];
}

function pushAudit(action: string, detail: string) {
  const entry: AuditEntry = { id: crypto.randomUUID(), choreId: null, actorId: manager.id, action, detail, createdAt: new Date().toISOString() };
  mockState.audit = [entry, ...(mockState.audit ?? [])].slice(0, 200);
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLength);
}

export function mutateLocalDevState(input: Record<string, unknown>): RawLocalState {
  const action = requiredString(input.action, 'Action');
  const actorId = typeof input.actorId === 'string' ? input.actorId : manager.id;
  const now2 = new Date().toISOString();
  // Mirror the production rule so role previews behave like the real backend.
  if (actorId === viewerMember.id) throw new Error('Family viewers have read-only access.');

  const findChore = (id: string) => {
    const chore = mockState.chores.find((c) => c.id === id);
    if (!chore) throw new Error('That chore no longer exists.');
    return chore;
  };

  const findMember = (id: string) => {
    const member = mockState.members.find((m) => m.id === id);
    if (!member) throw new Error('Member not found.');
    return member;
  };

  switch (action) {
    case 'createChore': {
      const title = requiredString(input.title, 'Chore name');
      const area = requiredString(input.area, 'Area');
      const dueDate = typeof input.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
      const dueTime = typeof input.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.dueTime) ? input.dueTime : null;
      const priority = ['low', 'normal', 'high', 'urgent'].includes(String(input.priority)) ? String(input.priority) : 'normal';
      const instructions = optionalString(input.instructions, 4000);
      const recurrence = ['daily', 'weekly', 'monthly'].includes(String(input.recurrence)) ? String(input.recurrence) : null;
      const assigneeId = typeof input.assigneeId === 'string' && input.assigneeId ? input.assigneeId : null;
      const reminderLeadDays = Number(input.reminderLeadDays) || 1;
      const chore = makeChore({
        id: crypto.randomUUID(),
        title,
        area,
        dueDate,
        dueTime,
        priority: priority as Chore['priority'],
        status: 'open',
        assignedTo: assigneeId,
        recurrence: recurrence as Chore['recurrence'],
        instructions,
        reminderLeadDays,
        createdAt: now2,
      });
      mockState.chores.push(chore);
      pushActivity(assigneeId ? 'assigned' : 'created', `${assigneeId ? 'assigned' : 'added'} ${title}`);
      break;
    }
    case 'updateTask': {
      const choreId = requiredString(input.choreId, 'Chore');
      const chore = findChore(choreId);
      if (typeof input.title === 'string') chore.title = input.title;
      if (typeof input.area === 'string') chore.area = input.area;
      if (typeof input.dueDate === 'string') chore.dueDate = input.dueDate || null;
      if (typeof input.dueTime === 'string') chore.dueTime = input.dueTime || null;
      if (typeof input.priority === 'string') chore.priority = input.priority as Chore['priority'];
      if (typeof input.assigneeId === 'string') chore.assignedTo = input.assigneeId || null;
      if (typeof input.recurrence === 'string') chore.recurrence = input.recurrence as Chore['recurrence'] || null;
      if (typeof input.reminderLeadDays === 'string' || typeof input.reminderLeadDays === 'number') chore.reminderLeadDays = Number(input.reminderLeadDays);
      if (typeof input.instructions === 'string') chore.instructions = input.instructions;
      if (typeof input.progressNotes === 'string') chore.progressNotes = input.progressNotes;
      if (typeof input.completionNotes === 'string') chore.completionNotes = input.completionNotes;
      if (typeof input.issueReport === 'string') chore.issueReport = input.issueReport;
      if (typeof input.expectedCompletionAt === 'string') chore.expectedCompletionAt = input.expectedCompletionAt || null;
      chore.issueOpen = input.issueOpen === 'on' || input.issueOpen === true || input.issueOpen === 'true';
      pushActivity('updated', `updated ${chore.title}`);
      break;
    }
    case 'claim': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      if (chore.status === 'open' && !chore.assignedTo) {
        chore.assignedTo = actorId;
        pushActivity('claimed', `claimed ${chore.title}`);
      }
      break;
    }
    case 'start': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      if (chore.status === 'open' && chore.assignedTo === actorId) {
        chore.status = 'in_progress';
        chore.startedAt = now2;
        pushActivity('started', `started ${chore.title}`);
      }
      break;
    }
    case 'complete': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      if (chore.status !== 'complete' && (actorId === manager.id || chore.assignedTo === actorId)) {
        chore.status = 'complete';
        chore.completedBy = actorId;
        chore.completedAt = now2;
        chore.reviewStatus = actorId === manager.id ? null : 'pending';
        pushActivity('completed', `finished ${chore.title}`);
      }
      break;
    }
    case 'takeover': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      if (chore.status !== 'complete' && chore.assignedTo && chore.assignedTo !== actorId) {
        chore.assignedTo = actorId;
        chore.status = 'open';
        chore.startedAt = null;
        chore.notes = chore.notes ?? [];
        chore.notes.push({ id: crypto.randomUUID(), choreId: chore.id, memberId: actorId, kind: 'progress', body: 'Took over', createdAt: now2 });
        pushActivity('took_over', `took over ${chore.title}`);
      }
      break;
    }
    case 'assign': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      const assigneeId = typeof input.assigneeId === 'string' && input.assigneeId ? input.assigneeId : null;
      chore.assignedTo = assigneeId;
      pushActivity('assigned', `assigned ${chore.title}`);
      break;
    }
    case 'unclaim': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      chore.assignedTo = null;
      pushActivity('unclaimed', `unclaimed ${chore.title}`);
      break;
    }
    case 'approveTask': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      chore.reviewStatus = null;
      pushActivity('approved', `approved ${chore.title}`);
      break;
    }
    case 'reopenTask': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      chore.status = 'open';
      chore.reviewStatus = null;
      chore.completedAt = null;
      chore.completedBy = null;
      pushActivity('reopened', `sent back ${chore.title}`);
      break;
    }
    case 'postMessage': {
      const body = requiredString(input.body, 'Message').slice(0, 1000);
      const message: Message = { id: crypto.randomUUID(), memberId: actorId, body, createdAt: now2 };
      mockState.messages = [message, ...(mockState.messages ?? [])].slice(0, 100);
      pushActivity('posted_message', body.slice(0, 200));
      break;
    }
    case 'announce': {
      const body = requiredString(input.body, 'Announcement').slice(0, 500);
      pushActivity('announcement', body);
      break;
    }
    case 'updateHouseholdSettings': {
      const settings = mockState.settings!;
      if (typeof input.recurrenceHorizonDays === 'string' || typeof input.recurrenceHorizonDays === 'number') settings.recurrenceHorizonDays = Math.max(1, Math.min(365, Number(input.recurrenceHorizonDays))) || 30;
      if (typeof input.reminderDefaultLeadDays === 'string' || typeof input.reminderDefaultLeadDays === 'number') settings.reminderDefaultLeadDays = Math.max(0, Math.min(30, Number(input.reminderDefaultLeadDays))) || 1;
      if (typeof input.fundedHoursMonthly === 'string' || typeof input.fundedHoursMonthly === 'number') settings.fundedHoursMonthly = Math.max(0, Number(input.fundedHoursMonthly));
      if (typeof input.fundingHourlyRate === 'string' || typeof input.fundingHourlyRate === 'number') settings.fundingHourlyRate = Math.max(0, Number(input.fundingHourlyRate));
      if (typeof input.bookkeeperEmail === 'string') settings.bookkeeperEmail = input.bookkeeperEmail;
      settings.updatedAt = now2;
      pushAudit('update_settings', 'Updated household settings');
      break;
    }
    case 'updateProfile': {
      const memberId = requiredString(input.memberId, 'Profile');
      const member = findMember(memberId);
      if (typeof input.name === 'string') member.name = input.name;
      if (typeof input.email === 'string') member.email = input.email;
      if (typeof input.phone === 'string') member.phone = input.phone || null;
      if (typeof input.availability === 'string') member.availability = input.availability;
      if (typeof input.languages === 'string') member.languages = input.languages;
      if (typeof input.skillsNotes === 'string') member.skillsNotes = input.skillsNotes;
      if (typeof input.certifications === 'string') member.certifications = input.certifications;
      if (typeof input.emergencyContact === 'string') member.emergencyContact = input.emergencyContact || null;
      if (typeof input.hourlyRate === 'string' || typeof input.hourlyRate === 'number') member.hourlyRate = Number(input.hourlyRate) || null;
      if (typeof input.dateOfBirth === 'string') member.dateOfBirth = input.dateOfBirth || null;
      if (typeof input.address === 'string') member.address = input.address;
      if (typeof input.jobTitle === 'string') member.jobTitle = input.jobTitle;
      if (typeof input.employmentStartedOn === 'string') member.employmentStartedOn = input.employmentStartedOn || null;
      break;
    }
    case 'saveDashboard': {
      const member = findMember(actorId);
      if (input.theme !== undefined) {
        const theme = input.theme === null || input.theme === '' ? null : requiredString(input.theme, 'Theme');
        if (theme && !themeById(theme)) throw new Error('Choose a theme from the gallery.');
        member.theme = theme;
      }
      if (input.layout !== undefined) member.dashboardLayout = normalizeLayout(member.role as 'manager' | 'worker' | 'viewer', input.layout);
      break;
    }
    case 'addMember':
    case 'inviteMember': {
      const name = requiredString(input.name, 'Full name');
      const email = requiredString(input.googleEmail, 'Email');
      const role = input.role === 'viewer' ? 'viewer' : 'worker';
      const newMember: Member = {
        id: crypto.randomUUID(),
        name,
        role: role as Role,
        status: 'active',
        email,
        color: ['#5b72b8', '#986ca5', '#b57e1c'][mockState.members.length % 3],
        createdAt: now2,
        phone: null,
        availability: '',
        skillsNotes: '',
        emergencyContact: null,
        certifications: '',
        languages: '',
        profilePhotoId: null,
        hourlyRate: null,
        theme: randomThemeId(),
        dashboardLayout: null,
      };
      mockState.members.push(newMember);
      pushActivity('added_member', `added ${name}`);
      if (action === 'inviteMember') (input as Record<string, unknown>).inviteToken = crypto.randomUUID();
      break;
    }
    case 'disableMember': {
      const member = findMember(requiredString(input.memberId, 'Member'));
      member.status = 'disabled';
      pushActivity('disabled', `disabled ${member.name}`);
      break;
    }
    case 'reactivateMember': {
      const member = findMember(requiredString(input.memberId, 'Member'));
      member.status = 'active';
      pushActivity('reactivated', `reactivated ${member.name}`);
      break;
    }
    case 'setShifts':
    case 'setAvailability': {
      const memberId = requiredString(input.memberId, 'Member');
      const raw = typeof input.shifts === 'string' ? input.shifts : typeof input.windows === 'string' ? input.windows : '[]';
      const rows: Array<{ weekday: number; startTime: string; endTime: string; cycleWeek?: number }> = JSON.parse(raw);
      const target: Shift[] = rows.map((row, index) => ({ id: `${action}-${memberId}-${index}`, memberId, weekday: row.weekday, startTime: row.startTime, endTime: row.endTime, cycleWeek: row.cycleWeek ?? 0, createdAt: now2 }));
      if (action === 'setShifts') mockState.shifts = (mockState.shifts ?? []).filter((s) => s.memberId !== memberId).concat(target);
      else mockState.availability = (mockState.availability ?? []).filter((s) => s.memberId !== memberId).concat(target);
      break;
    }
    case 'addNote': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      const kind = typeof input.kind === 'string' ? input.kind : 'progress';
      const body = requiredString(input.body, 'Note').slice(0, 2000);
      chore.notes = chore.notes ?? [];
      chore.notes.push({ id: crypto.randomUUID(), choreId: chore.id, memberId: actorId, kind: kind as 'progress' | 'completion' | 'issue', body, createdAt: now2 });
      break;
    }
    case 'saveCertification': {
      const memberId = requiredString(input.memberId, 'Member');
      const name = requiredString(input.name, 'Certification name');
      const expiresOn = requiredString(input.expiresOn, 'Expiry date');
      const cert: Certification = { id: crypto.randomUUID(), memberId, name, expiresOn, createdAt: now2 };
      mockState.certifications = [cert, ...(mockState.certifications ?? [])];
      break;
    }
    case 'deleteCertification': {
      const id = requiredString(input.id, 'Certification');
      mockState.certifications = (mockState.certifications ?? []).filter((c) => c.id !== id);
      break;
    }
    case 'clockIn': {
      const entry: TimeEntry = { id: crypto.randomUUID(), memberId: actorId, startedAt: now2, endedAt: null, createdAt: now2 };
      mockState.timeEntries = [entry, ...(mockState.timeEntries ?? [])];
      break;
    }
    case 'clockOut': {
      const open = (mockState.timeEntries ?? []).find((e) => e.memberId === actorId && !e.endedAt);
      if (open) open.endedAt = now2;
      break;
    }
    case 'deleteTimeEntry': {
      const entryId = requiredString(input.entryId, 'Time entry');
      mockState.timeEntries = (mockState.timeEntries ?? []).filter((e) => e.id !== entryId);
      break;
    }
    case 'deleteUpload': {
      const uploadId = requiredString(input.uploadId, 'Upload');
      for (const chore of mockState.chores) {
        chore.photos = (chore.photos ?? []).filter((photo) => photo.id !== uploadId);
      }
      break;
    }
    case 'resetMemberPassword':
    case 'reinviteMember':
    case 'reviewClientNote':
    case 'acknowledgeSafetyAlert':
    case 'sendInboxMessage':
    case 'sendPayrollReport': {
      // No-op in local-dev preview mode; UI feedback is enough.
      break;
    }
    case 'requestScheduleChange': {
      const shift = (mockState.shifts ?? []).find((item) => item.id === input.shiftId && item.memberId === actorId) ?? null;
      const request = scheduleChangeRequest(input.date, input.reason, shift);
      if (shift?.cycleWeek && cycleWeekOf(request.date) !== shift.cycleWeek) throw new Error('That shift does not run on that date — check the two-week schedule.');
      if ((mockState.scheduleRequests ?? []).some((item) => item.requesterId === actorId && item.requestedDate === request.date)) throw new Error('You already requested a schedule change for that date.');
      mockState.scheduleRequests = [{ id: crypto.randomUUID(), requesterId: actorId, shiftId: request.shift.id, requestedDate: request.date, startTime: request.shift.startTime, endTime: request.shift.endTime, reason: request.reason, status: 'open', acceptedBy: null, acceptedAt: null, createdAt: now2 }, ...(mockState.scheduleRequests ?? [])];
      const actorName = mockState.members.find((item) => item.id === actorId)?.name ?? 'A teammate';
      for (const coworker of mockState.members.filter((item) => item.role === 'worker' && item.id !== actorId && item.status === 'active')) {
        mockState.inboxItems = [{ id: crypto.randomUUID(), workerId: coworker.id, kind: 'direct_message', body: coverageAskMessage(actorName, request.date, request.shift.startTime, request.shift.endTime, request.reason), submissionId: null, createdBy: actorId, createdAt: now2 }, ...(mockState.inboxItems ?? [])];
      }
      break;
    }
    case 'acceptScheduleCoverage': {
      const request = (mockState.scheduleRequests ?? []).find((item) => item.id === input.requestId);
      if (!request || request.status !== 'open') throw new Error('That coverage request is no longer available.');
      if (request.requesterId === actorId) throw new Error('You cannot accept your own coverage request.');
      request.status = 'covered';
      request.acceptedBy = actorId;
      request.acceptedAt = now2;
      const actorName = mockState.members.find((item) => item.id === actorId)?.name ?? 'A teammate';
      mockState.inboxItems = [{ id: crypto.randomUUID(), workerId: request.requesterId, kind: 'direct_message', body: coverageAcceptedMessage(actorName, request.requestedDate, request.startTime, request.endTime), submissionId: null, createdBy: actorId, createdAt: now2 }, ...(mockState.inboxItems ?? [])];
      break;
    }
    case 'nudgeCoverageRequest': {
      const request = (mockState.scheduleRequests ?? []).find((item) => item.id === input.requestId);
      if (!request || request.status !== 'open') throw new Error('That coverage request is no longer open.');
      if (request.requesterId !== actorId) throw new Error('Only the requester or the manager can nudge this request.');
      break;
    }
    case 'recordShiftHandoff': {
      const handoff = validateShiftHandoff(input, now2.slice(0, 10));
      mockState.shiftHandoffs = [
        { id: crypto.randomUUID(), authorId: actorId, shiftDate: handoff.shiftDate, completedCare: handoff.completedCare, outstandingTasks: handoff.outstandingTasks, observations: handoff.observations, checklist: handoff.checklist, createdAt: now2 },
        ...(mockState.shiftHandoffs ?? []),
      ];
      pushActivity('recorded_handoff', `recorded a shift handoff for ${handoff.shiftDate}`);
      break;
    }
    case 'reportSafetyIncident': {
      const incident = validateSafetyIncident(input, now2);
      mockState.safetyIncidents = [
        { id: crypto.randomUUID(), reporterId: actorId, category: incident.category, severity: incident.severity, occurredAt: incident.occurredAt, location: incident.location, description: incident.description, immediateAction: incident.immediateAction, status: 'submitted', assignedTo: null, followUp: '', resolvedAt: null, createdAt: now2, updatedAt: now2 },
        ...(mockState.safetyIncidents ?? []),
      ];
      pushActivity('safety_incident_reported', `reported a ${incident.severity} safety concern`);
      break;
    }
    case 'triageSafetyIncident': {
      const incidentId = requiredString(input.incidentId, 'Safety report');
      const incident = (mockState.safetyIncidents ?? []).find((item) => item.id === incidentId);
      if (!incident) throw new Error('That safety report no longer exists.');
      const triage = triageSafetyIncident({ status: incident.status }, input);
      incident.status = triage.status;
      incident.assignedTo = triage.assignedTo;
      incident.followUp = triage.followUp;
      incident.resolvedAt = triage.resolved ? now2 : null;
      incident.updatedAt = now2;
      pushActivity('safety_incident_triaged', `${triage.status} safety report`);
      break;
    }
    default:
      logUnhandled(action, input);
  }

  mockState.settings = mockState.settings ?? { householdId: 'default', recurrenceHorizonDays: 30, reminderDefaultLeadDays: 1, retentionDays: 90, fundedHoursMonthly: 120, fundingHourlyRate: 25, updatedAt: now2 };
  return mockState;
}
