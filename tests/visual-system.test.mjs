import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

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
  for (const className of ['auth-shell', 'auth-panel', 'auth-control', 'auth-submit']) {
    assert.ok(signIn.includes(className), `sign-in must use ${className}`);
    assert.ok(changePassword.includes(className), `change-password must use ${className}`);
  }
});

test('shared buttons keep touch-friendly default and large sizes', () => {
  const button = source('components/ui/button.tsx');
  assert.match(button, /'h-11 gap-2 px-4/);
  assert.match(button, /lg: 'h-12 gap-2 px-5/);
});
