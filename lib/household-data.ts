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
export type ActivityItem = { id: string; choreId: string | null; memberId: string; action: string; detail: string; createdAt: string };
export type AuditEntry = { id: string; choreId: string | null; actorId: string; action: string; detail: string; createdAt: string };
export type TaskGroup = { id: 'my-tasks' | 'available-tasks'; title: 'My Tasks' | 'Available Tasks'; tasks: Chore[] };
export type HouseholdSettings = {
  householdId: string;
  recurrenceHorizonDays: number;
  reminderDefaultLeadDays: number;
  retentionDays: number;
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

export async function getHouseholdSettings(): Promise<HouseholdSettings> {
  const db = getD1();
  await db.prepare("INSERT OR IGNORE INTO household_settings (household_id) VALUES ('default')").run();
  const row = await db
    .prepare(
      "SELECT household_id AS householdId, recurrence_horizon_days AS recurrenceHorizonDays, reminder_default_lead_days AS reminderDefaultLeadDays, retention_days AS retentionDays, updated_at AS updatedAt FROM household_settings WHERE household_id='default'",
    )
    .first<HouseholdSettings>();
  return row ?? {
    householdId: 'default',
    recurrenceHorizonDays: 30,
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
  const [members, chores, activity] = await Promise.all([
    db
      .prepare(
        `SELECT m.id, m.name, m.role, COALESCE(l.status, 'active') AS status, g.email, m.color, m.created_at AS createdAt,
          m.phone, m.availability, m.skills_notes AS skillsNotes, m.emergency_contact AS emergencyContact,
          m.certifications, m.languages, m.profile_photo_id AS profilePhotoId
        FROM members m
        LEFT JOIN account_lifecycle l ON l.member_id=m.id
        LEFT JOIN google_accounts g ON g.member_id=m.id
        ORDER BY m.role, m.created_at, m.name`,
      )
      .all<Member>(),
    db
      .prepare(
        `SELECT id, title, area, due_date AS dueDate, due_time AS dueTime, priority, instructions, recurrence,
          status, created_by AS createdBy, assigned_to AS assignedTo, completed_by AS completedBy,
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
  return { members: members.results, chores: chores.results, activity: activity.results, audit: audit.results, settings };
}

export async function getHouseholdState(memberId: string): Promise<HouseholdState> {
  const state = await rawState();
  const viewer = state.members.find((member) => member.id === memberId && member.status === 'active');
  if (!viewer) throw new Error('Household access denied.');
  const today = new Date().toISOString().slice(0, 10);
  const defaultLeadDays = state.settings.reminderDefaultLeadDays;
  const remindersFor = (chores: Chore[]) =>
    chores.filter((chore) => {
      if (chore.status === 'complete' || !chore.dueDate) return false;
      const lead = chore.reminderLeadDays ?? defaultLeadDays;
      return chore.dueDate <= addDaysISO(today, lead);
    });
  if (viewer.role === 'manager') return { viewer: { id: viewer.id, role: viewer.role }, ...state, metrics: metrics(state.chores, today), reminders: remindersFor(state.chores) };
  const chores = visibleTasks(viewer, state.chores);
  // Strip private fields from the worker's own profile view
  const self: Member = {
    id: viewer.id, name: viewer.name, role: viewer.role, status: viewer.status, color: viewer.color,
    createdAt: viewer.createdAt, phone: viewer.phone, availability: viewer.availability,
    skillsNotes: viewer.skillsNotes, emergencyContact: null, certifications: viewer.certifications,
    languages: viewer.languages, profilePhotoId: viewer.profilePhotoId,
  };
  return { viewer: { id: viewer.id, role: viewer.role }, members: [self], chores, activity: [], taskGroups: workerTaskGroups(viewer, chores), reminders: remindersFor(chores) };
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
    `INSERT OR IGNORE INTO chores(
      id, title, area, due_date, due_time, status, created_by, assigned_to, completed_by,
      created_at, completed_at, started_at, priority, instructions, recurrence, recurrence_parent_id,
      recurrence_date, progress_notes, completion_notes, issue_report, issue_open, reminder_lead_days
    ) VALUES(?,?,?,?,?,'open',?,?,NULL,?,NULL,NULL,?,?,NULL,?,?,'','','',0,?)`,
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
  const root = resolve(process.env.UPLOAD_PATH || '/data/uploads');
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
        if (existsSync(path)) await unlink(path);
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

export async function mutateHousehold(input: Record<string, unknown>) {
  const db = getD1();
  const action = requiredString(input.action, 'Action');
  const actorId = requiredString(input.actorId, 'Profile');
  const actor = await db
    .prepare(`SELECT m.id, m.name, m.role, COALESCE(l.status, 'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=?`)
    .bind(actorId)
    .first<Member>();
  if (!actor || actor.status !== 'active') throw new Error('Household access denied.');
  const now = new Date().toISOString();
  const managerOnly = [
    'createChore',
    'assign',
    'unclaim',
    'addMember',
    'disableMember',
    'reactivateMember',
    'resetMemberPassword',
    'updateHouseholdSettings',
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
          "UPDATE chores SET status='complete', assigned_to=COALESCE(assigned_to,?), completed_by=?, completed_at=? WHERE id=? AND status IN ('open','in_progress') AND (?='manager' OR (status='in_progress' AND assigned_to=?))",
        )
        .bind(actorId, actorId, now, choreId, actor.role, actorId)
        .run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That task changed before your update. Refresh and try again.');
    await activity(choreId, actorId, action === 'complete' ? 'completed' : action === 'start' ? 'started' : 'claimed', `${action === 'complete' ? 'finished' : action === 'start' ? 'started' : 'claimed'} ${chore.title}`, now).run();
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
  } else if (action === 'addMember') {
    const name = requiredString(input.name, 'Name');
    const email = normalizeEmail(input.googleEmail);
    const temporaryPassword = input.temporaryPassword;
    if (!email || email === ownerEmail() || memberIdForEmail(email)) throw new Error('Enter an unused worker email address.');
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
      activity(null, actorId, 'created_worker', `created worker ${name}`, now),
    ]);
    await setCredential(email, passwordHash, true);
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
    const allowedWorkerFields = new Set(['phone', 'availability', 'languages', 'profilePhotoId']);
    const changedFields = Object.keys(input).filter((key) => key !== 'action' && key !== 'actorId' && key !== 'memberId');
    if (actor.role === 'worker' && changedFields.some((field) => !allowedWorkerFields.has(field))) {
      throw new Error('You can only edit phone, availability, languages, and profile photo.');
    }
    const phone = optionalNullableString(input.phone, 40);
    const availability = optionalString(input.availability, 1000);
    const languages = optionalString(input.languages, 500);
    const skillsNotes = actor.role === 'manager' ? optionalString(input.skillsNotes, 2000) : undefined;
    const certifications = actor.role === 'manager' ? optionalString(input.certifications, 2000) : undefined;
    const emergencyContact = actor.role === 'manager' ? optionalNullableString(input.emergencyContact, 200) : undefined;
    const name = actor.role === 'manager' ? (typeof input.name === 'string' && input.name.trim() ? input.name.trim().slice(0, 200) : undefined) : undefined;
    const email = actor.role === 'manager' ? normalizeEmail(input.email) : undefined;
    const profilePhotoId = typeof input.profilePhotoId === 'string' && input.profilePhotoId ? input.profilePhotoId : undefined;
    if (profilePhotoId) {
      const photoOwner = await db.prepare('SELECT profile_member_id FROM proof_photos WHERE id=?').bind(profilePhotoId).first<{ profileMemberId: string }>();
      if (!photoOwner || (actor.role === 'worker' && photoOwner.profileMemberId !== actor.id)) throw new Error('Choose a valid profile photo.');
    }
    const sets: string[] = [];
    const values: (string | number | null)[] = [];
    if (phone !== undefined) { sets.push('phone=?'); values.push(phone); }
    if (availability !== undefined) { sets.push('availability=?'); values.push(availability); }
    if (languages !== undefined) { sets.push('languages=?'); values.push(languages); }
    if (skillsNotes !== undefined) { sets.push('skills_notes=?'); values.push(skillsNotes); }
    if (certifications !== undefined) { sets.push('certifications=?'); values.push(certifications); }
    if (emergencyContact !== undefined) { sets.push('emergency_contact=?'); values.push(emergencyContact); }
    if (name !== undefined) { sets.push('name=?'); values.push(name); }
    if (profilePhotoId !== undefined) { sets.push('profile_photo_id=?'); values.push(profilePhotoId); }
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
    await db
      .prepare(
        `UPDATE household_settings SET recurrence_horizon_days=?, reminder_default_lead_days=?, retention_days=?, updated_at=? WHERE household_id='default'`,
      )
      .bind(recurrenceHorizonDays, reminderDefaultLeadDays, retentionDays, now)
      .run();
    await activity(null, actorId, 'updated_settings', 'updated household settings', now).run();
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
    if (actor.role !== 'manager' && actor.id !== upload.uploadedBy && upload.assignedTo !== actor.id) throw new Error('Only the manager or the upload owner can remove this.');
    const root = resolve(process.env.UPLOAD_PATH || '/data/uploads');
    const path = resolve(root, upload.storedName);
    if ((path.startsWith(`${root}\\`) || path.startsWith(`${root}/`)) && existsSync(path)) await unlink(path);
    await db.prepare('DELETE FROM proof_photos WHERE id=?').bind(uploadId).run();
    await db.prepare('UPDATE members SET profile_photo_id=NULL WHERE profile_photo_id=?').bind(uploadId).run();
    await activity(null, actorId, 'deleted_upload', `deleted upload ${uploadId}`, now).run();
  } else if (['disableMember', 'reactivateMember'].includes(action)) {
    const memberId = requiredString(input.memberId, 'Worker');
    const member = await db.prepare("SELECT id FROM members WHERE id=? AND role='worker'").bind(memberId).first();
    if (!member) throw new Error('Choose a valid worker.');
    await setAccountStatus(memberId, action === 'disableMember' ? 'disabled' : 'active');
    await activity(null, actorId, action === 'disableMember' ? 'disabled_worker' : 'reactivated_worker', `${action === 'disableMember' ? 'disabled' : 'reactivated'} worker`, now).run();
  } else if (action === 'resetMemberPassword') {
    const memberId = requiredString(input.memberId, 'Worker');
    const temporaryPassword = input.temporaryPassword;
    const passwordProblem = passwordError(temporaryPassword);
    if (passwordProblem) throw new Error(passwordProblem);
    const target = await db.prepare(`SELECT g.email FROM google_accounts g JOIN members m ON m.id=g.member_id WHERE m.id=? AND m.role='worker'`).bind(memberId).first<{ email: string }>();
    if (!target) throw new Error('Choose a valid worker.');
    await setCredential(target.email, await hashPassword(temporaryPassword as string), true);
    await activity(null, actorId, 'reset_password', `reset password for worker`, now).run();
  } else throw new Error('Unsupported action.');
  return getHouseholdState(actorId);

  async function validAssignee(id: string) {
    const worker = await db
      .prepare(`SELECT m.id, COALESCE(l.status,'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role='worker'`)
      .bind(id)
      .first<{ id: string; status: AccountStatus }>();
    if (!worker || !canAssignTo(worker.status)) throw new Error('Tasks can only be assigned to active workers.');
  }
  function activity(choreId: string | null, memberId: string, event: string, detail: string, createdAt: string) {
    return db.prepare('INSERT INTO activity(id,chore_id,member_id,action,detail,created_at) VALUES(?,?,?,?,?,?)').bind(crypto.randomUUID(), choreId, memberId, event, detail, createdAt);
  }
}

export function uploadRoot(): string {
  return resolve(process.env.UPLOAD_PATH || '/data/uploads');
}

export function safeUploadPath(root: string, storedName: string): string | null {
  const path = resolve(root, storedName);
  if (!path.startsWith(`${root}\\`) && !path.startsWith(`${root}/`)) return null;
  return path;
}
