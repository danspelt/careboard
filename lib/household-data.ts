import 'server-only';

import { getD1 } from '@/db';

export type Member = {
  id: string;
  name: string;
  role: 'manager' | 'worker';
  color: string;
  createdAt: string;
};

export type Chore = {
  id: string;
  title: string;
  area: string;
  dueDate: string | null;
  status: 'open' | 'complete';
  createdBy: string;
  assignedTo: string | null;
  completedBy: string | null;
  createdAt: string;
  completedAt: string | null;
};

export type ActivityItem = {
  id: string;
  choreId: string | null;
  memberId: string;
  action: 'created' | 'claimed' | 'assigned' | 'unclaimed' | 'completed' | 'joined';
  detail: string;
  createdAt: string;
};

export type HouseholdState = {
  members: Member[];
  chores: Chore[];
  activity: ActivityItem[];
};

const palette = ['#287b6f', '#d36f4e', '#5b72b8', '#986ca5', '#b57e1c'];

function todayOffset(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function seedIfEmpty() {
  const db = getD1();
  const count = await db.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
  if ((count?.count ?? 0) > 0) return;

  const now = new Date().toISOString();
  const earlier = new Date(Date.now() - 38 * 60 * 1000).toISOString();
  const manager = 'member-manager';
  const alex = 'member-alex';
  const sam = 'member-sam';
  const recycling = 'chore-recycling';
  const counters = 'chore-counters';
  const linens = 'chore-linens';

  await db.batch([
    db.prepare('INSERT INTO members (id, name, role, color, created_at) VALUES (?, ?, ?, ?, ?)').bind(manager, 'Dana', 'manager', palette[4], now),
    db.prepare('INSERT INTO members (id, name, role, color, created_at) VALUES (?, ?, ?, ?, ?)').bind(alex, 'Alex', 'worker', palette[0], now),
    db.prepare('INSERT INTO members (id, name, role, color, created_at) VALUES (?, ?, ?, ?, ?)').bind(sam, 'Sam', 'worker', palette[1], now),
    db.prepare(`INSERT INTO chores (id, title, area, due_date, status, created_by, assigned_to, completed_by, created_at, completed_at)
      VALUES (?, ?, ?, ?, 'open', ?, NULL, NULL, ?, NULL)`).bind(recycling, 'Take out recycling', 'Outside', todayOffset(0), manager, now),
    db.prepare(`INSERT INTO chores (id, title, area, due_date, status, created_by, assigned_to, completed_by, created_at, completed_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, NULL, ?, NULL)`).bind(counters, 'Wipe kitchen counters', 'Kitchen', todayOffset(0), manager, alex, earlier),
    db.prepare(`INSERT INTO chores (id, title, area, due_date, status, created_by, assigned_to, completed_by, created_at, completed_at)
      VALUES (?, ?, ?, ?, 'open', ?, ?, NULL, ?, NULL)`).bind(linens, 'Change bed linens', 'Bedroom', todayOffset(1), manager, sam, earlier),
    db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), counters, alex, 'assigned', 'was assigned Wipe kitchen counters', earlier),
    db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), linens, sam, 'assigned', 'was assigned Change bed linens', earlier),
  ]);
}

