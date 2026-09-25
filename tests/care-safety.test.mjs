import assert from 'node:assert/strict';
import test from 'node:test';
import { triageSafetyIncident, validateSafetyIncident, validateShiftHandoff, visibleSafetyIncidents, visibleShiftHandoffs } from '../lib/care-safety.ts';

const today = '2026-09-19';
const now = '2026-09-19T14:30:00.000Z';

test('shift handoff validation normalizes checklist lines and optional fields', () => {
  const result = validateShiftHandoff({
    shiftDate: today,
    completedCare: '  Medication and lunch done  ',
    outstandingTasks: '',
    observations: '  ',
    checklist: 'Medication given\n\nIssues flagged\n'.repeat(1),
  }, today);
  assert.equal(result.shiftDate, today);
  assert.equal(result.completedCare, 'Medication and lunch done');
  assert.equal(result.outstandingTasks, '');
  assert.deepEqual(result.checklist, ['Medication given', 'Issues flagged']);
});

test('shift handoff validation rejects future dates and empty summaries', () => {
  assert.throws(() => validateShiftHandoff({ shiftDate: '2026-09-20', completedCare: 'Done' }, today), /already happened/);
  assert.throws(() => validateShiftHandoff({ shiftDate: today, completedCare: '   ' }, today), /care you completed/);
  assert.throws(() => validateShiftHandoff({ shiftDate: 'not-a-date', completedCare: 'Done' }, today), /valid shift date/);
});

test('safety incident validation enforces category, severity, and a past timestamp', () => {
  const incident = validateSafetyIncident({
    category: 'near_miss', severity: 'high', occurredAt: '2026-09-19T08:15',
    location: ' Front steps ', description: ' Client almost fell ', immediateAction: ' Area dried ',
  }, now);
  assert.equal(incident.category, 'near_miss');
  assert.equal(incident.location, 'Front steps');
  assert.throws(() => validateSafetyIncident({ category: 'other', severity: 'low', occurredAt: '2026-09-19T08:15', location: 'x', description: 'x' }, now), /kind of safety concern/);
  assert.throws(() => validateSafetyIncident({ category: 'hazard', severity: 'extreme', occurredAt: '2026-09-19T08:15', location: 'x', description: 'x' }, now), /how serious/);
  assert.throws(() => validateSafetyIncident({ category: 'hazard', severity: 'low', occurredAt: '2026-09-20T08:15', location: 'x', description: 'x' }, now), /future/);
  assert.throws(() => validateSafetyIncident({ category: 'hazard', severity: 'low', occurredAt: '2026-09-19T08:15', location: ' ', description: 'x' }, now), /where it happened/);
});

test('incident triage moves forward and resolved reports cannot change', () => {
  assert.deepEqual(triageSafetyIncident({ status: 'submitted' }, { status: 'reviewing', assignedTo: 'member-manager', followUp: ' Checking in ' }), { status: 'reviewing', followUp: 'Checking in', assignedTo: 'member-manager', resolved: false });
  assert.deepEqual(triageSafetyIncident({ status: 'reviewing' }, { status: 'resolved' }), { status: 'resolved', followUp: '', assignedTo: null, resolved: true });
  assert.throws(() => triageSafetyIncident({ status: 'resolved' }, { status: 'reviewing' }), /already resolved/);
});

test('handoffs stay private to author, manager, and covering worker', () => {
  const handoffs = [
    { id: 'h1', authorId: 'worker-a', shiftDate: '2026-09-18' },
    { id: 'h2', authorId: 'worker-b', shiftDate: '2026-09-18' },
    { id: 'h3', authorId: 'worker-a', shiftDate: '2026-09-17' },
  ];
  assert.deepEqual(visibleShiftHandoffs('manager', 'member-manager', handoffs, []).map((h) => h.id), ['h1', 'h2', 'h3']);
  const coverage = [{ requesterId: 'worker-a', requestedDate: '2026-09-18', acceptedBy: 'worker-b' }];
  assert.deepEqual(visibleShiftHandoffs('worker', 'worker-b', handoffs, coverage).map((h) => h.id), ['h1', 'h2']);
  assert.deepEqual(visibleShiftHandoffs('worker', 'worker-c', handoffs, coverage), []);
  assert.deepEqual(visibleShiftHandoffs('viewer', 'viewer-1', handoffs, []), []);
});

test('safety reports are visible only to the reporter and the manager', () => {
  const incidents = [{ id: 'i1', reporterId: 'worker-a' }, { id: 'i2', reporterId: 'worker-b' }];
  assert.deepEqual(visibleSafetyIncidents('manager', 'member-manager', incidents).map((i) => i.id), ['i1', 'i2']);
  assert.deepEqual(visibleSafetyIncidents('worker', 'worker-a', incidents).map((i) => i.id), ['i1']);
  assert.deepEqual(visibleSafetyIncidents('viewer', 'viewer-1', incidents), []);
});
