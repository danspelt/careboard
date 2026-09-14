import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildNotifications } from '../lib/notifications.ts';

const members = [{ id: 'manager', name: 'Manager' }, { id: 'worker', name: 'Worker' }];
const activity = (overrides = {}) => ({ id: crypto.randomUUID(), choreId: 'chore-1', memberId: 'worker', action: 'completed', detail: 'finished Kitchen clean', createdAt: '2026-09-13T10:00:00Z', ...overrides });
const task = (overrides = {}) => ({ id: crypto.randomUUID(), title: 'Task', status: 'open', assignedTo: null, createdBy: 'manager', createdAt: '2026-09-13T09:00:00Z', notes: [], ...overrides });
const note = (overrides = {}) => ({ id: crypto.randomUUID(), memberId: 'manager', kind: 'progress', body: 'Nearly done', createdAt: '2026-09-13T11:00:00Z', ...overrides });

test('manager notifications come from the activity feed, newest first, capped at twelve', () => {
  const feed = Array.from({ length: 15 }, (_, index) => activity({ id: `a${index}`, createdAt: `2026-09-13T${String(index).padStart(2, '0')}:00:00Z` }));
  const items = buildNotifications({ viewerId: 'manager', manager: true, activity: feed, tasks: [], members });
  assert.equal(items.length, 12);
  assert.equal(items[0].id, 'a14');
  assert.equal(items[0].actor, 'Worker');
  assert.equal(items[0].text, 'finished Kitchen clean');
  assert.equal(items[0].kind, 'completed');
});

test('worker notifications surface notes by others on their tasks and new claimable work', () => {
  const items = buildNotifications({
    viewerId: 'worker',
    manager: false,
    activity: [],
    members,
    since: '2026-09-12T00:00:00Z',
    tasks: [
      task({ id: 'mine', assignedTo: 'worker', notes: [note({ id: 'n1' }), note({ id: 'n2', memberId: 'worker' })] }),
      task({ id: 'claimable' }),
      task({ id: 'old-claimable', createdAt: '2026-09-10T09:00:00Z' }),
      task({ id: 'other-worker', assignedTo: 'someone-else', notes: [note({ id: 'n3' })] }),
    ],
  });
  assert.deepEqual(items.map((item) => item.id).sort(), ['available-claimable', 'n1']);
  assert.equal(items.find((item) => item.id === 'n1').actor, 'Manager');
});

test('worker notifications exclude empty note lists and respect the cutoff', () => {
  const items = buildNotifications({ viewerId: 'worker', manager: false, activity: [], members, since: '2026-09-13T10:30:00Z', tasks: [task({ id: 'stale' })] });
  assert.deepEqual(items, []);
});
