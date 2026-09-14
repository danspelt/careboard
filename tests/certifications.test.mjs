import assert from 'node:assert/strict';
import { test } from 'node:test';
import { certDaysLeft, certStatus, certificationAlerts } from '../lib/certifications.ts';

const now = '2026-09-10T12:00:00.000Z';

test('certStatus classifies expired, expiring, and valid records', () => {
  assert.equal(certStatus('2026-09-09', now), 'expired');
  assert.equal(certStatus('2026-09-10', now), 'expiring');
  assert.equal(certStatus('2026-10-10', now), 'expiring');
  assert.equal(certStatus('2026-10-11', now), 'valid');
  assert.equal(certStatus('2027-01-01', now), 'valid');
});

test('certDaysLeft counts days until expiry across month boundaries', () => {
  assert.equal(certDaysLeft('2026-09-10', now), 0);
  assert.equal(certDaysLeft('2026-09-15', now), 5);
  assert.equal(certDaysLeft('2026-09-01', now), -9);
  assert.equal(certDaysLeft('2026-10-01', now), 21);
});

test('certificationAlerts returns only expired/expiring records sorted by urgency', () => {
  const members = [
    { id: 'w1', name: 'Maria' },
    { id: 'w2', name: 'Jon' },
  ];
  const certs = [
    { id: 'c1', memberId: 'w1', name: 'First aid', expiresOn: '2027-06-01', createdAt: now },
    { id: 'c2', memberId: 'w1', name: 'CRC', expiresOn: '2026-09-20', createdAt: now },
    { id: 'c3', memberId: 'w2', name: 'Food safe', expiresOn: '2026-08-01', createdAt: now },
    { id: 'c4', memberId: 'gone', name: 'Orphan', expiresOn: '2026-09-11', createdAt: now },
  ];
  const alerts = certificationAlerts(certs, members, now);
  assert.deepEqual(alerts.map((a) => a.certification.id), ['c3', 'c2']);
  assert.equal(alerts[0].status, 'expired');
  assert.equal(alerts[0].memberName, 'Jon');
  assert.equal(alerts[1].status, 'expiring');
});
