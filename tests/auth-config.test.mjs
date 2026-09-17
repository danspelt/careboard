import assert from 'node:assert/strict';
import { test } from 'node:test';
import { accountRoleAllowed, authenticationConfigured, localDevMode, memberIdForEmail, trustedMutationOrigin } from '../lib/auth-config.ts';

test('local development authentication cannot be enabled outside development', () => {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousFlag = process.env.CAREBOARD_LOCAL_DEV;
  try {
    for (const environment of ['production', 'test', undefined]) {
      if (environment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = environment;
      for (const flag of ['true', '1', 'false', undefined]) {
        if (flag === undefined) delete process.env.CAREBOARD_LOCAL_DEV;
        else process.env.CAREBOARD_LOCAL_DEV = flag;
        assert.equal(localDevMode(), false, `${environment}/${flag} must require real authentication`);
      }
    }
    process.env.NODE_ENV = 'development';
    delete process.env.CAREBOARD_LOCAL_DEV;
    assert.equal(localDevMode(), true);
    process.env.CAREBOARD_LOCAL_DEV = 'false';
    assert.equal(localDevMode(), false);
  } finally {
    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousFlag === undefined) delete process.env.CAREBOARD_LOCAL_DEV;
    else process.env.CAREBOARD_LOCAL_DEV = previousFlag;
  }
});

test('authentication configuration fails closed and requires the explicit owner', () => {
  process.env.AUTH_SECRET = 'x'.repeat(32); process.env.AUTH_URL = 'http://localhost:3010';
  delete process.env.CAREBOARD_OWNER_EMAIL;
  assert.equal(authenticationConfigured(), false);
  process.env.CAREBOARD_OWNER_EMAIL = 'owner@example.com';
  assert.equal(authenticationConfigured(), true);
  process.env.AUTH_URL = 'http://example.com';
  assert.equal(authenticationConfigured(), false);
  process.env.AUTH_URL = 'https://example.com';
  assert.equal(authenticationConfigured(), true);
  process.env.AUTH_SECRET = 'short';
  assert.equal(authenticationConfigured(), false);
});

test('only the configured owner may use the manager profile', () => {
  process.env.CAREBOARD_OWNER_EMAIL = 'owner@example.com';
  assert.equal(accountRoleAllowed('OWNER@example.com', 'member-manager', 'manager'), true);
  assert.equal(accountRoleAllowed('worker@example.com', 'member-manager', 'manager'), false);
  assert.equal(accountRoleAllowed('worker@example.com', 'another-manager', 'manager'), false);
  assert.equal(accountRoleAllowed('owner@example.com', 'worker-id', 'worker'), false);
  assert.equal(accountRoleAllowed('worker@example.com', 'worker-id', 'worker'), true);
  delete process.env.CAREBOARD_OWNER_EMAIL;
  assert.equal(accountRoleAllowed('worker@example.com', 'worker-id', 'worker'), false);
});

test('worker mappings reject invalid or ambiguous values', () => {
  process.env.CAREBOARD_MEMBER_EMAILS = '{"Worker@example.com":"worker-id"}';
  assert.equal(memberIdForEmail('worker@example.com'), 'worker-id');
  assert.equal(memberIdForEmail('outsider@example.com'), null);
  process.env.CAREBOARD_MEMBER_EMAILS = '{"Worker@example.com":"one","worker@example.com":"two"}';
  assert.equal(memberIdForEmail('worker@example.com'), null);
  process.env.CAREBOARD_MEMBER_EMAILS = '{';
  assert.equal(memberIdForEmail('worker@example.com'), null);
});

test('mutations require the exact configured origin', () => {
  process.env.AUTH_URL = 'https://careboard.example.com';
  assert.equal(trustedMutationOrigin('https://careboard.example.com'), true);
  for (const origin of [null, 'null', 'https://evil.example', 'https://careboard.example.com.evil.example', 'http://careboard.example.com']) {
    assert.equal(trustedMutationOrigin(origin), false);
  }
});
