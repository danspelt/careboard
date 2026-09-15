import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import { runInThisContext } from 'node:vm';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const source = readFileSync(new URL('../app/sign-in/page.tsx', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  fileName: 'page.tsx',
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
});

const React = require('react');

async function signIn({ searchParams = {}, passwordEnabled = true, googleEnabled = false } = {}) {
  const loaded = { exports: {} };
  const localRequire = (specifier) => {
    if (specifier === '@/app/actions/auth') {
      return {
        googleSignIn: async () => { throw new Error('Sign-in must not run during rendering'); },
        passwordSignIn: async () => { throw new Error('Sign-in must not run during rendering'); },
      };
    }
    if (specifier === '@/lib/auth-config') {
      return {
        authenticationConfigured: () => passwordEnabled,
        googleAuthenticationConfigured: () => googleEnabled,
      };
    }
    if (specifier === '@/app/auth-ui') {
      return {
        PasswordField: ({ name, label }) => React.createElement('label', null, label, React.createElement('input', { type: 'password', name })),
        SubmitButton: ({ children }) => React.createElement('button', { type: 'submit' }, children),
      };
    }
    if (specifier === 'next/image') return { default: (props) => React.createElement('img', props) };
    if (specifier === 'next/link') return { default: ({ href, children, ...rest }) => React.createElement('a', { href, ...rest }, children) };
    return require(specifier);
  };
  runInThisContext(`(function(require, module, exports) {${outputText}\n})`)(localRequire, loaded, loaded.exports);
  return renderToStaticMarkup(await loaded.exports.default({ searchParams: Promise.resolve(searchParams) }));
}

test('sign-in renders one h1, CSIL positioning, and care worker copy', async () => {
  const html = await signIn();
  assert.equal((html.match(/<h1\b/g) ?? []).length, 1);
  assert.match(html, /Built for CSIL employers/);
  assert.match(html, /Run your care team with confidence/);
  assert.match(html, /care workers/i);
  assert.match(html, /Care worker/);
  assert.match(html, /Family viewer/);
  assert.match(html, /Household manager/);
  assert.match(html, /<input[^>]*type="password"[^>]*name="password"/);
});

test('sign-in maps error codes to specific messages', async () => {
  const credentials = await signIn({ searchParams: { error: 'CredentialsSignin' } });
  assert.match(credentials, /That email or password didn’t match an approved account/);
  const configuration = await signIn({ searchParams: { error: 'Configuration' } });
  assert.match(configuration, /Sign-in isn’t configured yet\. Please contact your household manager/);
  const other = await signIn({ searchParams: { error: 'Other' } });
  assert.match(other, /Sign-in could not be completed\. Please try again or contact your household manager/);
  const clean = await signIn();
  assert.doesNotMatch(clean, /role="alert"/);
});

test('sign-in shows the activation notice after joining', async () => {
  const html = await signIn({ searchParams: { joined: '1' } });
  assert.match(html, /Your account is active/);
});

test('Google sign-in only appears when configured', async () => {
  const withGoogle = await signIn({ googleEnabled: true });
  assert.match(withGoogle, /Sign in with Google/);
  const withoutGoogle = await signIn();
  assert.doesNotMatch(withoutGoogle, /Sign in with Google/);
});
