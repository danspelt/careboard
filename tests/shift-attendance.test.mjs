import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import { test } from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const modules = new Map();
function loadModule(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const loaded = { exports: {} };
  modules.set(path, loaded);
  const filename = fileURLToPath(new URL(path, root));
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = (specifier) => specifier.startsWith('@/lib/') ? loadModule(`${specifier.slice(2)}.ts`) : require(specifier);
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { attendanceLabel, buildAttendance } = loadModule('lib/shift-attendance.ts');

const workers = [{ id: 'w1' }, { id: 'w2' }, { id: 'w3' }, { id: 'w4' }, { id: 'w5' }, { id: 'w6' }];
// 2026-09-14 is a Monday (weekday 1)
const shift = (memberId, startTime = '09:00', endTime = '17:00') => ({ id: `s-${memberId}-${startTime}`, memberId, weekday: 1, startTime, endTime });
const entry = (memberId, startedAt, endedAt = null) => ({ id: `e-${memberId}-${startedAt}`, memberId, startedAt, endedAt });

const base = { workers, date: '2026-09-14', now: '2026-09-14T10:30:00.000Z', nowTime: '10:30' };

test('open entry with a shift is on duty', () => {
  const rows = buildAttendance({ ...base, shifts: [shift('w1')], entries: [entry('w1', '2026-09-14T09:05:00.000Z')] });
  const row = rows.find((item) => item.workerId === 'w1');
  assert.equal(row.status, 'on_duty');
  assert.match(attendanceLabel(row), /^On duty since /);
});

test('open entry without a shift is unscheduled on duty', () => {
  const rows = buildAttendance({ ...base, shifts: [], entries: [entry('w1', '2026-09-14T08:00:00.000Z')] });
  const row = rows.find((item) => item.workerId === 'w1');
  assert.equal(row.status, 'unscheduled_on_duty');
  assert.equal(attendanceLabel(row), 'On duty (no shift scheduled)');
});

test('shift starting later is upcoming', () => {
  const rows = buildAttendance({ ...base, nowTime: '07:30', shifts: [shift('w1')], entries: [] });
  const row = rows.find((item) => item.workerId === 'w1');
  assert.equal(row.status, 'upcoming');
  assert.equal(attendanceLabel(row), 'Starts 09:00');
});

test('late only after the grace window with no work today', () => {
  const shifts = [shift('w1')];
  const grace = buildAttendance({ ...base, nowTime: '09:14', shifts, entries: [] });
  assert.equal(grace.find((item) => item.workerId === 'w1').status, 'upcoming');
  const late = buildAttendance({ ...base, nowTime: '09:15', shifts, entries: [] });
  const row = late.find((item) => item.workerId === 'w1');
  assert.equal(row.status, 'late');
  assert.equal(row.minutesLate, 15);
  assert.equal(attendanceLabel(row), 'Late — shift started 09:00');
});

test('custom grace window is respected', () => {
  const rows = buildAttendance({ ...base, nowTime: '09:05', shifts: [shift('w1')], entries: [], lateAfterMinutes: 5 });
  assert.equal(rows.find((item) => item.workerId === 'w1').status, 'late');
});

test('clocking out mid-shift or after end time is finished', () => {
  const shifts = [shift('w1')];
  const entries = [entry('w1', '2026-09-14T09:00:00.000Z', '2026-09-14T10:00:00.000Z')];
  const midShift = buildAttendance({ ...base, nowTime: '10:30', shifts, entries });
  assert.equal(midShift.find((item) => item.workerId === 'w1').status, 'finished');
  const after = buildAttendance({ ...base, nowTime: '17:30', shifts, entries: [] });
  const row = after.find((item) => item.workerId === 'w1');
  assert.equal(row.status, 'finished');
  assert.equal(attendanceLabel(row), 'Shift 09:00–17:00 finished');
});

test('no shift and no open entry is off today', () => {
  const rows = buildAttendance({ ...base, shifts: [], entries: [] });
  const row = rows.find((item) => item.workerId === 'w1');
  assert.equal(row.status, 'off_today');
  assert.equal(attendanceLabel(row), 'Not scheduled today');
});

test('rows sort late first, off today last, ties keep worker order', () => {
  const shifts = [shift('w1'), shift('w3'), shift('w4'), shift('w5', '12:00')];
  const entries = [
    entry('w2', '2026-09-14T08:00:00.000Z'),
    entry('w3', '2026-09-14T09:10:00.000Z'),
    entry('w4', '2026-09-14T09:00:00.000Z', '2026-09-14T10:00:00.000Z'),
  ];
  const rows = buildAttendance({ ...base, nowTime: '10:30', shifts, entries });
  assert.deepEqual(rows.map((row) => [row.workerId, row.status]), [
    ['w1', 'late'],
    ['w2', 'unscheduled_on_duty'],
    ['w3', 'on_duty'],
    ['w5', 'upcoming'],
    ['w4', 'finished'],
    ['w6', 'off_today'],
  ]);
});

test('a worker with two shifts uses the earliest', () => {
  const rows = buildAttendance({ ...base, nowTime: '07:00', shifts: [shift('w1', '14:00', '18:00'), shift('w1', '08:00', '12:00')], entries: [] });
  const row = rows.find((item) => item.workerId === 'w1');
  assert.equal(row.shift.startTime, '08:00');
  assert.equal(attendanceLabel(row), 'Starts 08:00');
});
