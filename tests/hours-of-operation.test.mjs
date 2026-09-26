import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  formatClockLabel,
  formatOperatingHoursSummary,
  isValidClockTime,
  normalizeOperatingHours,
  parseOperatingWeekdays,
  serializeOperatingWeekdays,
} from '../lib/hours-of-operation.ts';

test('clock times validate HH:MM and reject inverted ranges', () => {
  assert.equal(isValidClockTime('08:00'), true);
  assert.equal(isValidClockTime('14:00'), true);
  assert.equal(isValidClockTime('8:00'), false);
  assert.deepEqual(normalizeOperatingHours('08:00', '14:00'), { start: '08:00', end: '14:00' });
  assert.deepEqual(normalizeOperatingHours('16:00', '09:00'), { start: '08:00', end: '14:00' });
});

test('weekday lists serialize and format a regular week summary', () => {
  assert.deepEqual(parseOperatingWeekdays('1,2,3,4,5'), [1, 2, 3, 4, 5]);
  assert.equal(serializeOperatingWeekdays([5, 1, 1, 3]), '1,3,5');
  assert.equal(formatClockLabel('08:00'), '8:00 AM');
  assert.equal(formatClockLabel('14:00'), '2:00 PM');
  assert.equal(
    formatOperatingHoursSummary({ start: '08:00', end: '14:00', weekdays: '1,2,3,4,5' }),
    'Weekdays 8:00 AM–2:00 PM',
  );
});
