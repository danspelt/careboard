import 'server-only';

import { getD1 } from '@/db';
import { canAssignTo, visibleTasks, workerCan, workerTaskGroups, type AccountStatus, type Role, type TaskStatus } from '@/lib/access-policy';
import { ensureAccountTable, setAccountStatus } from '@/lib/account-store';
import { memberIdForEmail, ownerEmail } from '@/lib/auth-config';
import { setCredential } from '@/lib/credential-store';
import { hashPassword, normalizeEmail, passwordError } from '@/lib/auth-security';

export type Member = { id: string; name: string; role: Role; status: AccountStatus; email?: string; color: string; createdAt: string };
export type Chore = { id: string; title: string; area: string; dueDate: string | null; status: TaskStatus; createdBy: string; assignedTo: string | null; completedBy: string | null; createdAt: string; startedAt: string | null; completedAt: string | null };
export type ActivityItem = { id: string; choreId: string | null; memberId: string; action: string; detail: string; createdAt: string };
export type TaskGroup = { id: 'my-tasks' | 'available-tasks'; title: 'My Tasks' | 'Available Tasks'; tasks: Chore[] };
export type HouseholdState = { viewer: { id: string; role: Role }; members: Member[]; chores: Chore[]; activity: ActivityItem[]; taskGroups?: TaskGroup[] };

const palette = ['#287b6f', '#d36f4e', '#5b72b8', '#986ca5', '#b57e1c'];
const todayOffset = (days: number) => { const date = new Date(); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); };

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

export async function ensureHouseholdData() { await seedIfEmpty(); }

async function rawState() {
  await ensureHouseholdData();
  await ensureAccountTable();
  const db = getD1();
  const [members, chores, activity] = await Promise.all([
    db.prepare(`SELECT m.id, m.name, m.role, COALESCE(l.status, 'active') AS status, g.email, m.color, m.created_at AS createdAt FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id LEFT JOIN google_accounts g ON g.member_id=m.id ORDER BY m.role, m.created_at, m.name`).all<Member>(),
    db.prepare(`SELECT id, title, area, due_date AS dueDate, status, created_by AS createdBy, assigned_to AS assignedTo, completed_by AS completedBy, created_at AS createdAt, started_at AS startedAt, completed_at AS completedAt FROM chores ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END, due_date IS NULL, due_date, created_at DESC`).all<Chore>(),
    db.prepare(`SELECT id, chore_id AS choreId, member_id AS memberId, action, detail, created_at AS createdAt FROM activity ORDER BY created_at DESC LIMIT 60`).all<ActivityItem>(),
  ]);
  return { members: members.results, chores: chores.results, activity: activity.results };
}

