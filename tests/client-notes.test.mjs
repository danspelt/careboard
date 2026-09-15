import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import Database from 'better-sqlite3';
import {
  canReviewClientNote,
  canSendInboxMessage,
  canSubmitClientNote,
  canViewClientNoteImage,
  normalizeClientNoteText,
  reviewClientNote,
  triageInboxMessage,
  visibleInbox,
  visibleSafetyAlerts,
} from '../lib/client-notes.ts';

test('client-note permissions and review transitions fail closed', () => {
  assert.equal(canSubmitClientNote('worker'), true);
  assert.equal(canSubmitClientNote('manager'), false);
  assert.equal(canSubmitClientNote('viewer'), false);
  assert.equal(canReviewClientNote('manager'), true);
  assert.equal(canReviewClientNote('worker'), false);
  assert.deepEqual(reviewClientNote('pending', 'approve', ' Checked text \n\n\n'), { status: 'approved', approvedText: 'Checked text' });
  assert.deepEqual(reviewClientNote('pending', 'reject', 'ignored'), { status: 'rejected', approvedText: null });
  assert.throws(() => reviewClientNote('approved', 'reject', ''), /already been reviewed/);
  assert.throws(() => reviewClientNote('rejected', 'approve', 'text'), /already been reviewed/);
  assert.throws(() => reviewClientNote('pending', 'approve', '  '), /require reviewed text/);
  assert.equal(normalizeClientNoteText('a  \r\n\n\n\nb', 20), 'a\n\nb');
});

test('inbox visibility includes only participants for workers and everything for manager', () => {
  const items = [
    { id: 'to-a', workerId: 'a', createdBy: 'manager' },
    { id: 'a-to-b', workerId: 'b', createdBy: 'a' },
    { id: 'b-to-c', workerId: 'c', createdBy: 'b' },
  ];
  assert.deepEqual(visibleInbox('worker', 'a', items).map((item) => item.id), ['to-a', 'a-to-b']);
  assert.deepEqual(visibleInbox('worker', 'c', items).map((item) => item.id), ['b-to-c']);
  assert.deepEqual(visibleInbox('manager', 'manager', items), items);
  assert.deepEqual(visibleInbox('viewer', 'viewer', items), []);
});

test('message authorization is limited to active care-team participants', () => {
  const worker = { id: 'worker-b', role: 'worker', status: 'active' };
  const manager = { id: 'manager', role: 'manager', status: 'active' };
  assert.equal(canSendInboxMessage('worker', 'worker-a', worker), true);
  assert.equal(canSendInboxMessage('worker', 'worker-a', manager), true);
  assert.equal(canSendInboxMessage('manager', 'manager', worker), true);
  assert.equal(canSendInboxMessage('manager', 'manager', manager), false);
  assert.equal(canSendInboxMessage('viewer', 'viewer', worker), false);
  assert.equal(canSendInboxMessage('worker', 'worker-a', { ...worker, status: 'disabled' }), false);
});

test('local safety triage flags specific urgent phrases without broad keyword false positives', () => {
  assert.equal(triageInboxMessage('Please update the medication list tomorrow.'), null);
  assert.equal(triageInboxMessage('We discussed safety and support.'), null);
  assert.equal(triageInboxMessage('Client has chest pain and looks pale.')?.category, 'emergency');
  assert.equal(triageInboxMessage('I gave the wrong dose.')?.category, 'medication');
  assert.equal(triageInboxMessage('They threatened to hurt her.')?.category, 'threat');
  assert.equal(triageInboxMessage('I believe the client was slapped.')?.category, 'abuse');
});

test('safety alert metadata is manager-only', () => {
  const items = [{ id: 'alert', safetyCategory: 'emergency', safetyReason: 'Possible emergency' }, { id: 'plain', safetyCategory: null, safetyReason: null }];
  assert.deepEqual(visibleSafetyAlerts('manager', items).map((item) => item.id), ['alert']);
  assert.deepEqual(visibleSafetyAlerts('worker', items), []);
  assert.deepEqual(visibleSafetyAlerts('viewer', items), []);
});

test('source image visibility protects pending and rejected submissions', () => {
  assert.equal(canViewClientNoteImage('manager', 'manager', 'worker-a', 'pending'), true);
  assert.equal(canViewClientNoteImage('worker', 'worker-a', 'worker-a', 'rejected'), true);
  assert.equal(canViewClientNoteImage('worker', 'worker-b', 'worker-a', 'pending'), false);
  assert.equal(canViewClientNoteImage('worker', 'worker-b', 'worker-a', 'approved'), true);
  assert.equal(canViewClientNoteImage('viewer', 'viewer', 'worker-a', 'approved'), false);
});

test('migration persists review state, messages, and original safety-triaged text', () => {
  const db = new Database(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec('CREATE TABLE members(id TEXT PRIMARY KEY); CREATE TABLE proof_photos(id TEXT PRIMARY KEY);');
  for (const file of ['0012_client_notes.sql', '0013_inbox_safety.sql', '0014_inbox_direct_message.sql']) {
    const migration = readFileSync(new URL(`../drizzle/${file}`, import.meta.url), 'utf8');
    for (const statement of migration.split('--> statement-breakpoint').map((value) => value.trim()).filter(Boolean)) db.exec(statement);
  }
  db.prepare('INSERT INTO members(id) VALUES (?),(?),(?)').run('manager', 'worker-a', 'worker-b');
  db.prepare('INSERT INTO proof_photos(id) VALUES (?)').run('photo');
  db.prepare(`INSERT INTO client_note_submissions(id,client_member_id,submitted_by,source_photo_id,ocr_text,status,created_at) VALUES(?,?,?,?,?,'pending',?)`).run('note', 'manager', 'worker-a', 'photo', 'OCR original', '2026-09-14T00:00:00Z');
  assert.equal(db.prepare("SELECT COUNT(*) count FROM client_note_submissions WHERE status='approved'").get().count, 0);
  db.prepare("UPDATE client_note_submissions SET status='approved', approved_text=?, reviewed_by=?, reviewed_at=? WHERE id=? AND status='pending'").run('Manager reviewed', 'manager', '2026-09-14T01:00:00Z', 'note');
  assert.deepEqual(db.prepare("SELECT ocr_text ocrText, approved_text approvedText FROM client_note_submissions WHERE status='approved'").get(), { ocrText: 'OCR original', approvedText: 'Manager reviewed' });
  const original = 'Client has chest pain; call 911.';
  db.prepare(`INSERT INTO worker_inbox_items(id,worker_id,kind,body,created_by,safety_category,safety_reason,created_at) VALUES(?,?,?,?,?,?,?,?)`).run('message', 'worker-b', 'direct_message', original, 'worker-a', 'emergency', 'Possible emergency', '2026-09-14T02:00:00Z');
  assert.equal(db.prepare('SELECT body FROM worker_inbox_items WHERE id=?').get('message').body, original);
  db.close();
});

test('upload route validates and OCRs before persisting, while review remains manager-only', () => {
  const route = readFileSync(new URL('../app/api/client-notes/route.ts', import.meta.url), 'utf8');
  const household = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
  assert.match(route, /validateUpload\(file\.type, file\.size, bytes\)/);
  assert.ok(route.indexOf('extractClientNoteText') < route.indexOf('writeFile(destination'));
  assert.match(route, /canSubmitClientNote\(access\.role\)/);
  assert.match(household, /'reviewClientNote'/);
  assert.match(household, /managerOnly\.includes\(action\)/);
  assert.match(household, /safety_alert_reviewed/);
});
