import assert from 'node:assert/strict';
import { test } from 'node:test';
import { encryptCsilDocument, decryptCsilDocument } from '../lib/csil-crypto.ts';

test('CSIL documents use authenticated encryption and fail closed', () => {
  const previous = process.env.CSIL_DOCUMENT_ENCRYPTION_KEY;
  process.env.CSIL_DOCUMENT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
  const plain = Buffer.from('receipt');
  const encrypted = encryptCsilDocument(plain);
  assert.notDeepEqual(encrypted, plain);
  assert.deepEqual(decryptCsilDocument(encrypted), plain);
  encrypted[encrypted.length - 1] ^= 1;
  assert.throws(() => decryptCsilDocument(encrypted));
  if (previous === undefined) delete process.env.CSIL_DOCUMENT_ENCRYPTION_KEY; else process.env.CSIL_DOCUMENT_ENCRYPTION_KEY = previous;
});
