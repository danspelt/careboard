import assert from 'node:assert/strict';
import test from 'node:test';
import { buildWorkloadWarnings, workloadThresholds } from '../lib/workload-warnings.ts';

test('workload thresholds are bounded and explainable', () => {
  assert.deepEqual(workloadThresholds({ WORKLOAD_MAX_CONSECUTIVE_DAYS: '99', WORKLOAD_MIN_TURNAROUND_HOURS: '0', WORKLOAD_MAX_DAILY_TASKS: '4' }), { maxConsecutiveDays: 7, minTurnaroundHours: 10, maxDailyTasks: 4 });
});

test('warnings use schedule and task evidence without health claims', () => {
  const shifts = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ memberId: 'worker', weekday, startTime: weekday === 2 ? '06:00' : '09:00', endTime: weekday === 1 ? '23:00' : '17:00' }));
  const tasks = Array.from({ length: 4 }, () => ({ assignedTo: 'worker', dueDate: '2026-09-19', status: 'open' })).concat([{ assignedTo: 'worker', dueDate: '2026-09-18', status: 'open' }]);
  const warnings = buildWorkloadWarnings(['worker'], shifts, tasks, '2026-09-19', { maxConsecutiveDays: 6, minTurnaroundHours: 10, maxDailyTasks: 3 });
  assert.deepEqual(warnings.map((warning) => warning.code), ['consecutive_days', 'short_turnaround', 'high_task_load', 'overdue_work']);
  assert.ok(warnings.every((warning) => /configured|CareBoard/.test(warning.explanation)));
});

test('workers receive only their own warning rows when callers scope member ids', () => {
  const warnings = buildWorkloadWarnings(['a'], [], [{ assignedTo: 'b', dueDate: '2026-09-18', status: 'open' }], '2026-09-19');
  assert.deepEqual(warnings, []);
});
