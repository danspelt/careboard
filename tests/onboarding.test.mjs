import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildOnboarding } from '../lib/onboarding.ts';

const task = (overrides = {}) => ({ id: crypto.randomUUID(), status: 'open', assignedTo: null, notes: [], ...overrides });

test('manager onboarding tracks team, task, assignment, note, and completion milestones', () => {
  const empty = buildOnboarding({ manager: true, viewerId: 'm', members: [{ id: 'm', role: 'manager' }], tasks: [] });
  assert.deepEqual(empty.map((step) => step.done), [false, false, false, false, false]);
  const ready = buildOnboarding({
    manager: true, viewerId: 'm',
    members: [{ id: 'm', role: 'manager' }, { id: 'w', role: 'worker' }],
    tasks: [task({ assignedTo: 'w', status: 'complete', notes: [{ id: 'n', memberId: 'w' }] })],
  });
  assert.deepEqual(ready.map((step) => step.done), [true, true, true, true, true]);
});

test('worker onboarding tracks profile, assignment, start, note, and completion', () => {
  const steps = buildOnboarding({
    manager: false, viewerId: 'w',
    members: [{ id: 'w', role: 'worker', phone: '555-0100' }],
    tasks: [task({ assignedTo: 'w', status: 'in_progress' }), task({ assignedTo: 'other', status: 'complete', notes: [{ id: 'n1', memberId: 'w' }] })],
  });
  assert.deepEqual(steps.map((step) => step.done), [true, true, true, false, false]);
  assert.equal(steps.length, 5);
});
