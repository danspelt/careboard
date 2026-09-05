import { getD1 } from '@/db';
import { canAuthenticate, type AccountStatus } from '@/lib/access-policy';
import { memberIdForEmail, ownerEmail, ownerMemberId, accountRoleAllowed } from '@/lib/auth-config';

export async function ensureAccountTable() {
  await getD1().prepare(`CREATE TABLE IF NOT EXISTS google_accounts (
    email TEXT PRIMARY KEY NOT NULL,
    member_id TEXT NOT NULL UNIQUE REFERENCES members(id) ON DELETE CASCADE
  )`).run();
}

export async function accountForEmail(email: string | null | undefined) {
  if (!email || !ownerEmail()) return null;
  const normalized = email.trim().toLowerCase();
  await ensureAccountTable();
  const db = getD1();
  const linked = await db.prepare('SELECT member_id AS id FROM google_accounts WHERE email = ?').bind(normalized).first<{ id: string }>();
  const id = normalized === ownerEmail() ? ownerMemberId() : linked?.id ?? memberIdForEmail(normalized);
  if (!id) return null;
  const member = await db.prepare(`SELECT m.id, m.role, COALESCE(l.status, 'active') AS status
    FROM members m LEFT JOIN account_lifecycle l ON l.member_id = m.id WHERE m.id = ?`).bind(id).first<{ id: string; role: string; status: AccountStatus }>();
  return member && accountRoleAllowed(normalized, member.id, member.role) ? { ...member, email: normalized } : null;
}

export async function resolveAccountMember(email: string | null | undefined): Promise<string | null> {
  const account = await accountForEmail(email);
  return account && canAuthenticate(account.status) ? account.id : null;
}

export async function setAccountStatus(memberId: string, status: AccountStatus) {
  const now = new Date().toISOString();
  await getD1().prepare(`INSERT INTO account_lifecycle(member_id, household_id, status, activated_at, disabled_at, updated_at)
    VALUES (?, 'default', ?, CASE WHEN ? = 'active' THEN ? END, CASE WHEN ? = 'disabled' THEN ? END, ?)
    ON CONFLICT(member_id) DO UPDATE SET status = excluded.status,
      activated_at = CASE WHEN excluded.status = 'active' THEN excluded.updated_at ELSE account_lifecycle.activated_at END,
      disabled_at = CASE WHEN excluded.status = 'disabled' THEN excluded.updated_at ELSE NULL END,
      updated_at = excluded.updated_at`).bind(memberId, status, status, now, status, now, now).run();
}