export async function getHouseholdState(memberId: string): Promise<HouseholdState> {
  const state = await rawState();
  const viewer = state.members.find((member) => member.id === memberId && member.status === 'active');
  if (!viewer) throw new Error('Household access denied.');
  if (viewer.role === 'manager') return { viewer: { id: viewer.id, role: viewer.role }, ...state };
  const chores = visibleTasks(viewer, state.chores);
  const self = { ...viewer }; delete self.email;
  return { viewer: { id: viewer.id, role: viewer.role }, members: [self], chores, activity: [], taskGroups: workerTaskGroups(viewer, chores) };
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

export async function mutateHousehold(input: Record<string, unknown>) {
  const db = getD1();
  const action = requiredString(input.action, 'Action');
  const actorId = requiredString(input.actorId, 'Profile');
  const actor = await db.prepare(`SELECT m.id, m.name, m.role, COALESCE(l.status, 'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=?`).bind(actorId).first<Member>();
  if (!actor || actor.status !== 'active') throw new Error('Household access denied.');
  const now = new Date().toISOString();
  const managerOnly = ['createChore', 'assign', 'unclaim', 'addMember', 'disableMember', 'reactivateMember', 'resetMemberPassword'];
  if (managerOnly.includes(action) && actor.role !== 'manager') throw new Error('Only the household manager can do that.');

  if (action === 'createChore') {
    const title = requiredString(input.title, 'Chore name');
    const area = requiredString(input.area, 'Area');
    const dueDate = typeof input.dueDate === 'string' && input.dueDate ? input.dueDate : null;
    const assigneeId = typeof input.assigneeId === 'string' && input.assigneeId ? input.assigneeId : null;
    if (assigneeId) await validAssignee(assigneeId);
    const id = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO chores (id,title,area,due_date,status,created_by,assigned_to,completed_by,created_at,started_at,completed_at) VALUES (?,?,?,?,'open',?,?,NULL,?,NULL,NULL)`).bind(id, title, area, dueDate, actorId, assigneeId, now),
      activity(id, actorId, assigneeId ? 'assigned' : 'created', assigneeId ? `assigned ${title}` : `added ${title}`, now),
    ]);
  } else if (['claim', 'start', 'complete'].includes(action)) {
    const choreId = requiredString(input.choreId, 'Chore');
    const chore = await db.prepare('SELECT title, status, assigned_to AS assignedTo FROM chores WHERE id=?').bind(choreId).first<Chore>();
    if (!chore) throw new Error('That chore no longer exists.');
    if (actor.role === 'worker' && !workerCan(action, actorId, chore)) throw new Error('You can only update your own eligible tasks.');
    let result;
    if (action === 'claim') result = await db.prepare("UPDATE chores SET assigned_to=? WHERE id=? AND status='open' AND assigned_to IS NULL").bind(actorId, choreId).run();
    else if (action === 'start') result = await db.prepare("UPDATE chores SET status='in_progress', started_at=? WHERE id=? AND status='open' AND (?='manager' OR assigned_to=?)").bind(now, choreId, actor.role, actorId).run();
    else result = await db.prepare("UPDATE chores SET status='complete', assigned_to=COALESCE(assigned_to,?), completed_by=?, completed_at=? WHERE id=? AND status IN ('open','in_progress') AND (?='manager' OR (status='in_progress' AND assigned_to=?))").bind(actorId, actorId, now, choreId, actor.role, actorId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('That task changed before your update. Refresh and try again.');
    await activity(choreId, actorId, action === 'complete' ? 'completed' : action === 'start' ? 'started' : 'claimed', `${action === 'complete' ? 'finished' : action === 'start' ? 'started' : 'claimed'} ${chore.title}`, now).run();
  } else if (action === 'assign' || action === 'unclaim') {
    const choreId = requiredString(input.choreId, 'Chore');
    const assigneeId = action === 'assign' ? requiredString(input.assigneeId, 'Care worker') : null;
    if (assigneeId) await validAssignee(assigneeId);
    const result = await db.prepare("UPDATE chores SET assigned_to=?, status=CASE WHEN status='in_progress' THEN 'open' ELSE status END, started_at=NULL WHERE id=? AND status!='complete'").bind(assigneeId, choreId).run();
    if ((result.meta.changes ?? 0) !== 1) throw new Error('Choose an incomplete task.');
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
      db.prepare('INSERT INTO members(id,name,role,color,created_at) VALUES (?,?,\'worker\',?,?)').bind(id, name, palette[(count?.count ?? 0) % palette.length], now),
      db.prepare('INSERT INTO google_accounts(email,member_id) VALUES (?,?)').bind(email, id),
      db.prepare("INSERT INTO account_lifecycle(member_id,household_id,status,activated_at,updated_at) VALUES (?,'default','active',?,?)").bind(id, now, now),
      activity(null, actorId, 'created_worker', `created worker ${name}`, now),
    ]);
    await setCredential(email, passwordHash, true);
  } else if (['disableMember', 'reactivateMember'].includes(action)) {
    const memberId = requiredString(input.memberId, 'Worker');
    const member = await db.prepare("SELECT id FROM members WHERE id=? AND role='worker'").bind(memberId).first();
    if (!member) throw new Error('Choose a valid worker.');
    await setAccountStatus(memberId, action === 'disableMember' ? 'disabled' : 'active');
  } else if (action === 'resetMemberPassword') {
    const memberId = requiredString(input.memberId, 'Worker');
    const temporaryPassword = input.temporaryPassword;
    const passwordProblem = passwordError(temporaryPassword);
    if (passwordProblem) throw new Error(passwordProblem);
    const target = await db.prepare(`SELECT g.email FROM google_accounts g JOIN members m ON m.id=g.member_id WHERE m.id=? AND m.role='worker'`).bind(memberId).first<{ email: string }>();
    if (!target) throw new Error('Choose a valid worker.');
    await setCredential(target.email, await hashPassword(temporaryPassword as string), true);
  } else throw new Error('Unsupported action.');
  return getHouseholdState(actorId);

  async function validAssignee(id: string) {
    const worker = await db.prepare(`SELECT m.id, COALESCE(l.status,'active') AS status FROM members m LEFT JOIN account_lifecycle l ON l.member_id=m.id WHERE m.id=? AND m.role='worker'`).bind(id).first<{ id: string; status: AccountStatus }>();
    if (!worker || !canAssignTo(worker.status)) throw new Error('Tasks can only be assigned to active workers.');
  }
  function activity(choreId: string | null, memberId: string, event: string, detail: string, createdAt: string) {
    return db.prepare('INSERT INTO activity(id,chore_id,member_id,action,detail,created_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(), choreId, memberId, event, detail, createdAt);
  }
}
