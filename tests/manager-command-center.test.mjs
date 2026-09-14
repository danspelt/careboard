import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildManagerCommandCenter } from '../lib/manager-command-center.ts';

const workers = [{ id: 'active', status: 'active' }, { id: 'disabled', status: 'disabled' }];
const task = (overrides = {}) => ({ id: crypto.randomUUID(), status: 'open', priority: 'normal', dueDate: null, assignedTo: null, issueOpen: false, completedAt: null, notes: [], ...overrides });

test('manager command center ranks exceptions and excludes disabled workers from coverage', () => {
  const state = buildManagerCommandCenter([
    task({ id: 'today', dueDate: '2026-09-13', assignedTo: 'active' }),
    task({ id: 'issue', dueDate: '2026-09-14', assignedTo: 'active', issueOpen: true }),
    task({ id: 'overdue', dueDate: '2026-09-12', assignedTo: 'active' }),
    task({ id: 'unassigned', dueDate: '2026-09-13' }),
  ], workers, '2026-09-13');
  assert.deepEqual(state.attention.map((item) => item.id), ['issue', 'overdue', 'unassigned', 'today']);
  assert.equal(state.coverage.length, 1);
  assert.deepEqual(state.coverage[0], { workerId: 'active', dueToday: 1, inProgress: 0, overdue: 1 });
  assert.equal(state.unassignedDueToday, 1);
});

test('manager command center returns recent notes and a stable seven-day completion trend', () => {
  const state = buildManagerCommandCenter([
    task({ id: 'done', status: 'complete', completedAt: '2026-09-13T18:00:00Z', notes: [
      { id: 'old', kind: 'progress', body: 'Started', createdAt: '2026-09-12T10:00:00Z' },
      { id: 'new', kind: 'completion', body: 'Finished', createdAt: '2026-09-13T18:00:00Z' },
    ] }),
  ], workers, '2026-09-13');
  assert.deepEqual(state.recentHandoffs.map((note) => note.id), ['new', 'old']);
  assert.equal(state.completionTrend.length, 7);
  assert.deepEqual(state.completionTrend.at(-1), { date: '2026-09-13', completed: 1 });
  assert.equal(state.completedToday, 1);
});
