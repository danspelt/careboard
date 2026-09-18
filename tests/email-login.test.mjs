import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import { test } from 'node:test';
import Database from 'better-sqlite3';
import ts from 'typescript';
import { hashPassword, verifyPassword } from '../lib/auth-security.ts';

const require = createRequire(import.meta.url);
function load(file, mocks) {
  const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } });
  const loaded = { exports: {} };
  runInThisContext(`(function(require,module,exports){${outputText}\n})`, { filename: file })((name) => mocks[name] ?? require(name), loaded, loaded.exports);
  return loaded.exports;
}

test('first-owner credential bootstrap verifies passwords, forces replacement and never overwrites', async () => {
  const db = new Database(':memory:');
  const adapter = {
    dialect: 'sqlite',
    prepare(sql) {
      const statement = db.prepare(sql);
      let parameters = [];
      return {
        bind(...values) { parameters = values; return this; },
        async first() { return statement.get(...parameters); },
        async all() { return { results: statement.all(...parameters) }; },
        async run() { return { meta: { changes: statement.run(...parameters).changes } }; },
      };
    },
  };
  let activeOwner = true;
  const store = load('lib/credential-store.ts', {
    'server-only': {}, '@/db': { getD1: () => adapter },
    '@/lib/auth-security': { normalizeEmail: (value) => value.trim().toLowerCase() },
    '@/lib/auth-config': { ownerEmail: () => 'owner@example.com' },
    '@/lib/account-store': { resolveAccountMember: async (email) => activeOwner && email === 'owner@example.com' ? 'member-manager' : null },
  });
  const previousHash = process.env.CAREBOARD_OWNER_PASSWORD_HASH;
  try {
    const temporary = 'Fixture-Temporary-Password9!';
    process.env.CAREBOARD_OWNER_PASSWORD_HASH = await hashPassword(temporary);
    activeOwner = false;
    await store.ensureOwnerCredential();
    assert.equal(await store.credentialForEmail('owner@example.com'), null);
    activeOwner = true;
    await store.ensureOwnerCredential();
    const initial = await store.credentialForEmail('owner@example.com');
    assert.equal(await verifyPassword(temporary, initial.hash), true);
    assert.equal(await verifyPassword('wrong', initial.hash), false);
    assert.equal(initial.mustChangePassword, 1);
    const permanent = await hashPassword('Fixture-Permanent-Password9!');
    await store.setCredential('owner@example.com', permanent, false);
    await store.ensureOwnerCredential();
    assert.deepEqual(await store.credentialForEmail('owner@example.com'), { hash: permanent, mustChangePassword: 0 });
    assert.equal(await store.credentialForEmail('worker@example.com'), null);
    process.env.CAREBOARD_OWNER_PASSWORD_HASH = 'plaintext-is-not-a-hash';
    await assert.rejects(store.ensureOwnerCredential(), /bcrypt hash/);
    delete process.env.CAREBOARD_OWNER_PASSWORD_HASH;
    await store.ensureOwnerCredential();
  } finally {
    if (previousHash === undefined) delete process.env.CAREBOARD_OWNER_PASSWORD_HASH;
    else process.env.CAREBOARD_OWNER_PASSWORD_HASH = previousHash;
    db.close();
  }
});

test('password sign-in preserves redirects and distinguishes rejected credentials from server failure', async () => {
  class AuthError extends Error { constructor(type) { super(type); this.type = type; } }
  let failure;
  let configured = true;
  let received;
  const actions = load('app/actions/auth.ts', {
    'next-auth': { AuthError },
    'next/navigation': { redirect: (url) => { throw new Error(`redirect:${url}`); } },
    '@/auth': { signIn: async (...args) => { received = args; throw failure; } },
    '@/lib/auth-access': {},
    '@/lib/auth-config': { authenticationConfigured: () => configured },
    '@/lib/credential-store': {}, '@/lib/auth-security': {},
  });
  const form = new FormData();
  form.set('email', 'owner@example.com'); form.set('password', 'Fixture-Temporary-Password9!');
  failure = new AuthError('CredentialsSignin');
  await assert.rejects(actions.passwordSignIn(form), /redirect:\/sign-in\?error=CredentialsSignin/);
  assert.deepEqual(received, ['credentials', { email: 'owner@example.com', password: 'Fixture-Temporary-Password9!', redirectTo: '/dashboard' }]);
  failure = new AuthError('CallbackRouteError');
  await assert.rejects(actions.passwordSignIn(form), /redirect:\/sign-in\?error=SignInFailed/);
  failure = new Error('redirect:/dashboard');
  await assert.rejects(actions.passwordSignIn(form), /redirect:\/dashboard/);
  configured = false;
  await assert.rejects(actions.passwordSignIn(form), /redirect:\/sign-in\?error=Configuration/);
});
