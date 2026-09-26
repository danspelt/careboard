import assert from 'node:assert/strict';
import { test } from 'node:test';
import { csilMonthSummary, csilReadiness, reportDueDate } from '../lib/csil.ts';

test('CSIL reporting deadline is configurable from month end', () => {
  assert.equal(reportDueDate('2026-01', 45), '2026-03-17');
  assert.equal(reportDueDate('2028-02', 45), '2028-04-14');
});

test('CSIL month summary separates agreement status and receipt gaps', () => {
  const summary = csilMonthSummary({
    month: '2026-09', entries: [], workers: [], fundedHoursMonthly: 100, fundingHourlyRate: 38.19,
    clientContribution: 120,
    expenses: [
      { id: '1', expenseDate: '2026-09-02', vendor: 'Bookkeeper', category: 'bookkeeping', description: '', amount: 75, eligibilityStatus: 'confirmed', receiptReference: 'INV-1', createdBy: 'm', createdAt: '', updatedAt: '' },
      { id: '2', expenseDate: '2026-09-03', vendor: 'Agency', category: 'backup_agency', description: '', amount: 200, eligibilityStatus: 'pending', receiptReference: '', createdBy: 'm', createdAt: '', updatedAt: '' },
      { id: '3', expenseDate: '2026-09-04', vendor: 'Store', category: 'other', description: '', amount: 20, eligibilityStatus: 'ineligible', receiptReference: '', createdBy: 'm', createdAt: '', updatedAt: '' },
    ],
    now: '2026-09-10T12:00:00.000Z',
  });
  assert.equal(summary.available, 3939);
  assert.equal(summary.confirmedExpenses, 75);
  assert.equal(summary.pendingExpenses, 200);
  assert.equal(summary.ineligibleExpenses, 20);
  assert.equal(summary.balance, 3864);
  assert.equal(summary.missingReceipts, 1);
});

test('CSIL readiness is evidence based and does not infer agreement eligibility', () => {
  const items = csilReadiness({ healthAuthority: 'Example HA', agreementStart: '2026-01-01', accountLastFour: '1234', fundedHoursMonthly: 100, fundingHourlyRate: 38.19, activeWorkerCount: 1, missingReceipts: 0 });
  assert.ok(items.every((item) => item.complete));
  assert.equal(csilReadiness({ fundedHoursMonthly: 0, fundingHourlyRate: 0, activeWorkerCount: 0, missingReceipts: 2 }).filter((item) => item.complete).length, 0);
});
