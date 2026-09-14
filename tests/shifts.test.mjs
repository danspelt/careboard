import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shiftsForDay, weekdayOf, formatShift } from '../lib/shifts.ts';

const shifts = [
  { id: 's1', memberId: 'w1', weekday: 1, startTime: '09:00', endTime: '17:00' },
  { id: 's2', memberId: 'w2', weekday: 1, startTime: '08:00', endTime: '12:00' },
  { id: 's3', memberId: 'w1', weekday: 3, startTime: '09:00', endTime: '17:00' },
];

test('weekdayOf maps ISO dates to weekday numbers', () => {
  assert.equal(weekdayOf('2024-01-07'), 0); // Sunday
  assert.equal(weekdayOf('2024-01-08'), 1); // Monday
  assert.equal(weekdayOf('2024-01-13'), 6); // Saturday
});

test('shiftsForDay returns shifts for the weekday sorted by start time', () => {
  const monday = shiftsForDay(shifts, '2024-01-08');
  assert.deepEqual(monday.map((shift) => shift.id), ['s2', 's1']);
  assert.equal(shiftsForDay(shifts, '2024-01-10').length, 1);
  assert.equal(shiftsForDay(shifts, '2024-01-09').length, 0);
});

test('formatShift renders a compact time range', () => {
  assert.equal(formatShift(shifts[0]), '09:00–17:00');
});
