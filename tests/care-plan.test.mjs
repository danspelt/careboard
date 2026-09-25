import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canCompleteAppointment, careProfileCompleteness, doseAlertMessage, emptyCareProfile, kudosCounts, medicationRound,
  parseDoseTimes, resolveDoseDate, supplyList, upcomingAppointments, validateAppointment, validateCareProfile, validateDoseLog,
  validateKudos, validateMedication, validateSupplyItem, visibleKudos,
} from '../lib/care-plan.ts';

const today = '2026-09-25';
const med = (overrides = {}) => ({ id: 'm1', name: 'Metformin', dose: '500 mg', instructions: 'With food', times: ['08:00', '18:00'], prn: false, active: true, createdAt: 'x', updatedAt: 'x', ...overrides });

test('dose times are validated, de-duplicated, and sorted', () => {
  assert.deepEqual(parseDoseTimes('18:00, 08:00 08:00'), ['08:00', '18:00']);
  assert.deepEqual(parseDoseTimes(['12:30']), ['12:30']);
  assert.throws(() => parseDoseTimes('8am'), /not a valid time/);
});

test('medications need a name and a schedule unless they are as-needed', () => {
  assert.deepEqual(validateMedication({ name: ' Vitamin D ', dose: '1000 IU', times: '08:00' }), { name: 'Vitamin D', dose: '1000 IU', instructions: '', times: ['08:00'], prn: false });
  assert.deepEqual(validateMedication({ name: 'Acetaminophen', prn: 'on', times: '08:00' }).times, []);
  assert.throws(() => validateMedication({ name: ' ', times: '08:00' }), /medication name/);
  assert.throws(() => validateMedication({ name: 'Metformin', times: '' }), /at least one scheduled time/);
});

test('dose logs require an explanation whenever a dose is not given', () => {
  assert.deepEqual(validateDoseLog({ outcome: 'given', scheduledTime: '08:00' }, med(), today, []), { doseDate: today, scheduledTime: '08:00', outcome: 'given', note: '' });
  assert.throws(() => validateDoseLog({ outcome: 'refused', scheduledTime: '08:00' }, med(), today, []), /why the dose was not given/);
  assert.equal(validateDoseLog({ outcome: 'held', scheduledTime: '18:00', note: 'Doctor advised' }, med(), today, []).outcome, 'held');
  assert.throws(() => validateDoseLog({ outcome: 'skipped', scheduledTime: '08:00' }, med(), today, []), /given, refused, missed, or held/);
});

test('dose logs reject unknown times, duplicates, and archived medications', () => {
  assert.throws(() => validateDoseLog({ outcome: 'given', scheduledTime: '09:00' }, med(), today, []), /scheduled dose times/);
  assert.throws(() => validateDoseLog({ outcome: 'given', scheduledTime: '08:00' }, med(), today, [{ doseDate: today, scheduledTime: '08:00' }]), /already logged/);
  assert.doesNotThrow(() => validateDoseLog({ outcome: 'given', scheduledTime: '08:00' }, med(), today, [{ doseDate: '2026-09-24', scheduledTime: '08:00' }]));
  assert.throws(() => validateDoseLog({ outcome: 'given', scheduledTime: '08:00' }, med({ active: false }), today, []), /no longer on the care plan/);
  assert.throws(() => validateDoseLog({ outcome: 'given' }, null, today, []), /no longer on the care plan/);
});

test('as-needed doses need a reason and are never tied to a schedule slot', () => {
  const prn = med({ prn: true, times: [] });
  assert.deepEqual(validateDoseLog({ outcome: 'given', note: 'Headache' }, prn, today, [{ doseDate: today, scheduledTime: null }]), { doseDate: today, scheduledTime: null, outcome: 'given', note: 'Headache' });
  assert.throws(() => validateDoseLog({ outcome: 'given' }, prn, today, []), /why the as-needed dose was given/);
  assert.throws(() => validateDoseLog({ outcome: 'missed', note: 'x' }, prn, today, []), /given or refused/);
});

