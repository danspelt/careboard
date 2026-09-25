import assert from 'node:assert/strict';
import test from 'node:test';
import { cn } from '../lib/utils.ts';

test('cn merges class lists and resolves tailwind conflicts', () => {
  assert.equal(cn('px-2', 'px-4'), 'px-4');
  assert.equal(cn('text-sm', false, undefined, 'font-bold'), 'text-sm font-bold');
  assert.equal(cn(), '');
});
