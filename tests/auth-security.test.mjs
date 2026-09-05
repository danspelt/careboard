import assert from 'node:assert/strict';
import { test } from 'node:test';
import { hashPassword, normalizeEmail, passwordError, verifyPassword } from '../lib/auth-security.ts';

test('password policy and pure-js bcrypt hashing work', async () => {
  assert.ok(passwordError('short'));
  assert.ok(passwordError('alllowercasebutlong1!'));
  const password = 'Long-and-Strong-Password9!';
  assert.equal(passwordError(password), null);
  const hash = await hashPassword(password);
  assert.match(hash, /^\$2[aby]\$/);
  assert.notEqual(hash, password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword('wrong', hash), false);
});

test('email normalization fails closed', () => {
  assert.equal(normalizeEmail(' User@Example.COM '), 'user@example.com');
  assert.equal(normalizeEmail('invalid'), null);
  assert.equal(normalizeEmail(null), null);
});
