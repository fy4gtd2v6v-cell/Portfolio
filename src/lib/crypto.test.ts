import { describe, expect, it } from 'vitest';
import {
  changePassword, createVault, decryptText, encryptText, EnvelopeV1, generateRecoveryCode, normalizeRecoveryCode,
  parseEnvelope, renewRecoveryCode, unlockWithEither, unlockWithPassword, unlockWithRecoveryCode, verifyPassword, WrongPasswordError,
} from './crypto';

const FAST = 1000; // iterations; the real default is far higher and too slow for unit tests

describe('crypto', () => {
  it('round-trips text, including umlauts', async () => {
    const { vault } = await createVault('korrektes pferd', FAST);
    const env = await encryptText(vault, '{"name":"Krügerrand","wert":2500.07}');
    expect(JSON.stringify(env)).not.toContain('Krügerrand');
    expect(await decryptText(vault, env)).toBe('{"name":"Krügerrand","wert":2500.07}');
    expect((await unlockWithPassword('korrektes pferd', env)).text).toContain('Krügerrand');
  });

  it('rejects a wrong password', async () => {
    const env = await encryptText((await createVault('richtig-123', FAST)).vault, 'geheim');
    await expect(unlockWithPassword('falsch-123', env)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detects tampering with the ciphertext', async () => {
    const { vault } = await createVault('richtig-123', FAST);
    const env = await encryptText(vault, 'geheim geheim geheim');
    const flipped = (env.data[0] === 'A' ? 'B' : 'A') + env.data.slice(1);
    await expect(decryptText(vault, { ...env, data: flipped })).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('uses a fresh IV per message and fresh salts per vault', async () => {
    const { vault } = await createVault('pw-12345', FAST);
    const a = await encryptText(vault, 'gleich');
    const b = await encryptText(vault, 'gleich');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect((await createVault('pw-12345', FAST)).vault.pw.salt).not.toBe(vault.pw.salt);
  });

  it('recognises envelopes and nothing else', async () => {
    const env = await encryptText((await createVault('pw-12345', FAST)).vault, 'x');
    expect(parseEnvelope(JSON.stringify(env))).toEqual(env);
    expect(parseEnvelope('{"version":1,"holdings":[]}')).toBeNull();
    expect(parseEnvelope('kein json')).toBeNull();
    expect(parseEnvelope(JSON.stringify({ ...env, iterations: 0 }))).toBeNull();
    expect(parseEnvelope(JSON.stringify({ ...env, rec: undefined }))).toBeNull();
  });
});

describe('recovery code', () => {
  it('has the expected shape and no look-alike characters', () => {
    const code = generateRecoveryCode();
    expect(code).toMatch(/^([A-HJ-NP-Z2-9]{4}-){5}[A-HJ-NP-Z2-9]{4}$/);
    expect(generateRecoveryCode()).not.toBe(code);
    expect(normalizeRecoveryCode(' abcd-efgh ')).toBe('ABCDEFGH');
  });

  it('opens the data without the password, however it is typed', async () => {
    const { vault, recoveryCode } = await createVault('vergessen-123', FAST);
    const env = await encryptText(vault, 'meine daten');
    expect((await unlockWithRecoveryCode(recoveryCode, env)).text).toBe('meine daten');
    expect((await unlockWithRecoveryCode(recoveryCode.toLowerCase().replace(/-/g, ' '), env)).text).toBe('meine daten');
    await expect(unlockWithRecoveryCode('AAAA-AAAA-AAAA-AAAA-AAAA-AAAA', env)).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(unlockWithPassword(recoveryCode, env)).rejects.toBeInstanceOf(WrongPasswordError);
    expect((await unlockWithEither(recoveryCode, env)).text).toBe('meine daten');
    expect((await unlockWithEither('vergessen-123', env)).text).toBe('meine daten');
  });

  it('lets you set a new password after recovery; old password stops working, code stays valid', async () => {
    const { vault, recoveryCode } = await createVault('altes-passwort', FAST);
    const env = await encryptText(vault, 'daten');
    const recovered = await unlockWithRecoveryCode(recoveryCode, env);
    const next = await changePassword(recovered.vault, 'neues-passwort');
    const env2 = await encryptText(next, recovered.text);
    expect((await unlockWithPassword('neues-passwort', env2)).text).toBe('daten');
    await expect(unlockWithPassword('altes-passwort', env2)).rejects.toBeInstanceOf(WrongPasswordError);
    expect((await unlockWithRecoveryCode(recoveryCode, env2)).text).toBe('daten');
    expect(await verifyPassword('neues-passwort', next)).toBe(true);
    expect(await verifyPassword('altes-passwort', next)).toBe(false);
  });

  it('can be renewed; the old code stops working', async () => {
    const first = await createVault('pw-12345', FAST);
    const renewed = await renewRecoveryCode(first.vault);
    const env = await encryptText(renewed.vault, 'daten');
    expect((await unlockWithRecoveryCode(renewed.recoveryCode, env)).text).toBe('daten');
    await expect(unlockWithRecoveryCode(first.recoveryCode, env)).rejects.toBeInstanceOf(WrongPasswordError);
    expect((await unlockWithPassword('pw-12345', env)).text).toBe('daten');
  });
});

describe('data saved in the first format', () => {
  /** Builds an envelope the way the first released version did. */
  async function v1(password: string, text: string): Promise<EnvelopeV1> {
    const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
    const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: FAST }, material, { name: 'AES-GCM', length: 256 }, false, ['encrypt']);
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(text));
    return { format: 'portfolio-encrypted', v: 1, kdf: 'PBKDF2-SHA256', iterations: FAST, salt: b64(salt), iv: b64(iv), data: b64(new Uint8Array(ct)) };
  }

  it('still opens with the password and is upgraded with a new recovery code', async () => {
    const env = await v1('altes-format', 'alte daten');
    expect(parseEnvelope(JSON.stringify(env))).toEqual(env);
    const opened = await unlockWithPassword('altes-format', env);
    expect(opened.text).toBe('alte daten');
    expect(opened.newRecoveryCode).toMatch(/^([A-Z2-9]{4}-){5}[A-Z2-9]{4}$/);
    const upgraded = await encryptText(opened.vault, opened.text);
    expect(upgraded.v).toBe(2);
    expect((await unlockWithRecoveryCode(opened.newRecoveryCode!, upgraded)).text).toBe('alte daten');
    await expect(unlockWithPassword('falsch', env)).rejects.toBeInstanceOf(WrongPasswordError);
    await expect(unlockWithRecoveryCode('AAAA', env)).rejects.toThrow(/noch kein Wiederherstellungsschlüssel/);
  });
});
