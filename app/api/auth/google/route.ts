import { safeReturnPath } from '@/app/auth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const returnTo = safeReturnPath(url.searchParams.get('returnTo') ?? '/');
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) {
    const params = new URLSearchParams({ returnTo, error: 'Google-Login ist noch nicht konfiguriert.' });
    return Response.redirect(new URL(`/login?${params}`, request.url), 303);
  }
  const state = Buffer.from(crypto.getRandomValues(new Uint8Array(24))).toString('base64url');
  const redirectUri = `${url.origin}/api/auth/google/callback`;
  const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  authorization.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: 'openid email profile', state, prompt: 'select_account' }).toString();
  const secure = url.protocol === 'https:' ? '; Secure' : '';
  const headers = new Headers({ Location: authorization.toString() });
  headers.append('Set-Cookie', `rankly-google-state=${state}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  headers.append('Set-Cookie', `rankly-google-return=${encodeURIComponent(returnTo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=600${secure}`);
  return new Response(null, { status: 303, headers });
}
