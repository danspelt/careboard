import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attentionReasons, buildShiftHandoff } from '../lib/shift-handoff.ts';

const date = '2026-09-11';
const task = (overrides = {}) => ({ id: crypto.randomUUID(), status: 'open', priority: 'normal', dueDate: date, assignedTo: 'worker', notes: [], ...overrides });

test('handoff includes only the worker assignments and explains priority deterministically', () => {
  const issue = task({ id: 'issue', issueOpen: true, issueReport: 'Supplies unavailable' });
  const overdue = task({ id: 'overdue', dueDate: '2026-09-10', priority: 'urgent' });
  const other = task({ id: 'private', assignedTo: 'another-worker', issueOpen: true });
  const handoff = buildShiftHandoff([issue, overdue, other], 'worker', date);
  assert.deepEqual(handoff.attention.map(({ id }) => id), ['issue', 'overdue']);
  assert.deepEqual(attentionReasons(issue, date), ['Open issue', 'Due today']);
  assert.deepEqual(attentionReasons(overdue, date), ['Overdue', 'Urgent priority']);
  assert.ok(!handoff.attention.includes(other));
});

test('handoff summarizes todays assignments, completions, and newest notes', () => {
  const completedToday = task({ id: 'done', status: 'complete', completedAt: `${date}T17:00:00Z`, notes: [{ id: 'new', kind: 'completion', body: 'Finished', createdAt: `${date}T17:00:00Z` }] });
  const completedEarlier = task({ id: 'old-done', status: 'complete', completedAt: '2026-09-10T17:00:00Z' });
  const todayTask = task({ id: 'today', notes: [{ id: 'old', kind: 'progress', body: 'Started', createdAt: `${date}T09:00:00Z` }] });
  const future = task({ id: 'future', dueDate: '2026-09-12' });
  const handoff = buildShiftHandoff([completedToday, completedEarlier, todayTask, future], 'worker', date);
  assert.deepEqual(handoff.assigned.map(({ id }) => id), ['today']);
  assert.deepEqual(handoff.completed.map(({ id }) => id), ['done']);
  assert.deepEqual(handoff.latestNotes.map(({ id }) => id), ['new', 'old']);
});
