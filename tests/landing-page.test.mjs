import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  fileName: 'page.tsx',
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});
async function landing({ signedIn = false, googleEnabled = false } = {}) {
  const loaded = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/auth') return { auth: async () => signedIn ? { user: { name: 'Test Member' } } : null };
    if (specifier === '@/lib/auth-config') return { googleAuthenticationConfigured: () => googleEnabled };
    if (specifier === '@/app/actions/auth') return { googleSignIn: async () => { throw new Error('Sign-in must not run during rendering'); } };
    return require(specifier);
  };
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`)(localRequire, loaded, loaded.exports);
  return renderToStaticMarkup(await loaded.exports.default());
}

test('landing brand is inline SVG and the preview is explicitly illustrative', async () => {
  const html = await landing();
  assert.match(html, /<svg[^>]*data-slot="brand-icon"/);
  assert.doesNotMatch(html, /<img[^>]*favicon/);
  assert.match(html, /Example board/);
  assert.match(html, /Not live household data/);
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /id="how-it-works"/);
  assert.match(html, /id="privacy"/);
});

test('configured Google SSO has a direct sign-in form and a password alternative', async () => {
  const html = await landing({ googleEnabled: true });
  assert.match(html, /<form\b/);
  assert.match(html, /Continue with Google/);
  assert.match(html, /Google single sign-on/);
  assert.match(html, /href="\/sign-in"[^>]*>[^<]*Use a password/);
});

test('unconfigured Google SSO falls back to the standard sign-in page', async () => {
  const html = await landing();
  assert.doesNotMatch(html, /Continue with Google|<form\b/);
  assert.match(html, /href="\/sign-in"/);
  assert.match(html, /Manager-approved/);
});

test('signed-in visitors go to the dashboard instead of restarting SSO', async () => {
  const html = await landing({ signedIn: true, googleEnabled: true });
  assert.match(html, /href="\/dashboard"/);
  assert.doesNotMatch(html, /Continue with Google|<form\b/);
  assert.match(html, /Open your dashboard/);
});
