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
const { lastCompletePeriod, payrollRows } = loadModule('lib/payroll-report.ts');

test('lastCompletePeriod returns the 14 days ending on the last even-ISO-week Sunday', () => {
  // 2024-01-15 is Monday of ISO week 3 (cycle week 1): last complete period = Jan 1–14
  assert.deepEqual(lastCompletePeriod('2024-01-15'), { start: '2024-01-01', end: '2024-01-14' });
  // Same answer mid-week and on the Sunday of the odd week
  assert.deepEqual(lastCompletePeriod('2024-01-17'), { start: '2024-01-01', end: '2024-01-14' });
  assert.deepEqual(lastCompletePeriod('2024-01-21'), { start: '2024-01-01', end: '2024-01-14' });
  // 2024-01-22 is Monday of ISO week 4 (cycle week 2): the Jan 15–28 period is still running
  assert.deepEqual(lastCompletePeriod('2024-01-22'), { start: '2024-01-01', end: '2024-01-14' });
  // 2024-01-29 is Monday of ISO week 5: the Jan 15–28 period just completed
  assert.deepEqual(lastCompletePeriod('2024-01-29'), { start: '2024-01-15', end: '2024-01-28' });
});

test('payrollRows lists each worker’s daily hours with per-worker and grand totals', () => {
  const rows = payrollRows([
    {
      name: 'Alex', hourlyRate: 22,
      entries: [
        { startedAt: '2024-01-02T08:00:00.000Z', endedAt: '2024-01-02T16:00:00.000Z' },
        { startedAt: '2024-01-03T08:00:00.000Z', endedAt: '2024-01-03T12:00:00.000Z' },
      ],
    },
    { name: 'Blair', hourlyRate: null, entries: [{ startedAt: '2024-01-02T09:00:00.000Z', endedAt: '2024-01-02T10:00:00.000Z' }] },
  ], '2024-01-01', '2024-01-14');
  assert.deepEqual(rows[0], ['Pay period', '2024-01-01 to 2024-01-14']);
  assert.deepEqual(rows[2], ['Worker', 'Date', 'Day', 'Clock in (UTC)', 'Clock out (UTC)', 'Hours', 'Rate', 'Gross pay']);
  assert.equal(rows[3][0], 'Alex');
  assert.equal(rows[3][1], '2024-01-02');
  assert.equal(rows[3][5], '8.00');
  assert.equal(rows[3][7], '176.00');
  assert.deepEqual(rows[5], ['Alex — total', '', '', '', '', '12.00', '', '264.00']);
  const blairTotal = rows.find((row) => row[0] === 'Blair — total');
  assert.equal(blairTotal[5], '1.00');
  assert.equal(blairTotal[7], ''); // no rate → blank gross, not a guessed number
  assert.deepEqual(rows.at(-1), ['Grand total', '', '', '', '', '13.00', '', '264.00']);
});