export async function getHouseholdState(): Promise<HouseholdState> {
  await seedIfEmpty();
  const db = getD1();
  const [membersResult, choresResult, activityResult] = await Promise.all([
    db.prepare('SELECT id, name, role, color, created_at AS createdAt FROM members ORDER BY role, created_at, name').all<Member>(),
    db.prepare(`SELECT id, title, area, due_date AS dueDate, status, created_by AS createdBy,
      assigned_to AS assignedTo, completed_by AS completedBy, created_at AS createdAt,
      completed_at AS completedAt FROM chores
      ORDER BY CASE status WHEN 'open' THEN 0 ELSE 1 END, due_date IS NULL, due_date, created_at DESC`).all<Chore>(),
    db.prepare(`SELECT id, chore_id AS choreId, member_id AS memberId, action, detail, created_at AS createdAt
      FROM activity ORDER BY created_at DESC LIMIT 60`).all<ActivityItem>(),
  ]);

  return { members: membersResult.results, chores: choresResult.results, activity: activityResult.results };
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} is required.`);
  return value.trim();
}

export async function mutateHousehold(input: Record<string, unknown>) {
  const db = getD1();
  const action = requiredString(input.action, 'Action');
  const actorId = requiredString(input.actorId, 'Profile');
  const actor = await db.prepare('SELECT id, name, role FROM members WHERE id = ?').bind(actorId).first<{ id: string; name: string; role: string }>();
  if (!actor) throw new Error('Choose a valid profile.');
  const now = new Date().toISOString();

  if (action === 'createChore') {
    const title = requiredString(input.title, 'Chore name');
    const area = requiredString(input.area, 'Area');
    const dueDate = typeof input.dueDate === 'string' && input.dueDate ? input.dueDate : null;
    const assigneeId = typeof input.assigneeId === 'string' && input.assigneeId ? input.assigneeId : null;
    const choreId = crypto.randomUUID();
    await db.batch([
      db.prepare(`INSERT INTO chores (id, title, area, due_date, status, created_by, assigned_to, completed_by, created_at, completed_at)
        VALUES (?, ?, ?, ?, 'open', ?, ?, NULL, ?, NULL)`).bind(choreId, title, area, dueDate, actorId, assigneeId, now),
      db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), choreId, actorId, assigneeId ? 'assigned' : 'created', assigneeId ? `assigned ${title}` : `added ${title}`, now),
    ]);
  } else if (action === 'claim') {
    const choreId = requiredString(input.choreId, 'Chore');
    const chore = await db.prepare('SELECT title FROM chores WHERE id = ?').bind(choreId).first<{ title: string }>();
    if (!chore) throw new Error('That chore no longer exists.');
    const result = await db.prepare(`UPDATE chores SET assigned_to = ? WHERE id = ? AND status = 'open' AND assigned_to IS NULL`).bind(actorId, choreId).run();
    if ((result.meta.changes ?? 0) === 0) throw new Error('Someone else already claimed that chore.');
    await db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), choreId, actorId, 'claimed', `claimed ${chore.title}`, now).run();
  } else if (action === 'assign') {
    if (actor.role !== 'manager') throw new Error('Only the household manager can assign chores.');
    const choreId = requiredString(input.choreId, 'Chore');
    const assigneeId = requiredString(input.assigneeId, 'Care worker');
    const chore = await db.prepare('SELECT title FROM chores WHERE id = ?').bind(choreId).first<{ title: string }>();
    const assignee = await db.prepare(`SELECT name FROM members WHERE id = ? AND role = 'worker'`).bind(assigneeId).first<{ name: string }>();
    if (!chore || !assignee) throw new Error('Choose a valid chore and care worker.');
    const result = await db.prepare(`UPDATE chores SET assigned_to = ? WHERE id = ? AND status = 'open'`).bind(assigneeId, choreId).run();
    if ((result.meta.changes ?? 0) === 0) throw new Error('That chore is already complete.');
    await db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), choreId, actorId, 'assigned', `assigned ${chore.title} to ${assignee.name}`, now).run();
  } else if (action === 'unclaim') {
    const choreId = requiredString(input.choreId, 'Chore');
    const chore = await db.prepare('SELECT title, assigned_to AS assignedTo FROM chores WHERE id = ?').bind(choreId).first<{ title: string; assignedTo: string | null }>();
    if (!chore || (chore.assignedTo !== actorId && actor.role !== 'manager')) throw new Error('Only the assigned worker or manager can release this chore.');
    const result = await db.prepare(`UPDATE chores SET assigned_to = NULL WHERE id = ? AND status = 'open'`).bind(choreId).run();
    if ((result.meta.changes ?? 0) === 0) throw new Error('That chore is already complete.');
    await db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), choreId, actorId, 'unclaimed', `released ${chore.title}`, now).run();
  } else if (action === 'complete') {
    const choreId = requiredString(input.choreId, 'Chore');
    const chore = await db.prepare('SELECT title FROM chores WHERE id = ?').bind(choreId).first<{ title: string }>();
    const managerOverride = actor.role === 'manager' ? 1 : 0;
    const result = await db.prepare(`UPDATE chores SET status = 'complete', assigned_to = COALESCE(assigned_to, ?), completed_by = ?, completed_at = ?
      WHERE id = ? AND status = 'open' AND (? = 1 OR assigned_to IS NULL OR assigned_to = ?)`).bind(actorId, actorId, now, choreId, managerOverride, actorId).run();
    if (!chore || (result.meta.changes ?? 0) === 0) throw new Error('This chore belongs to another worker or is already complete.');
    await db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(crypto.randomUUID(), choreId, actorId, 'completed', `finished ${chore.title}`, now).run();
  } else if (action === 'addMember') {
    if (actor.role !== 'manager') throw new Error('Only the household manager can add care workers.');
    const name = requiredString(input.name, 'Name');
    const existing = await db.prepare('SELECT id FROM members WHERE lower(name) = lower(?)').bind(name).first();
    if (existing) throw new Error('That care worker already has a profile.');
    const memberId = crypto.randomUUID();
    const memberCount = await db.prepare('SELECT COUNT(*) AS count FROM members').first<{ count: number }>();
    const color = palette[(memberCount?.count ?? 0) % palette.length];
    await db.batch([
      db.prepare('INSERT INTO members (id, name, role, color, created_at) VALUES (?, ?, ?, ?, ?)').bind(memberId, name, 'worker', color, now),
      db.prepare('INSERT INTO activity (id, chore_id, member_id, action, detail, created_at) VALUES (?, NULL, ?, ?, ?, ?)').bind(crypto.randomUUID(), memberId, 'joined', 'joined the care team', now),
    ]);
  } else {
    throw new Error('Unsupported action.');
  }

  return getHouseholdState();
}
