/**
 * Password-based encryption with the browser's WebCrypto.
 *
 * The data is encrypted with a random AES-256-GCM data key. That data key is
 * stored twice, each time encrypted ("wrapped") with a key derived via
 * PBKDF2-SHA256: once from the password, once from the recovery code. Either
 * secret can therefore open the data, and the password can be replaced
 * without re-encrypting or losing anything.
 */

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

/** The data key, encrypted with a key derived from a secret and this salt. */
export interface WrappedKey {
  salt: string; // base64
  iv: string; // base64
  data: string; // base64
}

/** Current storage format. */
export interface EnvelopeV2 {
  format: 'portfolio-encrypted';
  v: 2;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  pw: WrappedKey;
  rec: WrappedKey;
  iv: string;
  data: string;
}

/** First format (password-derived key encrypts the data directly, no recovery code). Still readable. */
export interface EnvelopeV1 {
  format: 'portfolio-encrypted';
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string;
  iv: string;
  data: string;
}

export type Envelope = EnvelopeV1 | EnvelopeV2;

/** An opened vault: the data key in memory plus the wrapped copies that get stored with every save. */
export interface Vault {
  key: CryptoKey;
  iterations: number;
  pw: WrappedKey;
  rec: WrappedKey;
}

export class WrongPasswordError extends Error {
  constructor(message = 'Falsches Passwort.') {
    super(message);
  }
}

export const cryptoAvailable = (): boolean => typeof crypto !== 'undefined' && !!crypto.subtle;

// ---------- helpers ----------

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const AES = { name: 'AES-GCM', length: 256 } as const;

async function deriveKey(secret: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, material, AES, false, ['encrypt', 'decrypt']);
}

async function wrap(dataKey: CryptoKey, secret: string, iterations: number): Promise<WrappedKey> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const kek = await deriveKey(secret, salt, iterations);
  const raw = await crypto.subtle.exportKey('raw', dataKey);
  const data = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw);
  return { salt: toB64(salt), iv: toB64(iv), data: toB64(new Uint8Array(data)) };
}

/** Returns the data key, or null if the secret does not fit. */
async function unwrap(w: WrappedKey, secret: string, iterations: number): Promise<CryptoKey | null> {
  try {
    const kek = await deriveKey(secret, fromB64(w.salt), iterations);
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(w.iv) }, kek, fromB64(w.data));
    // Extractable, so it can be wrapped again when the password or recovery code changes.
    return await crypto.subtle.importKey('raw', raw, AES, true, ['encrypt', 'decrypt']);
  } catch {
    return null;
  }
}

async function decryptWith(key: CryptoKey, iv: string, data: string): Promise<string | null> {
  try {
    return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(iv) }, key, fromB64(data)));
  } catch {
    return null;
  }
}

// ---------- recovery code ----------

// 32 symbols without the look-alikes 0/O and 1/I: exactly 5 bits each.
const CODE_SYMBOLS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 24;

/** Random recovery code like "K7QM-2XHD-…" with 120 bits of entropy. */
export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_LENGTH));
  const chars = Array.from(bytes, (b) => CODE_SYMBOLS[b & 31]); // 256 is a multiple of 32, so this is uniform
  return chars.join('').replace(/(.{4})(?=.)/g, '$1-');
}

/** Ignores case, spaces and dashes, so the code can be typed as it was written down. */
export function normalizeRecoveryCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// ---------- vault ----------

/** New vault with a fresh data key. The recovery code is only returned here and never stored. */
export async function createVault(password: string, iterations = KDF_ITERATIONS): Promise<{ vault: Vault; recoveryCode: string }> {
  const key = await crypto.subtle.generateKey(AES, true, ['encrypt', 'decrypt']);
  const recoveryCode = generateRecoveryCode();
  const [pw, rec] = await Promise.all([wrap(key, password, iterations), wrap(key, normalizeRecoveryCode(recoveryCode), iterations)]);
  return { vault: { key, iterations, pw, rec }, recoveryCode };
}

export async function encryptText(vault: Vault, text: string): Promise<EnvelopeV2> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh per message, required for GCM
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.key, new TextEncoder().encode(text));
  return {
    format: 'portfolio-encrypted', v: 2, kdf: 'PBKDF2-SHA256',
    iterations: vault.iterations, pw: vault.pw, rec: vault.rec,
    iv: toB64(iv), data: toB64(new Uint8Array(ct)),
  };
}

