import 'server-only';
import { cookies } from 'next/headers';
import type { AuthenticatedAccess } from '@/lib/auth-access';
import type { HouseholdState, Member, Chore, Shift, TimeEntry, Message, AuditEntry, ActivityItem, ClientNoteSubmission } from '@/lib/household-data';
import type { InboxItem } from '@/lib/client-notes';
import { triageSafetyIncident, validateSafetyIncident, validateShiftHandoff } from '@/lib/care-safety';
import { coverageAcceptedMessage, coverageAskMessage, scheduleChangeRequest } from '@/lib/client-notes';
import { cycleWeekOf } from '@/lib/shifts';
import type { Certification } from '@/lib/certifications';
import { workerCan, type Role } from '@/lib/access-policy';
import { normalizeLayout, randomThemeId, isValidAppearanceToken } from '@/lib/dashboard-widgets';
import { normalizeOperatingHours, parseOperatingWeekdays, serializeOperatingWeekdays } from '@/lib/hours-of-operation';
import { KUDOS_BADGES, canCompleteAppointment, validateAppointment, validateCareProfile, validateDoseLog, validateKudos, validateMedication, validateSupplyItem } from '@/lib/care-plan';
import { DEFAULT_HIRE_CHECKLIST } from '@/lib/hr';
import { aggregateWorkerHours, grossFor, nextPeriod, periodContaining } from '@/lib/hr-payroll';

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
  guideSeenAt: null,
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
  guideSeenAt: null,
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
  guideSeenAt: null,
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
  guideSeenAt: null,
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

