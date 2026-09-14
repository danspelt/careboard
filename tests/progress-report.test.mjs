import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildProgressReport } from '../lib/progress-report.ts';

const workers = [{ id: 'w1', status: 'active' }, { id: 'w2', status: 'active' }, { id: 'gone', status: 'disabled' }];
const task = (overrides = {}) => ({ id: crypto.randomUUID(), area: 'Kitchen', status: 'open', dueDate: null, assignedTo: null, completedBy: null, completedAt: null, issueOpen: false, notes: [], ...overrides });
const note = (overrides = {}) => ({ id: crypto.randomUUID(), memberId: 'w1', kind: 'issue', createdAt: '2026-09-10T09:00:00Z', ...overrides });

test('progress report covers a 30-day window with on-time and issue metrics', () => {
  const report = buildProgressReport([
    task({ id: 'on-time', status: 'complete', dueDate: '2026-09-10', completedAt: '2026-09-10T15:00:00Z', completedBy: 'w1', area: 'Kitchen' }),
    task({ id: 'late', status: 'complete', dueDate: '2026-09-08', completedAt: '2026-09-11T15:00:00Z', completedBy: 'w2', area: 'Bathroom' }),
    task({ id: 'too-old', status: 'complete', completedAt: '2026-08-10T15:00:00Z', completedBy: 'w1' }),
    task({ id: 'not-done', status: 'in_progress' }),
    task({ id: 'open-issue', issueOpen: true, notes: [note()] }),
  ], workers, '2026-09-13');
  assert.equal(report.start, '2026-08-15');
  assert.equal(report.end, '2026-09-13');
  assert.equal(report.completed, 2);
  assert.equal(report.onTime, 1);
  assert.equal(report.onTimeRate, 50);
  assert.equal(report.issuesOpened, 1);
  assert.equal(report.openIssues, 1);
  assert.deepEqual(report.byArea, [{ area: 'Bathroom', count: 1 }, { area: 'Kitchen', count: 1 }]);
  assert.equal(report.weekly.length, 5);
});

test('progress report attributes completions and issues per active worker', () => {
  const report = buildProgressReport([
    task({ status: 'complete', completedAt: '2026-09-12T10:00:00Z', completedBy: 'w1', dueDate: '2026-09-12' }),
    task({ status: 'complete', completedAt: '2026-09-12T10:00:00Z', assignedTo: 'w2', dueDate: null }),
    task({ status: 'complete', completedAt: '2026-09-12T10:00:00Z', completedBy: 'gone' }),
    task({ notes: [note({ memberId: 'w2' })] }),
  ], workers, '2026-09-13');
  const w1 = report.perWorker.find((worker) => worker.workerId === 'w1');
  const w2 = report.perWorker.find((worker) => worker.workerId === 'w2');
  assert.equal(report.perWorker.length, 2);
  assert.deepEqual({ completed: w1.completed, onTimeRate: w1.onTimeRate }, { completed: 1, onTimeRate: 100 });
  assert.deepEqual({ completed: w2.completed, onTimeRate: w2.onTimeRate, issues: w2.issues }, { completed: 1, onTimeRate: 0, issues: 1 });
});
