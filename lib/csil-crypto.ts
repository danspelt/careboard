import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key() {
  const secret = process.env.CSIL_DOCUMENT_ENCRYPTION_KEY;
  if (!secret) throw new Error('Encrypted CSIL document storage is not configured.');
  let raw: Buffer;
  try { raw = Buffer.from(secret, 'base64'); } catch { throw new Error('Encrypted CSIL document storage is not configured.'); }
  if (raw.length !== 32) throw new Error('Encrypted CSIL document storage is not configured.');
  return createHash('sha256').update(raw).digest();
}

export function encryptCsilDocument(data: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]);
}

export function decryptCsilDocument(data: Buffer) {
  if (data.length < 29) throw new Error('Encrypted document is invalid.');
  const decipher = createDecipheriv('aes-256-gcm', key(), data.subarray(0, 12));
  decipher.setAuthTag(data.subarray(12, 28));
  return Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]);
}
