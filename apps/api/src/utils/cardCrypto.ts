// AES-256-GCM at-rest encryption for the one-shot full card details VitalPay
// delivers in its issue response. The key is derived from ENCRYPTION_KEY via
// SHA-256 so any length passes; ciphertext format is iv:tag:data (hex), all
// three parts required for decryption and tamper-detection.
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { env } from '../config/index.js';

const key = createHash('sha256').update(env.ENCRYPTION_KEY).digest();

export function encryptCardSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${cipher.getAuthTag().toString('hex')}:${data.toString('hex')}`;
}

export function decryptCardSecret(ciphertext: string): string {
  const [ivHex, tagHex, dataHex] = ciphertext.split(':');
  if (!ivHex || !tagHex || !dataHex) throw new Error('Malformed encrypted card data');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, 'hex')), decipher.final()]).toString('utf8');
}
