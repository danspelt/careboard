import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const source = (path) => readFileSync(new URL(path, root), 'utf8');

test('shared typography has a resilient sans-serif fallback', () => {
  const css = source('app/globals.css');
  assert.match(css, /font-family:\s*var\(--font-geist-sans, Arial\), Helvetica, sans-serif/);
  assert.doesNotMatch(css, /font-family:\s*var\(--font-geist-sans\),/);
});

test('dashboard surfaces use the shared visual system hooks', () => {
  const css = source('app/globals.css');
  const dashboard = source('app/household-app.tsx');
  for (const className of ['dashboard-sidebar', 'dashboard-mobile-header', 'dashboard-mobile-nav', 'dashboard-card', 'field-control', 'status-badge']) {
    assert.ok(css.includes(`.${className}`), `${className} must have shared styling`);
    assert.ok(dashboard.includes(className), `${className} must be used by the dashboard`);
  }
});

test('authentication routes share polished panel and control styles', () => {
  const signIn = source('app/sign-in/page.tsx');
  const changePassword = source('app/change-password/page.tsx');
  const authUi = source('app/auth-ui.tsx');
  for (const className of ['auth-shell', 'auth-panel', 'auth-control', 'auth-submit']) {
    assert.ok(signIn.includes(className) || authUi.includes(className), `sign-in must use ${className}`);
    assert.ok(changePassword.includes(className) || authUi.includes(className), `change-password must use ${className}`);
  }
});

test('shared buttons keep touch-friendly default and large sizes', () => {
  const button = source('components/ui/button.tsx');
  assert.match(button, /'h-11 gap-2 px-4/);
  assert.match(button, /lg: 'h-12 gap-2 px-5/);
});

test('dashboard depth system is green-led and reduced-motion safe', () => {
  const css = source('app/globals.css');
  assert.match(css, /--shadow-raised:/);
  assert.match(css, /\.dashboard-card:has\(> button:hover\)/);
  assert.match(css, /--role-primary: #347858/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.careboard \[data-slot='button'\]/);
});

test('dashboard has accessible loading, route error, and live connection recovery states', () => {
  const dashboard = source('app/household-app.tsx');
  const loading = source('app/dashboard/loading.tsx');
  const error = source('app/dashboard/error.tsx');
  assert.match(dashboard, /function ConnectionBanner/);
  assert.match(dashboard, /window\.addEventListener\('offline'/);
  assert.match(dashboard, /Your last loaded information is still available/);
  assert.match(loading, /aria-busy="true"/);
  assert.match(error, /role="alert"/);
  assert.match(error, /onClick=\{reset\}/);
});

test('shared primitives carry dimensional surfaces across forms, dialogs, cards, and tables', () => {
  const dialog = source('components/ui/dialog.tsx');
  const card = source('components/ui/card.tsx');
  const input = source('components/ui/input.tsx');
  const table = source('components/ui/table.tsx');
  assert.match(dialog, /shadow-\[var\(--shadow-raised\)\]/);
  assert.match(dialog, /max-h-\[calc\(100dvh-2rem\)\]/);
  assert.match(card, /shadow-\[var\(--shadow-soft\)\]/);
  assert.match(input, /focus-visible:ring-ring\/30/);
  assert.match(table, /rounded-2xl/);
});

test('every dashboard form action uses explicit submit semantics', () => {
  const dashboard = source('app/household-app.tsx');
  const syntax = ts.createSourceFile('household-app.tsx', dashboard, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const missing = [];
  let submitActions = 0;

  function attribute(element, name) {
    return element.attributes.properties.find((property) => ts.isJsxAttribute(property) && property.name.text === name);
  }

  function visit(node, insideForm = false) {
    const form = insideForm || (ts.isJsxElement(node) && node.openingElement.tagName.getText(syntax) === 'form');
    if (form && ts.isJsxOpeningElement(node) && node.tagName.getText(syntax) === 'Button' && !attribute(node, 'onClick')) {
      submitActions += 1;
      const type = attribute(node, 'type');
      if (!type || !type.initializer || !ts.isStringLiteral(type.initializer) || type.initializer.text !== 'submit') {
        missing.push(syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1);
      }
    }
    ts.forEachChild(node, (child) => visit(child, form));
  }

  visit(syntax);
  assert.ok(submitActions > 0, 'expected dashboard form actions to be detected');
  assert.deepEqual(missing, [], `form action buttons missing type="submit" at lines ${missing.join(', ')}`);
  assert.doesNotMatch(dashboard, /<option selected/);
});
