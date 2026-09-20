import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('notification delivery boundaries keep credentials server-side and messages minimal', () => {
  const sms = readFileSync(new URL('../lib/sms.ts', import.meta.url), 'utf8');
  const email = readFileSync(new URL('../lib/email.ts', import.meta.url), 'utf8');
  const household = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
  assert.match(sms, /TWILIO_ACCOUNT_SID/);
  assert.match(sms, /TWILIO_AUTH_TOKEN/);
  assert.match(sms, /TWILIO_FROM_NUMBER/);
  assert.match(sms, /\^\\\+\[1-9\]\\d\{7,14\}\$/);
  assert.doesNotMatch(`${sms}${email}`, /NEXT_PUBLIC_/);
  assert.match(household, /filter\(\(item\) => item\.smsOptIn\)/);
  assert.match(household, /Coverage SMS delivery failed after saving the in-app request/);
  assert.match(household, /Manager coverage SMS failed after saving the accepted coverage/);
});

test('coverage acceptance is explicit, atomic, authorized, conflict checked, and audited', () => {
  const household = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
  assert.match(household, /action === 'acceptScheduleCoverage'/);
  assert.match(household, /Only active care workers can accept shift coverage/);
  assert.match(household, /You cannot accept your own coverage request/);
  assert.match(household, /status='open'/);
  assert.match(household, /conflicts with your existing schedule/);
  assert.match(household, /schedule_coverage_accepted/);
});

test('invites send a best-effort email after the invite row is saved', () => {
  const email = readFileSync(new URL('../lib/email.ts', import.meta.url), 'utf8');
  const household = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
  assert.match(email, /export function inviteEmailMessage/);
  assert.match(email, /export async function sendInviteEmail/);
  assert.match(household, /accept-invite\?token=/);
  // invite row is persisted before the email attempt in both paths
  for (const marker of ["'invited_member'", "'reinvited_worker'"]) {
    const markerAt = household.indexOf(marker);
    const insertAt = household.lastIndexOf('INSERT INTO worker_invites', markerAt);
    const sendAt = household.indexOf('trySendInviteEmail', markerAt);
    assert.ok(insertAt > 0 && sendAt > markerAt, `email must follow invite insert near ${marker}`);
  }
  // email is best-effort: a skipped/failed send must not fail the mutation
  assert.match(household, /catch \{\s*return 'skipped';/);
});

test('request is durable before independent email and SMS attempts', () => {
  const household = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
  const insertAt = household.indexOf('INSERT INTO schedule_change_requests');
  assert.ok(insertAt > 0);
  assert.ok(insertAt < household.indexOf('sendCoverageEmail', insertAt));
  assert.ok(insertAt < household.indexOf('sendCareBoardSms', insertAt));
  assert.match(household, /You already requested a schedule change for that date/);
});
