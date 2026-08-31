import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export type ChatGPTUser = { userId: string; displayName: string; email: string; fullName: string | null };

const sessionCookieName = 'rankly-session';
const encoder = new TextEncoder();

function safeReturnPath(value: string) {
  if (!value.startsWith('/') || value.startsWith('//')) return '/';
  try {
    const url = new URL(value, 'https://app.local');
    if (url.origin !== 'https://app.local' || ['/login', '/api/session', '/api/session/logout'].includes(url.pathname)) return '/';
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return '/'; }
}

function secret() {
  const value = process.env.AUTH_SECRET;
  if (value) return value;
  if (process.env.NODE_ENV !== 'production') return 'rankly-local-development-secret';
  throw new Error('AUTH_SECRET is not configured.');
}

function base64Url(value: Uint8Array | string) {
  return Buffer.from(value instanceof Uint8Array ? value : encoder.encode(value)).toString('base64url');
}

async function signature(payload: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret()), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}

function secureEqual(left: string, right: string) {
  const leftBytes = encoder.encode(left);
  const rightBytes = encoder.encode(right);
  if (leftBytes.length !== rightBytes.length) return false;
  let difference = 0;
  for (let index = 0; index < leftBytes.length; index += 1) difference |= leftBytes[index] ^ rightBytes[index];
  return difference === 0;
}

export async function createSession(displayName: string) {
  const payload = base64Url(JSON.stringify({ userId: crypto.randomUUID(), displayName, createdAt: Date.now() }));
  return `${payload}.${await signature(payload)}`;
}

export function sessionCookie(value: string, secure: boolean) {
  return `${sessionCookieName}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000${secure ? '; Secure' : ''}`;
}

export function expiredSessionCookie() {
  return `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export async function getChatGPTUser(): Promise<ChatGPTUser | null> {
  const token = (await cookies()).get(sessionCookieName)?.value;
  if (!token) return null;
  const [payload, providedSignature] = token.split('.');
  if (!payload || !providedSignature || !secureEqual(providedSignature, await signature(payload))) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { userId?: unknown; displayName?: unknown };
    if (typeof session.userId !== 'string' || typeof session.displayName !== 'string') return null;
    return { userId: session.userId, displayName: session.displayName, email: `${session.userId}@rankly.local`, fullName: session.displayName };
  } catch { return null; }
}

export async function requireChatGPTUser(returnTo: string) {
  const user = await getChatGPTUser();
  if (user) return user;
  redirect(chatGPTSignInPath(returnTo));
}

export function chatGPTSignInPath(returnTo: string) { return `/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`; }
export function chatGPTSignOutPath(returnTo = '/') { return `/api/session/logout?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`; }
export { safeReturnPath };
