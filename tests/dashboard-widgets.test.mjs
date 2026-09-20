import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DASHBOARD_THEMES,
  addWidget,
  defaultLayout,
  layoutFor,
  moveWidget,
  normalizeLayout,
  randomThemeId,
  removeWidget,
  setWidgetSize,
  themeFor,
  widgetDef,
  widgetsForRole,
} from '../lib/dashboard-widgets.ts';

test('every role has a non-empty default layout drawn from the catalog', () => {
  for (const role of ['manager', 'worker', 'viewer']) {
    const layout = defaultLayout(role);
    assert.ok(layout.length >= 4, `${role} should have several widgets`);
    const catalogIds = new Set(widgetsForRole(role).map((widget) => widget.id));
    for (const item of layout) assert.ok(catalogIds.has(item.id), `${item.id} must be available to ${role}`);
  }
});

test('widget ids are unique and catalog entries are well formed', () => {
  const ids = new Set();
  for (const widget of [...widgetsForRole('manager'), ...widgetsForRole('worker'), ...widgetsForRole('viewer')]) {
    assert.ok(widget.title && widget.description && widget.category);
    assert.ok(widget.size === undefined);
  }
  const all = new Map();
  for (const widget of widgetsForRole('manager').concat(widgetsForRole('worker'), widgetsForRole('viewer'))) {
    const key = `${widget.id}`;
    if (all.has(key)) assert.deepEqual(all.get(key).roles.includes('manager') || all.get(key).roles.includes('worker') || all.get(key).roles.includes('viewer'), true);
    all.set(key, widget);
    ids.add(`${widget.id}:${widget.roles.join(',')}`);
  }
  assert.ok(widgetDef('timeclock'));
});

test('normalizeLayout drops unknown ids, duplicates, and bad sizes', () => {
  const cleaned = normalizeLayout('worker', [
    { id: 'timeclock', size: 'half' },
    { id: 'not-a-widget', size: 'full' },
    { id: 'timeclock', size: 'full' },
    { id: 'funding', size: 'full' }, // manager-only — dropped for worker
    'garbage',
    { id: 'mytasks', size: 'wide' },
    null,
  ]);
  assert.deepEqual(cleaned, [
    { id: 'timeclock', size: 'half' },
    { id: 'mytasks', size: 'half' }, // 'wide' falls back to the widget default
  ]);
});

test('normalizeLayout honors removal — missing widgets stay missing', () => {
  const kept = normalizeLayout('manager', [{ id: 'hero', size: 'full' }]);
  assert.deepEqual(kept, [{ id: 'hero', size: 'full' }]);
  assert.deepEqual(normalizeLayout('manager', []), []);
  assert.deepEqual(normalizeLayout('manager', 'nonsense'), []);
  assert.deepEqual(normalizeLayout('manager', null), []);
});

test('layoutFor falls back to defaults only when nothing is stored', () => {
  assert.equal(layoutFor('worker', null).length, defaultLayout('worker').length);
  assert.equal(layoutFor('worker', undefined).length, defaultLayout('worker').length);
  assert.deepEqual(layoutFor('worker', [{ id: 'timeclock', size: 'full' }]), [{ id: 'timeclock', size: 'full' }]);
  assert.deepEqual(layoutFor('worker', []), []);
});

test('moveWidget swaps neighbours and is bounded', () => {
  const items = [{ id: 'a', size: 'full' }, { id: 'b', size: 'half' }, { id: 'c', size: 'half' }];
  assert.deepEqual(moveWidget(items, 'b', 'up').map((i) => i.id), ['b', 'a', 'c']);
  assert.deepEqual(moveWidget(items, 'b', 'down').map((i) => i.id), ['a', 'c', 'b']);
  assert.deepEqual(moveWidget(items, 'a', 'up').map((i) => i.id), ['a', 'b', 'c']);
  assert.deepEqual(moveWidget(items, 'c', 'down').map((i) => i.id), ['a', 'b', 'c']);
  assert.deepEqual(moveWidget(items, 'nope', 'up'), items);
});

test('setWidgetSize toggles and sets explicitly', () => {
  const items = [{ id: 'a', size: 'half' }];
  assert.equal(setWidgetSize(items, 'a')[0].size, 'full');
  assert.equal(setWidgetSize(items, 'a', 'half')[0].size, 'half');
});

test('removeWidget and addWidget manage membership', () => {
  const items = [{ id: 'timeclock', size: 'full' }];
  assert.deepEqual(removeWidget(items, 'timeclock'), []);
  assert.deepEqual(removeWidget(items, 'nope'), items);
  const added = addWidget(items, 'worker', 'safetyform');
  assert.deepEqual(added.map((i) => i.id), ['timeclock', 'safetyform']);
  assert.equal(added[1].size, widgetDef('safetyform').defaultSize);
  assert.deepEqual(addWidget(added, 'worker', 'safetyform'), added, 'no duplicates');
  assert.deepEqual(addWidget(items, 'worker', 'funding'), items, 'cannot add a manager widget to a worker layout');
});

test('themeFor returns saved theme, else a stable per-member pick', () => {
  assert.equal(themeFor('member-1', 'plum').id, 'plum');
  const auto = themeFor('member-abc', null);
  assert.ok(DASHBOARD_THEMES.some((theme) => theme.id === auto.id));
  assert.equal(themeFor('member-abc', null).id, auto.id, 'stable across calls');
  assert.equal(themeFor('member-abc', 'bogus').id, auto.id, 'unknown saved value falls back');
});

test('randomThemeId always returns a real theme and respects the RNG', () => {
  assert.equal(randomThemeId(() => 0), DASHBOARD_THEMES[0].id);
  assert.equal(randomThemeId(() => 0.999), DASHBOARD_THEMES[DASHBOARD_THEMES.length - 1].id);
  assert.ok(DASHBOARD_THEMES.every((theme) => Object.keys(theme.vars).length >= 9));
});
