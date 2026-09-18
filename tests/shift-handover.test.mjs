import assert from 'node:assert/strict';
import { test } from 'node:test';
import { handoverHasContent, incomingHandover, myHandoverFor, sortHandovers, suggestedCompletedSummary, suggestedPendingSummary } from '../lib/shift-handover.ts';

const handover = (overrides = {}) => ({
  id: crypto.randomUUID(),
  memberId: 'worker-a',
  shiftDate: '2026-09-18',
  completedSummary: '',
  pendingSummary: '',
  notes: '',
  createdAt: '2026-09-18T16:00:00.000Z',
  ...overrides,
});

test('a handover needs at least one section filled in', () => {
  assert.equal(handoverHasContent(handover()), false);
  assert.equal(handoverHasContent(handover({ notes: '   ' })), false);
  assert.equal(handoverHasContent(handover({ completedSummary: 'Breakfast served' })), true);
  assert.equal(handoverHasContent(handover({ pendingSummary: 'Laundry' })), true);
  assert.equal(handoverHasContent(handover({ notes: 'Client slept poorly' })), true);
});

test('the incoming handover is the newest one written by someone else', () => {
  const own = handover({ id: 'own', memberId: 'worker-a', createdAt: '2026-09-18T18:00:00.000Z' });
  const older = handover({ id: 'older', memberId: 'worker-b', createdAt: '2026-09-17T16:00:00.000Z' });
  const newer = handover({ id: 'newer', memberId: 'worker-c', createdAt: '2026-09-18T08:00:00.000Z' });
  assert.equal(incomingHandover([own, older, newer], 'worker-a')?.id, 'newer');
  assert.equal(incomingHandover([own], 'worker-a'), null);
  assert.equal(incomingHandover([], 'worker-a'), null);
});

test('a worker edits their own handover for the day rather than duplicating it', () => {
  const today = handover({ id: 'today', createdAt: '2026-09-18T09:00:00.000Z' });
  const resaved = handover({ id: 'resaved', createdAt: '2026-09-18T17:00:00.000Z' });
  const yesterday = handover({ id: 'yesterday', shiftDate: '2026-09-17' });
  const other = handover({ id: 'other', memberId: 'worker-b' });
  assert.equal(myHandoverFor([today, resaved, yesterday, other], 'worker-a', '2026-09-18')?.id, 'resaved');
  assert.equal(myHandoverFor([yesterday], 'worker-a', '2026-09-18'), null);
});

test('handovers are listed newest first without mutating the source list', () => {
  const list = [
    handover({ id: 'old', createdAt: '2026-09-16T16:00:00.000Z' }),
    handover({ id: 'new', createdAt: '2026-09-18T16:00:00.000Z' }),
    handover({ id: 'mid', createdAt: '2026-09-17T16:00:00.000Z' }),
  ];
  assert.deepEqual(sortHandovers(list).map(({ id }) => id), ['new', 'mid', 'old']);
  assert.deepEqual(list.map(({ id }) => id), ['old', 'new', 'mid']);
});

test('the form is prefilled from the shift tasks', () => {
  assert.equal(suggestedCompletedSummary([{ title: 'Breakfast' }, { title: 'Medication' }]), 'Breakfast\nMedication');
  assert.equal(suggestedPendingSummary([{ title: 'Laundry' }]), 'Laundry');
  assert.equal(suggestedCompletedSummary([]), '');
});