test('dose dates follow the caregiver device but cannot be back- or forward-dated', () => {
  // 18:00 in Vancouver is already the next UTC day on the server.
  const serverToday = '2026-09-26';
  assert.equal(resolveDoseDate('2026-09-25', serverToday), '2026-09-25');
  assert.equal(resolveDoseDate(undefined, serverToday), serverToday);
  assert.throws(() => resolveDoseDate('2026-09-20', serverToday), /only be logged for today/);
  assert.throws(() => resolveDoseDate('2026-09-28', serverToday), /only be logged for today/);
  assert.throws(() => resolveDoseDate('nope', serverToday), /valid dose date/);
  const logged = validateDoseLog({ outcome: 'given', scheduledTime: '18:00', doseDate: '2026-09-25' }, med(), serverToday, []);
  assert.equal(logged.doseDate, '2026-09-25');
  assert.throws(() => validateDoseLog({ outcome: 'given', scheduledTime: '18:00', doseDate: '2026-09-25' }, med(), serverToday, [{ doseDate: '2026-09-25', scheduledTime: '18:00' }]), /already logged/);
});

test('medication round derives upcoming, due, overdue, and logged statuses', () => {
  const medications = [med(), med({ id: 'm2', name: 'Vitamin D', times: ['08:00'] }), med({ id: 'm3', name: 'Old', active: false }), med({ id: 'p1', name: 'Acetaminophen', prn: true, times: [] })];
  const logs = [
    { id: 'l1', medicationId: 'm2', doseDate: today, scheduledTime: '08:00', outcome: 'refused', note: 'Asleep', loggedBy: 'w', loggedAt: 'x' },
    { id: 'l2', medicationId: 'p1', doseDate: today, scheduledTime: null, outcome: 'given', note: 'Pain', loggedBy: 'w', loggedAt: 'x' },
    { id: 'l3', medicationId: 'm1', doseDate: '2026-09-24', scheduledTime: '08:00', outcome: 'given', note: '', loggedBy: 'w', loggedAt: 'x' },
  ];
  const round = medicationRound(medications, logs, today, '09:30');
  assert.deepEqual(round.slots.map((slot) => `${slot.scheduledTime} ${slot.medication.name} ${slot.status}`), ['08:00 Metformin overdue', '08:00 Vitamin D refused', '18:00 Metformin upcoming']);
  assert.deepEqual(round.counts, { total: 3, given: 0, pending: 1, overdue: 1, exceptions: 1 });
  assert.deepEqual(round.prnMedications.map((item) => item.id), ['p1']);
  assert.deepEqual(round.prnLogs.map((item) => item.id), ['l2']);
  assert.equal(medicationRound([med()], [], today, '08:45').slots[0].status, 'due');
});

test('dose alerts describe the exception without dropping the note', () => {
  assert.equal(doseAlertMessage('Alex', 'Metformin', '08:00', 'refused', 'Felt nauseous'), 'Medication refused: Alex logged the 08:00 dose of Metformin as refused. Note: Felt nauseous');
  assert.match(doseAlertMessage('Alex', 'Acetaminophen', null, 'refused', 'No pain'), /an as-needed dose of Acetaminophen/);
});

test('about-me profile trims every section and rejects an empty profile', () => {
  const profile = validateCareProfile({ preferredName: ' Sam ', likes: 'Jazz', unknown: 'ignored' });
  assert.equal(profile.preferredName, 'Sam');
  assert.equal(profile.likes, 'Jazz');
  assert.equal(profile.importantToKnow, '');
  assert.ok(!('unknown' in profile));
  assert.throws(() => validateCareProfile({ preferredName: '  ' }), /at least one section/);
  assert.deepEqual(careProfileCompleteness(profile), { filled: 2, total: 9 });
  assert.deepEqual(careProfileCompleteness(null), { filled: 0, total: 9 });
  assert.equal(emptyCareProfile().updatedAt, null);
});

