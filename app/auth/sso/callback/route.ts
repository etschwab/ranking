import { legacyUserIdFromToken, safeReturnPath, sessionCookie, sessionCookieName, createUserSession } from '@/app/auth';
import { findOrCreateSsoUser, migrateLegacyAccount } from '@/db/accounts';
import { clearSsoFlowCookies, constantTimeEqual, cookieValue, exchangeSsoCode, getSsoConfig, SSO_NEXT_COOKIE, SSO_STATE_COOKIE, SSO_VERIFIER_COOKIE } from '@/lib/sso';

function loginRedirect(request: Request, returnTo: string, error: string, secure: boolean) {
  const params = new URLSearchParams({ returnTo, error });
  const headers = new Headers({ Location: new URL(`/login?${params}`, request.url).toString() });
  clearSsoFlowCookies(headers, secure);
  return new Response(null, { status: 303, headers });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const config = getSsoConfig();
  const nextPath = safeReturnPath(decodeURIComponent(cookieValue(request, SSO_NEXT_COOKIE) || '/'));

  if (!config) return loginRedirect(request, nextPath, 'Die zentrale Anmeldung ist für diese Umgebung noch nicht eingerichtet.', secure);

  const oauthError = url.searchParams.get('error');
  if (oauthError) {
    return loginRedirect(request, nextPath, oauthError === 'access_denied' ? 'Die Anmeldung wurde abgebrochen.' : 'Die zentrale Anmeldung ist fehlgeschlagen.', secure);
  }

  const returnedState = url.searchParams.get('state') ?? '';
  const expectedState = cookieValue(request, SSO_STATE_COOKIE);
  const verifier = cookieValue(request, SSO_VERIFIER_COOKIE);
  const code = url.searchParams.get('code');

  if (!code || !returnedState || !expectedState || !verifier || !constantTimeEqual(returnedState, expectedState)) {
    return loginRedirect(request, nextPath, 'Die Sicherheitsprüfung der Anmeldung ist fehlgeschlagen. Bitte versuche es erneut.', secure);
  }

  const redirectUri = `${url.origin}/auth/sso/callback`;
  const identity = await exchangeSsoCode(config, code, verifier, redirectUri);
  if (!identity) return loginRedirect(request, nextPath, 'Die Anmeldebestätigung ist abgelaufen oder konnte nicht eingelöst werden.', secure);

  try {
    const userId = await findOrCreateSsoUser(identity);
    const oldToken = cookieValue(request, sessionCookieName);
    await migrateLegacyAccount(await legacyUserIdFromToken(oldToken), userId, identity.email.toLocaleLowerCase('en-US'));
    const token = await createUserSession(userId);

    const headers = new Headers({ Location: new URL(nextPath, url.origin).toString() });
    headers.append('Set-Cookie', sessionCookie(token, secure));
    clearSsoFlowCookies(headers, secure);
    return new Response(null, { status: 303, headers });
  } catch (error) {
    console.error('SSO callback failed', error);
    return loginRedirect(request, nextPath, 'Das Konto konnte gerade nicht geladen werden. Bitte versuche es erneut.', secure);
  }
}
