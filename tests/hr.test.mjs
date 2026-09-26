import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  buildHrAlerts,
  incompleteHireWorkerCount,
  memberOnApprovedLeave,
  remainingLeaveHours,
  unsignedRequiredDocCount,
} from '../lib/hr.ts';
import {
  aggregateWorkerHours,
  grossFor,
  nextPeriod,
  payPeriodReadyToClose,
  periodContaining,
  wageStatementRows,
} from '../lib/hr-payroll.ts';

test('HR alerts compose leave, docs, hire, certs, and payroll signals', () => {
  assert.deepEqual(buildHrAlerts({
    pendingLeave: 0, unsignedRequiredDocs: 0, incompleteHireChecklists: 0, certAlerts: 0, payPeriodReady: false,
  }), []);
  const alerts = buildHrAlerts({
    pendingLeave: 2, unsignedRequiredDocs: 1, incompleteHireChecklists: 1, certAlerts: 3, payPeriodReady: true, payPeriodLabel: '2026-01-06 to 2026-01-19',
  });
  assert.equal(alerts.length, 5);
  assert.equal(alerts.map((item) => item.kind).join(','), 'leave,docs,hire,certs,payroll');
});

test('leave remaining hours never go negative', () => {
  assert.equal(remainingLeaveHours({ memberId: 'w', kind: 'vacation', hoursEntitled: 40, hoursUsed: 10 }), 30);
  assert.equal(remainingLeaveHours({ memberId: 'w', kind: 'vacation', hoursEntitled: 10, hoursUsed: 40 }), 0);
});

test('unsigned required docs count outstanding worker acknowledgments', () => {
  const docs = [
    { id: 'd1', title: 'Policy', category: 'policy', body: 'x', required: true, createdBy: 'm', createdAt: 't', archivedAt: null },
    { id: 'd2', title: 'Old', category: 'policy', body: 'x', required: true, createdBy: 'm', createdAt: 't', archivedAt: 't' },
  ];
  const acks = [{ documentId: 'd1', memberId: 'w1', acknowledgedAt: 't' }];
  assert.equal(unsignedRequiredDocCount(docs, acks, ['w1', 'w2']), 1);
});

test('incomplete hire checklists only count recent hires', () => {
  const items = [
    { id: '1', memberId: 'new', title: 'A', done: false, doneAt: null, doneBy: null, sortOrder: 0 },
    { id: '2', memberId: 'old', title: 'A', done: false, doneAt: null, doneBy: null, sortOrder: 0 },
  ];
  const workers = [
    { id: 'new', employmentStartedOn: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z' },
    { id: 'old', employmentStartedOn: '2024-01-01', createdAt: '2024-01-01T00:00:00.000Z' },
  ];
  assert.equal(incompleteHireWorkerCount(items, workers, '2026-09-25'), 1);
});

test('approved leave covers inclusive date range', () => {
  const requests = [{
    id: 'r', memberId: 'w', kind: 'vacation', startOn: '2026-09-20', endOn: '2026-09-22', hours: 24, note: '', status: 'approved', decidedBy: 'm', decidedAt: 't', createdAt: 't',
  }];
  assert.equal(memberOnApprovedLeave(requests, 'w', '2026-09-21'), true);
  assert.equal(memberOnApprovedLeave(requests, 'w', '2026-09-23'), false);
});

test('pay periods align to anchor and length', () => {
  const period = periodContaining('2026-01-20', '2026-01-06', 14);
  assert.deepEqual(period, { startOn: '2026-01-20', endOn: '2026-02-02' });
  assert.deepEqual(nextPeriod(period, 14), { startOn: '2026-02-03', endOn: '2026-02-16' });
  assert.equal(payPeriodReadyToClose({ endOn: '2026-01-19', status: 'open' }, '2026-01-19'), true);
  assert.equal(payPeriodReadyToClose({ endOn: '2026-01-19', status: 'closed' }, '2026-01-20'), false);
});

test('hour aggregation and wage statements use gross only', () => {
  const { hours, entryIds } = aggregateWorkerHours([
    { id: 'e1', startedAt: '2026-01-07T09:00:00.000Z', endedAt: '2026-01-07T17:00:00.000Z' },
    { id: 'e2', startedAt: '2025-12-01T09:00:00.000Z', endedAt: '2025-12-01T17:00:00.000Z' },
  ], '2026-01-06', '2026-01-19');
  assert.equal(hours, 8);
  assert.deepEqual(entryIds, ['e1']);
  assert.equal(grossFor(8, 25), 200);
  const rows = wageStatementRows('Alex', { startOn: '2026-01-06', endOn: '2026-01-19' }, { hours: 8, hourlyRate: 25, grossAmount: 200 });
  assert.match(String(rows.flat()), /bookkeeper/);
});
