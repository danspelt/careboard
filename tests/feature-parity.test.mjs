import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { widgetsForRole } from '../lib/dashboard-widgets.ts';

const household = readFileSync(new URL('../lib/household-data.ts', import.meta.url), 'utf8');
const localDev = readFileSync(new URL('../lib/local-dev.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app/household-app.tsx', import.meta.url), 'utf8');

// Standalone `action === 'x'` comparisons — excludes `item.action`/`request.action` property checks.
const backendActions = new Set([...household.matchAll(/(?<![.\w])action === '([a-zA-Z]+)'/g)].map((m) => m[1]));
// Grouped handlers like `['disableMember', 'reactivateMember'].includes(action)`.
for (const group of household.matchAll(/\[([^\]]+)\]\.includes\(action\)/g)) {
  for (const item of group[1].matchAll(/'([a-zA-Z]+)'/g)) backendActions.add(item[1]);
}
const localDevCases = new Set([...localDev.matchAll(/case '([a-zA-Z]+)'/g)].map((m) => m[1]));

// Any backend action name appearing as a string literal in the app is treated as UI-reachable
// (covers `mutate({ action: 'x' })`, `submit(e, 'x')`, ternary dispatches, and `action="x"` props).
const appLiterals = new Set([...app.matchAll(/'([a-z][a-zA-Z]+)'|"([a-z][a-zA-Z]+)"/g)].flatMap((m) => m.slice(1).filter(Boolean)));

// Backend actions intentionally not dispatched by the UI — API-only capabilities.
const backendOnly = ['unclaim', 'deleteUpload'];

// Actions allowed for non-managers; everything else must be in the managerOnly guard list.
const workerReachable = [
  'acceptScheduleCoverage', 'addNote', 'claim', 'clockIn', 'clockOut', 'complete', 'deleteUpload',
  'dismissFirstLoginGuide', 'nudgeCoverageRequest', 'postMessage', 'recordShiftHandoff', 'reportSafetyIncident',
  'requestScheduleChange', 'saveDashboard', 'sendInboxMessage', 'setAvailability', 'start',
  'submitShiftHandoff', 'takeover', 'unclaim', 'updateProfile', 'updateTask',
  'logMedicationDose', 'completeAppointment', 'sendKudos', 'addSupplyItem', 'markSupplyPurchased',
];

test('every mutation action is categorized: manager-only, worker-guarded, or backend-only', () => {
  const managerBlock = household.match(/const managerOnly = \[([\s\S]*?)\];/);
  assert.ok(managerBlock, 'managerOnly list exists');
  const managerOnly = new Set([...managerBlock[1].matchAll(/'([a-zA-Z]+)'/g)].map((m) => m[1]));
  const allowed = new Set([...managerOnly, ...workerReachable]);
  for (const action of backendActions) {
    assert.ok(allowed.has(action), `action '${action}' is uncategorized — add it to managerOnly or the worker-reachable list`);
  }
  // Nothing sits in managerOnly that was never dispatched
  for (const action of managerOnly) {
    assert.ok(backendActions.has(action) || ['updateSafetyIncident'].includes(action), `managerOnly entry '${action}' has no backend handler`);
  }
});

test('every UI-dispatched action has a backend handler, and every backend action is reachable', () => {
  for (const action of backendActions) {
    assert.ok(appLiterals.has(action) || backendOnly.includes(action), `backend action '${action}' is not dispatched anywhere in the UI`);
  }
});

test('every backend action is handled in the local-dev preview', () => {
  for (const action of backendActions) {
    assert.ok(localDevCases.has(action), `action '${action}' falls through to logUnhandled in local dev`);
  }
});

test('mutation entry points are guarded', () => {
  assert.match(household, /Household access denied/);
  assert.match(household, /Family viewers have read-only access/);
  assert.match(household, /requiredString\(input\.actorId, 'Profile'\)/);
  assert.match(household, /Only the household manager can do that/);
});

test('every catalog widget has a rendered cell for its role', () => {
  const cellBlocks = [...app.matchAll(/const cells: Record<string, React\.ReactNode> = \{([\s\S]*?)\n  \};/g)].map((m) => m[1]);
  assert.equal(cellBlocks.length, 3, 'expected manager, viewer, and worker cell maps');
  const keySets = cellBlocks.map((block) => new Set([...block.matchAll(/^    ([a-zA-Z]+):/gm)].map((m) => m[1])));
  const audiences = ['manager', 'viewer', 'worker']; // order of the cells objects in household-app.tsx
  audiences.forEach((role, index) => {
    for (const widget of widgetsForRole(role)) {
      assert.ok(keySets[index].has(widget.id), `${role} widget '${widget.id}' has no cell renderer — it would render blank`);
    }
  });
});
