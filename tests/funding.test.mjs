import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fundingSummary, monthRange } from '../lib/funding.ts';

const workers = [
  { id: 'w1', hourlyRate: 30 },
  { id: 'w2', hourlyRate: null },
  { id: 'w3' },
];

const entries = [
  { id: 'e1', memberId: 'w1', startedAt: '2026-09-08T09:00:00.000Z', endedAt: '2026-09-08T13:00:00.000Z' },
  { id: 'e2', memberId: 'w1', startedAt: '2026-09-10T09:00:00.000Z', endedAt: null },
  { id: 'e3', memberId: 'w2', startedAt: '2026-09-09T09:00:00.000Z', endedAt: '2026-09-09T15:00:00.000Z' },
  { id: 'e4', memberId: 'w1', startedAt: '2026-08-31T09:00:00.000Z', endedAt: '2026-08-31T12:00:00.000Z' },
];

test('monthRange returns month bounds and day counts including leap years', () => {
  assert.deepEqual(monthRange('2026-09'), { start: '2026-09-01', end: '2026-09-30', daysInMonth: 30 });
  assert.equal(monthRange('2028-02').daysInMonth, 29);
  assert.equal(monthRange('2027-02').daysInMonth, 28);
});

test('fundingSummary aggregates only in-month entries per worker', () => {
  const summary = fundingSummary({
    entries,
    workers,
    fundedHoursMonthly: 100,
    fundingHourlyRate: 38.19,
    month: '2026-09',
    now: '2026-09-10T12:00:00.000Z',
  });
  const byWorker = new Map(summary.perWorker.map((row) => [row.workerId, row]));
  assert.equal(byWorker.get('w1').minutes, 240 + 180);
  assert.equal(byWorker.get('w2').minutes, 360);
  assert.equal(byWorker.get('w3').minutes, 0);
  assert.equal(summary.usedMinutes, 780);
});

test('labor cost uses each worker pay rate and skips missing rates', () => {
  const summary = fundingSummary({
    entries,
    workers,
    fundedHoursMonthly: 100,
    fundingHourlyRate: 38.19,
    month: '2026-09',
    now: '2026-09-10T12:00:00.000Z',
  });
  const byWorker = new Map(summary.perWorker.map((row) => [row.workerId, row]));
  assert.equal(byWorker.get('w1').cost, (420 / 60) * 30);
  assert.equal(byWorker.get('w2').cost, null);
  assert.equal(byWorker.get('w3').cost, null);
  assert.equal(summary.laborCost, (420 / 60) * 30);
});

test('funded value, remaining, and projection are deterministic', () => {
  const summary = fundingSummary({
    entries,
    workers,
    fundedHoursMonthly: 100,
    fundingHourlyRate: 38.19,
    month: '2026-09',
    now: '2026-09-10T12:00:00.000Z',
  });
  assert.equal(summary.fundedMinutes, 6000);
  assert.equal(summary.remainingMinutes, 6000 - 780);
  assert.equal(summary.projectedMinutes, (780 / 10) * 30);
  assert.ok(Math.abs(summary.fundedValue - 3819) < 1e-9);
});

test('funded value is zero when the CSIL rate is unset', () => {
  const summary = fundingSummary({
    entries: [],
    workers,
    fundedHoursMonthly: 100,
    fundingHourlyRate: 0,
    month: '2026-09',
    now: '2026-09-10T12:00:00.000Z',
  });
  assert.equal(summary.fundedValue, 0);
  assert.equal(summary.usedMinutes, 0);
  assert.equal(summary.projectedMinutes, 0);
});
