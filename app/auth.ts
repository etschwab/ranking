import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/db/client';
import { ensureSchema } from '@/db/rankings';

export type RanklyUser = {
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

const sessionCookieName = 'rankly-session';
const sessionDuration = 60 * 60 * 24 * 30;
const encoder = new TextEncoder();

export function safeReturnPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (
      url.origin !== 'https://app.local' ||
      ['/login', '/api/session', '/api/session/logout'].includes(url.pathname)
    )
      return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return '/';
  }
}

async function tokenHash(token: string) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(token),
  );
  return Buffer.from(digest).toString('hex');
}

async function legacySignature(payload: string) {
  const secret =
    process.env.AUTH_SECRET ??
    (process.env.NODE_ENV !== 'production'
      ? 'rankly-local-development-secret'
      : '');
  if (!secret) return '';
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return Buffer.from(
    await crypto.subtle.sign('HMAC', key, encoder.encode(payload)),
  ).toString('base64url');
}

export async function legacyUserIdFromToken(token: string) {
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature) return null;
  const expected = await legacySignature(payload);
  if (!expected || expected.length !== providedSignature.length) return null;
  let difference = 0;
  for (let index = 0; index < expected.length; index += 1)
    difference |=
      expected.charCodeAt(index) ^ providedSignature.charCodeAt(index);
  if (difference !== 0) return null;
  try {
    const value = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    ) as { userId?: unknown };
    return typeof value.userId === 'string' ? value.userId : null;
  } catch {
    return null;
  }
}

export async function createUserSession(userId: string) {
  await ensureSchema();
  const token = Buffer.from(
    crypto.getRandomValues(new Uint8Array(32)),
  ).toString('base64url');
  await db
    .prepare(
      'INSERT INTO auth_sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)',
    )
    .bind(await tokenHash(token), userId, Date.now() + sessionDuration * 1000)
    .run();
  return token;
}

export function sessionCookie(value: string, secure: boolean) {
  return `${sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${sessionDuration}${secure ? '; Secure' : ''}`;
}

export function expiredSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function deleteUserSession(token: string) {
  if (!token) return;
  await ensureSchema();
  await db
    .prepare('DELETE FROM auth_sessions WHERE token_hash = ?')
    .bind(await tokenHash(token))
    .run();
}

export async function getCurrentUser(): Promise<RanklyUser | null> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return null;
  await ensureSchema();
  const session = await db
    .prepare(`
    SELECT u.id AS userId, u.display_name AS displayName, u.email, s.expires_at AS expiresAt
    FROM auth_sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ?
  `)
    .bind(await tokenHash(token))
    .first<{
      userId: string;
      displayName: string;
      email: string;
      expiresAt: number;
    }>();
  if (!session || Number(session.expiresAt) <= Date.now()) {
    if (session) await deleteUserSession(token);
    return null;
  }
  return {
    userId: session.userId,
    displayName: session.displayName,
    email: session.email,
    fullName: session.displayName,
  };
}

export async function requireUser(returnTo: string) {
  const user = await getCurrentUser();
  if (user) return user;
  redirect(signInPath(returnTo));
}

export function signInPath(returnTo: string) {
  return `/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
export function signOutPath(returnTo = '/') {
  return `/api/session/logout?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`;
}
export { sessionCookieName };
