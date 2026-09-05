import 'server-only';
import { getD1 } from '@/db';
import { normalizeEmail } from '@/lib/auth-security';

export async function ensureCredentialTables() {
  const db = getD1();
  await db.prepare(`CREATE TABLE IF NOT EXISTS auth_credentials (
    email TEXT PRIMARY KEY NOT NULL,
    password_hash TEXT NOT NULL,
    must_change_password INTEGER NOT NULL DEFAULT 1,
    updated_at TEXT NOT NULL
  )`).run();
  const columns = await db.prepare('PRAGMA table_info(auth_credentials)').all<{ name: string }>();
  if (!columns.results.some((column) => column.name === 'must_change_password')) {
    await db.prepare('ALTER TABLE auth_credentials ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 1').run();
  }
}

export async function credentialForEmail(emailValue: string) {
  const email = normalizeEmail(emailValue);
  if (!email) return null;
  await ensureCredentialTables();
  return (await getD1().prepare('SELECT password_hash AS hash, must_change_password AS mustChangePassword FROM auth_credentials WHERE email = ?')
    .bind(email).first<{ hash: string; mustChangePassword: number }>()) ?? null;
}

export async function setCredential(emailValue: string, passwordHash: string, mustChangePassword: boolean) {
  const email = normalizeEmail(emailValue);
  if (!email) throw new Error('A valid email is required.');
  await ensureCredentialTables();
  await getD1().prepare(`INSERT INTO auth_credentials(email, password_hash, must_change_password, updated_at) VALUES (?, ?, ?, ?)
    ON CONFLICT(email) DO UPDATE SET password_hash = excluded.password_hash, must_change_password = excluded.must_change_password, updated_at = excluded.updated_at`)
    .bind(email, passwordHash, mustChangePassword ? 1 : 0, new Date().toISOString()).run();
}

export async function credentialMustChange(emailValue: string): Promise<boolean> {
  return Boolean((await credentialForEmail(emailValue))?.mustChangePassword);
}
