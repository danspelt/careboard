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
const stubs = {
  'server-only': {},
  'next/headers': { cookies: async () => ({ get: () => undefined }) },
};
function loadModule(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const loaded = { exports: {} };
  modules.set(path, loaded);
  const filename = fileURLToPath(new URL(path, root));
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = (specifier) =>
    specifier in stubs ? stubs[specifier]
      : specifier.startsWith('@/lib/') ? loadModule(`${specifier.slice(2)}.ts`)
      : require(specifier);
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { getLocalDevRawState, mutateLocalDevState } = loadModule('lib/local-dev.ts');

const state = getLocalDevRawState();
const manager = state.members.find((m) => m.role === 'manager');
const worker = state.members.find((m) => m.role === 'worker');
const coworker = state.members.find((m) => m.role === 'worker' && m.id !== worker.id);
const viewer = state.members.find((m) => m.role === 'viewer');

let seq = 0;
function addChore(overrides = {}) {
  const chore = { id: `test-chore-${seq++}`, title: 'Test task', area: 'Other', dueDate: null, dueTime: null, priority: 'normal', status: 'open', assignedTo: null, notes: [], ...overrides };
  state.chores = [chore, ...state.chores];
  return chore;
}

test('the local-dev manager-only list matches the production list', () => {
  const production = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
  const localDev = readFileSync(new URL('../lib/local-dev.ts', import.meta.url), 'utf8');
  const names = (source) => new Set([...source.match(/managerOnly = (?:new Set\()?(\[[\s\S]*?\])/)?.[1].matchAll(/'([a-zA-Z]+)'/g) ?? []].map((m) => m[1]));
  assert.deepEqual(names(localDev), names(production));
});

test('manager-only actions reject workers in local dev', () => {
  assert.throws(() => mutateLocalDevState({ action: 'createChore', actorId: worker.id, title: 'X', area: 'Y' }), /Only the household manager/);
  assert.throws(() => mutateLocalDevState({ action: 'setShifts', actorId: worker.id, memberId: worker.id, shifts: '[]' }), /Only the household manager/);
  assert.throws(() => mutateLocalDevState({ action: 'deleteTimeEntry', actorId: worker.id, entryId: 'x' }), /Only the household manager/);
  assert.throws(() => mutateLocalDevState({ action: 'saveMedication', actorId: worker.id, name: 'Med' }), /Only the household manager/);
});

test('family viewers stay read-only in local dev', () => {
  assert.throws(() => mutateLocalDevState({ action: 'claim', actorId: viewer.id, choreId: state.chores[0].id }), /read-only/);
});

test('clock in/out enforce a single open entry and own-time rules like production', () => {
  state.timeEntries = [];
  mutateLocalDevState({ action: 'clockIn', actorId: worker.id });
  assert.equal(state.timeEntries.filter((e) => e.memberId === worker.id && !e.endedAt).length, 1);
  assert.throws(() => mutateLocalDevState({ action: 'clockIn', actorId: worker.id }), /already clocked in/);
  mutateLocalDevState({ action: 'clockOut', actorId: worker.id });
  assert.equal(state.timeEntries.filter((e) => e.memberId === worker.id && !e.endedAt).length, 0);
  assert.throws(() => mutateLocalDevState({ action: 'clockOut', actorId: worker.id }), /not clocked in/);
  assert.throws(() => mutateLocalDevState({ action: 'clockIn', actorId: worker.id, memberId: coworker.id }), /your own time/);
  mutateLocalDevState({ action: 'clockIn', actorId: manager.id, memberId: coworker.id });
  mutateLocalDevState({ action: 'clockOut', actorId: manager.id, memberId: coworker.id });
});

test('the claim → start → complete flow rejects out-of-order steps like production', () => {
  const chore = addChore({ assignedTo: worker.id });
  assert.throws(() => mutateLocalDevState({ action: 'complete', actorId: worker.id, choreId: chore.id }), /changed before your update/);
  mutateLocalDevState({ action: 'start', actorId: worker.id, choreId: chore.id });
  assert.equal(chore.status, 'in_progress');
  assert.throws(() => mutateLocalDevState({ action: 'start', actorId: worker.id, choreId: chore.id }), /changed before your update/);
  mutateLocalDevState({ action: 'complete', actorId: worker.id, choreId: chore.id });
  assert.equal(chore.status, 'complete');
  assert.equal(chore.reviewStatus, 'pending');
});

test('claim and takeover mirror production guards and messages', () => {
  const open = addChore();
  mutateLocalDevState({ action: 'claim', actorId: worker.id, choreId: open.id });
  assert.equal(open.assignedTo, worker.id);
  assert.throws(() => mutateLocalDevState({ action: 'claim', actorId: coworker.id, choreId: open.id }), /changed before your update/);

  const other = addChore({ assignedTo: worker.id });
  mutateLocalDevState({ action: 'takeover', actorId: coworker.id, choreId: other.id });
  assert.equal(other.assignedTo, coworker.id);
  assert.equal(other.notes.at(-1).body, `Took over from ${worker.name}`);

  const mine = addChore({ assignedTo: worker.id });
  assert.throws(() => mutateLocalDevState({ action: 'takeover', actorId: worker.id, choreId: mine.id }), /already yours/);
  const unassigned = addChore();
  assert.throws(() => mutateLocalDevState({ action: 'takeover', actorId: worker.id, choreId: unassigned.id }), /claim it instead/);
  const done = addChore({ status: 'complete', assignedTo: coworker.id });
  assert.throws(() => mutateLocalDevState({ action: 'takeover', actorId: worker.id, choreId: done.id }), /already complete/);
});

test('workers can only update their own active tasks and only the notes fields', () => {
  const own = addChore({ assignedTo: worker.id });
  mutateLocalDevState({ action: 'updateTask', actorId: worker.id, choreId: own.id, progressNotes: 'Halfway there', title: 'Sneaky rename', assigneeId: '' });
  assert.equal(own.progressNotes, 'Halfway there');
  assert.equal(own.title, 'Test task');
  assert.equal(own.assignedTo, worker.id);

  const notMine = addChore({ assignedTo: coworker.id });
  assert.throws(() => mutateLocalDevState({ action: 'updateTask', actorId: worker.id, choreId: notMine.id, progressNotes: 'X' }), /your own active tasks/);

  const done = addChore({ status: 'complete', assignedTo: worker.id });
  assert.throws(() => mutateLocalDevState({ action: 'updateTask', actorId: worker.id, choreId: done.id, progressNotes: 'X' }), /your own active tasks/);

  mutateLocalDevState({ action: 'updateTask', actorId: manager.id, choreId: notMine.id, title: 'Manager rename' });
  assert.equal(notMine.title, 'Manager rename');
});

test('workers cannot rewrite another member’s availability', () => {
  assert.throws(
    () => mutateLocalDevState({ action: 'setAvailability', actorId: worker.id, memberId: coworker.id, windows: '[]' }),
    /your own availability/,
  );
  mutateLocalDevState({ action: 'setAvailability', actorId: worker.id, memberId: worker.id, windows: '[]' });
});
