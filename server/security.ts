// Password hashing, secret encryption and random tokens. Uses only node:crypto.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

// --- Passwords (scrypt) ------------------------------------------------------

const SCRYPT = { N: 2 ** 15, r: 8, p: 1, keylen: 64 };
const scryptOptions = (N: number, r: number, p: number) => ({ N, r, p, maxmem: 128 * N * r * 2 });

function scrypt(password: string, salt: Buffer, N: number, r: number, p: number, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    crypto.scrypt(password.normalize('NFKC'), salt, keylen, scryptOptions(N, r, p), (err, key) => (err ? reject(err) : resolve(key))),
  );
}

/** Returns "scrypt$N$r$p$salt$hash" (base64url), safe to store. */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT.N, SCRYPT.r, SCRYPT.p, SCRYPT.keylen);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), key.toString('base64url')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'base64url');
  const key = await scrypt(password, Buffer.from(salt, 'base64url'), Number(n), Number(r), Number(p), expected.length);
  return crypto.timingSafeEqual(key, expected);
}

/** A valid hash of a random password, used so unknown accounts take as long to reject as known ones. */
let dummyHash: Promise<string> | undefined;
export function getDummyHash() {
  dummyHash ??= hashPassword(crypto.randomBytes(16).toString('hex'));
  return dummyHash;
}

export const PASSWORD_MIN_LENGTH = 12;

/** Dutch error message, or undefined when the password is acceptable. */
export function passwordProblem(password: string, email?: string): string | undefined {
  if (password.length < PASSWORD_MIN_LENGTH) return `Kies een wachtwoord van minimaal ${PASSWORD_MIN_LENGTH} tekens.`;
  if (password.length > 200) return 'Dit wachtwoord is te lang.';
  if (new Set(password).size < 5) return 'Dit wachtwoord is te voorspelbaar. Gebruik meer verschillende tekens.';
  const lower = password.toLowerCase();
  if (email && lower.includes(email.split('@')[0].toLowerCase())) return 'Gebruik je e-mailadres niet in je wachtwoord.';
  if (/(wachtwoord|password|detail2go|welkom|qwerty|123456)/.test(lower)) return 'Dit wachtwoord is te makkelijk te raden.';
  return undefined;
}

// --- Tokens ----------------------------------------------------------------------

export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString('base64url');
export const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('base64url');

/** Constant-time string comparison. */
export function safeEqual(a: string, b: string) {
  const ha = crypto.createHash('sha256').update(a).digest();
  const hb = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(ha, hb);
}

// --- Encryption at rest (AES-256-GCM) ---------------------------------------------

export interface Cipher {
  encrypt(plain: string, context: string): string;
  decrypt(sealed: string, context: string): string;
}

/** `context` is bound as associated data, so a value cannot be moved to another field or row. */
export function createCipher(key: Buffer): Cipher {
  if (key.length !== 32) throw new Error('Encryption key must be 32 bytes');
  return {
    encrypt(plain, context) {
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(context));
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), data.toString('base64url')].join('.');
    },
    decrypt(sealed, context) {
      const [version, iv, tag, data] = sealed.split('.');
      if (version !== 'v1') throw new Error('Unknown encryption format');
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
      decipher.setAAD(Buffer.from(context));
      decipher.setAuthTag(Buffer.from(tag, 'base64url'));
      return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
    },
  };
}

/**
 * The key comes from SECRET_KEY (recommended in production, keep it out of backups),
 * otherwise from a key file next to the database that is created on first start.
 */
export function loadEncryptionKey(envValue: string | undefined, databasePath: string, production: boolean): Buffer {
  if (envValue) {
    const key = /^[0-9a-f]{64}$/i.test(envValue) ? Buffer.from(envValue, 'hex') : Buffer.from(envValue, 'base64');
    if (key.length !== 32) throw new Error('SECRET_KEY moet 32 bytes zijn (64 hex-tekens). Genereer er een met: npm run secret');
    return key;
  }
  if (databasePath === ':memory:') return crypto.randomBytes(32);
  const file = path.join(path.dirname(path.resolve(databasePath)), 'secret.key');
  if (fs.existsSync(file)) return Buffer.from(fs.readFileSync(file, 'utf8').trim(), 'hex');
  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, key.toString('hex'), { mode: 0o600 });
  if (production) console.warn(`[security] Sleutel aangemaakt in ${file}. Zet bij voorkeur SECRET_KEY als omgevingsvariabele.`);
  return key;
}
