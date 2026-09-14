import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatMinutes, minutesInRange, openEntryFor, weekSummary } from '../lib/time-tracking.ts';

const entries = [
  { id: 'e1', memberId: 'w1', startedAt: '2026-09-14T09:00:00.000Z', endedAt: '2026-09-14T12:30:00.000Z' },
  { id: 'e2', memberId: 'w1', startedAt: '2026-09-15T09:00:00.000Z', endedAt: null },
  { id: 'e3', memberId: 'w2', startedAt: '2026-09-14T10:00:00.000Z', endedAt: '2026-09-14T11:00:00.000Z' },
];

test('openEntryFor finds the active clock-in', () => {
  assert.equal(openEntryFor(entries, 'w1')?.id, 'e2');
  assert.equal(openEntryFor(entries, 'w2'), null);
});

test('minutesInRange counts open entries against the current time', () => {
  const now = '2026-09-15T10:30:00.000Z';
  assert.equal(minutesInRange(entries, 'w1', '2026-09-14', '2026-09-15', now), 210 + 90);
  assert.equal(minutesInRange(entries, 'w2', '2026-09-14', '2026-09-15', now), 60);
});

test('weekSummary reports per-worker totals and clocked-in state', () => {
  const summary = weekSummary(entries, ['w1', 'w2', 'w3'], '2026-09-14', 7, '2026-09-15T10:30:00.000Z');
  assert.deepEqual(summary.map((row) => row.minutes), [300, 60, 0]);
  assert.deepEqual(summary.map((row) => row.clockedIn), [true, false, false]);
});

test('formatMinutes renders compact durations', () => {
  assert.equal(formatMinutes(45), '45m');
  assert.equal(formatMinutes(60), '1h');
  assert.equal(formatMinutes(150), '2h 30m');
});
