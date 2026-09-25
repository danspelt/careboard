import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { runInThisContext } from 'node:vm';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import * as lucide from 'lucide-react';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const require = createRequire(import.meta.url);
const modules = new Map();
function loadComponent(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const loaded = { exports: {} };
  modules.set(path, loaded);
  const filename = fileURLToPath(new URL(path, root));
  const { outputText } = ts.transpileModule(readFileSync(filename, 'utf8'), {
    fileName: filename,
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
  });
  const localRequire = (specifier) => {
    if (specifier === '@/app/actions/auth') return { logOut: async () => {} };
    if (specifier.startsWith('@/')) return loadComponent(`${specifier.slice(2)}${specifier.startsWith('@/lib/') ? '.ts' : '.tsx'}`);
    return require(specifier);
  };
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`, { filename })(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { HouseholdApp } = loadComponent('app/household-app.tsx');
test('every dashboard icon import, including dialog actions, renders SVG geometry', () => {
  const source = ts.createSourceFile('dashboard.tsx', readFileSync(new URL('app/household-app.tsx', root), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const icons = source.statements.find((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'lucide-react').importClause.namedBindings.elements;
  assert.ok(icons.length >= 20);
  const components = new Map(Object.entries(lucide));
  for (const icon of icons) {
    const name = (icon.propertyName ?? icon.name).text;
    const html = renderToStaticMarkup(createElement(components.get(name), { size: 20, 'aria-hidden': true }));
    assert.match(html, /<svg\b[^>]*width="20"[^>]*height="20"/, name);
    assert.match(html, /<(?:path|circle|rect|line|polyline|polygon)\b/, name);
  }
});

test('site-wide icons keep their dimensions and leave pointer targets on their controls', () => {
  const css = readFileSync(new URL('app/globals.css', root), 'utf8');
  assert.match(css, /svg\.lucide\s*\{[^}]*flex-shrink:\s*0;[^}]*pointer-events:\s*none;/);
  for (const [size, rem] of [[4, '1'], [5, '1.25'], [6, '1.5']]) {
    const rule = css.match(new RegExp(`svg\\.lucide\\.size-${size}\\s*\\{([^}]+)\\}`))?.[1];
    assert.ok(rule?.includes(`width: ${rem}rem;`) && rule.includes(`height: ${rem}rem;`), `size-${size}`);
  }
});

const date = new Date().toISOString().slice(0, 10);
const areas = ['Kitchen', 'Bathroom', 'Bedroom', 'Living room', 'Laundry', 'Outside', 'Other'];
export function dashboard(role, taskAreas = areas) {
  const member = { id: 'test-member', name: 'Test Member', role, status: 'active', color: '#287b6f', profilePhotoId: null };
  return renderToStaticMarkup(createElement(HouseholdApp, {
    authenticatedId: member.id,
    initialState: {
      viewer: { id: member.id, role }, members: [member], reminders: [], activity: [],
      chores: taskAreas.map((area, index) => ({ id: `test-${index}`, title: `Task ${index}`, area, status: 'open', priority: 'normal', dueDate: date, assignedTo: member.id })),
    },
  }));
}

for (const role of ['manager', 'worker']) {
  test(`${role} dashboard renders navigation, action and room SVGs with visible geometry`, () => {
    const html = dashboard(role);
    const icons = [...html.matchAll(/<svg\b[^>]*>[\s\S]*?<\/svg>/g)].map(([svg]) => svg);
    assert.ok(icons.length >= 15);
    for (const svg of icons) {
      assert.match(svg, /viewBox="0 0 24 24"/);
      assert.match(svg, /stroke="currentColor"/);
      assert.match(svg, /stroke-width="2"/);
      assert.match(svg, /<(?:path|circle|rect|line|polyline|polygon)\b/);
      assert.match(svg, /aria-hidden="true"/);
    }
    for (const icon of ['utensils', 'bath', 'bed-double', 'sofa', 'washing-machine', 'sprout', 'house']) {
      assert.ok(html.includes(`lucide-${icon}`), icon);
    }
  });
  test(`${role} dashboard safely renders icons for unknown and inherited area names`, () => {
    for (const area of ['Unknown room', 'constructor', '__proto__', 'toString']) {
      assert.doesNotThrow(() => dashboard(role, [area]), area);
      assert.match(dashboard(role, [area]), /lucide-house/);
    }
  });
}

test('worker today view renders the shift handoff command center', () => {
  const html = dashboard('worker');
  assert.match(html, /Ready for your shift, Test/);
  assert.match(html, /Priority briefing/);
  assert.match(html, /Today’s assignments/);
  assert.match(html, /Latest handoff notes/);
  assert.match(html, /Shift snapshot/);
  assert.match(html, /Start task/);
});

function carePlanDashboard(role) {
  const member = { id: 'test-member', name: 'Test Member', role, status: 'active', color: '#287b6f', profilePhotoId: null };
  const teammate = { id: 'mate', name: 'Robin Mate', role: 'worker', status: 'active', color: '#986ca5', profilePhotoId: null };
  const later = new Date(Date.now() + 3 * 86_400_000).toISOString().slice(0, 10);
  return renderToStaticMarkup(createElement(HouseholdApp, {
    authenticatedId: member.id,
    initialState: {
      viewer: { id: member.id, role }, members: [member, teammate], reminders: [], activity: [], chores: [],
      medications: [
        { id: 'm1', name: 'Metformin', dose: '500 mg', instructions: 'With food', times: ['00:00'], prn: false, active: true },
        { id: 'p1', name: 'Acetaminophen', dose: '500 mg', instructions: '', times: [], prn: true, active: true },
      ],
      medicationLogs: [],
      careProfile: { preferredName: 'Sam', importantToKnow: 'Allergic to penicillin', howToSupport: 'Offer choices', updatedAt: null },
      appointments: [{ id: 'a1', title: 'Dentist visit', date: later, time: '10:00', location: 'Main St', notes: '', accompanyingId: member.id, status: 'scheduled', outcome: '' }],
      supplies: [{ id: 's1', name: 'Gloves', quantity: '1 box', urgency: 'out', addedBy: teammate.id, purchasedBy: null, purchasedAt: null, createdAt: new Date().toISOString() }],
      kudos: role === 'viewer' ? [] : [{ id: 'k1', senderId: teammate.id, recipientId: member.id, badge: 'teamwork', message: 'Thanks for the swap', createdAt: new Date().toISOString() }],
    },
  }));
}

test('care-plan widgets render live data and let caregivers act', () => {
  const html = carePlanDashboard('worker');
  assert.match(html, /Medication round/);
  assert.match(html, /Metformin/);
  assert.match(html, /data-status="(?:due|overdue)"/);
  assert.match(html, />Given</);
  assert.match(html, /Log dose/);
  assert.match(html, /About Sam/);
  assert.match(html, /Allergic to penicillin/);
  assert.match(html, /Dentist visit/);
  assert.match(html, /You are going along/);
  assert.match(html, /Mark done/);
  assert.match(html, /Out now/);
  assert.match(html, /Team shout-outs/);
  assert.match(html, /Thanks for the swap/);
  assert.match(html, /You received 1 shout-out/);
});

test('family viewers see the care plan read-only and never see team shout-outs', () => {
  const html = carePlanDashboard('viewer');
  assert.match(html, /Medication round/);
  assert.match(html, /About Sam/);
  assert.match(html, /Dentist visit/);
  assert.match(html, /Gloves/);
  assert.doesNotMatch(html, />Given</);
  assert.doesNotMatch(html, /Log dose/);
  assert.doesNotMatch(html, /Mark done/);
  assert.doesNotMatch(html, /aria-label="Item"/);
  assert.doesNotMatch(html, />Bought</);
  assert.doesNotMatch(html, /Team shout-outs/);
});

test('manager overview includes the medication round, appointments, supplies, and shout-outs', () => {
  const html = carePlanDashboard('manager');
  for (const heading of ['Medication round', 'Upcoming appointments', 'Supplies list', 'Team shout-outs']) assert.match(html, new RegExp(heading));
  assert.match(html, />Cancel</);
});
