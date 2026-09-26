import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildOnboarding, firstLoginGuide } from '../lib/onboarding.ts';
import { isEditableKeyboardTarget, shortcutsForRole } from '../lib/dashboard-shortcuts.ts';

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

test('first login guide differs for manager and worker, and viewers get none', () => {
  const manager = firstLoginGuide('manager');
  const worker = firstLoginGuide('worker');
  assert.deepEqual(manager.map((step) => step.id), ['overview', 'team', 'tasks', 'inbox', 'payroll', 'checklist']);
  assert.deepEqual(worker.map((step) => step.id), ['today', 'tasks', 'handoffs-safety', 'schedule-profile', 'payroll', 'checklist']);
  assert.deepEqual(firstLoginGuide('viewer'), []);
  assert.equal(manager.find((step) => step.id === 'payroll')?.section, 'more');
  assert.equal(worker.find((step) => step.id === 'payroll')?.target, 'your-pay');
  for (const step of [...manager, ...worker]) {
    assert.ok(step.title.trim());
    assert.ok(step.body.trim());
    assert.ok(step.target.trim());
    assert.ok(step.section.trim());
  }
  assert.notDeepEqual(manager.map((step) => step.target), worker.map((step) => step.target));
});

test('dashboard shortcuts differ by role and ignore editable targets', () => {
  const managerKeys = new Set(shortcutsForRole('manager').map((item) => item.keys));
  const workerKeys = new Set(shortcutsForRole('worker').map((item) => item.keys));
  const viewerKeys = new Set(shortcutsForRole('viewer').map((item) => item.keys));
  assert.ok(managerKeys.has('w'));
  assert.ok(managerKeys.has('n'));
  assert.ok(!workerKeys.has('w'));
  assert.ok(workerKeys.has('p'));
  assert.ok(!viewerKeys.has('w'));
  assert.ok(!viewerKeys.has('n'));
  assert.ok(!viewerKeys.has('p'));
  assert.equal(isEditableKeyboardTarget(null), false);
});
