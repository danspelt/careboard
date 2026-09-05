import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canAssignTo, canAuthenticate, visibleTasks, workerCan, workerTaskGroups } from '../lib/access-policy.ts';

const worker = { id: 'worker-1', role: 'worker', status: 'active' };
const tasks = [
  { id: 'mine', assignedTo: 'worker-1', status: 'in_progress' },
  { id: 'available', assignedTo: null, status: 'open' },
  { id: 'other', assignedTo: 'worker-2', status: 'open' },
  { id: 'unassigned-complete', assignedTo: null, status: 'complete' },
];

test('worker filtering never exposes another worker or unrelated completed work', () => {
  assert.deepEqual(visibleTasks(worker, tasks).map(({ id }) => id), ['mine', 'available']);
  const groups = workerTaskGroups(worker, tasks);
  assert.deepEqual(groups.map(({ title }) => title), ['My Tasks', 'Available Tasks']);
  assert.deepEqual(groups[0].tasks.map(({ id }) => id), ['mine']);
  assert.deepEqual(groups[1].tasks.map(({ id }) => id), ['available']);
});

test('manager visibility remains complete', () => {
  assert.equal(visibleTasks({ id: 'manager', role: 'manager', status: 'active' }, tasks).length, tasks.length);
});

test('worker transitions require ownership and exact task state', () => {
  assert.equal(workerCan('claim', worker.id, { assignedTo: null, status: 'open' }), true);
  assert.equal(workerCan('start', worker.id, { assignedTo: worker.id, status: 'open' }), true);
  assert.equal(workerCan('complete', worker.id, { assignedTo: worker.id, status: 'in_progress' }), true);
  assert.equal(workerCan('complete', worker.id, { assignedTo: worker.id, status: 'open' }), false);
  assert.equal(workerCan('start', worker.id, { assignedTo: 'worker-2', status: 'open' }), false);
});

test('lifecycle authentication and assignment policies fail closed', () => {
  assert.equal(canAuthenticate('active'), true);
  assert.equal(canAuthenticate('disabled'), false);
  assert.equal(canAssignTo('active'), true);
  assert.equal(canAssignTo('disabled'), false);
});
