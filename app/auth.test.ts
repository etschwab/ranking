import { beforeEach, describe, expect, it, vi } from 'vitest';

// app/auth.ts pulls in Next.js request APIs and the database layer just by being
// imported. None of that is needed to exercise the pure helpers below, so it's
// replaced with lightweight stand-ins.
vi.mock('next/headers', () => ({ cookies: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
const run = vi.fn();
const bind = vi.fn(() => ({ run }));
const prepare = vi.fn(() => ({ bind }));
vi.mock('@/db/client', () => ({ db: { prepare, batch: vi.fn() } }));
vi.mock('@/db/rankings', () => ({ ensureSchema: vi.fn() }));
const getSsoConfig = vi.fn();
const refreshSsoToken = vi.fn();
vi.mock('@/lib/sso', () => ({ getSsoConfig, refreshSsoToken }));

const { safeReturnPath, legacyUserIdFromToken, revalidateSsoSession } =
  await import('./auth');

const fakeConfig = {
  authUrl: 'https://auth.example',
  clientId: 'client',
  clientSecret: 'secret',
  authorizeEndpoint: 'https://auth.example/authorize',
  tokenEndpoint: 'https://auth.example/token',
};

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

describe('revalidateSsoSession', () => {
  beforeEach(() => {
    getSsoConfig.mockReset();
    refreshSsoToken.mockReset();
    run.mockClear();
    bind.mockClear();
    prepare.mockClear();
  });

  it('treats the session as valid without calling esch-auth when SSO is not configured', async () => {
    getSsoConfig.mockReturnValue(null);
    await expect(revalidateSsoSession('hash', 'refresh')).resolves.toBe(true);
    expect(refreshSsoToken).not.toHaveBeenCalled();
  });

  it('ends the session when esch-auth rejects the refresh token (revoked grant)', async () => {
    getSsoConfig.mockReturnValue(fakeConfig);
    refreshSsoToken.mockResolvedValue({ tokens: null, invalid: true });
    await expect(revalidateSsoSession('hash', 'refresh')).resolves.toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it('keeps the session on a transient/network failure without rotating the stored token', async () => {
    getSsoConfig.mockReturnValue(fakeConfig);
    refreshSsoToken.mockResolvedValue({ tokens: null, invalid: false });
    await expect(revalidateSsoSession('hash', 'refresh')).resolves.toBe(true);
    expect(run).not.toHaveBeenCalled();
  });

  it('rotates the stored refresh token and timestamp on a successful check', async () => {
    getSsoConfig.mockReturnValue(fakeConfig);
    refreshSsoToken.mockResolvedValue({
      tokens: { refreshToken: 'new-refresh-token' },
      invalid: false,
    });
    await expect(revalidateSsoSession('hash', 'refresh')).resolves.toBe(true);
    expect(prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE auth_sessions'));
    expect(bind).toHaveBeenCalledWith('new-refresh-token', expect.any(Number), 'hash');
    expect(run).toHaveBeenCalledTimes(1);
  });
});
