import assert from 'node:assert/strict';
import { test } from 'node:test';
import { addDaysISO, clampInteger, csvCell, metrics, nextRecurrenceDate, safeStoredName, validateUpload, validateUploadSignature } from '../lib/operations.ts';

test('recurrence handles leap boundaries and clamps month end', () => {
  assert.equal(nextRecurrenceDate('2024-02-28', 'daily'), '2024-02-29');
  assert.equal(nextRecurrenceDate('2024-01-31', 'monthly'), '2024-02-29');
  assert.equal(nextRecurrenceDate('2025-01-31', 'monthly'), '2025-02-28');
  assert.equal(nextRecurrenceDate('2025-03-01', 'weekly'), '2025-03-08');
  assert.equal(nextRecurrenceDate('2025-01-30', 'monthly'), '2025-02-28');
  assert.equal(nextRecurrenceDate('2024-12-31', 'monthly'), '2025-01-31');
});

test('CSV quotes data, strips line breaks, and neutralizes spreadsheet formulas', () => {
  assert.equal(csvCell('a,"b"'), '"a,""b"""');
  assert.equal(csvCell('=CMD()'), "\"'=CMD()\"");
  assert.equal(csvCell('-2+3'), "\"'-2+3\"");
  assert.equal(csvCell('line\nbreak'), '"line break"');
  assert.equal(csvCell('\tsecret'), '" secret"');
});

test('upload validation is strict, checks file signatures, and generated paths contain no input name', () => {
  assert.equal(validateUpload('image/jpeg', 100, new Uint8Array([0xff, 0xd8, 0xff, 0xe0])), null);
  assert.equal(validateUpload('image/png', 100, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), null);
  assert.equal(validateUpload('image/webp', 100, new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50])), null);
  assert.match(validateUpload('image/svg+xml', 100, new Uint8Array([0x3c])), /JPEG/);
  assert.match(validateUpload('image/png', 11 * 1024 * 1024, new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), /10 MB/);
  assert.match(validateUpload('image/jpeg', 100, new Uint8Array([0x89, 0x50, 0x4e, 0x47])), /signature/);
  assert.equal(safeStoredName('123e4567-e89b-12d3-a456-426614174000', 'image/webp'), '123e4567-e89b-12d3-a456-426614174000.webp');
  assert.throws(() => safeStoredName('../secret', 'image/png'));
});

test('signature helper fails for short buffers and mismatched magic numbers', () => {
  assert.equal(validateUploadSignature(new Uint8Array([0xff, 0xd8]), 'image/jpeg'), false);
  assert.equal(validateUploadSignature(new Uint8Array([0x00, 0x00, 0x00]), 'image/jpeg'), false);
  assert.equal(validateUploadSignature(new Uint8Array([0x52, 0x49, 0x46, 0x46]), 'image/webp'), false);
});

test('bounded settings and reminder dates reject unbounded or invalid values', () => {
  assert.equal(clampInteger(9999, 1, 365, 30), 365);
  assert.equal(clampInteger(-5, 0, 90, 1), 0);
  assert.equal(clampInteger('not-a-number', 1, 365, 30), 30);
  assert.equal(addDaysISO('2024-02-28', 1), '2024-02-29');
});

test('manager metrics distinguish overdue, due today, and on-time work', () => {
  assert.deepEqual(
    metrics(
      [
        { status: 'open', dueDate: '2025-01-01' },
        { status: 'open', dueDate: '2025-01-03' },
        { status: 'complete', dueDate: '2025-01-02', completedAt: '2025-01-02T12:00:00Z' },
      ],
      '2025-01-03',
    ),
    { open: 2, overdue: 1, dueToday: 1, completed: 1, completedOnTime: 1 },
  );
});
