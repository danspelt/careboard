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
const { suggestAssignments } = loadModule('lib/auto-assign.ts');

const workers = [{ id: 'a', status: 'active' }, { id: 'b', status: 'active' }, { id: 'off', status: 'disabled' }];
const task = (overrides = {}) => ({ id: crypto.randomUUID(), dueDate: '2026-09-14', status: 'open', assignedTo: null, ...overrides });

test('auto-assign balances unassigned tasks across active workers by day', () => {
  const plan = suggestAssignments([
    task({ id: 't1' }), task({ id: 't2' }), task({ id: 't3' }),
    task({ id: 'busy', dueDate: '2026-09-14', assignedTo: 'a' }),
    task({ id: 'done', status: 'complete', assignedTo: null }),
    task({ id: 'far', dueDate: '2026-10-01' }),
  ], workers, '2026-09-13');
  assert.equal(plan.length, 3);
  const assignees = plan.map((item) => item.workerId).sort();
  assert.deepEqual(assignees, ['a', 'b', 'b']);
  assert.ok(plan.every((item) => item.workerId !== 'off'));
});

test('overdue unassigned tasks count against the first schedule day', () => {
  const plan = suggestAssignments([task({ id: 'late', dueDate: '2026-09-10' })], workers, '2026-09-13');
  assert.deepEqual(plan, [{ taskId: 'late', workerId: 'a', day: '2026-09-13' }]);
});

test('auto-assign returns nothing without active workers or candidates', () => {
  assert.deepEqual(suggestAssignments([task({ id: 't1' })], [{ id: 'off', status: 'disabled' }], '2026-09-13'), []);
  assert.deepEqual(suggestAssignments([task({ id: 't1', assignedTo: 'a' }), task({ id: 't2', dueDate: null })], workers, '2026-09-13'), []);
});

test('auto-assign prefers care workers on shift for the task day', () => {
  // 2026-09-14 is a Monday (weekday 1); b is on shift, a is not.
  const plan = suggestAssignments([task({ id: 't1' }), task({ id: 't2' })], workers, '2026-09-13', 7, {
    shifts: [{ memberId: 'b', weekday: 1 }],
  });
  assert.equal(plan.length, 2);
  assert.ok(plan.every((item) => item.workerId === 'b'));
});

test('auto-assign respects declared availability windows', () => {
  // a declared Tuesday-only availability; b declared nothing. Monday tasks go to b.
  const availability = [{ memberId: 'a', weekday: 2 }];
  const plan = suggestAssignments([task({ id: 't1' })], workers, '2026-09-13', 7, { availability });
  assert.deepEqual(plan, [{ taskId: 't1', workerId: 'b', day: '2026-09-14' }]);
  // When everyone declared but nobody is available that day, still assign someone.
  const fallback = suggestAssignments([task({ id: 't1' })], workers, '2026-09-13', 7, {
    availability: [{ memberId: 'a', weekday: 2 }, { memberId: 'b', weekday: 2 }],
  });
  assert.equal(fallback.length, 1);
});
