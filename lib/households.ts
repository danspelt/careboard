import 'server-only';
import { cookies } from 'next/headers';
import { getD1 } from '@/db';
import type { Role } from '@/lib/access-policy';

export const ACTIVE_HOUSEHOLD_COOKIE = 'careboard-active-household';
export const DEFAULT_HOUSEHOLD_ID = 'default';

export type HouseholdSummary = { id: string; name: string; role: Role };

export async function listMemberHouseholds(memberId: string): Promise<HouseholdSummary[]> {
  const db = getD1();
  const rows = await db
    .prepare(
      `SELECT h.id, h.name, hm.role
       FROM household_members hm
       JOIN households h ON h.id = hm.household_id
       WHERE hm.member_id = ?
       ORDER BY h.name`,
    )
    .bind(memberId)
    .all<{ id: string; name: string; role: string }>();
  return rows.results.map((row) => ({
    id: row.id,
    name: row.name,
    role: (row.role === 'manager' ? 'manager' : row.role === 'viewer' ? 'viewer' : 'worker') as Role,
  }));
}

export async function membershipRole(memberId: string, householdId: string): Promise<Role | null> {
  const db = getD1();
  const row = await db
    .prepare(`SELECT role FROM household_members WHERE member_id=? AND household_id=?`)
    .bind(memberId, householdId)
    .first<{ role: string }>();
  if (!row) return null;
  return (row.role === 'manager' ? 'manager' : row.role === 'viewer' ? 'viewer' : 'worker') as Role;
}

export async function ensureDefaultHouseholdBackfill() {
  const db = getD1();
  await db.prepare(
    `INSERT INTO households (id, name, created_at)
     SELECT ?, 'Primary home', ?
     WHERE NOT EXISTS (SELECT 1 FROM households WHERE id = ?)`,
  ).bind(DEFAULT_HOUSEHOLD_ID, new Date().toISOString(), DEFAULT_HOUSEHOLD_ID).run();
  await db.prepare(`INSERT INTO household_settings (household_id) VALUES (?) ON CONFLICT (household_id) DO NOTHING`).bind(DEFAULT_HOUSEHOLD_ID).run();
  const members = await db.prepare(`SELECT id, role, created_at AS createdAt FROM members`).all<{ id: string; role: string; createdAt: string }>();
  if (members.results.length) {
    await db.batch(
      members.results.map((member) =>
        db
          .prepare(
            `INSERT INTO household_members (household_id, member_id, role, created_at)
             SELECT ?, ?, ?, ?
             WHERE NOT EXISTS (SELECT 1 FROM household_members WHERE household_id=? AND member_id=?)`,
          )
          .bind(DEFAULT_HOUSEHOLD_ID, member.id, member.role, member.createdAt || new Date().toISOString(), DEFAULT_HOUSEHOLD_ID, member.id),
      ),
    );
  }
}

export async function resolveActiveHouseholdId(memberId: string, preferredId?: string | null): Promise<{ householdId: string; households: HouseholdSummary[]; role: Role }> {
  await ensureDefaultHouseholdBackfill();
  let households = await listMemberHouseholds(memberId);
  if (households.length === 0) {
    // Legacy member without membership row — attach to default.
    const db = getD1();
    const member = await db.prepare(`SELECT id, role FROM members WHERE id=?`).bind(memberId).first<{ id: string; role: string }>();
    if (member) {
      await db
        .prepare(`INSERT INTO household_members (household_id, member_id, role, created_at) VALUES (?, ?, ?, ?)`)
        .bind(DEFAULT_HOUSEHOLD_ID, member.id, member.role, new Date().toISOString())
        .run();
      households = await listMemberHouseholds(memberId);
    }
  }
  if (households.length === 0) throw new Error('Household access denied.');

  let cookieId: string | undefined;
  try {
    const store = await cookies();
    cookieId = store.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  } catch {
    cookieId = undefined;
  }

  const candidates = [preferredId, cookieId].filter((value): value is string => Boolean(value && value.trim()));
  const matched = candidates.map((id) => households.find((item) => item.id === id)).find(Boolean) ?? households[0];
  return { householdId: matched.id, households, role: matched.role };
}

export async function setActiveHouseholdCookie(householdId: string) {
  const store = await cookies();
  store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createHousehold(name: string, managerId: string): Promise<string> {
  const trimmed = name.trim().slice(0, 80);
  if (!trimmed) throw new Error('Household name is required.');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = getD1();
  await db.batch([
    db.prepare(`INSERT INTO households (id, name, created_at) VALUES (?, ?, ?)`).bind(id, trimmed, now),
    db.prepare(`INSERT INTO household_settings (household_id) VALUES (?)`).bind(id),
    db.prepare(`INSERT INTO household_members (household_id, member_id, role, created_at) VALUES (?, ?, 'manager', ?)`).bind(id, managerId, now),
  ]);
  return id;
}

export async function addHouseholdMembership(householdId: string, memberId: string, role: Role) {
  const db = getD1();
  await db
    .prepare(
      `INSERT INTO household_members (household_id, member_id, role, created_at) VALUES (?, ?, ?, ?)
       ON CONFLICT (household_id, member_id) DO UPDATE SET role = excluded.role`,
    )
    .bind(householdId, memberId, role, new Date().toISOString())
    .run();
}
