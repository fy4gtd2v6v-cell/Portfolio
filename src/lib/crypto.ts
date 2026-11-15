/**
 * Password-based encryption with the browser's WebCrypto:
 * PBKDF2-SHA256 derives an AES-256-GCM key from the password.
 * The key is non-extractable and only ever lives in memory.
 */

export const KDF_ITERATIONS = 600_000;
export const MIN_PASSWORD_LENGTH = 8;

export interface Envelope {
  format: 'portfolio-encrypted';
  v: 1;
  kdf: 'PBKDF2-SHA256';
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  data: string; // base64 AES-GCM ciphertext
}

export interface Vault {
  key: CryptoKey;
  salt: string;
  iterations: number;
}

export class WrongPasswordError extends Error {
  constructor() {
    super('Falsches Passwort.');
  }
}

export const cryptoAvailable = (): boolean => typeof crypto !== 'undefined' && !!crypto.subtle;

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

async function deriveKey(password: string, salt: Uint8Array, iterations: number): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** New vault with a fresh random salt. */
export async function createVault(password: string, iterations = KDF_ITERATIONS): Promise<Vault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return { key: await deriveKey(password, salt, iterations), salt: toB64(salt), iterations };
}

/** Derives the key for an existing envelope. Whether the password is right only shows on decrypt. */
export async function vaultFor(password: string, env: Envelope): Promise<Vault> {
  return { key: await deriveKey(password, fromB64(env.salt), env.iterations), salt: env.salt, iterations: env.iterations };
}

export async function encryptText(vault: Vault, text: string): Promise<Envelope> {
  const iv = crypto.getRandomValues(new Uint8Array(12)); // fresh per message, required for GCM
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, vault.key, new TextEncoder().encode(text));
  return {
    format: 'portfolio-encrypted',
    v: 1,
    kdf: 'PBKDF2-SHA256',
    iterations: vault.iterations,
    salt: vault.salt,
    iv: toB64(iv),
    data: toB64(new Uint8Array(ct)),
  };
}

/** Throws WrongPasswordError if the key does not fit or the data was tampered with. */
export async function decryptText(vault: Vault, env: Envelope): Promise<string> {
  try {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: fromB64(env.iv) }, vault.key, fromB64(env.data));
    return new TextDecoder().decode(pt);
  } catch {
    throw new WrongPasswordError();
  }
}

/** Convenience: derive the key from the password and decrypt. */
export async function openEnvelope(password: string, env: Envelope): Promise<{ text: string; vault: Vault }> {
  const vault = await vaultFor(password, env);
  return { text: await decryptText(vault, env), vault };
}

export function parseEnvelope(raw: string): Envelope | null {
  try {
    const d = JSON.parse(raw);
    const ok =
      d && d.format === 'portfolio-encrypted' && d.v === 1 && d.kdf === 'PBKDF2-SHA256' &&
      Number.isInteger(d.iterations) && d.iterations >= 1 && d.iterations <= 10_000_000 &&
      typeof d.salt === 'string' && typeof d.iv === 'string' && typeof d.data === 'string';
    return ok ? (d as Envelope) : null;
  } catch {
    return null;
  }
}
