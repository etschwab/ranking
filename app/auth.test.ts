import { beforeEach, describe, expect, it, vi } from 'vitest';

// app/auth.ts pulls in Next.js request APIs and the database layer just by being
// imported. None of that is needed to exercise the pure helpers below, so it's
// replaced with lightweight stand-ins.
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('@/db/client', () => ({ db: { prepare: vi.fn(), batch: vi.fn() } }));
vi.mock('@/db/rankings', () => ({ ensureSchema: vi.fn() }));

const { safeReturnPath, legacyUserIdFromToken } = await import('./auth');

async function signLegacyPayload(payload: string, secret: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload),
  );
  return Buffer.from(signature).toString('base64url');
}

async function buildLegacyToken(
  userId: string,
  secret = 'rankly-local-development-secret',
) {
  const payload = Buffer.from(JSON.stringify({ userId })).toString('base64url');
  const signature = await signLegacyPayload(payload, secret);
  return `${payload}.${signature}`;
}

describe('safeReturnPath', () => {
  it('keeps a plain in-app path', () => {
    expect(safeReturnPath('/r/abc123')).toBe('/r/abc123');
  });

  it('keeps query string and hash', () => {
    expect(safeReturnPath('/mine?tab=open#top')).toBe('/mine?tab=open#top');
  });

  it('rejects an absolute external URL', () => {
    expect(safeReturnPath('https://evil.example/phish')).toBe('/');
  });

  it('rejects a protocol-relative URL (open redirect attempt)', () => {
    expect(safeReturnPath('//evil.example/phish')).toBe('/');
  });

  it('rejects a backslash-based open-redirect trick', () => {
    // The WHATWG URL parser treats a leading "\" like "//" for special schemes,
    // so "/\evil.example" actually resolves to the origin "https://evil.example".
    expect(safeReturnPath('/\\evil.example')).toBe('/');
  });

  it('blocks the login page to avoid redirect loops', () => {
    expect(safeReturnPath('/login')).toBe('/');
  });

  it('blocks the session endpoints', () => {
    expect(safeReturnPath('/api/session')).toBe('/');
    expect(safeReturnPath('/api/session/logout')).toBe('/');
  });

  it('falls back to "/" for an empty string', () => {
    expect(safeReturnPath('')).toBe('/');
  });
});

describe('legacyUserIdFromToken', () => {
  beforeEach(() => {
    delete process.env.AUTH_SECRET;
  });

  it('accepts a validly signed token and returns the encoded userId', async () => {
    const token = await buildLegacyToken('user-123');
    await expect(legacyUserIdFromToken(token)).resolves.toBe('user-123');
  });

  it('rejects a token with a tampered signature', async () => {
    const token = await buildLegacyToken('user-123');
    const [payload, signature] = token.split('.');
    const tamperedSignature = signature.startsWith('A')
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;
    await expect(
      legacyUserIdFromToken(`${payload}.${tamperedSignature}`),
    ).resolves.toBeNull();
  });

  it('rejects a token signed with a different secret', async () => {
    const token = await buildLegacyToken('user-123', 'a-different-secret');
    await expect(legacyUserIdFromToken(token)).resolves.toBeNull();
  });

  it('rejects a malformed token without a signature part', async () => {
    await expect(legacyUserIdFromToken('not-a-real-token')).resolves.toBeNull();
  });

  it('rejects an empty token', async () => {
    await expect(legacyUserIdFromToken('')).resolves.toBeNull();
  });

  it('rejects a validly signed payload that is not valid JSON', async () => {
    const payload = Buffer.from('not-json').toString('base64url');
    const signature = await signLegacyPayload(
      payload,
      'rankly-local-development-secret',
    );
    await expect(
      legacyUserIdFromToken(`${payload}.${signature}`),
    ).resolves.toBeNull();
  });

  it('rejects a validly signed payload whose userId is not a string', async () => {
    const payload = Buffer.from(JSON.stringify({ userId: 42 })).toString(
      'base64url',
    );
    const signature = await signLegacyPayload(
      payload,
      'rankly-local-development-secret',
    );
    await expect(
      legacyUserIdFromToken(`${payload}.${signature}`),
    ).resolves.toBeNull();
  });
});