const daysFromToday = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };
const hoursAgo = (hours: number) => new Date(Date.now() - hours * 3_600_000).toISOString();

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
  settings: { householdId: 'default', recurrenceHorizonDays: 30, reminderDefaultLeadDays: 1, retentionDays: 90, fundedHoursMonthly: 120, fundingHourlyRate: 25, csilHealthAuthority: 'Example health authority', csilAgreementStart: `${today.slice(0, 4)}-01-01`, csilAgreementEnd: null, csilClientContribution: 0, csilReportDueDays: 45, csilAccountLastFour: '1234', csilContactName: '', csilContactEmail: '', bookkeeperEmail: '', payrollLastSent: '', defaultVacationHours: 80, payPeriodDays: 14, payPeriodAnchor: '2025-01-06', operatingHoursStart: '08:00', operatingHoursEnd: '14:00', operatingWeekdays: '1,2,3,4,5', updatedAt: now },
  csilExpenses: [],
  csilMonthlyReports: [],
  leaveBalances: [
    { memberId: worker.id, kind: 'vacation', hoursEntitled: 80, hoursUsed: 0 },
    { memberId: worker.id, kind: 'sick', hoursEntitled: 0, hoursUsed: 0 },
    { memberId: worker2.id, kind: 'vacation', hoursEntitled: 80, hoursUsed: 8 },
    { memberId: worker2.id, kind: 'sick', hoursEntitled: 24, hoursUsed: 0 },
  ],
  leaveRequests: [],
  hrDocuments: [
    { id: 'hr-doc-1', title: 'Workplace respectful conduct policy', category: 'policy', body: 'Everyone deserves a safe, respectful workplace. Report bullying or harassment to the household manager promptly.', required: true, createdBy: manager.id, createdAt: now, archivedAt: null },
  ],
  hrDocumentAcks: [],
  hireChecklistItems: [
    ...DEFAULT_HIRE_CHECKLIST.map((title, sortOrder) => ({ id: `hire-alex-${sortOrder}`, memberId: worker.id, title, done: sortOrder < 4, doneAt: sortOrder < 4 ? now : null, doneBy: sortOrder < 4 ? manager.id : null, sortOrder })),
    ...DEFAULT_HIRE_CHECKLIST.map((title, sortOrder) => ({ id: `hire-maya-${sortOrder}`, memberId: worker2.id, title, done: true, doneAt: now, doneBy: manager.id, sortOrder })),
  ],
  payPeriods: [{ id: 'pay-period-open', startOn: periodContaining(today, '2025-01-06', 14).startOn, endOn: periodContaining(today, '2025-01-06', 14).endOn, status: 'open' as const, createdAt: now }],
  payRuns: [],
  payRunLines: [],
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
  medications: [
    { id: 'med-1', name: 'Metformin', dose: '500 mg tablet', instructions: 'Give with breakfast and dinner.', times: ['08:00', '18:00'], prn: false, active: true, createdAt: now, updatedAt: now },
    { id: 'med-2', name: 'Vitamin D', dose: '1000 IU', instructions: 'With food.', times: ['08:00'], prn: false, active: true, createdAt: now, updatedAt: now },
    { id: 'med-3', name: 'Melatonin', dose: '3 mg', instructions: '30 minutes before bed.', times: ['21:00'], prn: false, active: true, createdAt: now, updatedAt: now },
    { id: 'med-4', name: 'Acetaminophen', dose: '500 mg', instructions: 'For pain. No more than 4 doses in 24 hours.', times: [], prn: true, active: true, createdAt: now, updatedAt: now },
  ],
  medicationLogs: [
    { id: 'medlog-1', medicationId: 'med-2', doseDate: today, scheduledTime: '08:00', outcome: 'given', note: '', loggedBy: worker.id, loggedAt: now },
  ],
  careProfile: {
    preferredName: 'Sam',
    importantToMe: 'My morning coffee on the porch, calls with my daughter Lisa on Sundays, and keeping my garden tidy.',
    howToSupport: 'Give me time to answer — I get there. Offer choices rather than deciding for me. Knock before coming into my room.',
    communication: 'I hear better on my left side. If I rub my forehead I am getting tired.',
    dailyRoutine: '7:30 wake up and coffee · 8:00 breakfast and meds · 10:00 short walk · 12:30 lunch · 14:00 rest · 18:00 dinner and meds · 21:00 bedtime routine',
    likes: 'Jazz (especially Oscar Peterson), crossword puzzles, talking about the Canucks, butter tarts.',
    dislikes: 'Loud TV, being rushed in the shower, cold rooms. If upset, a cup of tea and quiet music helps.',
    importantToKnow: 'Allergic to penicillin. Uses a walker for longer distances. Type 2 diabetes — watch for low blood sugar.',
    emergencyContacts: 'Lisa (daughter) 604-555-0142 · Dr. Patel 604-555-0199 · London Drugs pharmacy 604-555-0110',
    updatedBy: manager.id,
    updatedAt: now,
  },
  appointments: [
    { id: 'appt-1', title: 'Family doctor check-up', date: daysFromToday(2), time: '10:30', location: 'Dr. Patel, 1200 Main St', notes: 'Bring the blood sugar log.', accompanyingId: worker.id, status: 'scheduled', outcome: '', createdAt: now, updatedAt: now },
    { id: 'appt-2', title: 'Physiotherapy', date: daysFromToday(6), time: '14:00', location: 'Community rehab centre', notes: '', accompanyingId: worker2.id, status: 'scheduled', outcome: '', createdAt: now, updatedAt: now },
  ],
  kudos: [
    { id: 'kudos-1', senderId: manager.id, recipientId: worker.id, badge: 'calm', message: 'Thank you for staying so steady during yesterday’s fall scare.', createdAt: hoursAgo(20) },
    { id: 'kudos-2', senderId: worker.id, recipientId: worker2.id, badge: 'teamwork', message: 'Thanks for covering my Saturday!', createdAt: hoursAgo(50) },
  ],
  supplies: [
    { id: 'supply-1', name: 'Disposable gloves (M)', quantity: '1 box', urgency: 'out', addedBy: worker.id, purchasedBy: null, purchasedAt: null, createdAt: hoursAgo(6) },
    { id: 'supply-2', name: 'Blood glucose test strips', quantity: '50', urgency: 'soon', addedBy: worker2.id, purchasedBy: null, purchasedAt: null, createdAt: hoursAgo(30) },
    { id: 'supply-3', name: 'Oat milk', quantity: '2 cartons', urgency: 'normal', addedBy: worker.id, purchasedBy: null, purchasedAt: null, createdAt: hoursAgo(10) },
    { id: 'supply-4', name: 'Hand soap refill', quantity: '', urgency: 'soon', addedBy: worker.id, purchasedBy: manager.id, purchasedAt: hoursAgo(26), createdAt: hoursAgo(48) },
  ],
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
  // Mirror the production rules so role previews behave like the real backend.
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

  const actor = findMember(actorId);
  // Same list as the production backend — role previews enforce it identically.
  const managerOnly = new Set([
    'createChore', 'assign', 'unclaim', 'addMember', 'disableMember', 'reactivateMember',
    'resetMemberPassword', 'updateHouseholdSettings', 'announce', 'setShifts', 'approveTask',
    'reopenTask', 'inviteMember', 'reinviteMember', 'deleteTimeEntry', 'saveCertification',
    'deleteCertification', 'reviewClientNote', 'acknowledgeSafetyAlert', 'triageSafetyIncident',
    'sendPayrollReport', 'saveMedication', 'archiveMedication', 'saveCareProfile',
    'saveAppointment', 'cancelAppointment',
    'decideLeaveRequest', 'setLeaveBalance', 'saveHrDocument', 'archiveHrDocument',
    'seedHireChecklist', 'toggleHireChecklistItem', 'addHireChecklistItem', 'ensurePayPeriods', 'closePayRun',
    'startPayPeriodReview', 'reopenPayPeriod',
    'saveCsilExpense', 'deleteCsilExpense', 'saveCsilMonthlyReport',
  ]);
  if (managerOnly.has(action) && actor.role !== 'manager') throw new Error('Only the household manager can do that.');

  switch (action) {
    case 'requestLeave': {
      const memberId = actor.role === 'manager' && typeof input.memberId === 'string' && input.memberId ? input.memberId : actorId;
      if (actor.role === 'worker' && memberId !== actorId) throw new Error('You can only request leave for yourself.');
      const kind = ['vacation', 'sick', 'other'].includes(String(input.kind)) ? String(input.kind) as 'vacation' | 'sick' | 'other' : 'vacation';
      const startOn = requiredString(input.startOn, 'Start date');
      const endOn = requiredString(input.endOn, 'End date');
      const hours = Math.max(0.25, Number(input.hours) || 8);
      mockState.leaveRequests = [{ id: crypto.randomUUID(), memberId, kind, startOn, endOn, hours, note: optionalString(input.note, 1000), status: 'pending', decidedBy: null, decidedAt: null, createdAt: now2 }, ...(mockState.leaveRequests ?? [])];
      break;
    }
    case 'cancelLeaveRequest': {
      const request = (mockState.leaveRequests ?? []).find((item) => item.id === input.requestId);
      if (!request || request.status !== 'pending') throw new Error('Only pending leave requests can be cancelled.');
      if (actor.role !== 'manager' && request.memberId !== actorId) throw new Error('You can only cancel your own leave request.');
      request.status = 'cancelled'; request.decidedBy = actorId; request.decidedAt = now2;
      break;
    }
    case 'decideLeaveRequest': {
      const request = (mockState.leaveRequests ?? []).find((item) => item.id === input.requestId);
      if (!request || request.status !== 'pending') throw new Error('That leave request is no longer pending.');
      const decision = input.decision === 'denied' ? 'denied' : 'approved';
      request.status = decision; request.decidedBy = actorId; request.decidedAt = now2;
      if (decision === 'approved') {
        const balance = (mockState.leaveBalances ?? []).find((row) => row.memberId === request.memberId && row.kind === request.kind);
        if (balance) balance.hoursUsed += request.hours;
        else mockState.leaveBalances = [...(mockState.leaveBalances ?? []), { memberId: request.memberId, kind: request.kind, hoursEntitled: 0, hoursUsed: request.hours }];
      }
      break;
    }
    case 'setLeaveBalance': {
      const memberId = requiredString(input.memberId, 'Care worker');
      const kind = ['vacation', 'sick', 'other'].includes(String(input.kind)) ? String(input.kind) as 'vacation' | 'sick' | 'other' : 'vacation';
      const hoursEntitled = Math.max(0, Number(input.hoursEntitled) || 0);
      const hoursUsed = Math.max(0, Number(input.hoursUsed) || 0);
      const existing = (mockState.leaveBalances ?? []).find((row) => row.memberId === memberId && row.kind === kind);
      if (existing) { existing.hoursEntitled = hoursEntitled; existing.hoursUsed = hoursUsed; }
      else mockState.leaveBalances = [...(mockState.leaveBalances ?? []), { memberId, kind, hoursEntitled, hoursUsed }];
      break;
    }
    case 'saveHrDocument': {
      const title = requiredString(input.title, 'Document title');
      const category = ['policy', 'contract', 'handbook', 'other'].includes(String(input.category)) ? String(input.category) as 'policy' | 'contract' | 'handbook' | 'other' : 'policy';
      const body = optionalString(input.body, 20_000);
      const required = input.required === true || input.required === 'true' || input.required === 'on' || input.required === '1';
      const id = typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID();
      const existing = (mockState.hrDocuments ?? []).find((doc) => doc.id === id);
      if (existing) { existing.title = title; existing.category = category; existing.body = body; existing.required = Boolean(required); }
      else mockState.hrDocuments = [{ id, title, category, body, required: Boolean(required), createdBy: actorId, createdAt: now2, archivedAt: null }, ...(mockState.hrDocuments ?? [])];
      break;
    }
    case 'archiveHrDocument': {
      const doc = (mockState.hrDocuments ?? []).find((item) => item.id === input.documentId);
      if (doc) doc.archivedAt = now2;
      break;
    }
    case 'acknowledgeHrDocument': {
      const documentId = requiredString(input.documentId, 'Document');
      if (!(mockState.hrDocuments ?? []).some((doc) => doc.id === documentId && !doc.archivedAt)) throw new Error('That document is no longer available.');
      mockState.hrDocumentAcks = [{ documentId, memberId: actorId, acknowledgedAt: now2 }, ...(mockState.hrDocumentAcks ?? []).filter((ack) => !(ack.documentId === documentId && ack.memberId === actorId))];
      break;
    }
    case 'seedHireChecklist': {
      const memberId = requiredString(input.memberId, 'Care worker');
      if ((mockState.hireChecklistItems ?? []).some((item) => item.memberId === memberId)) break;
      mockState.hireChecklistItems = [
        ...(mockState.hireChecklistItems ?? []),
        ...DEFAULT_HIRE_CHECKLIST.map((title, sortOrder) => ({ id: crypto.randomUUID(), memberId, title, done: false, doneAt: null, doneBy: null, sortOrder })),
      ];
      break;
    }
    case 'toggleHireChecklistItem': {
      const item = (mockState.hireChecklistItems ?? []).find((row) => row.id === input.itemId);
      if (!item) throw new Error('Checklist item not found.');
      item.done = !item.done;
      item.doneAt = item.done ? now2 : null;
      item.doneBy = item.done ? actorId : null;
      break;
    }
    case 'addHireChecklistItem': {
      const memberId = requiredString(input.memberId, 'Care worker');
      const title = requiredString(input.title, 'Checklist item');
      const sortOrder = (mockState.hireChecklistItems ?? []).filter((item) => item.memberId === memberId).length;
      mockState.hireChecklistItems = [...(mockState.hireChecklistItems ?? []), { id: crypto.randomUUID(), memberId, title, done: false, doneAt: null, doneBy: null, sortOrder }];
      break;
    }
    case 'ensurePayPeriods': {
      if (!(mockState.payPeriods ?? []).some((period) => period.status === 'open' || period.status === 'review')) {
        const bounds = periodContaining(today, mockState.settings?.payPeriodAnchor || '2025-01-06', mockState.settings?.payPeriodDays ?? 14);
        mockState.payPeriods = [{ id: crypto.randomUUID(), startOn: bounds.startOn, endOn: bounds.endOn, status: 'open', createdAt: now2 }, ...(mockState.payPeriods ?? [])];
      }
      break;
    }
    case 'startPayPeriodReview': {
      const period = (mockState.payPeriods ?? []).find((item) => item.status === 'open' || item.status === 'review');
      if (!period || period.status === 'closed') throw new Error('No open pay period.');
      period.status = 'review';
      break;
    }
    case 'reopenPayPeriod': {
      const closed = (mockState.payPeriods ?? [])
        .filter((item) => item.status === 'closed')
        .sort((a, b) => b.endOn.localeCompare(a.endOn))[0];
      const period = (typeof input.periodId === 'string' && input.periodId
        ? (mockState.payPeriods ?? []).find((item) => item.id === input.periodId)
        : closed) ?? null;
      if (!period || period.status !== 'closed') throw new Error('Only a closed pay period can be reopened.');
      const run = (mockState.payRuns ?? []).find((item) => item.periodId === period.id);
      if (run) {
        mockState.payRunLines = (mockState.payRunLines ?? []).filter((line) => line.runId !== run.id);
        mockState.payRuns = (mockState.payRuns ?? []).filter((item) => item.id !== run.id);
      }
      period.status = 'open';
      mockState.payPeriods = (mockState.payPeriods ?? []).filter((item) => {
        if (item.startOn <= period.endOn) return true;
        if (item.status !== 'open' && item.status !== 'review') return true;
        return (mockState.payRuns ?? []).some((payRun) => payRun.periodId === item.id);
      });
      pushActivity('pay_period_reopened', `reopened pay period ${period.startOn} to ${period.endOn}`);
      break;
    }
    case 'closePayRun': {
      const period = (mockState.payPeriods ?? []).find((item) => item.status === 'open' || item.status === 'review');
      if (!period) throw new Error('No open pay period.');
      const runId = crypto.randomUUID();
      mockState.payRuns = [{ id: runId, periodId: period.id, closedAt: now2, closedBy: actorId, notes: optionalString(input.notes, 1000) }, ...(mockState.payRuns ?? [])];
      const lines = mockState.members.filter((member) => member.role === 'worker' && member.status === 'active').map((member) => {
        const entries = (mockState.timeEntries ?? []).filter((entry) => entry.memberId === member.id);
        const { hours, entryIds } = aggregateWorkerHours(entries, period.startOn, period.endOn, now2);
        return { id: crypto.randomUUID(), runId, memberId: member.id, hours, hourlyRate: member.hourlyRate ?? null, grossAmount: grossFor(hours, member.hourlyRate ?? null), entryIds };
      });
      mockState.payRunLines = [...lines, ...(mockState.payRunLines ?? [])];
      period.status = 'closed';
      const next = nextPeriod({ startOn: period.startOn, endOn: period.endOn }, mockState.settings?.payPeriodDays ?? 14);
      mockState.payPeriods = [{ id: crypto.randomUUID(), startOn: next.startOn, endOn: next.endOn, status: 'open', createdAt: now2 }, ...(mockState.payPeriods ?? [])];
      pushActivity('pay_run_closed', `closed pay period ${period.startOn} to ${period.endOn}`);
      break;
    }
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
      if (actor.role === 'worker' && (chore.assignedTo !== actorId || chore.status === 'complete')) throw new Error('You can only update your own active tasks.');
      if (actor.role !== 'manager') {
        if (typeof input.progressNotes === 'string') chore.progressNotes = input.progressNotes;
        if (typeof input.completionNotes === 'string') chore.completionNotes = input.completionNotes;
        if (typeof input.issueReport === 'string') chore.issueReport = input.issueReport;
        if (typeof input.expectedCompletionAt === 'string') chore.expectedCompletionAt = input.expectedCompletionAt || null;
        chore.issueOpen = input.issueOpen === 'on' || input.issueOpen === true || input.issueOpen === 'true';
        pushActivity('updated', `updated ${chore.title}`);
        break;
      }
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
      if (!(chore.status === 'open' && !chore.assignedTo)) throw new Error('That task changed before your update. Refresh and try again.');
      chore.assignedTo = actorId;
      pushActivity('claimed', `claimed ${chore.title}`);
      break;
    }
    case 'start': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      if (!(chore.status === 'open' && (actor.role === 'manager' || chore.assignedTo === actorId))) throw new Error('That task changed before your update. Refresh and try again.');
      chore.status = 'in_progress';
      chore.startedAt = now2;
      pushActivity('started', `started ${chore.title}`);
      break;
    }
    case 'complete': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      const allowed = actor.role === 'manager'
        ? chore.status === 'open' || chore.status === 'in_progress'
        : chore.status === 'in_progress' && chore.assignedTo === actorId;
      if (!allowed) throw new Error('That task changed before your update. Refresh and try again.');
      chore.status = 'complete';
      chore.assignedTo = chore.assignedTo ?? actorId;
      chore.completedBy = actorId;
      chore.completedAt = now2;
      chore.reviewStatus = actor.role === 'manager' ? null : 'pending';
      pushActivity('completed', `finished ${chore.title}`);
      break;
    }
    case 'takeover': {
      const chore = findChore(requiredString(input.choreId, 'Chore'));
      if (chore.status === 'complete') throw new Error('That task is already complete.');
      if (chore.assignedTo === actorId) throw new Error('That task is already yours.');
      if (!chore.assignedTo) throw new Error('That task is unassigned — claim it instead.');
      if (actor.role === 'worker' && !workerCan('takeover', actorId, chore)) throw new Error('You can only take over unfinished tasks.');
      const previous = mockState.members.find((m) => m.id === chore.assignedTo);
      chore.assignedTo = actorId;
      chore.status = 'open';
      chore.startedAt = null;
      chore.notes = chore.notes ?? [];
      chore.notes.push({ id: crypto.randomUUID(), choreId: chore.id, memberId: actorId, kind: 'progress', body: `Took over${previous ? ` from ${previous.name}` : ''}`, createdAt: now2 });
      pushActivity('took_over', `took over ${chore.title}`);
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
      if (typeof input.csilHealthAuthority === 'string') settings.csilHealthAuthority = input.csilHealthAuthority;
      if (typeof input.csilAgreementStart === 'string') settings.csilAgreementStart = input.csilAgreementStart || null;
      if (typeof input.csilAgreementEnd === 'string') settings.csilAgreementEnd = input.csilAgreementEnd || null;
      if (typeof input.csilClientContribution === 'string' || typeof input.csilClientContribution === 'number') settings.csilClientContribution = Math.max(0, Number(input.csilClientContribution));
      if (typeof input.csilReportDueDays === 'string' || typeof input.csilReportDueDays === 'number') settings.csilReportDueDays = Math.max(1, Math.min(90, Number(input.csilReportDueDays)));
      if (typeof input.csilAccountLastFour === 'string') settings.csilAccountLastFour = input.csilAccountLastFour;
      if (typeof input.csilContactName === 'string') settings.csilContactName = input.csilContactName;
      if (typeof input.csilContactEmail === 'string') settings.csilContactEmail = input.csilContactEmail;
      if (typeof input.bookkeeperEmail === 'string') settings.bookkeeperEmail = input.bookkeeperEmail;
      if (typeof input.defaultVacationHours === 'string' || typeof input.defaultVacationHours === 'number') settings.defaultVacationHours = Math.max(0, Number(input.defaultVacationHours));
      if (typeof input.payPeriodDays === 'string' || typeof input.payPeriodDays === 'number') settings.payPeriodDays = Math.max(1, Math.min(62, Number(input.payPeriodDays)));
      if (typeof input.payPeriodAnchor === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.payPeriodAnchor)) settings.payPeriodAnchor = input.payPeriodAnchor;
      const hours = normalizeOperatingHours(
        typeof input.operatingHoursStart === 'string' ? input.operatingHoursStart : (settings.operatingHoursStart ?? '08:00'),
        typeof input.operatingHoursEnd === 'string' ? input.operatingHoursEnd : (settings.operatingHoursEnd ?? '14:00'),
      );
      settings.operatingHoursStart = hours.start;
      settings.operatingHoursEnd = hours.end;
      const weekdayRaw = input.operatingWeekdays;
      const weekdayList = Array.isArray(weekdayRaw) ? weekdayRaw.map(String) : typeof weekdayRaw === 'string' ? weekdayRaw.split(',') : String(settings.operatingWeekdays ?? '1,2,3,4,5').split(',');
      settings.operatingWeekdays = serializeOperatingWeekdays(parseOperatingWeekdays(weekdayList.join(',')));
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
        if (theme && !isValidAppearanceToken(theme)) throw new Error('Choose a colour and sizing from the gallery.');
        member.theme = theme;
      }
      if (input.layout !== undefined) member.dashboardLayout = normalizeLayout(member.role as 'manager' | 'worker' | 'viewer', input.layout);
      break;
    }
    case 'dismissFirstLoginGuide': {
      const member = findMember(actorId);
      if (member.role === 'viewer') throw new Error('Family viewers do not have a first-login guide.');
      member.guideSeenAt = now2;
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
        guideSeenAt: null,
      };
      mockState.members.push(newMember);
      if (role === 'worker') {
        const id = newMember.id;
        mockState.leaveBalances = [
          ...(mockState.leaveBalances ?? []),
          { memberId: id, kind: 'vacation', hoursEntitled: mockState.settings?.defaultVacationHours ?? 80, hoursUsed: 0 },
          { memberId: id, kind: 'sick', hoursEntitled: 0, hoursUsed: 0 },
        ];
        mockState.hireChecklistItems = [
          ...(mockState.hireChecklistItems ?? []),
          ...DEFAULT_HIRE_CHECKLIST.map((title, sortOrder) => ({ id: crypto.randomUUID(), memberId: id, title, done: false, doneAt: null, doneBy: null, sortOrder })),
        ];
      }
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
      if (action === 'setAvailability' && actor.role !== 'manager' && memberId !== actorId) throw new Error('You can only update your own availability.');
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
    case 'clockIn':
    case 'clockOut': {
      const memberId = typeof input.memberId === 'string' && input.memberId ? input.memberId : actorId;
      if (actor.role !== 'manager' && memberId !== actorId) throw new Error('You can only track your own time.');
      const target = findMember(memberId);
      if (target.role !== 'worker' || target.status !== 'active') throw new Error('Choose an active care worker.');
      const open = (mockState.timeEntries ?? []).find((e) => e.memberId === memberId && !e.endedAt);
      if (action === 'clockIn') {
        if (open) throw new Error(`${target.name} is already clocked in.`);
        const entry: TimeEntry = { id: crypto.randomUUID(), memberId, startedAt: now2, endedAt: null, createdAt: now2 };
        mockState.timeEntries = [entry, ...(mockState.timeEntries ?? [])];
        pushActivity('clocked_in', `clocked in ${target.name}`);
      } else {
        if (!open) throw new Error(`${target.name} is not clocked in.`);
        open.endedAt = now2;
        pushActivity('clocked_out', `clocked out ${target.name}`);
      }
      break;
    }
    case 'deleteTimeEntry': {
      const entryId = requiredString(input.entryId, 'Time entry');
      const before = (mockState.timeEntries ?? []).length;
      mockState.timeEntries = (mockState.timeEntries ?? []).filter((e) => e.id !== entryId);
      if (mockState.timeEntries.length !== before - 1) throw new Error('Time entry not found.');
      break;
    }
    case 'deleteUpload': {
      const uploadId = requiredString(input.uploadId, 'Upload');
      for (const chore of mockState.chores) {
        chore.photos = (chore.photos ?? []).filter((photo) => photo.id !== uploadId);
      }
      break;
    }
    case 'saveCsilExpense': {
      const id = typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID();
      const expense = { id, expenseDate: requiredString(input.expenseDate, 'Expense date'), vendor: requiredString(input.vendor, 'Vendor'), category: (typeof input.category === 'string' ? input.category : 'other') as 'other', description: optionalString(input.description, 500), amount: Number(input.amount), eligibilityStatus: (typeof input.eligibilityStatus === 'string' ? input.eligibilityStatus : 'pending') as 'pending', receiptReference: optionalString(input.receiptReference, 240), createdBy: actorId, createdAt: now2, updatedAt: now2 };
      mockState.csilExpenses = [expense, ...(mockState.csilExpenses ?? []).filter((item) => item.id !== id)];
      break;
    }
    case 'deleteCsilExpense': {
      mockState.csilExpenses = (mockState.csilExpenses ?? []).filter((item) => item.id !== input.expenseId);
      break;
    }
    case 'saveCsilMonthlyReport': {
      const reportMonth = requiredString(input.reportMonth, 'Report month');
      const existing = (mockState.csilMonthlyReports ?? []).find((item) => item.reportMonth === reportMonth);
      const record = { id: existing?.id ?? crypto.randomUUID(), reportMonth, status: (typeof input.status === 'string' ? input.status : 'draft') as 'draft', submittedAt: input.status === 'draft' ? null : now2, notes: optionalString(input.notes, 1000), createdBy: actorId, createdAt: existing?.createdAt ?? now2, updatedAt: now2 };
      mockState.csilMonthlyReports = [record, ...(mockState.csilMonthlyReports ?? []).filter((item) => item.reportMonth !== reportMonth)];
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
    case 'saveMedication':
    case 'archiveMedication':
    case 'saveCareProfile':
    case 'saveAppointment':
    case 'cancelAppointment': {
      if (findMember(actorId).role !== 'manager') throw new Error('Only the household manager can do that.');
      if (action === 'saveMedication') {
        const medication = validateMedication(input);
        const existing = (mockState.medications ?? []).find((item) => item.id === input.medicationId && item.active);
        if (input.medicationId && !existing) throw new Error('That medication is no longer on the care plan.');
        if (existing) Object.assign(existing, medication, { updatedAt: now2 });
        else mockState.medications = [...(mockState.medications ?? []), { id: crypto.randomUUID(), ...medication, active: true, createdAt: now2, updatedAt: now2 }];
        pushActivity('medication_saved', `${existing ? 'updated' : 'added'} medication ${medication.name}`);
      } else if (action === 'archiveMedication') {
        const medication = (mockState.medications ?? []).find((item) => item.id === input.medicationId && item.active);
        if (!medication) throw new Error('That medication is no longer on the care plan.');
        medication.active = false;
        pushActivity('medication_archived', `removed ${medication.name} from the medication round`);
      } else if (action === 'saveCareProfile') {
        mockState.careProfile = { ...validateCareProfile(input), updatedBy: actorId, updatedAt: now2 };
        pushActivity('care_profile_updated', 'updated the About me profile');
      } else if (action === 'saveAppointment') {
        const appointment = validateAppointment(input, now2.slice(0, 10));
        const existing = (mockState.appointments ?? []).find((item) => item.id === input.appointmentId && item.status === 'scheduled');
        if (input.appointmentId && !existing) throw new Error('That appointment is no longer scheduled.');
        if (existing) Object.assign(existing, appointment, { updatedAt: now2 });
        else mockState.appointments = [...(mockState.appointments ?? []), { id: crypto.randomUUID(), ...appointment, status: 'scheduled', outcome: '', createdAt: now2, updatedAt: now2 }];
        pushActivity('appointment_saved', `${existing ? 'updated' : 'scheduled'} ${appointment.title} on ${appointment.date}`);
      } else {
        const appointment = (mockState.appointments ?? []).find((item) => item.id === input.appointmentId && item.status === 'scheduled');
        if (!appointment) throw new Error('That appointment is no longer scheduled.');
        appointment.status = 'cancelled';
        appointment.updatedAt = now2;
        pushActivity('appointment_cancelled', `cancelled ${appointment.title} on ${appointment.date}`);
      }
      break;
    }
    case 'logMedicationDose': {
      const medication = (mockState.medications ?? []).find((item) => item.id === input.medicationId) ?? null;
      const logs = (mockState.medicationLogs ?? []).filter((log) => log.medicationId === input.medicationId);
      const dose = validateDoseLog(input, medication, now2.slice(0, 10), logs);
      mockState.medicationLogs = [{ id: crypto.randomUUID(), medicationId: medication!.id, ...dose, loggedBy: actorId, loggedAt: now2 }, ...(mockState.medicationLogs ?? [])];
      pushActivity('medication_logged', `logged ${medication!.name}${dose.scheduledTime ? ` (${dose.scheduledTime})` : ' (as needed)'} as ${dose.outcome}`);
      break;
    }
    case 'completeAppointment': {
      const appointment = (mockState.appointments ?? []).find((item) => item.id === input.appointmentId);
      const actor = findMember(actorId);
      if (!appointment || !canCompleteAppointment(actor.role, actorId, appointment)) throw new Error('Only the manager or the accompanying care worker can close this appointment.');
      appointment.status = 'done';
      appointment.outcome = optionalString(input.outcome, 1000);
      appointment.updatedAt = now2;
      pushActivity('appointment_completed', `completed ${appointment.title} on ${appointment.date}`);
      break;
    }
    case 'sendKudos': {
      const recipient = mockState.members.find((item) => item.id === input.recipientId) ?? null;
      const kudos = validateKudos(input, actorId, recipient);
      mockState.kudos = [{ id: crypto.randomUUID(), senderId: actorId, ...kudos, createdAt: now2 }, ...(mockState.kudos ?? [])];
      const actorName = findMember(actorId).name;
      mockState.inboxItems = [{ id: crypto.randomUUID(), workerId: kudos.recipientId, kind: 'direct_message', body: `${actorName} gave you a shout-out: ${KUDOS_BADGES[kudos.badge]}${kudos.message ? ` — "${kudos.message}"` : ''}`, submissionId: null, createdBy: actorId, createdAt: now2 }, ...(mockState.inboxItems ?? [])];
      pushActivity('kudos_sent', `gave a ${KUDOS_BADGES[kudos.badge]} shout-out`);
      break;
    }
    case 'addSupplyItem': {
      const item = validateSupplyItem(input);
      mockState.supplies = [...(mockState.supplies ?? []), { id: crypto.randomUUID(), ...item, addedBy: actorId, purchasedBy: null, purchasedAt: null, createdAt: now2 }];
      pushActivity('supply_added', `added ${item.name} to the supplies list`);
      break;
    }
    case 'markSupplyPurchased': {
      const item = (mockState.supplies ?? []).find((entry) => entry.id === input.itemId);
      if (!item || item.purchasedAt) throw new Error('That item was already marked as bought.');
      item.purchasedBy = actorId;
      item.purchasedAt = now2;
      pushActivity('supply_purchased', `bought ${item.name}`);
      break;
    }
    default:
      logUnhandled(action, input);
  }

  mockState.settings = mockState.settings ?? { householdId: 'default', recurrenceHorizonDays: 30, reminderDefaultLeadDays: 1, retentionDays: 90, fundedHoursMonthly: 120, fundingHourlyRate: 25, updatedAt: now2 };
  return mockState;
}
