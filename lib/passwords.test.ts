import { describe, expect, it } from 'vitest';
import { hashPassword, secureEqual, verifyPassword } from './passwords';

describe('hashPassword / verifyPassword', () => {
  it('accepts the correct password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    await expect(
      verifyPassword('correct horse battery staple', stored),
    ).resolves.toBe(true);
  });

  it('rejects an incorrect password', async () => {
    const stored = await hashPassword('correct horse battery staple');
    await expect(verifyPassword('wrong password', stored)).resolves.toBe(false);
  });

  it('produces a different salt (and hash) on every call', async () => {
    const first = await hashPassword('same-password');
    const second = await hashPassword('same-password');
    expect(first).not.toBe(second);
    await expect(verifyPassword('same-password', first)).resolves.toBe(true);
    await expect(verifyPassword('same-password', second)).resolves.toBe(true);
  });

  it('stores the expected format', async () => {
    const stored = await hashPassword('anything');
    expect(stored).toMatch(/^pbkdf2-sha256:120000:[0-9a-f]{32}:[0-9a-f]{64}$/);
  });

  it('rejects a tampered hash', async () => {
    const stored = await hashPassword('correct horse battery staple');
    const [algorithm, iterations, salt, hash] = stored.split(':');
    const tamperedHash = hash.startsWith('0')
      ? `1${hash.slice(1)}`
      : `0${hash.slice(1)}`;
    const tampered = `${algorithm}:${iterations}:${salt}:${tamperedHash}`;
    await expect(
      verifyPassword('correct horse battery staple', tampered),
    ).resolves.toBe(false);
  });

  it('rejects an unsupported algorithm', async () => {
    await expect(verifyPassword('anything', 'md5:1:aa:bb')).resolves.toBe(
      false,
    );
  });

  it('rejects a stored value with a different iteration count', async () => {
    const stored = await hashPassword('anything');
    const [algorithm, , salt, hash] = stored.split(':');
    await expect(
      verifyPassword('anything', `${algorithm}:1:${salt}:${hash}`),
    ).resolves.toBe(false);
  });

  it('rejects malformed or empty stored values without throwing', async () => {
    await expect(verifyPassword('anything', '')).resolves.toBe(false);
    await expect(verifyPassword('anything', 'not-a-valid-hash')).resolves.toBe(
      false,
    );
    await expect(
      verifyPassword('anything', 'pbkdf2-sha256:120000:zz:zz'),
    ).resolves.toBe(false);
  });
});

describe('secureEqual', () => {
  it('returns true for identical strings', () => {
    expect(secureEqual('token-value', 'token-value')).toBe(true);
  });

  it('returns false for different strings of the same length', () => {
    expect(secureEqual('token-value', 'token-valuf')).toBe(false);
  });

  it('returns false for strings of different length', () => {
    expect(secureEqual('short', 'a-much-longer-value')).toBe(false);
  });

  it('treats empty strings as equal to each other', () => {
    expect(secureEqual('', '')).toBe(true);
  });
});