test('appointments are validated and only the manager or companion can close them', () => {
  const appointment = validateAppointment({ title: ' Dentist ', date: '2026-09-30', time: '14:15', accompanyingId: 'worker-a' }, today);
  assert.deepEqual(appointment, { title: 'Dentist', date: '2026-09-30', time: '14:15', location: '', notes: '', accompanyingId: 'worker-a' });
  assert.throws(() => validateAppointment({ title: 'x', date: '2026-09-01' }, today), /today or later/);
  assert.throws(() => validateAppointment({ title: '', date: today }, today), /what the appointment is for/);
  assert.throws(() => validateAppointment({ title: 'x', date: today, time: '25:00' }, today), /valid appointment time/);
  assert.equal(canCompleteAppointment('manager', 'm', { status: 'scheduled', accompanyingId: null }), true);
  assert.equal(canCompleteAppointment('worker', 'worker-a', { status: 'scheduled', accompanyingId: 'worker-a' }), true);
  assert.equal(canCompleteAppointment('worker', 'worker-b', { status: 'scheduled', accompanyingId: 'worker-a' }), false);
  assert.equal(canCompleteAppointment('manager', 'm', { status: 'cancelled', accompanyingId: null }), false);
  assert.equal(canCompleteAppointment('viewer', 'v', { status: 'scheduled', accompanyingId: 'v' }), false);
});

test('upcoming appointments are scheduled, in range, and sorted by date then time', () => {
  const items = [
    { id: 'late', date: '2026-10-01', time: null, status: 'scheduled' },
    { id: 'pm', date: today, time: '15:00', status: 'scheduled' },
    { id: 'am', date: today, time: '09:00', status: 'scheduled' },
    { id: 'past', date: '2026-09-20', time: '09:00', status: 'scheduled' },
    { id: 'done', date: today, time: '10:00', status: 'done' },
    { id: 'far', date: '2026-12-25', time: '10:00', status: 'scheduled' },
  ];
  assert.deepEqual(upcomingAppointments(items, today).map((item) => item.id), ['am', 'pm', 'late']);
});

test('shout-outs go to active teammates, never to yourself or family viewers', () => {
  const recipient = { id: 'worker-b', role: 'worker', status: 'active' };
  assert.deepEqual(validateKudos({ badge: 'teamwork', message: ' Thanks! ' }, 'worker-a', recipient), { recipientId: 'worker-b', badge: 'teamwork', message: 'Thanks!' });
  assert.throws(() => validateKudos({ badge: 'teamwork' }, 'worker-b', recipient), /pick someone else/);
  assert.throws(() => validateKudos({ badge: 'teamwork' }, 'worker-a', { id: 'v', role: 'viewer', status: 'active' }), /active care team member/);
  assert.throws(() => validateKudos({ badge: 'teamwork' }, 'worker-a', { ...recipient, status: 'disabled' }), /active care team member/);
  assert.throws(() => validateKudos({ badge: 'constructor' }, 'worker-a', recipient), /what you are recognizing/);
  assert.deepEqual(visibleKudos('viewer', [1, 2]), []);
  assert.deepEqual(visibleKudos('worker', [1, 2]), [1, 2]);
  const counts = kudosCounts([{ recipientId: 'a', createdAt: '2026-09-20' }, { recipientId: 'a', createdAt: '2026-09-24' }, { recipientId: 'b', createdAt: '2026-08-01' }], '2026-09-01');
  assert.equal(counts.get('a'), 2);
  assert.equal(counts.get('b'), undefined);
});

test('supplies list puts urgent needs first and keeps a week of purchases', () => {
  assert.deepEqual(validateSupplyItem({ name: ' Gloves ', quantity: '2 boxes', urgency: 'bogus' }), { name: 'Gloves', quantity: '2 boxes', urgency: 'normal' });
  assert.throws(() => validateSupplyItem({ name: ' ' }), /item that is needed/);
  const now = '2026-09-25T12:00:00.000Z';
  const items = [
    { id: 'wipes', urgency: 'normal', purchasedAt: null, createdAt: '2026-09-20' },
    { id: 'gloves', urgency: 'out', purchasedAt: null, createdAt: '2026-09-24' },
    { id: 'soap', urgency: 'soon', purchasedAt: null, createdAt: '2026-09-21' },
    { id: 'milk', urgency: 'soon', purchasedAt: '2026-09-24T10:00:00.000Z', createdAt: '2026-09-23' },
    { id: 'old', urgency: 'normal', purchasedAt: '2026-09-01T10:00:00.000Z', createdAt: '2026-08-30' },
  ];
  const list = supplyList(items, now);
  assert.deepEqual(list.needed.map((item) => item.id), ['gloves', 'soap', 'wipes']);
  assert.deepEqual(list.recentlyBought.map((item) => item.id), ['milk']);
});
