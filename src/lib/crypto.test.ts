import { describe, expect, it } from 'vitest';
import { createVault, decryptText, encryptText, openEnvelope, parseEnvelope, vaultFor, WrongPasswordError } from './crypto';

const FAST = 1000; // iterations; the real default is far higher and too slow for unit tests

describe('crypto', () => {
  it('round-trips text, including umlauts', async () => {
    const vault = await createVault('korrektes pferd', FAST);
    const env = await encryptText(vault, '{"name":"Krügerrand","wert":2500.07}');
    expect(env.data).not.toContain('Krügerrand');
    expect(await decryptText(vault, env)).toBe('{"name":"Krügerrand","wert":2500.07}');
    expect((await openEnvelope('korrektes pferd', env)).text).toContain('Krügerrand');
  });

  it('rejects a wrong password', async () => {
    const env = await encryptText(await createVault('richtig-123', FAST), 'geheim');
    await expect(openEnvelope('falsch-123', env)).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('detects tampering with the ciphertext', async () => {
    const vault = await createVault('richtig-123', FAST);
    const env = await encryptText(vault, 'geheim geheim geheim');
    const flipped = (env.data[0] === 'A' ? 'B' : 'A') + env.data.slice(1);
    await expect(decryptText(vault, { ...env, data: flipped })).rejects.toBeInstanceOf(WrongPasswordError);
  });

  it('uses a fresh IV per message and a fresh salt per vault', async () => {
    const vault = await createVault('pw-12345', FAST);
    const a = await encryptText(vault, 'gleich');
    const b = await encryptText(vault, 'gleich');
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
    expect((await createVault('pw-12345', FAST)).salt).not.toBe(vault.salt);
  });

  it('re-derives the same key from password and stored salt', async () => {
    const env = await encryptText(await createVault('pw-12345', FAST), 'x');
    expect(await decryptText(await vaultFor('pw-12345', env), env)).toBe('x');
  });

  it('recognises envelopes and nothing else', async () => {
    const env = await encryptText(await createVault('pw-12345', FAST), 'x');
    expect(parseEnvelope(JSON.stringify(env))).toEqual(env);
    expect(parseEnvelope('{"version":1,"holdings":[]}')).toBeNull();
    expect(parseEnvelope('kein json')).toBeNull();
    expect(parseEnvelope(JSON.stringify({ ...env, iterations: 0 }))).toBeNull();
  });
});
