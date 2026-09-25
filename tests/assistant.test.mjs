import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { assistantContext, assistantInstructions, safeAssistantError, validateAssistantMessages } from '../lib/assistant.ts';

const base = {
  viewer: { id: 'worker-a', role: 'worker' }, activity: [], reminders: [],
  members: [
    { id: 'worker-a', name: 'Alice', role: 'worker', status: 'active', phone: '111', hourlyRate: 25 },
    { id: 'worker-b', name: 'Bob', role: 'worker', status: 'active', phone: '222', hourlyRate: 30 },
  ],
  chores: [
    { id: 'mine', title: 'Mine', assignedTo: 'worker-a', status: 'open', instructions: 'Do mine' },
    { id: 'open', title: 'Available', assignedTo: null, status: 'open', instructions: 'Available work' },
    { id: 'private', title: 'Other private task', assignedTo: 'worker-b', status: 'open', instructions: 'Private detail' },
  ],
  shifts: [
    { id: 'a-shift', memberId: 'worker-a', weekday: 1, startTime: '09:00', endTime: '17:00', createdAt: 'x' },
    { id: 'b-shift', memberId: 'worker-b', weekday: 2, startTime: '10:00', endTime: '18:00', createdAt: 'x' },
  ],
};

test('assistant validates bounded history and requires a final user message', () => {
  assert.deepEqual(validateAssistantMessages([{ role: 'user', content: '  Help me  ' }]), [{ role: 'user', content: 'Help me' }]);
  assert.throws(() => validateAssistantMessages([]), /between 1 and 12/);
  assert.throws(() => validateAssistantMessages([{ role: 'assistant', content: 'Hi' }]), /last message/);
  assert.throws(() => validateAssistantMessages([{ role: 'user', content: 'x'.repeat(2001) }]), /1-2000/);
});

test('worker assistant context excludes other workers, their shifts, contact details, and pay', () => {
  const context = assistantContext(base);
  assert.deepEqual(context.tasks.map((task) => task.id), ['mine', 'open']);
  assert.deepEqual(context.tasks.map((task) => task.assignedTo), ['you', null]);
  assert.deepEqual(context.shifts.map((shift) => shift.id), ['a-shift']);
  assert.deepEqual(context.shifts.map((shift) => shift.memberId), ['you']);
  assert.deepEqual(context.members, []);
  assert.deepEqual(Object.keys(context).sort(), ['members', 'role', 'shifts', 'tasks', 'today']);
  const serialized = JSON.stringify(context);
  for (const secret of ['worker-b', 'Bob', 'Private detail', '111', '222']) assert.equal(serialized.includes(secret), false);
});

test('manager context includes operational names but strips contact, pay, reports, settings, and audit records', () => {
  const context = assistantContext({ ...base, viewer: { id: 'manager', role: 'manager' }, audit: [{ detail: 'secret audit' }], settings: { secret: true } });
  assert.deepEqual(context.tasks.map((task) => task.id), ['mine', 'open', 'private']);
  assert.deepEqual(context.members.map((member) => member.name), ['Alice', 'Bob']);
  for (const member of context.members) assert.deepEqual(Object.keys(member).sort(), ['id', 'name', 'role']);
  assert.deepEqual(Object.keys(context).sort(), ['members', 'role', 'shifts', 'tasks', 'today']);
  const serialized = JSON.stringify(context);
  for (const secret of ['111', '222', 'secret audit']) assert.equal(serialized.includes(secret), false);
  assert.match(assistantInstructions(context), /informational and read-only/);
  assert.match(assistantInstructions(context), /untrusted data/);
  assert.match(assistantInstructions(context), /two-week cycle/);
  assert.match(assistantInstructions(context), /in-app Inbox/);
  assert.match(assistantInstructions(context), /never suggest sharing or reveal personal phone numbers/);
});

test('assistant errors do not expose upstream details', () => {
  assert.deepEqual(safeAssistantError(new Error('Assistant configuration is missing.')), { status: 503, message: 'Assistant configuration is missing.' });
  assert.deepEqual(safeAssistantError(new Error('api key sk-secret failed')), { status: 502, message: 'The CareBoard assistant is temporarily unavailable. Please try again.' });
});

test('assistant route enforces authentication, role, origin, and server-only key use', () => {
  const route = readFileSync(new URL('../app/api/assistant/route.ts', import.meta.url), 'utf8');
  assert.match(route, /authenticatedAccess\(\)/);
  assert.match(route, /access\.role === 'viewer'/);
  assert.match(route, /trustedMutationOrigin/);
  assert.match(route, /process\.env\.OPENAI_API_KEY/);
  assert.doesNotMatch(route, /NEXT_PUBLIC_OPENAI/);
  assert.match(route, /store: false/);
});

test('dashboard exposes a distinct assistant surface for managers and workers', () => {
  const dashboard = readFileSync(new URL('../app/household-app.tsx', import.meta.url), 'utf8');
  assert.match(dashboard, /\['assistant', 'Assistant', Sparkles\]/);
  assert.match(dashboard, /Separate from the team inbox/);
  assert.match(dashboard, /fetch\('\/api\/assistant'/);
  assert.match(dashboard, /maxLength=\{2000\}/);
  assert.match(dashboard, /AI can make mistakes/);
  assert.match(dashboard, /Which days do I have off\?/);
  assert.match(dashboard, /action: 'requestScheduleChange'/);
  assert.match(dashboard, /Your schedule will not change automatically/);
  assert.match(dashboard, /Reported not coming \/ day off requested/);
  assert.match(dashboard, /schedule not yet changed/);
});
