// Run after npm run build. Uses disposable local accounts/data, never deployment credentials.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createServer } from 'node:net';
import { setTimeout as delay } from 'node:timers/promises';
import Database from 'better-sqlite3';
import { hashPassword } from '../lib/auth-security.ts';

const output = resolve('.next/standalone');
assert.ok(existsSync(join(output, 'server.js')), 'Run npm run build first.');
// Match the Docker runner's migration copy into generated standalone output.
cpSync(resolve('drizzle'), join(output, 'drizzle'), { recursive: true });
const fixtureDirectory = mkdtempSync(join(tmpdir(), 'careboard-auth-fixture-'));
const databasePath = join(fixtureDirectory, 'fixture.db');
const reservation = createServer();
await new Promise((done) => reservation.listen(0, '127.0.0.1', done));
const port = reservation.address().port;
await new Promise((done) => reservation.close(done));
const origin = `http://127.0.0.1:${port}`;
const password = 'Disposable-Fixture-Password9!';
const passwordHash = await hashPassword(password);
const server = spawn(process.execPath, [join(output, 'server.js')], {
  cwd: output, stdio: 'ignore',
  env: { ...process.env, NODE_ENV: 'production', PORT: String(port), HOSTNAME: '127.0.0.1',
    DATABASE_URL: '', DATABASE_PATH: databasePath, UPLOAD_PATH: join(fixtureDirectory, 'uploads'),
    AUTH_URL: origin, AUTH_SECRET: 'disposable-fixture-secret-not-for-deployment-123456789',
    AUTH_GOOGLE_ID: '', AUTH_GOOGLE_SECRET: '', CAREBOARD_OWNER_EMAIL: 'owner@example.com',
    CAREBOARD_OWNER_MEMBER_ID: 'member-manager', CAREBOARD_MEMBER_EMAILS: '{}',
    CAREBOARD_OWNER_PASSWORD_HASH: passwordHash, CAREBOARD_LOCAL_DEV: 'true' },
});

function jar() {
  const cookies = new Map();
  return {
    async fetch(path, options = {}) {
      const response = await fetch(origin + path, { ...options, redirect: 'manual',
        headers: { cookie: [...cookies].map(([key, value]) => `${key}=${value}`).join('; '), ...options.headers } });
      for (const cookie of response.headers.getSetCookie()) {
        const entry = cookie.split(';')[0]; const equals = entry.indexOf('=');
        cookies.set(entry.slice(0, equals), entry.slice(equals + 1));
      }
      return response;
    },
  };
}
async function login(email, candidate = password) {
  const client = jar();
  const csrf = await (await client.fetch('/api/auth/csrf')).json();
  const result = await client.fetch('/api/auth/callback/credentials', { method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded', origin, 'X-Auth-Return-Redirect': '1' },
    body: new URLSearchParams({ csrfToken: csrf.csrfToken, email, password: candidate, callbackUrl: origin + '/dashboard' }) });
  const redirect = await result.json();
  const session = await (await client.fetch('/api/auth/session')).json();
  return { client, redirect, session };
}

let db;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(origin + '/api/auth/csrf')).ok; } catch { /* Wait for local startup. */ }
    if (ready) break;
    if (server.exitCode !== null) throw new Error('Local auth fixture server exited.');
    await delay(100);
  }
  assert.ok(ready, 'Local auth fixture server did not become ready.');
  const owner = await login(' OWNER@EXAMPLE.COM ');
  assert.equal(owner.session.user?.email, 'owner@example.com');
  assert.equal(owner.session.loginProvider, 'credentials');
  const restricted = await owner.client.fetch('/api/household');
  assert.equal(restricted.status, 403, 'Temporary owner password must not access household data.');
  const dashboard = await owner.client.fetch('/dashboard');
  assert.match(await dashboard.text(), /NEXT_REDIRECT.*change-password|url=\/change-password/);
  db = new Database(databasePath);
  assert.equal(db.prepare('SELECT must_change_password FROM auth_credentials WHERE email=?').get('owner@example.com').must_change_password, 1);
  db.prepare('UPDATE auth_credentials SET must_change_password=0 WHERE email=?').run('owner@example.com');
  for (const [id, role, status] of [['worker-active', 'worker', 'active'], ['viewer-active', 'viewer', 'active'], ['worker-disabled', 'worker', 'disabled'], ['worker-invited', 'worker', 'invited']]) {
    db.prepare('INSERT INTO members(id,name,role,color,created_at) VALUES(?,?,?,?,?)').run(id, 'Disposable fixture', role, '#287b6f', new Date().toISOString());
    db.prepare('INSERT INTO account_lifecycle(member_id,status,updated_at) VALUES(?,?,?)').run(id, status, new Date().toISOString());
    db.prepare('INSERT INTO google_accounts(email,member_id) VALUES(?,?)').run(`${id}@example.com`, id);
    db.prepare('INSERT INTO auth_credentials(email,password_hash,must_change_password,updated_at) VALUES(?,?,0,?)').run(`${id}@example.com`, passwordHash, new Date().toISOString());
  }
  for (const [email, role] of [['owner@example.com', 'manager'], ['worker-active@example.com', 'worker'], ['viewer-active@example.com', 'viewer']]) {
    const signedIn = await login(email);
    assert.equal(signedIn.session.user?.email, email);
    const response = await signedIn.client.fetch('/api/household');
    assert.equal(response.status, 200);
    assert.equal((await response.json()).viewer.role, role);
    if (role === 'worker') {
      db.prepare("UPDATE account_lifecycle SET status='disabled' WHERE member_id='worker-active'").run();
      assert.equal((await signedIn.client.fetch('/api/household')).status, 401, 'Disabling must revoke an existing session.');
    }
  }
  for (const email of ['worker-disabled@example.com', 'worker-invited@example.com', 'unknown@example.com']) {
    const rejected = await login(email);
    assert.equal(rejected.session?.user, undefined);
    assert.match(rejected.redirect.url, /error=CredentialsSignin/);
  }
  const wrong = await login('owner@example.com', 'Wrong-Fixture-Password9!');
  assert.equal(wrong.session?.user, undefined);
  assert.match(wrong.redirect.url, /error=CredentialsSignin/);
  assert.equal(db.prepare('SELECT must_change_password FROM auth_credentials WHERE email=?').get('owner@example.com').must_change_password, 0, 'Bootstrap must not reset a changed password.');
  console.log('PASS: production-mode email/password sessions, owner bootstrap, temporary-password restriction, manager/worker/viewer roles, wrong/unknown/invited/disabled rejection, session revocation and bootstrap non-overwrite.');
} finally {
  db?.close();
  server.kill();
  // Retain the clearly named disposable fixture for inspection; never remove user data.
}
