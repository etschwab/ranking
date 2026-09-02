import { createUserSession, legacyUserIdFromToken, safeReturnPath, sessionCookie, sessionCookieName } from '@/app/auth';
import { findOrCreateGoogleUser, migrateLegacyAccount } from '@/db/accounts';

function cookieValue(request: Request, name: string) {
  return (request.headers.get('cookie') ?? '').split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`))?.slice(name.length + 1) ?? '';
}

function loginRedirect(request: Request, returnTo: string, error: string) {
  const params = new URLSearchParams({ returnTo, error });
  return Response.redirect(new URL(`/login?${params}`, request.url), 303);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(decodeURIComponent(cookieValue(request, 'rankly-google-return') || '/'));
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const expectedState = cookieValue(request, 'rankly-google-state');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!code || !state || !expectedState || state !== expectedState || !clientId || !clientSecret) return loginRedirect(request, returnTo, 'Google-Anmeldung konnte nicht bestätigt werden.');
  try {
    const redirectUri = `${url.origin}/api/auth/google/callback`;
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: 'authorization_code' }) });
    const tokenData = await tokenResponse.json() as { id_token?: string };
    if (!tokenResponse.ok || !tokenData.id_token) throw new Error('token');
    const identityResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(tokenData.id_token)}`);
    const identity = await identityResponse.json() as { aud?: string; sub?: string; email?: string; email_verified?: string | boolean; name?: string; iss?: string };
    if (!identityResponse.ok || identity.aud !== clientId || !identity.sub || !identity.email || !['true', true].includes(identity.email_verified ?? false) || !['accounts.google.com', 'https://accounts.google.com'].includes(identity.iss ?? '')) throw new Error('identity');
    const displayName = (identity.name?.trim() || identity.email.split('@')[0]).slice(0, 50);
    const userId = await findOrCreateGoogleUser({ sub: identity.sub, email: identity.email, displayName });
    await migrateLegacyAccount(await legacyUserIdFromToken(cookieValue(request, sessionCookieName)), userId, identity.email.toLocaleLowerCase('en-US'));
    const token = await createUserSession(userId);
    const secure = url.protocol === 'https:' ? '; Secure' : '';
    const headers = new Headers({ Location: new URL(returnTo, request.url).toString() });
    headers.append('Set-Cookie', sessionCookie(token, url.protocol === 'https:'));
    headers.append('Set-Cookie', `rankly-google-state=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    headers.append('Set-Cookie', `rankly-google-return=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`);
    return new Response(null, { status: 303, headers });
  } catch {
    return loginRedirect(request, returnTo, 'Google-Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.');
  }
}
