import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DESKTOP_MEDIA_QUERY, viewportLabel } from '../lib/viewport.ts';
import { readFileSync } from 'node:fs';

test('viewport helpers map desktop and mobile shells', () => {
  assert.equal(viewportLabel(true), 'desktop');
  assert.equal(viewportLabel(false), 'mobile');
  assert.match(DESKTOP_MEDIA_QUERY, /768px/);
});

test('dashboard auto-adapts shells with data-viewport and role-specific mobile nav', () => {
  const source = readFileSync(new URL('../app/household-app.tsx', import.meta.url), 'utf8');
  assert.match(source, /data-viewport=\{viewport\}/);
  assert.match(source, /useIsDesktopViewport/);
  assert.match(source, /workerMobileNav/);
  assert.match(source, /managerMobileNav/);
  assert.match(source, /pb-24 md:pb-0/);
  assert.match(source, /manager-task-table/);
});
