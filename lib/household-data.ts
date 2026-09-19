import 'server-only';

import { unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { getD1 } from '@/db';
import { canAssignTo, visibleTasks, workerCan, workerTaskGroups, type AccountStatus, type Role, type TaskStatus } from '@/lib/access-policy';
import { ensureAccountTable, setAccountStatus } from '@/lib/account-store';
import { memberIdForEmail, ownerEmail } from '@/lib/auth-config';
import { credentialForEmail, setCredential } from '@/lib/credential-store';
import { hashPassword, normalizeEmail, passwordError } from '@/lib/auth-security';
import { addDaysISO, clampInteger, metrics, nextRecurrenceDate, type Priority, type Recurrence } from '@/lib/operations';
import type { Certification } from '@/lib/certifications';
import { canSendInboxMessage, reviewClientNote, scheduleChangeRequest, triageInboxMessage, visibleInbox, visibleSafetyAlerts, type ClientNoteStatus, type InboxItem, type SafetyCategory } from '@/lib/client-notes';
import { localDevMode } from '@/lib/auth-config';
import { getLocalDevRawState, mutateLocalDevState } from '@/lib/local-dev';
import { sendCoverageEmail, sendManagerCoverageEmail } from '@/lib/email';
import { isE164, sendCareBoardSms } from '@/lib/sms';
import { buildWorkloadWarnings, workloadThresholds, type WorkloadWarning } from '@/lib/workload-warnings';
import { triageSafetyIncident, validateSafetyIncident, validateShiftHandoff, visibleSafetyIncidents, visibleShiftHandoffs } from '@/lib/care-safety';

export type Member = {
  id: string;
  name: string;
  role: Role;
  status: AccountStatus;
  email?: string;
  color: string;
  createdAt: string;
  phone: string | null;
  availability: string;
  skillsNotes: string;
  emergencyContact: string | null;
  certifications: string;
  languages: string;
  profilePhotoId: string | null;
  hourlyRate?: number | null;
  smsOptIn?: boolean;
  dateOfBirth?: string | null;
  address?: string;
  jobTitle?: string;
  employmentStartedOn?: string | null;
};
export type ProofPhoto = { id: string; choreId?: string; profileMemberId?: string; originalName: string; mimeType: string; byteSize: number; createdAt: string };
export type TaskNote = { id: string; choreId: string; memberId: string; kind: 'progress' | 'completion' | 'issue'; body: string; createdAt: string };
export type Chore = {
  id: string;
  title: string;
  area: string;
  dueDate: string | null;
  dueTime: string | null;
  priority: Priority;
  instructions: string;
  recurrence: Recurrence | null;
  status: TaskStatus;
  reviewStatus: 'pending' | 'approved' | null;
  createdBy: string;
  assignedTo: string | null;
  completedBy: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  progressNotes: string;
  completionNotes: string;
  issueReport: string;
  issueOpen: boolean;
  reminderLeadDays: number | null;
  expectedCompletionAt: string | null;
  photos?: ProofPhoto[];
  notes?: TaskNote[];
};
export type Shift = { id: string; memberId: string; weekday: number; startTime: string; endTime: string; createdAt: string };
export type TimeEntry = { id: string; memberId: string; startedAt: string; endedAt: string | null; createdAt: string };
export type ScheduleChangeRequest = { id: string; requesterId: string; shiftId: string; requestedDate: string; startTime: string; endTime: string; reason: string; status: 'open' | 'covered'; acceptedBy: string | null; acceptedAt: string | null; createdAt: string };
export type ShiftHandoffRecord = { id: string; authorId: string; shiftDate: string; completedCare: string; outstandingTasks: string; observations: string; checklist: string[]; createdAt: string };
export type SafetyIncident = { id: string; reporterId: string; category: 'hazard' | 'injury' | 'violence_threat' | 'unsafe_home' | 'near_miss'; severity: 'low' | 'medium' | 'high' | 'urgent'; occurredAt: string; location: string; description: string; immediateAction: string; status: 'submitted' | 'reviewing' | 'resolved'; assignedTo: string | null; followUp: string; resolvedAt: string | null; createdAt: string; updatedAt: string };
export type ActivityItem = { id: string; choreId: string | null; memberId: string; action: string; detail: string; createdAt: string };
export type Message = { id: string; memberId: string; body: string; createdAt: string };
export type ClientNoteSubmission = {
  id: string; clientMemberId: string; submittedBy: string; sourcePhotoId: string | null; ocrText: string;
  status: ClientNoteStatus; approvedText: string | null; reviewedBy: string | null; reviewedAt: string | null; createdAt: string;
};
export type ClientNote = ClientNoteSubmission & { body: string; editedDuringReview: boolean };
export type SafetyAlert = InboxItem & { safetyCategory: SafetyCategory; safetyReason: string };
export type AuditEntry = { id: string; choreId: string | null; actorId: string; action: string; detail: string; createdAt: string };
export type TaskGroup = { id: 'my-tasks' | 'available-tasks'; title: 'My Tasks' | 'Available Tasks'; tasks: Chore[] };
export type HouseholdSettings = {
  householdId: string;
  recurrenceHorizonDays: number;
  reminderDefaultLeadDays: number;
  retentionDays: number;
  fundedHoursMonthly: number;
  fundingHourlyRate: number;
  updatedAt: string;
};
export type HouseholdState = {
  viewer: { id: string; role: Role };
  members: Member[];
  chores: Chore[];
  activity: ActivityItem[];
  audit?: AuditEntry[];
  settings?: HouseholdSettings;
  taskGroups?: TaskGroup[];
  metrics?: ReturnType<typeof metrics>;
  reminders: Chore[];
  announcements?: ActivityItem[];
  shifts?: Shift[];
  availability?: Shift[];
  timeEntries?: TimeEntry[];
  certifications?: Certification[];
  messages?: Message[];
  clientNotes?: ClientNote[];
  clientNoteQueue?: ClientNoteSubmission[];
  inbox?: InboxItem[];
  safetyAlerts?: SafetyAlert[];
  scheduleRequests?: ScheduleChangeRequest[];
  shiftHandoffs?: ShiftHandoffRecord[];
  safetyIncidents?: SafetyIncident[];
  workloadWarnings?: WorkloadWarning[];
};

const palette = ['#287b6f', '#d36f4e', '#5b72b8', '#986ca5', '#b57e1c'];
const todayOffset = (days: number) => {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

async function seedIfEmpty() {
  const db = getD1();
  const count = await db.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;
  const now = new Date().toISOString();
  const manager = 'member-manager';
  await db.batch([
    db.prepare('INSERT INTO members (id, name, role, color, created_at) VALUES (?, ?, ?, ?, ?)').bind(manager, 'Dana', 'manager', palette[4], now),
    db.prepare("INSERT INTO account_lifecycle(member_id, household_id, status, activated_at, updated_at) VALUES (?, 'default', 'active', ?, ?)").bind(manager, now, now),
    db.prepare(`INSERT INTO chores (id, title, area, due_date, status, created_by, assigned_to, completed_by, created_at, started_at, completed_at) VALUES (?, ?, ?, ?, 'open', ?, NULL, NULL, ?, NULL, NULL)`).bind('chore-recycling', 'Take out recycling', 'Outside', todayOffset(0), manager, now),
  ]);
}

export async function ensureHouseholdData() {
  await seedIfEmpty();
}

async function inviteTokenHash(token: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function newInviteToken() {
  return `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '');
}

export async function inviteForToken(token: string) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return null;
  await ensureAccountTable();
  const db = getD1();
  const invite = await db
    .prepare(
      `SELECT i.id, i.expires_at AS expiresAt, i.accepted_at AS acceptedAt, m.id AS memberId, m.name, g.email
      FROM worker_invites i JOIN members m ON m.id=i.member_id JOIN google_accounts g ON g.member_id=m.id
      WHERE i.token_hash=?`,
    )
    .bind(await inviteTokenHash(token))
    .first<{ id: string; expiresAt: string; acceptedAt: string | null; memberId: string; name: string; email: string }>();
  if (!invite || invite.acceptedAt || invite.expiresAt <= new Date().toISOString()) return null;
  return { inviteId: invite.id, memberId: invite.memberId, name: invite.name, email: invite.email };
}

export async function acceptInvite(token: string, password: string) {
  const invite = await inviteForToken(token);
  if (!invite) throw new Error('This invite link is invalid or has expired.');
  const problem = passwordError(password);
  if (problem) throw new Error(problem);
  const now = new Date().toISOString();
  await setCredential(invite.email, await hashPassword(password), false);
  await setAccountStatus(invite.memberId, 'active');
  await getD1().prepare('UPDATE worker_invites SET accepted_at=? WHERE id=?').bind(now, invite.inviteId).run();
  return invite.name;
}

export async function getHouseholdSettings(): Promise<HouseholdSettings> {
  const db = getD1();
  await db.prepare("INSERT INTO household_settings (household_id) VALUES ('default') ON CONFLICT (household_id) DO NOTHING").run();
  const row = await db
    .prepare(
      "SELECT household_id AS householdId, recurrence_horizon_days AS recurrenceHorizonDays, reminder_default_lead_days AS reminderDefaultLeadDays, retention_days AS retentionDays, funded_hours_monthly AS fundedHoursMonthly, funding_hourly_rate AS fundingHourlyRate, updated_at AS updatedAt FROM household_settings WHERE household_id='default'",
    )
    .first<HouseholdSettings>();
  return row ?? {
    householdId: 'default',
    recurrenceHorizonDays: 30,
    fundedHoursMonthly: 0,
    fundingHourlyRate: 0,
    reminderDefaultLeadDays: 1,
    retentionDays: 90,
    updatedAt: new Date().toISOString(),
  };
}

async function rawState() {
  await ensureHouseholdData();
  await ensureAccountTable();
  await cleanupExpiredUploads();
  await generateRecurringTasks();
  const db = getD1();
  const settings = await getHouseholdSettings();
  const cutoff = db.dialect === 'postgres' ? "(NOW() - INTERVAL '90 days')::TEXT" : "datetime('now', '-90 days')";
  const [members, chores, activity, shifts, availability, timeEntries, certifications, messages, clientNoteSubmissions, inboxItems, scheduleRequests, shiftHandoffs, safetyIncidents] = await Promise.all([
    db
      .prepare(
        `SELECT m.id, m.name, m.role, COALESCE(l.status, 'active') AS status, g.email, m.color, m.created_at AS createdAt,
          m.phone, m.sms_opt_in AS smsOptIn, m.availability, m.skills_notes AS skillsNotes, m.emergency_contact AS emergencyContact,
          m.certifications, m.languages, m.profile_photo_id AS profilePhotoId, m.hourly_rate AS hourlyRate,
          m.date_of_birth AS dateOfBirth, m.address, m.job_title AS jobTitle, m.employment_started_on AS employmentStartedOn
        FROM members m
        LEFT JOIN account_lifecycle l ON l.member_id=m.id
        LEFT JOIN google_accounts g ON g.member_id=m.id
        ORDER BY m.role, m.created_at, m.name`,
      )
      .all<Member>(),
    db
      .prepare(
        `SELECT id, title, area, due_date AS dueDate, due_time AS dueTime, priority, instructions, recurrence,
          status, review_status AS reviewStatus, created_by AS createdBy, assigned_to AS assignedTo, completed_by AS completedBy,
          created_at AS createdAt, started_at AS startedAt, completed_at AS completedAt,
          progress_notes AS progressNotes, completion_notes AS completionNotes, issue_report AS issueReport,
          issue_open AS issueOpen, reminder_lead_days AS reminderLeadDays, expected_completion_at AS expectedCompletionAt
        FROM chores
        ORDER BY CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
          CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
          due_date IS NULL, due_date, created_at DESC`,
      )
      .all<Chore>(),
    db.prepare(`SELECT id, chore_id AS choreId, member_id AS memberId, action, detail, created_at AS createdAt FROM activity ORDER BY created_at DESC LIMIT 60`).all<ActivityItem>(),
    db.prepare(`SELECT id, member_id AS memberId, weekday, start_time AS startTime, end_time AS endTime, created_at AS createdAt FROM shifts ORDER BY weekday, start_time`).all<Shift>(),
    db.prepare(`SELECT id, member_id AS memberId, weekday, start_time AS startTime, end_time AS endTime, created_at AS createdAt FROM availability_windows ORDER BY weekday, start_time`).all<Shift>(),
    db.prepare(`SELECT id, member_id AS memberId, started_at AS startedAt, ended_at AS endedAt, created_at AS createdAt FROM time_entries WHERE started_at >= ${cutoff} ORDER BY started_at DESC`).all<TimeEntry>(),
    db.prepare(`SELECT id, member_id AS memberId, name, expires_on AS expiresOn, created_at AS createdAt FROM certification_records ORDER BY expires_on`).all<Certification>(),
    db.prepare(`SELECT id, member_id AS memberId, body, created_at AS createdAt FROM messages ORDER BY created_at DESC LIMIT 100`).all<Message>(),
    db.prepare(`SELECT id, client_member_id AS clientMemberId, submitted_by AS submittedBy, source_photo_id AS sourcePhotoId, ocr_text AS ocrText, status, approved_text AS approvedText, reviewed_by AS reviewedBy, reviewed_at AS reviewedAt, created_at AS createdAt FROM client_note_submissions ORDER BY created_at DESC`).all<ClientNoteSubmission>(),
    db.prepare(`SELECT id, worker_id AS workerId, kind, body, submission_id AS submissionId, created_by AS createdBy, safety_category AS safetyCategory, safety_reason AS safetyReason, safety_reviewed_by AS safetyReviewedBy, safety_reviewed_at AS safetyReviewedAt, created_at AS createdAt FROM worker_inbox_items ORDER BY created_at DESC LIMIT 300`).all<InboxItem>(),
    db.prepare(`SELECT id, requester_id AS requesterId, shift_id AS shiftId, requested_date AS requestedDate, start_time AS startTime, end_time AS endTime, reason, status, accepted_by AS acceptedBy, accepted_at AS acceptedAt, created_at AS createdAt FROM schedule_change_requests ORDER BY created_at DESC`).all<ScheduleChangeRequest>(),
    db.prepare(`SELECT id, author_id AS authorId, shift_date AS shiftDate, completed_care AS completedCare, outstanding_tasks AS outstandingTasks, observations, checklist_json AS checklistJson, created_at AS createdAt FROM shift_handoffs ORDER BY created_at DESC LIMIT 300`).all<ShiftHandoffRecord & { checklistJson: string }>(),
    db.prepare(`SELECT id, reporter_id AS reporterId, category, severity, occurred_at AS occurredAt, location, description, immediate_action AS immediateAction, status, assigned_to AS assignedTo, follow_up AS followUp, resolved_at AS resolvedAt, created_at AS createdAt, updated_at AS updatedAt FROM safety_incidents ORDER BY CASE severity WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, created_at DESC LIMIT 300`).all<SafetyIncident>(),
  ]);
  const photos = await db
    .prepare(`SELECT id, chore_id AS choreId, profile_member_id AS profileMemberId, original_name AS originalName, mime_type AS mimeType, byte_size AS byteSize, created_at AS createdAt FROM proof_photos ORDER BY created_at`)
    .all<ProofPhoto>();
  const notes = await db.prepare(`SELECT id, chore_id AS choreId, member_id AS memberId, kind, body, created_at AS createdAt FROM task_notes ORDER BY created_at`).all<TaskNote>();
  const audit = await db.prepare(`SELECT id, chore_id AS choreId, actor_id AS actorId, action, detail, created_at AS createdAt FROM audit_log ORDER BY created_at DESC LIMIT 200`).all<AuditEntry>();
  for (const chore of chores.results) {
    chore.photos = photos.results.filter((photo) => photo.choreId === chore.id);
    chore.notes = notes.results.filter((note) => note.choreId === chore.id);
  }
  return { members: members.results, chores: chores.results, activity: activity.results, audit: audit.results, settings, shifts: shifts.results, availability: availability.results, timeEntries: timeEntries.results, certifications: certifications.results, messages: messages.results, clientNoteSubmissions: clientNoteSubmissions.results, inboxItems: inboxItems.results, scheduleRequests: scheduleRequests.results, shiftHandoffs: shiftHandoffs.results.map(({ checklistJson, ...item }) => ({ ...item, checklist: JSON.parse(checklistJson) as string[] })), safetyIncidents: safetyIncidents.results };
}

type RawState = Awaited<ReturnType<typeof rawState>>;

function buildHouseholdState(state: RawState, memberId: string): HouseholdState {
  const viewer = state.members.find((member) => member.id === memberId && member.status === 'active');
  if (!viewer) throw new Error('Household access denied.');
  const today = new Date().toISOString().slice(0, 10);
  const defaultLeadDays = state.settings.reminderDefaultLeadDays;
  const clientNotes: ClientNote[] = state.clientNoteSubmissions
    .filter((note) => note.status === 'approved' && note.approvedText)
    .map((note) => ({ ...note, body: note.approvedText as string, editedDuringReview: note.approvedText !== note.ocrText }));
  const remindersFor = (chores: Chore[]) =>
    chores.filter((chore) => {
      if (chore.status === 'complete' || !chore.dueDate) return false;
      const lead = chore.reminderLeadDays ?? defaultLeadDays;
      return chore.dueDate <= addDaysISO(today, lead);
    });
  if (viewer.role === 'manager') return {
    viewer: { id: viewer.id, role: viewer.role }, ...state,
    clientNotes,
    clientNoteQueue: state.clientNoteSubmissions.filter((note) => note.status === 'pending'),
    inbox: visibleInbox(viewer.role, viewer.id, state.inboxItems),
    safetyAlerts: visibleSafetyAlerts(viewer.role, state.inboxItems) as SafetyAlert[],
    scheduleRequests: state.scheduleRequests,
    shiftHandoffs: state.shiftHandoffs ?? [],
    safetyIncidents: state.safetyIncidents ?? [],
    workloadWarnings: buildWorkloadWarnings(state.members.filter((item) => item.role === 'worker' && item.status === 'active').map((item) => item.id), state.shifts, state.chores, today, workloadThresholds()),
    metrics: metrics(state.chores, today), reminders: remindersFor(state.chores),
  };
  if (viewer.role === 'viewer') {
    // Family viewers see the care plan and schedule, but not care workers' private details, audit data, or settings.
    const people: Member[] = state.members.map((item) => ({
      id: item.id, name: item.name, role: item.role, status: item.status, color: item.color,
      createdAt: item.createdAt, phone: null, availability: '', skillsNotes: '', emergencyContact: null,
      certifications: '', languages: '', profilePhotoId: item.profilePhotoId, hourlyRate: null,
      dateOfBirth: null, address: '', jobTitle: '', employmentStartedOn: null,
    }));
    return {
      viewer: { id: viewer.id, role: viewer.role }, members: people, chores: state.chores, activity: [],
      reminders: remindersFor(state.chores), announcements: state.activity.filter((item) => item.action === 'announcement').slice(0, 5),
      shifts: state.shifts, metrics: metrics(state.chores, today),
    };
  }
  const chores = visibleTasks(viewer, state.chores);
  // Strip private fields from the worker's own profile view
  const self: Member = {
    id: viewer.id, name: viewer.name, role: viewer.role, status: viewer.status, color: viewer.color,
    createdAt: viewer.createdAt, phone: viewer.phone, availability: viewer.availability,
    skillsNotes: viewer.skillsNotes, emergencyContact: null, certifications: viewer.certifications, smsOptIn: viewer.smsOptIn,
    languages: viewer.languages, profilePhotoId: viewer.profilePhotoId, hourlyRate: viewer.hourlyRate ?? null,
    dateOfBirth: viewer.dateOfBirth ?? null, address: viewer.address ?? '', jobTitle: viewer.jobTitle ?? '',
    employmentStartedOn: viewer.employmentStartedOn ?? null,
  };
  // Workers get a minimal roster (names, roles, colors, photos only) so they can see who posted messages and who owns unfinished work — private details stay stripped.
  const roster: Member[] = state.members
    .filter((item) => item.id !== viewer.id && item.role !== 'viewer')
    .map((item) => ({
      id: item.id, name: item.name, role: item.role, status: item.status, color: item.color,
      createdAt: item.createdAt, phone: null, availability: '', skillsNotes: '', emergencyContact: null,
      certifications: '', languages: '', profilePhotoId: item.profilePhotoId, hourlyRate: null,
      dateOfBirth: null, address: '', jobTitle: '', employmentStartedOn: null,
    }));
  const inbox = visibleInbox(viewer.role, viewer.id, state.inboxItems).map(({ safetyCategory: _category, safetyReason: _reason, safetyReviewedAt: _reviewedAt, safetyReviewedBy: _reviewedBy, ...item }) => item);
  return { viewer: { id: viewer.id, role: viewer.role }, members: [self, ...roster], chores, activity: [], taskGroups: workerTaskGroups(viewer, chores), reminders: remindersFor(chores), announcements: state.activity.filter((item) => item.action === 'announcement').slice(0, 5), shifts: state.shifts.filter((shift) => shift.memberId === viewer.id), availability: state.availability.filter((shift) => shift.memberId === viewer.id), timeEntries: state.timeEntries.filter((entry) => entry.memberId === viewer.id), certifications: state.certifications.filter((cert) => cert.memberId === viewer.id), messages: state.messages, clientNotes, inbox, scheduleRequests: (state.scheduleRequests ?? []).filter((request) => request.status === 'open' || request.requesterId === viewer.id || request.acceptedBy === viewer.id), shiftHandoffs: visibleShiftHandoffs(viewer.role, viewer.id, state.shiftHandoffs ?? [], state.scheduleRequests ?? []), safetyIncidents: visibleSafetyIncidents(viewer.role, viewer.id, state.safetyIncidents ?? []), workloadWarnings: buildWorkloadWarnings([viewer.id], state.shifts, chores, today, workloadThresholds()) };
}

export async function getHouseholdState(memberId: string): Promise<HouseholdState> {
  const state = localDevMode() ? getLocalDevRawState() : await rawState();
  return buildHouseholdState(state as RawState, memberId);
}

async function generateRecurringTasks() {
  const db = getD1();
  const settings = await getHouseholdSettings();
  const horizonDate = new Date();
  horizonDate.setUTCDate(horizonDate.getUTCDate() + Math.max(1, Math.min(365, settings.recurrenceHorizonDays)));
  const horizon = horizonDate.toISOString().slice(0, 10);
  const sources = await db
    .prepare(`SELECT id, title, area, due_date, due_time, created_by, assigned_to, priority, instructions, recurrence, reminder_lead_days FROM chores WHERE recurrence IS NOT NULL AND recurrence_parent_id IS NULL AND due_date IS NOT NULL`)
    .all<Record<string, string | number | null>>();
  const insert = db.prepare(
    `INSERT INTO chores(
      id, title, area, due_date, due_time, status, created_by, assigned_to, completed_by,
      created_at, completed_at, started_at, priority, instructions, recurrence, recurrence_parent_id,
      recurrence_date, progress_notes, completion_notes, issue_report, issue_open, reminder_lead_days
    ) VALUES(?,?,?,?,?,'open',?,?,NULL,?,NULL,NULL,?,?,NULL,?,?,'','','',0,?)
    ON CONFLICT (recurrence_parent_id, recurrence_date) WHERE recurrence_parent_id IS NOT NULL DO NOTHING`,
  );
  for (const source of sources.results) {
    let date = source.due_date as string;
    // The horizon is at most 365 days, so 366 iterations is a hard upper bound even for daily tasks.
    for (let iterations = 0; iterations < 366; iterations += 1) {
      date = nextRecurrenceDate(date, source.recurrence as Recurrence);
      if (date > horizon) break;
      await insert
        .bind(
          crypto.randomUUID(),
          source.title,
          source.area,
          date,
          source.due_time,
          source.created_by,
          source.assigned_to,
          new Date().toISOString(),
          source.priority,
          source.instructions,
          source.id,
          date,
          source.reminder_lead_days ?? null,
        )
        .run();
    }
  }
}

async function cleanupExpiredUploads() {
  const settings = await getHouseholdSettings();
  const root = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_PATH || '/data/uploads');
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - Math.max(1, Math.min(365, settings.retentionDays)));
  const db = getD1();
  const rows = await db
    .prepare(`SELECT id, stored_name AS storedName FROM proof_photos WHERE created_at < ?`)
    .bind(cutoff.toISOString())
    .all<{ id: string; storedName: string }>();
  for (const row of rows.results) {
    try {
      const path = resolve(root, row.storedName);
      if (path.startsWith(`${root}\\`) || path.startsWith(`${root}/`)) {
        if (existsSync(/* turbopackIgnore: true */ path)) await unlink(path);
      }
    } catch {
      // best-effort cleanup
    }
    await db.prepare(`DELETE FROM proof_photos WHERE id=?`).bind(row.id).run();
    await db.prepare(`UPDATE members SET profile_photo_id=NULL WHERE profile_photo_id=?`).bind(row.id).run();
  }
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

function optionalString(value: unknown, maxLength: number): string {
  const text = typeof value === 'string' ? value.trim() : '';
  return text.slice(0, maxLength);
}

function optionalNullableString(value: unknown, maxLength: number): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  return text ? text.slice(0, maxLength) : null;
}

function optionalNullableDate(value: unknown): string | null {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text) || Number.isNaN(Date.parse(`${text}T12:00:00Z`))) throw new Error('Enter a valid date.');
  return text;
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function parseWindowRows(value: unknown) {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    try { parsed = JSON.parse(value); } catch { throw new Error('Invalid shift list.'); }
  }
  if (!Array.isArray(parsed) || parsed.length > 14) throw new Error('Invalid shift list.');
  const timeFormat = /^([01]\d|2[0-3]):[0-5]\d$/;
  const rows = parsed.map((row) => ({ weekday: Number(row?.weekday), startTime: String(row?.startTime ?? ''), endTime: String(row?.endTime ?? '') }));
  for (const row of rows) {
    if (!Number.isInteger(row.weekday) || row.weekday < 0 || row.weekday > 6 || !timeFormat.test(row.startTime) || !timeFormat.test(row.endTime) || row.startTime >= row.endTime) {
      throw new Error('Each shift needs a weekday and a valid start/end time.');
    }
  }
  return rows;
}

export async function mutateHousehold(input: Record<string, unknown>) {
  if (localDevMode()) {
    const raw = mutateLocalDevState(input);
    const actorId = requiredString(input.actorId, 'Profile');
    return buildHouseholdState(raw as RawState, actorId);
  }
  const db = getD1();
  const action = requiredString(input.action, 'Action');
  const actorId = requiredString(input.actorId, 'Profile');
  const actor = await db
    .prepare(`SELECT m.id, m.name, m.role, COALESCE(l.status, 'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=?`)
    .bind(actorId)
    .first<Member>();
  if (!actor || actor.status !== 'active') throw new Error('Household access denied.');
  if (actor.role === 'viewer') throw new Error('Family viewers have read-only access.');
  const now = new Date().toISOString();
  const extras: Record<string, unknown> = {};
  const managerOnly = [
    'createChore',
    'assign',
    'unclaim',
    'addMember',
    'disableMember',
    'reactivateMember',
    'resetMemberPassword',
    'updateHouseholdSettings',
    'announce',
    'setShifts',
    'approveTask',
    'reopenTask',
    'inviteMember',
    'reinviteMember',
    'deleteTimeEntry',
    'saveCertification',
    'deleteCertification',
    'reviewClientNote',
    'acknowledgeSafetyAlert',
    'triageSafetyIncident',
  ];
  if (managerOnly.includes(action) && actor.role !== 'manager') throw new Error('Only the household manager can do that.');

  if (action === 'createChore') {
    const title = requiredString(input.title, 'Chore name');
    const area = requiredString(input.area, 'Area');
    const dueDate = typeof input.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : null;
    const dueTime = typeof input.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.dueTime) ? input.dueTime : null;
    const priority = ['low', 'normal', 'high', 'urgent'].includes(String(input.priority)) ? (input.priority as Priority) : 'normal';
    const instructions = optionalString(input.instructions, 4000);
    const recurrence = ['daily', 'weekly', 'monthly'].includes(String(input.recurrence)) ? (input.recurrence as Recurrence) : null;
    if (recurrence && !dueDate) throw new Error('Recurring tasks require a due date.');
    const assigneeId = typeof input.assigneeId === 'string' && input.assigneeId ? input.assigneeId : null;
    if (assigneeId) await validAssignee(assigneeId);
    const settings = await getHouseholdSettings();
    const reminderLeadDays = clampInteger(input.reminderLeadDays, 0, 90, settings.reminderDefaultLeadDays);
    const id = crypto.randomUUID();
    await db.batch([
      db
        .prepare(
          `INSERT INTO chores (
            id, title, area, due_date, due_time, status, created_by, assigned_to, completed_by,
            created_at, started_at, completed_at, priority, instructions, recurrence, recurrence_date,
            issue_open, reminder_lead_days
          ) VALUES (?,?,?,?,?,'open',?,?,NULL,?,NULL,NULL,?,?,?,?,0,?)`,
        )
        .bind(id, title, area, dueDate, dueTime, actorId, assigneeId, now, priority, instructions, recurrence, dueDate, reminderLeadDays),
      activity(id, actorId, assigneeId ? 'assigned' : 'created', assigneeId ? `assigned ${title}` : `added ${title}`, now),
    ]);
  } else if (['claim', 'start', 'complete'].includes(action)) {
    const choreId = requiredString(input.choreId, 'Chore');
    const chore = await db.prepare('SELECT title, status, assigned_to AS assignedTo FROM chores WHERE id=?').bind(choreId).first<Chore>();
    if (!chore) throw new Error('That chore no longer exists.');
    if (actor.role === 'worker' && !workerCan(action, actorId, chore)) throw new Error('You can only update your own eligible tasks.');
    let result;
    if (action === 'claim') result = await db.prepare("UPDATE chores SET assigned_to=? WHERE id=? AND status='open' AND assigned_to IS NULL").bind(actorId, choreId).run();
    else if (action === 'start')
      result = await db.prepare("UPDATE chores SET status='in_progress', started_at=? WHERE id=? AND status='open' AND (?='manager' OR assigned_to=?)").bind(now, choreId, actor.role, actorId).run();
    else
      result = await db
        .prepare(
          "UPDATE chores SET status='complete', assigned_to=COALESCE(assigned_to,?), completed_by=?, completed_at=?, review_status=? WHERE id=? AND status IN ('open','in_progress') AND (?='manager' OR (status='in_progress' AND assigned_to=?))",
        )
        .bind(actorId, actorId, now, actor.role === 'worker' ? 'pending' : null, choreId, actor.role, actorId)
        .run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That task changed before your update. Refresh and try again.');
    await activity(choreId, actorId, action === 'complete' ? 'completed' : action === 'start' ? 'started' : 'claimed', `${action === 'complete' ? 'finished' : action === 'start' ? 'started' : 'claimed'} ${chore.title}`, now).run();
  } else if (action === 'takeover') {
    const choreId = requiredString(input.choreId, 'Chore');
    const chore = await db.prepare('SELECT title, status, assigned_to AS assignedTo FROM chores WHERE id=?').bind(choreId).first<Chore>();
    if (!chore || chore.status === 'complete') throw new Error('That task is already complete.');
    if (chore.assignedTo === actorId) throw new Error('That task is already yours.');
    if (!chore.assignedTo) throw new Error('That task is unassigned — claim it instead.');
    if (actor.role === 'worker' && !workerCan('takeover', actorId, chore)) throw new Error('You can only take over unfinished tasks.');
    const previous = await db.prepare('SELECT name FROM members WHERE id=?').bind(chore.assignedTo).first<{ name: string }>();
    await db.batch([
      db.prepare("UPDATE chores SET assigned_to=?, status='open', started_at=NULL WHERE id=? AND status!='complete'").bind(actorId, choreId),
      db.prepare('INSERT INTO task_notes(id,chore_id,member_id,kind,body,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), choreId, actorId, 'progress', `Took over${previous ? ` from ${previous.name}` : ''}`, now),
      activity(choreId, actorId, 'took_over', `took over ${chore.title}`, now),
    ]);
  } else if (action === 'postMessage') {
    const body = requiredString(input.body, 'Message').slice(0, 1000);
    await db.batch([
      db.prepare('INSERT INTO messages(id,member_id,body,created_at) VALUES(?,?,?,?)').bind(crypto.randomUUID(), actorId, body, now),
      activity(null, actorId, 'posted_message', body.slice(0, 200), now),
    ]);
  } else if (action === 'requestScheduleChange') {
    if (actor.role !== 'worker') throw new Error('Only care workers can request a schedule change.');
    const shiftId = requiredString(input.shiftId, 'Shift');
    const shift = await db.prepare(`SELECT id, weekday, start_time AS startTime, end_time AS endTime FROM shifts WHERE id=? AND member_id=?`).bind(shiftId, actorId).first<{ id: string; weekday: number; startTime: string; endTime: string }>();
    const request = scheduleChangeRequest(input.date, input.reason, shift ?? null);
    const manager = await db.prepare(`SELECT m.id FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.role='manager' AND COALESCE(l.status,'active')='active' LIMIT 1`).first<{ id: string }>();
    if (!manager) throw new Error('No active manager is available to receive this request.');
    const duplicate = await db.prepare(`SELECT id FROM schedule_change_requests WHERE requester_id=? AND requested_date=? LIMIT 1`).bind(actorId, request.date).first();
    if (duplicate) throw new Error('You already requested a schedule change for that date.');
    await db.batch([
      db.prepare(`INSERT INTO schedule_change_requests(id,household_id,requester_id,shift_id,requested_date,start_time,end_time,reason,status,created_at) VALUES(?,'default',?,?,?,?,?,?,'open',?)`)
        .bind(crypto.randomUUID(), actorId, request.shift.id, request.date, request.shift.startTime, request.shift.endTime, request.reason, now),
      db.prepare(`INSERT INTO worker_inbox_items(id,household_id,worker_id,kind,body,submission_id,created_by,created_at) VALUES(?,'default',?,'direct_message',?,NULL,?,?)`)
        .bind(crypto.randomUUID(), manager.id, request.body, actorId, now),
      activity(null, actorId, 'schedule_change_requested', `${actor.name} requested a schedule change for ${request.date}`, now),
    ]);
    const recipients = await db.prepare(`SELECT g.email, m.phone, m.sms_opt_in AS smsOptIn FROM members m JOIN google_accounts g ON g.member_id=m.id LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.role='worker' AND m.id<>? AND COALESCE(l.status,'active')='active'`).bind(actorId).all<{ email: string; phone: string | null; smsOptIn: boolean }>();
    try { await sendCoverageEmail({ recipients: recipients.results.map((item) => item.email), date: request.date, startTime: request.shift.startTime, endTime: request.shift.endTime }); }
    catch (error) { console.error('Coverage email delivery failed after saving the in-app request.', error instanceof Error ? error.message : error); }
    try { await sendCareBoardSms(recipients.results.filter((item) => item.smsOptIn).map((item) => item.phone ?? ''), `CareBoard: A shift on ${request.date}, ${request.shift.startTime}-${request.shift.endTime}, needs coverage. Sign in to CareBoard to accept.`); }
    catch (error) { console.error('Coverage SMS delivery failed after saving the in-app request.', error instanceof Error ? error.message : error); }
  } else if (action === 'acceptScheduleCoverage') {
    if (actor.role !== 'worker') throw new Error('Only active care workers can accept shift coverage.');
    const requestId = requiredString(input.requestId, 'Schedule request');
    const request = await db.prepare(`SELECT id, requester_id AS requesterId, requested_date AS requestedDate, start_time AS startTime, end_time AS endTime, status FROM schedule_change_requests WHERE id=?`).bind(requestId).first<ScheduleChangeRequest>();
    if (!request || request.status !== 'open') throw new Error('That coverage request is no longer available.');
    if (request.requesterId === actorId) throw new Error('You cannot accept your own coverage request.');
    const conflict = await db.prepare(`SELECT id FROM schedule_change_requests WHERE accepted_by=? AND requested_date=? AND status='covered' LIMIT 1`).bind(actorId, request.requestedDate).first();
    if (conflict) throw new Error('You already have accepted coverage on that date.');
    const weekday = new Date(`${request.requestedDate}T12:00:00Z`).getUTCDay();
    const overlappingShift = await db.prepare(`SELECT id FROM shifts WHERE member_id=? AND weekday=? AND start_time<? AND end_time>? LIMIT 1`).bind(actorId, weekday, request.endTime, request.startTime).first();
    if (overlappingShift) throw new Error('That shift conflicts with your existing schedule.');
    const result = await db.prepare(`UPDATE schedule_change_requests SET status='covered',accepted_by=?,accepted_at=? WHERE id=? AND status='open'`).bind(actorId, now, requestId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That coverage request was already accepted.');
    await activity(null, actorId, 'schedule_coverage_accepted', `${actor.name} accepted shift coverage for ${request.requestedDate}`, now).run();
    const managers = await db.prepare(`SELECT g.email, m.phone, m.sms_opt_in AS smsOptIn FROM members m JOIN google_accounts g ON g.member_id=m.id LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.role='manager' AND COALESCE(l.status,'active')='active'`).all<{ email: string; phone: string | null; smsOptIn: boolean }>();
    try { await sendManagerCoverageEmail({ recipients: managers.results.map((item) => item.email), date: request.requestedDate, startTime: request.startTime, endTime: request.endTime }); }
    catch (error) { console.error('Manager coverage email failed after saving the accepted coverage.', error instanceof Error ? error.message : error); }
    try { await sendCareBoardSms(managers.results.filter((item) => item.smsOptIn).map((item) => item.phone ?? ''), `CareBoard: Coverage was accepted for ${request.requestedDate}, ${request.startTime}-${request.endTime}. Review the manager dashboard.`); }
    catch (error) { console.error('Manager coverage SMS failed after saving the accepted coverage.', error instanceof Error ? error.message : error); }
  } else if (action === 'recordShiftHandoff') {
    const handoff = validateShiftHandoff(input, now.slice(0, 10));
    await db.batch([
      db.prepare(`INSERT INTO shift_handoffs(id,household_id,author_id,shift_date,completed_care,outstanding_tasks,observations,checklist_json,created_at) VALUES(?,'default',?,?,?,?,?,?,?)`)
        .bind(crypto.randomUUID(), actorId, handoff.shiftDate, handoff.completedCare, handoff.outstandingTasks, handoff.observations, JSON.stringify(handoff.checklist), now),
      activity(null, actorId, 'recorded_handoff', `${actor.name} recorded a shift handoff for ${handoff.shiftDate}`, now),
    ]);
  } else if (action === 'reportSafetyIncident') {
    const incident = validateSafetyIncident(input, now);
    const incidentId = crypto.randomUUID();
    const statements = [
      db.prepare(`INSERT INTO safety_incidents(id,household_id,reporter_id,category,severity,occurred_at,location,description,immediate_action,status,created_at,updated_at) VALUES(?,'default',?,?,?,?,?,?,?,'submitted',?,?)`)
        .bind(incidentId, actorId, incident.category, incident.severity, incident.occurredAt, incident.location, incident.description, incident.immediateAction, now, now),
      activity(null, actorId, 'safety_incident_reported', `${actor.name} reported a ${incident.severity} safety concern`, now),
    ];
    if (incident.severity === 'high' || incident.severity === 'urgent') {
      const managers = await db.prepare(`SELECT m.id FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.role='manager' AND COALESCE(l.status,'active')='active'`).all<{ id: string }>();
      for (const manager of managers.results) {
        statements.push(
          db.prepare(`INSERT INTO worker_inbox_items(id,household_id,worker_id,kind,body,submission_id,created_by,created_at) VALUES(?,'default',?,'direct_message',?,NULL,?,?)`)
            .bind(crypto.randomUUID(), manager.id, `${incident.severity === 'urgent' ? 'Urgent' : 'High-severity'} safety report from ${actor.name}: ${incident.description.slice(0, 300)} — open the command center to triage.`, actorId, now),
        );
      }
    }
    await db.batch(statements);
  } else if (action === 'triageSafetyIncident') {
    const incidentId = requiredString(input.incidentId, 'Safety report');
    const incident = await db.prepare(`SELECT id, reporter_id AS reporterId, category, severity, occurred_at AS occurredAt, status FROM safety_incidents WHERE id=? AND household_id='default'`).bind(incidentId).first<SafetyIncident>();
    if (!incident) throw new Error('That safety report no longer exists.');
    const triage = triageSafetyIncident({ status: incident.status }, input);
    if (triage.assignedTo) {
      const assignee = await db.prepare(`SELECT m.id FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role IN ('worker','manager') AND COALESCE(l.status,'active')='active'`).bind(triage.assignedTo).first<{ id: string }>();
      if (!assignee) throw new Error('Choose an active care team member for follow-up.');
    }
    const result = await db
      .prepare(`UPDATE safety_incidents SET status=?, assigned_to=?, follow_up=?, resolved_at=?, updated_at=? WHERE id=? AND status!='resolved'`)
      .bind(triage.status, triage.assignedTo, triage.followUp, triage.resolved ? now : null, now, incidentId)
      .run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That safety report is already resolved.');
    await db.batch([
      activity(null, actorId, 'safety_incident_triaged', `${triage.status} safety report from ${incident.occurredAt.slice(0, 10)}`, now),
      db.prepare(`INSERT INTO worker_inbox_items(id,household_id,worker_id,kind,body,submission_id,created_by,created_at) VALUES(?,'default',?,'manager_message',?,NULL,?,?)`)
        .bind(crypto.randomUUID(), incident.reporterId, `Your safety report (${incident.category.replace('_', ' ')}, ${incident.occurredAt.slice(0, 10)}) is now ${triage.status === 'resolved' ? 'resolved' : 'being reviewed'}.${triage.followUp ? ` ${triage.followUp.slice(0, 300)}` : ''}`, actorId, now),
    ]);
  } else if (action === 'sendInboxMessage') {
    const recipientId = requiredString(input.recipientId, 'Recipient');
    const body = requiredString(input.body, 'Message').slice(0, 1000);
    const recipient = await db
      .prepare(`SELECT m.id, m.role, COALESCE(l.status,'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=?`)
      .bind(recipientId)
      .first<{ id: string; role: Role; status: AccountStatus }>();
    if (!recipient || !canSendInboxMessage(actor.role, actor.id, recipient)) throw new Error('You cannot message that team member.');
    const triage = triageInboxMessage(body);
    const messageId = crypto.randomUUID();
    const statements = [
      db.prepare(`INSERT INTO worker_inbox_items(id,household_id,worker_id,kind,body,submission_id,created_by,safety_category,safety_reason,created_at) VALUES(?,'default',?,?,?,NULL,?,?,?,?)`)
        .bind(messageId, recipientId, actor.role === 'manager' ? 'manager_message' : 'direct_message', body, actorId, triage?.category ?? null, triage?.reason ?? null, now),
      activity(null, actorId, 'sent_inbox_message', `sent a monitored inbox message to ${recipientId}`, now),
    ];
    if (triage) statements.push(activity(null, actorId, 'safety_alert_created', `advisory ${triage.category} alert for inbox message ${messageId}`, now));
    await db.batch(statements);
  } else if (action === 'reviewClientNote') {
    const submissionId = requiredString(input.submissionId, 'Client note');
    const decision = input.decision === 'approve' ? 'approve' : input.decision === 'reject' ? 'reject' : '';
    if (!decision) throw new Error('Choose approve or reject.');
    const note = await db.prepare(`SELECT status, submitted_by AS submittedBy FROM client_note_submissions WHERE id=? AND household_id='default'`)
      .bind(submissionId).first<{ status: ClientNoteStatus; submittedBy: string }>();
    if (!note) throw new Error('Client note not found.');
    const review = reviewClientNote(note.status, decision, input.reviewedText);
    const [result] = await db.batch([
      db.prepare(`UPDATE client_note_submissions SET status=?, approved_text=?, reviewed_by=?, reviewed_at=? WHERE id=? AND status='pending'`)
        .bind(review.status, review.approvedText, actorId, now, submissionId),
      db.prepare(`INSERT INTO worker_inbox_items(id,household_id,worker_id,kind,body,submission_id,created_by,created_at)
        SELECT ?,'default',?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM client_note_submissions WHERE id=? AND reviewed_by=? AND reviewed_at=?)`)
        .bind(crypto.randomUUID(), note.submittedBy, review.status === 'approved' ? 'client_note_approved' : 'client_note_rejected', review.status === 'approved' ? 'Your client note was approved and added to the client record.' : 'Your client note was rejected and was not added to the client record.', submissionId, actorId, now, submissionId, actorId, now),
      db.prepare(`INSERT INTO activity(id,chore_id,member_id,action,detail,created_at)
        SELECT ?,NULL,?,?,?,? WHERE EXISTS (SELECT 1 FROM client_note_submissions WHERE id=? AND reviewed_by=? AND reviewed_at=?)`)
        .bind(crypto.randomUUID(), actorId, review.status === 'approved' ? 'approved_client_note' : 'rejected_client_note', `${review.status} client note ${submissionId}`, now, submissionId, actorId, now),
    ]);
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That client note has already been reviewed.');
  } else if (action === 'acknowledgeSafetyAlert') {
    const messageId = requiredString(input.messageId, 'Alert');
    const result = await db.prepare(`UPDATE worker_inbox_items SET safety_reviewed_by=?, safety_reviewed_at=? WHERE id=? AND household_id='default' AND safety_category IS NOT NULL AND safety_reviewed_at IS NULL`)
      .bind(actorId, now, messageId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That safety alert is unavailable or already reviewed.');
    await activity(null, actorId, 'safety_alert_reviewed', `reviewed advisory alert for inbox message ${messageId}`, now).run();
  } else if (action === 'addNote') {
    const choreId = requiredString(input.choreId, 'Task');
    const kind = ['progress', 'completion', 'issue'].includes(String(input.kind)) ? String(input.kind) : '';
    const body = requiredString(input.body, 'Note').slice(0, 4000);
    const chore = await db.prepare('SELECT assigned_to AS assignedTo, status FROM chores WHERE id=?').bind(choreId).first<Chore>();
    if (!chore || (actor.role === 'worker' && chore.assignedTo !== actorId)) throw new Error('You can only add notes to your own tasks.');
    if (!kind) throw new Error('Choose a valid note type.');
    const column = kind === 'progress' ? 'progress_notes' : kind === 'completion' ? 'completion_notes' : 'issue_report';
    const issueOpen = kind === 'issue' ? 1 : undefined;
    await db.batch([
      db.prepare(`INSERT INTO task_notes(id,chore_id,member_id,kind,body,created_at) VALUES(?,?,?,?,?,?)`).bind(crypto.randomUUID(), choreId, actorId, kind, body, now),
      db.prepare(`UPDATE chores SET ${column}=? ${issueOpen !== undefined ? ', issue_open=?' : ''} WHERE id=?`).bind(...(issueOpen !== undefined ? [body, issueOpen, choreId] : [body, choreId])),
      activity(choreId, actorId, `note_${kind}`, body, now),
    ]);
  } else if (action === 'updateTask') {
    const choreId = requiredString(input.choreId, 'Task');
    const chore = await db
      .prepare(
        `SELECT id, title, status, assigned_to AS assignedTo, created_by AS createdBy FROM chores WHERE id=?`,
      )
      .bind(choreId)
      .first<Chore>();
    if (!chore) throw new Error('That task no longer exists.');
    if (actor.role === 'worker' && (chore.assignedTo !== actorId || chore.status === 'complete')) throw new Error('You can only update your own active tasks.');
    if (actor.role === 'manager') {
      const title = typeof input.title === 'string' && input.title.trim() ? input.title.trim().slice(0, 200) : chore.title;
      const area = typeof input.area === 'string' && input.area.trim() ? input.area.trim().slice(0, 100) : chore.area;
      const dueDate = typeof input.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.dueDate) ? input.dueDate : chore.dueDate;
      const dueTime = typeof input.dueTime === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(input.dueTime) ? input.dueTime : chore.dueTime;
      const priority = ['low', 'normal', 'high', 'urgent'].includes(String(input.priority)) ? (input.priority as Priority) : chore.priority;
      const instructions = typeof input.instructions === 'string' ? input.instructions.trim().slice(0, 4000) : chore.instructions;
      const recurrence = ['daily', 'weekly', 'monthly'].includes(String(input.recurrence)) ? (input.recurrence as Recurrence) : null;
      const reminderLeadDays = clampInteger(input.reminderLeadDays, 0, 90, chore.reminderLeadDays ?? 1);
      const assigneeId = typeof input.assigneeId === 'string' && input.assigneeId ? input.assigneeId : null;
      if (assigneeId) await validAssignee(assigneeId);
      await db
        .prepare(
          `UPDATE chores SET title=?, area=?, due_date=?, due_time=?, priority=?, instructions=?, recurrence=?,
            assigned_to=?, status=CASE WHEN status='in_progress' AND assigned_to != ? THEN 'open' ELSE status END,
            started_at=CASE WHEN assigned_to != ? THEN NULL ELSE started_at END,
            reminder_lead_days=? WHERE id=?`,
        )
        .bind(title, area, dueDate, dueTime, priority, instructions, recurrence, assigneeId, assigneeId, assigneeId, reminderLeadDays, choreId)
        .run();
      await activity(choreId, actorId, 'updated_task', `updated ${title}`, now).run();
    } else {
      const progressNotes = typeof input.progressNotes === 'string' ? input.progressNotes.trim().slice(0, 4000) : undefined;
      const completionNotes = typeof input.completionNotes === 'string' ? input.completionNotes.trim().slice(0, 4000) : undefined;
      const issueReport = typeof input.issueReport === 'string' ? input.issueReport.trim().slice(0, 4000) : undefined;
      const issueOpen = typeof input.issueOpen === 'boolean' ? (input.issueOpen ? 1 : 0) : undefined;
      const expectedCompletionAt =
        typeof input.expectedCompletionAt === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(input.expectedCompletionAt) ? input.expectedCompletionAt : undefined;
      const sets: string[] = [];
      const values: (string | number | null)[] = [];
      if (progressNotes !== undefined) { sets.push('progress_notes=?'); values.push(progressNotes); }
      if (completionNotes !== undefined) { sets.push('completion_notes=?'); values.push(completionNotes); }
      if (issueReport !== undefined) { sets.push('issue_report=?'); values.push(issueReport); }
      if (issueOpen !== undefined) { sets.push('issue_open=?'); values.push(issueOpen); }
      if (expectedCompletionAt !== undefined) { sets.push('expected_completion_at=?'); values.push(expectedCompletionAt); }
      if (!sets.length) throw new Error('No valid fields to update.');
      values.push(choreId);
      await db.prepare(`UPDATE chores SET ${sets.join(', ')} WHERE id=?`).bind(...values).run();
      await activity(choreId, actorId, 'updated_task_progress', `updated progress on ${chore.title}`, now).run();
    }
  } else if (action === 'assign' || action === 'unclaim') {
    const choreId = requiredString(input.choreId, 'Chore');
    const assigneeId = action === 'assign' ? requiredString(input.assigneeId, 'Care worker') : null;
    if (assigneeId) await validAssignee(assigneeId);
    const result = await db
      .prepare("UPDATE chores SET assigned_to=?, status=CASE WHEN status='in_progress' THEN 'open' ELSE status END, started_at=NULL WHERE id=? AND status!='complete'")
      .bind(assigneeId, choreId)
      .run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('Choose an incomplete task.');
    await activity(choreId, actorId, action === 'assign' ? 'assigned' : 'unclaimed', `${action === 'assign' ? 'assigned' : 'unassigned'} task`, now).run();
  } else if (action === 'approveTask' || action === 'reopenTask') {
    const choreId = requiredString(input.choreId, 'Task');
    const chore = await db.prepare('SELECT title FROM chores WHERE id=?').bind(choreId).first<Chore>();
    if (!chore) throw new Error('That task no longer exists.');
    const result = action === 'approveTask'
      ? await db.prepare("UPDATE chores SET review_status='approved' WHERE id=? AND review_status='pending'").bind(choreId).run()
      : await db.prepare("UPDATE chores SET status='in_progress', review_status=NULL, completed_at=NULL WHERE id=? AND review_status='pending'").bind(choreId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That task is not awaiting review.');
    await db.batch([
      db.prepare('INSERT INTO task_notes(id,chore_id,member_id,kind,body,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), choreId, actorId, action === 'approveTask' ? 'completion' : 'progress', action === 'approveTask' ? 'Approved by the manager' : 'Sent back for rework by the manager', now),
      activity(choreId, actorId, action === 'approveTask' ? 'approved' : 'reopened', `${action === 'approveTask' ? 'approved' : 'sent back'} ${chore.title}`, now),
    ]);
  } else if (action === 'addMember') {
    const name = requiredString(input.name, 'Name');
    const email = normalizeEmail(input.googleEmail);
    const temporaryPassword = input.temporaryPassword;
    if (!email || email === ownerEmail() || memberIdForEmail(email)) throw new Error('Enter an unused care worker email address.');
    const passwordProblem = passwordError(temporaryPassword);
    if (passwordProblem) throw new Error(passwordProblem);
    await ensureAccountTable();
    if (await db.prepare('SELECT email FROM google_accounts WHERE email=?').bind(email).first()) throw new Error('This email already has a profile.');
    const id = crypto.randomUUID();
    const count = await db.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
    const passwordHash = await hashPassword(temporaryPassword as string);
    await db.batch([
      db.prepare('INSERT INTO members(id,name,role,color,created_at) VALUES (?,?,"worker",?,?)').bind(id, name, palette[(count?.count ?? 0) % palette.length], now),
      db.prepare('INSERT INTO google_accounts(email,member_id) VALUES (?,?)').bind(email, id),
      db.prepare("INSERT INTO account_lifecycle(member_id,household_id,status,activated_at,updated_at) VALUES (?,'default','active',?,?)").bind(id, now, now),
      activity(null, actorId, 'created_worker', `created care worker ${name}`, now),
    ]);
    await setCredential(email, passwordHash, true);
  } else if (action === 'inviteMember') {
    const name = requiredString(input.name, 'Name');
    const email = normalizeEmail(input.googleEmail);
    const role = input.role === 'viewer' ? 'viewer' : 'worker';
    if (!email || email === ownerEmail() || memberIdForEmail(email)) throw new Error('Enter an unused email address.');
    await ensureAccountTable();
    if (await db.prepare('SELECT email FROM google_accounts WHERE email=?').bind(email).first()) throw new Error('This email already has a profile.');
    const id = crypto.randomUUID();
    const count = await db.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
    const token = newInviteToken();
    extras.inviteToken = token;
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.batch([
      db.prepare('INSERT INTO members(id,name,role,color,created_at) VALUES (?,?,?,?)').bind(id, name, role, palette[(count?.count ?? 0) % palette.length], now),
      db.prepare('INSERT INTO google_accounts(email,member_id) VALUES (?,?)').bind(email, id),
      db.prepare("INSERT INTO account_lifecycle(member_id,household_id,status,updated_at) VALUES (?,'default','invited',?)").bind(id, now),
      db.prepare('INSERT INTO worker_invites(id,member_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), id, await inviteTokenHash(token), expires, now),
      activity(null, actorId, 'invited_member', `invited ${role === 'viewer' ? 'family viewer' : 'care worker'} ${name}`, now),
    ]);
  } else if (action === 'reinviteMember') {
    const memberId = requiredString(input.memberId, 'Member');
    const member = await db.prepare(`SELECT m.name, COALESCE(l.status,'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role IN ('worker','viewer')`).bind(memberId).first<Member>();
    if (!member || member.status !== 'invited') throw new Error('Only pending invites can be renewed.');
    const token = newInviteToken();
    extras.inviteToken = token;
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await db.batch([
      db.prepare('INSERT INTO worker_invites(id,member_id,token_hash,expires_at,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(), memberId, await inviteTokenHash(token), expires, now),
      activity(null, actorId, 'reinvited_worker', `created a new invite link for ${member.name}`, now),
    ]);
  } else if (action === 'setShifts' || action === 'setAvailability') {
    const memberId = requiredString(input.memberId, 'Care worker');
    if (action === 'setAvailability' && actor.role !== 'manager' && memberId !== actorId) throw new Error('You can only update your own availability.');
    const worker = await db.prepare("SELECT name FROM members WHERE id=? AND role='worker'").bind(memberId).first<Member>();
    if (!worker) throw new Error('Choose a valid care worker.');
    const rows = parseWindowRows(input.shifts ?? input.windows);
    const table = action === 'setShifts' ? 'shifts' : 'availability_windows';
    await db.batch([
      db.prepare(`DELETE FROM ${table} WHERE member_id=?`).bind(memberId),
      ...rows.map((row) =>
        db.prepare(`INSERT INTO ${table} (id, member_id, weekday, start_time, end_time, created_at) VALUES (?,?,?,?,?,?)`).bind(crypto.randomUUID(), memberId, row.weekday, row.startTime, row.endTime, now),
      ),
      activity(null, actorId, action === 'setShifts' ? 'updated_shifts' : 'updated_availability', `${action === 'setShifts' ? 'updated shifts' : 'updated availability'} for ${worker.name}`, now),
    ]);
  } else if (action === 'updateProfile') {
    const memberId = requiredString(input.memberId, 'Profile');
    const target = await db
      .prepare(
        `SELECT m.id, m.role, g.email FROM members m LEFT JOIN google_accounts g ON g.member_id=m.id WHERE m.id=?`,
      )
      .bind(memberId)
      .first<{ id: string; role: Role; email?: string }>();
    if (!target) throw new Error('Choose a valid profile.');
    if (actor.role === 'worker' && actor.id !== target.id) throw new Error('You can only edit your own profile.');
    const allowedWorkerFields = new Set(['phone', 'smsOptIn', 'availability', 'languages', 'profilePhotoId']);
    const changedFields = Object.keys(input).filter((key) => key !== 'action' && key !== 'actorId' && key !== 'memberId');
    if (actor.role === 'worker' && changedFields.some((field) => !allowedWorkerFields.has(field))) {
      throw new Error('You can only edit phone, availability, languages, and profile photo.');
    }
    const phone = optionalNullableString(input.phone, 40);
    const smsOptIn = input.smsOptIn !== undefined ? input.smsOptIn === 'on' || input.smsOptIn === true : undefined;
    if (smsOptIn && !isE164(phone)) throw new Error('SMS alerts require a phone number in E.164 format, such as +15551234567.');
    const availability = optionalString(input.availability, 1000);
    const languages = optionalString(input.languages, 500);
    const skillsNotes = actor.role === 'manager' ? optionalString(input.skillsNotes, 2000) : undefined;
    const certifications = actor.role === 'manager' ? optionalString(input.certifications, 2000) : undefined;
    const emergencyContact = actor.role === 'manager' ? optionalNullableString(input.emergencyContact, 200) : undefined;
    const hourlyRate = actor.role === 'manager' && input.hourlyRate !== undefined
      ? (input.hourlyRate === '' || input.hourlyRate === null ? null : clampNumber(input.hourlyRate, 0, 1000, 0))
      : undefined;
    const name = actor.role === 'manager' ? (typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 200) : undefined) : undefined;
    const email = actor.role === 'manager' ? normalizeEmail(input.email) : undefined;
    const dateOfBirth = actor.role === 'manager' ? optionalNullableDate(input.dateOfBirth) : undefined;
    const address = actor.role === 'manager' ? optionalString(input.address, 500) : undefined;
    const jobTitle = actor.role === 'manager' ? optionalString(input.jobTitle, 100) : undefined;
    const employmentStartedOn = actor.role === 'manager' ? optionalNullableDate(input.employmentStartedOn) : undefined;
    const profilePhotoId = typeof input.profilePhotoId === 'string' && input.profilePhotoId ? input.profilePhotoId : undefined;
    if (profilePhotoId) {
      const photoOwner = await db.prepare('SELECT profile_member_id FROM proof_photos WHERE id=?').bind(profilePhotoId).first<{ profileMemberId: string }>();
      if (!photoOwner || (actor.role === 'worker' && photoOwner.profileMemberId !== actor.id)) throw new Error('Choose a valid profile photo.');
    }
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    if (phone !== undefined) { sets.push('phone=?'); values.push(phone); }
    if (smsOptIn !== undefined) { sets.push('sms_opt_in=?'); values.push(smsOptIn ? 1 : 0); }
    if (availability !== undefined) { sets.push('availability=?'); values.push(availability); }
    if (languages !== undefined) { sets.push('languages=?'); values.push(languages); }
    if (skillsNotes !== undefined) { sets.push('skills_notes=?'); values.push(skillsNotes); }
    if (certifications !== undefined) { sets.push('certifications=?'); values.push(certifications); }
    if (emergencyContact !== undefined) { sets.push('emergency_contact=?'); values.push(emergencyContact); }
    if (name !== undefined) { sets.push('name=?'); values.push(name); }
    if (profilePhotoId !== undefined) { sets.push('profile_photo_id=?'); values.push(profilePhotoId); }
    if (hourlyRate !== undefined) { sets.push('hourly_rate=?'); values.push(hourlyRate); }
    if (dateOfBirth !== undefined) { sets.push('date_of_birth=?'); values.push(dateOfBirth); }
    if (address !== undefined) { sets.push('address=?'); values.push(address); }
    if (jobTitle !== undefined) { sets.push('job_title=?'); values.push(jobTitle); }
    if (employmentStartedOn !== undefined) { sets.push('employment_started_on=?'); values.push(employmentStartedOn); }
    if (!sets.length) throw new Error('No valid fields to update.');
    values.push(memberId);
    await db.prepare(`UPDATE members SET ${sets.join(', ')} WHERE id=?`).bind(...values).run();
    if (email !== undefined && email && email !== target.email) {
      if (email === ownerEmail() || (await db.prepare('SELECT email FROM google_accounts WHERE email=?').bind(email).first())) {
        throw new Error('That email is already in use.');
      }
      await db.prepare('UPDATE google_accounts SET email=? WHERE member_id=?').bind(email, memberId).run();
      if (target.email) {
        const credential = await credentialForEmail(target.email);
        if (credential) {
          await setCredential(email, credential.hash, Boolean(credential.mustChangePassword));
          await db.prepare('DELETE FROM auth_credentials WHERE email=?').bind(target.email).run();
        }
      }
    }
    await activity(null, actorId, 'updated_profile', `updated profile for ${name ?? target.id}`, now).run();
  } else if (action === 'updateHouseholdSettings') {
    const recurrenceHorizonDays = clampInteger(input.recurrenceHorizonDays, 1, 365, 30);
    const reminderDefaultLeadDays = clampInteger(input.reminderDefaultLeadDays, 0, 90, 1);
    // Proof-photo retention is a fixed privacy policy, not a manager-configurable value.
    const retentionDays = 90;
    const fundedHoursMonthly = clampNumber(input.fundedHoursMonthly, 0, 10000, 0);
    const fundingHourlyRate = clampNumber(input.fundingHourlyRate, 0, 1000, 0);
    await db
      .prepare(
        `UPDATE household_settings SET recurrence_horizon_days=?, reminder_default_lead_days=?, retention_days=?, funded_hours_monthly=?, funding_hourly_rate=?, updated_at=? WHERE household_id='default'`,
      )
      .bind(recurrenceHorizonDays, reminderDefaultLeadDays, retentionDays, fundedHoursMonthly, fundingHourlyRate, now)
      .run();
    await activity(null, actorId, 'updated_settings', 'updated household settings', now).run();
  } else if (action === 'saveCertification') {
    const memberId = requiredString(input.memberId, 'Care worker');
    const worker = await db.prepare("SELECT name FROM members WHERE id=? AND role='worker'").bind(memberId).first<Member>();
    if (!worker) throw new Error('Certifications can only be recorded for care workers.');
    const name = requiredString(input.name, 'Certification name').slice(0, 200);
    const expiresOn = typeof input.expiresOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input.expiresOn) ? input.expiresOn : null;
    if (!expiresOn) throw new Error('Choose a valid expiry date.');
    const certId = typeof input.id === 'string' && input.id ? input.id : crypto.randomUUID();
    await db.batch([
      db
        .prepare(`INSERT INTO certification_records(id, member_id, name, expires_on, created_at) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET name=excluded.name, expires_on=excluded.expires_on`)
        .bind(certId, memberId, name, expiresOn, now),
      activity(null, actorId, 'saved_certification', `updated a certification for ${worker.name}`, now),
    ]);
  } else if (action === 'deleteCertification') {
    const certId = requiredString(input.id, 'Certification');
    await db.batch([
      db.prepare(`DELETE FROM certification_records WHERE id=?`).bind(certId),
      activity(null, actorId, 'deleted_certification', 'removed a certification record', now),
    ]);
  } else if (action === 'deleteUpload') {
    const uploadId = requiredString(input.uploadId, 'Upload');
    const upload = await db
      .prepare(
        `SELECT p.stored_name AS storedName, p.uploaded_by AS uploadedBy, p.chore_id AS choreId, c.assigned_to AS assignedTo
        FROM proof_photos p LEFT JOIN chores c ON c.id=p.chore_id WHERE p.id=?`,
      )
      .bind(uploadId)
      .first<{ storedName: string; uploadedBy: string; choreId: string | null; assignedTo: string | null }>();
    if (!upload) throw new Error('Upload not found.');
    const clientNote = await db.prepare('SELECT id FROM client_note_submissions WHERE source_photo_id=?').bind(uploadId).first<{ id: string }>();
    if (clientNote) throw new Error('Client note source images are retained with their review record.');
    if (actor.role !== 'manager' && actor.id !== upload.uploadedBy && upload.assignedTo !== actor.id) throw new Error('Only the manager or the upload owner can remove this.');
    const root = resolve(/* turbopackIgnore: true */ process.env.UPLOAD_PATH || '/data/uploads');
    const path = resolve(root, upload.storedName);
    if ((path.startsWith(`${root}\\`) || path.startsWith(`${root}/`)) && existsSync(/* turbopackIgnore: true */ path)) await unlink(path);
    await db.prepare('DELETE FROM proof_photos WHERE id=?').bind(uploadId).run();
    await db.prepare('UPDATE members SET profile_photo_id=NULL WHERE profile_photo_id=?').bind(uploadId).run();
    await activity(null, actorId, 'deleted_upload', `deleted upload ${uploadId}`, now).run();
  } else if (['disableMember', 'reactivateMember'].includes(action)) {
    const memberId = requiredString(input.memberId, 'Care worker');
    const member = await db.prepare("SELECT id FROM members WHERE id=? AND role IN ('worker','viewer')").bind(memberId).first();
    if (!member) throw new Error('Choose a valid member.');
    await setAccountStatus(memberId, action === 'disableMember' ? 'disabled' : 'active');
    await activity(null, actorId, action === 'disableMember' ? 'disabled_worker' : 'reactivated_worker', `${action === 'disableMember' ? 'disabled' : 'reactivated'} care worker`, now).run();
  } else if (action === 'clockIn' || action === 'clockOut') {
    const memberId = typeof input.memberId === 'string' && input.memberId ? input.memberId : actorId;
    if (actor.role !== 'manager' && memberId !== actorId) throw new Error('You can only track your own time.');
    const target = await db.prepare(`SELECT m.id, m.name, COALESCE(l.status,'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role='worker'`).bind(memberId).first<Member>();
    if (!target || target.status !== 'active') throw new Error('Choose an active care worker.');
    const open = await db.prepare('SELECT id FROM time_entries WHERE member_id=? AND ended_at IS NULL').bind(memberId).first<{ id: string }>();
    if (action === 'clockIn') {
      if (open) throw new Error(`${target.name} is already clocked in.`);
      await db.batch([
        db.prepare('INSERT INTO time_entries(id,member_id,started_at,created_at) VALUES (?,?,?,?)').bind(crypto.randomUUID(), memberId, now, now),
        activity(null, actorId, 'clocked_in', `clocked in ${target.name}`, now),
      ]);
    } else {
      if (!open) throw new Error(`${target.name} is not clocked in.`);
      await db.batch([
        db.prepare('UPDATE time_entries SET ended_at=? WHERE id=?').bind(now, open.id),
        activity(null, actorId, 'clocked_out', `clocked out ${target.name}`, now),
      ]);
    }
  } else if (action === 'deleteTimeEntry') {
    const entryId = requiredString(input.entryId, 'Time entry');
    const result = await db.prepare('DELETE FROM time_entries WHERE id=?').bind(entryId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('Time entry not found.');
    await activity(null, actorId, 'deleted_time_entry', 'removed a time entry', now).run();
  } else if (action === 'resetMemberPassword') {
    const memberId = requiredString(input.memberId, 'Care worker');
    const temporaryPassword = input.temporaryPassword;
    const passwordProblem = passwordError(temporaryPassword);
    if (passwordProblem) throw new Error(passwordProblem);
    const target = await db.prepare(`SELECT g.email FROM google_accounts g JOIN members m ON m.id=g.member_id WHERE m.id=? AND m.role IN ('worker','viewer')`).bind(memberId).first<{ email: string }>();
    if (!target) throw new Error('Choose a valid member.');
    await setCredential(target.email, await hashPassword(temporaryPassword as string), true);
    await activity(null, actorId, 'reset_password', `reset password for care worker`, now).run();
  } else if (action === 'announce') {
    const body = requiredString(input.body, 'Announcement');
    if (body.length > 500) throw new Error('Announcements are limited to 500 characters.');
    await activity(null, actorId, 'announcement', body, now).run();
  } else throw new Error('Unsupported action.');
  return { ...(await getHouseholdState(actorId)), ...extras };

  async function validAssignee(id: string) {
    const worker = await db
      .prepare(`SELECT m.id, COALESCE(l.status,'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role='worker'`)
      .bind(id)
      .first<{ id: string; status: AccountStatus }>();
    if (!worker || !canAssignTo(worker.status)) throw new Error('Tasks can only be assigned to active care workers.');
  }
  function activity(choreId: string | null, memberId: string, event: string, detail: string, createdAt: string) {
    return db.prepare('INSERT INTO activity(id,chore_id,member_id,action,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), choreId, memberId, event, detail, createdAt);
  }
}

export function uploadRoot(): string {
  return resolve(/* turbopackIgnore: true */ process.env.UPLOAD_PATH || '/data/uploads');
}

export function safeUploadPath(root: string, storedName: string): string | null {
  const path = resolve(root, storedName);
  if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) return null;
  return path;
}