/** Decrypts with an already opened vault. Throws if the envelope belongs to another vault or was tampered with. */
export async function decryptText(vault: Vault, env: Envelope): Promise<string> {
  const text = await decryptWith(vault.key, env.iv, env.data);
  if (text === null) throw new WrongPasswordError();
  return text;
}

export interface Opened {
  text: string;
  vault: Vault;
  /** Set when data in the first format was upgraded: a recovery code was created just now and must be shown once. */
  newRecoveryCode?: string;
}

/** Opens an envelope with the password. */
export async function unlockWithPassword(password: string, env: Envelope): Promise<Opened> {
  if (env.v === 1) {
    const oldKey = await deriveKey(password, fromB64(env.salt), env.iterations);
    const text = await decryptWith(oldKey, env.iv, env.data);
    if (text === null) throw new WrongPasswordError();
    const { vault, recoveryCode } = await createVault(password, Math.max(env.iterations, 1));
    return { text, vault, newRecoveryCode: recoveryCode };
  }
  const key = await unwrap(env.pw, password, env.iterations);
  const text = key && (await decryptWith(key, env.iv, env.data));
  if (!key || text === null) throw new WrongPasswordError();
  return { text, vault: { key, iterations: env.iterations, pw: env.pw, rec: env.rec } };
}

/**
 * Opens an envelope with the recovery code. The returned vault still carries
 * the old password; call changePassword right away.
 */
export async function unlockWithRecoveryCode(code: string, env: Envelope): Promise<Opened> {
  const wrong = new WrongPasswordError('Der Wiederherstellungsschlüssel passt nicht.');
  if (env.v === 1) throw new WrongPasswordError('Für diese Daten wurde noch kein Wiederherstellungsschlüssel eingerichtet.');
  const key = await unwrap(env.rec, normalizeRecoveryCode(code), env.iterations);
  const text = key && (await decryptWith(key, env.iv, env.data));
  if (!key || text === null) throw wrong;
  return { text, vault: { key, iterations: env.iterations, pw: env.pw, rec: env.rec } };
}

/** Opens an envelope with whichever secret fits: the password or the recovery code. */
export async function unlockWithEither(secret: string, env: Envelope): Promise<Opened> {
  try {
    return await unlockWithPassword(secret, env);
  } catch (e) {
    if (env.v === 1) throw e;
    try {
      return await unlockWithRecoveryCode(secret, env);
    } catch {
      throw new WrongPasswordError('Weder Passwort noch Wiederherstellungsschlüssel passen.');
    }
  }
}

export async function verifyPassword(password: string, vault: Vault): Promise<boolean> {
  return (await unwrap(vault.pw, password, vault.iterations)) !== null;
}

/** Same data key, new password. The recovery code stays valid. */
export async function changePassword(vault: Vault, newPassword: string): Promise<Vault> {
  return { ...vault, pw: await wrap(vault.key, newPassword, vault.iterations) };
}

/** Same data key, new recovery code. The old code stops working. */
export async function renewRecoveryCode(vault: Vault): Promise<{ vault: Vault; recoveryCode: string }> {
  const recoveryCode = generateRecoveryCode();
  return { vault: { ...vault, rec: await wrap(vault.key, normalizeRecoveryCode(recoveryCode), vault.iterations) }, recoveryCode };
}

// ---------- parsing ----------

const isStr = (x: unknown): x is string => typeof x === 'string';
const isWrapped = (w: any): w is WrappedKey => !!w && isStr(w.salt) && isStr(w.iv) && isStr(w.data);

export function parseEnvelope(raw: string): Envelope | null {
  try {
    const d = JSON.parse(raw);
    if (!d || d.format !== 'portfolio-encrypted' || d.kdf !== 'PBKDF2-SHA256') return null;
    if (!Number.isInteger(d.iterations) || d.iterations < 1 || d.iterations > 10_000_000) return null;
    if (!isStr(d.iv) || !isStr(d.data)) return null;
    if (d.v === 1 && isStr(d.salt)) return d as EnvelopeV1;
    if (d.v === 2 && isWrapped(d.pw) && isWrapped(d.rec)) return d as EnvelopeV2;
    return null;
  } catch {
    return null;
  }
}
