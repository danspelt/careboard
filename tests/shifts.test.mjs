import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cycleWeekOf, shiftsForDay, weekdayOf, formatShift } from '../lib/shifts.ts';

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

test('cycleWeekOf alternates by ISO week and is stable within a week', () => {
  const monday = cycleWeekOf('2024-01-08'); // ISO week 2 → cycle week 2
  assert.equal(monday, 2);
  assert.equal(cycleWeekOf('2024-01-14'), 2); // same week, Sunday
  assert.equal(cycleWeekOf('2024-01-15'), 1); // ISO week 3 → cycle week 1
  assert.equal(cycleWeekOf('2024-01-22'), 2); // ISO week 4 → back to 2
  assert.equal(cycleWeekOf('2024-01-01'), 1); // ISO week 1 → cycle week 1
});

test('shiftsForDay honors the two-week cycle and keeps every-week shifts always visible', () => {
  const biweekly = [
    { id: 'every', memberId: 'w1', weekday: 1, startTime: '09:00', endTime: '17:00', cycleWeek: 0 },
    { id: 'week-a', memberId: 'w1', weekday: 2, startTime: '09:00', endTime: '17:00', cycleWeek: 1 },
    { id: 'week-b', memberId: 'w1', weekday: 2, startTime: '10:00', endTime: '14:00', cycleWeek: 2 },
  ];
  // 2024-01-09 is a Tuesday in ISO week 2 → cycle week 2
  assert.deepEqual(shiftsForDay(biweekly, '2024-01-09').map((shift) => shift.id), ['week-b']);
  // 2024-01-16 is a Tuesday in ISO week 3 → cycle week 1
  assert.deepEqual(shiftsForDay(biweekly, '2024-01-16').map((shift) => shift.id), ['week-a']);
  // Monday shifts with no cycleWeek appear in both weeks
  assert.deepEqual(shiftsForDay(biweekly, '2024-01-08').map((shift) => shift.id), ['every']);
  assert.deepEqual(shiftsForDay(biweekly, '2024-01-15').map((shift) => shift.id), ['every']);
  // shifts with no cycleWeek field at all behave as every-week
  assert.equal(shiftsForDay([{ id: 'plain', memberId: 'w1', weekday: 2, startTime: '09:00', endTime: '10:00' }], '2024-01-09').length, 1);
});
