import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildWeekSchedule, nextTaskAction, workerDayPlan } from '../lib/schedule.ts';

const workers = [{ id: 'active', status: 'active' }, { id: 'disabled', status: 'disabled' }];
const task = (overrides = {}) => ({ id: crypto.randomUUID(), title: 'Task', dueDate: null, dueTime: null, status: 'open', priority: 'normal', assignedTo: null, issueOpen: false, ...overrides });

test('week schedule buckets tasks by day and orders them by time, priority, then title', () => {
  const schedule = buildWeekSchedule([
    task({ id: 'late', dueDate: '2026-09-14', dueTime: '17:00' }),
    task({ id: 'early', dueDate: '2026-09-14', dueTime: '08:30' }),
    task({ id: 'urgent-untimed', dueDate: '2026-09-14', priority: 'urgent' }),
    task({ id: 'zeta', dueDate: '2026-09-14' }),
    task({ id: 'alpha', dueDate: '2026-09-14', title: 'Alpha' }),
    task({ id: 'other-day', dueDate: '2026-09-16' }),
    task({ id: 'done', dueDate: '2026-09-14', status: 'complete' }),
  ], workers, '2026-09-13');
  assert.equal(schedule.days.length, 7);
  assert.deepEqual(schedule.days[0].date, '2026-09-13');
  assert.deepEqual(schedule.days[6].date, '2026-09-19');
  assert.deepEqual(schedule.days[1].tasks.map((item) => item.id), ['early', 'late', 'urgent-untimed', 'alpha', 'zeta', 'done']);
  assert.deepEqual(schedule.days[3].tasks.map((item) => item.id), ['other-day']);
});

test('week schedule separates overdue and unscheduled work and counts per-worker load', () => {
  const schedule = buildWeekSchedule([
    task({ id: 'overdue', dueDate: '2026-09-11', assignedTo: 'active' }),
    task({ id: 'today', dueDate: '2026-09-13', assignedTo: 'active' }),
    task({ id: 'tomorrow-unassigned', dueDate: '2026-09-14', issueOpen: true }),
    task({ id: 'floating' }),
    task({ id: 'off-week', dueDate: '2026-09-25' }),
    task({ id: 'disabled-load', dueDate: '2026-09-13', assignedTo: 'disabled' }),
    task({ id: 'done', dueDate: '2026-09-13', status: 'complete', assignedTo: 'active' }),
  ], workers, '2026-09-13');
  assert.deepEqual(schedule.overdue.map((item) => item.id), ['overdue']);
  assert.deepEqual(schedule.unscheduled.map((item) => item.id), ['floating']);
  assert.equal(schedule.days.flatMap((day) => day.tasks).some((item) => item.id === 'off-week'), false);
  assert.equal(schedule.days[0].unassigned, 0);
  assert.equal(schedule.days[1].unassigned, 1);
  assert.equal(schedule.days[1].issues, 1);
  assert.equal(schedule.workload.length, 1);
  assert.deepEqual(schedule.workload[0], { workerId: 'active', byDay: [1, 0, 0, 0, 0, 0, 0], total: 1 });
});

test('the schedule view spans the app’s real fourteen-day horizon', () => {
  const schedule = buildWeekSchedule([
    task({ id: 'week-a', dueDate: '2026-09-15' }),
    task({ id: 'week-b', dueDate: '2026-09-25' }),
    task({ id: 'beyond', dueDate: '2026-09-28' }),
  ], workers, '2026-09-13', 14);
  assert.equal(schedule.days.length, 14);
  assert.equal(schedule.days[13].date, '2026-09-26');
  assert.ok(schedule.days.flatMap((day) => day.tasks).some((item) => item.id === 'week-b'));
  assert.equal(schedule.days.flatMap((day) => day.tasks).some((item) => item.id === 'beyond'), false);
});

test('workerDayPlan splits carried-over work from today’s own and claimable tasks', () => {
  const plan = workerDayPlan([
    task({ id: 'carried', dueDate: '2026-09-14', assignedTo: 'me' }),
    task({ id: 'carried-done', dueDate: '2026-09-14', assignedTo: 'me', status: 'complete' }),
    task({ id: 'not-mine', dueDate: '2026-09-14', assignedTo: 'other' }),
    task({ id: 'mine-today', dueDate: '2026-09-15', assignedTo: 'me', dueTime: '09:00' }),
    task({ id: 'claimable-today', dueDate: '2026-09-15', dueTime: '08:00' }),
    task({ id: 'other-today', dueDate: '2026-09-15', assignedTo: 'other' }),
    task({ id: 'done-today', dueDate: '2026-09-15', assignedTo: 'me', status: 'complete' }),
    task({ id: 'undated' }),
    task({ id: 'mine-tomorrow', dueDate: '2026-09-16', assignedTo: 'me' }),
  ], 'me', '2026-09-15');
  assert.deepEqual(plan.carriedOver.map((item) => item.id), ['carried']);
  assert.deepEqual(plan.today.map((item) => item.id), ['claimable-today', 'mine-today', 'done-today']);
});

test('workerDayPlan keeps an in-progress carried-over task and orders today by time', () => {
  const plan = workerDayPlan([
    task({ id: 'late', dueDate: '2026-09-15', assignedTo: 'me', dueTime: '17:00' }),
    task({ id: 'early', dueDate: '2026-09-15', assignedTo: 'me', dueTime: '07:30' }),
    task({ id: 'half-done', dueDate: '2026-09-13', assignedTo: 'me', status: 'in_progress' }),
  ], 'me', '2026-09-15');
  assert.deepEqual(plan.carriedOver.map((item) => item.id), ['half-done']);
  assert.deepEqual(plan.today.map((item) => item.id), ['early', 'late']);
});

test('nextTaskAction gives each task a single next step for the caregiver', () => {
  assert.equal(nextTaskAction(task({ assignedTo: null, status: 'open' }), 'me'), 'claim');
  assert.equal(nextTaskAction(task({ assignedTo: 'me', status: 'open' }), 'me'), 'start');
  assert.equal(nextTaskAction(task({ assignedTo: 'me', status: 'in_progress' }), 'me'), 'complete');
  assert.equal(nextTaskAction(task({ assignedTo: 'me', status: 'complete' }), 'me'), null);
  assert.equal(nextTaskAction(task({ assignedTo: 'other', status: 'open' }), 'me'), null);
  assert.equal(nextTaskAction(task({ assignedTo: 'other', status: 'in_progress' }), 'me'), null);
  assert.equal(nextTaskAction(task({ assignedTo: null, status: 'in_progress' }), 'me'), null);
});
