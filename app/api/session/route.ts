import { createUserSession, legacyUserIdFromToken, safeReturnPath, sessionCookie, sessionCookieName } from '@/app/auth';
import { authenticateWithEmail, migrateLegacyAccount, registerWithEmail } from '@/db/accounts';

function redirectToLogin(request: Request, returnTo: string, mode: string, error: string) {
  const params = new URLSearchParams({ returnTo, mode, error });
  return Response.redirect(new URL(`/login?${params}`, request.url), 303);
}

export async function POST(request: Request) {
  try {
  const form = await request.formData();
  const mode = String(form.get('mode') ?? 'login') === 'register' ? 'register' : 'login';
  const email = String(form.get('email') ?? '').trim().toLocaleLowerCase('en-US').slice(0, 254);
  const password = String(form.get('password') ?? '');
  const displayName = String(form.get('displayName') ?? '').trim().slice(0, 50);
  const returnTo = safeReturnPath(String(form.get('returnTo') ?? '/'));
  if (!/^\S+@\S+\.\S+$/.test(email) || password.length < 8 || password.length > 100) {
    return redirectToLogin(request, returnTo, mode, 'Bitte gib eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein.');
  }
  let userId: string | null;
  if (mode === 'register') {
    if (displayName.length < 2) return redirectToLogin(request, returnTo, mode, 'Dein Name muss mindestens 2 Zeichen lang sein.');
    userId = await registerWithEmail(email, password, displayName);
    if (!userId) return redirectToLogin(request, returnTo, mode, 'Für diese E-Mail-Adresse besteht bereits ein Konto.');
  } else {
    userId = await authenticateWithEmail(email, password);
    if (!userId) return redirectToLogin(request, returnTo, mode, 'E-Mail-Adresse oder Passwort ist nicht korrekt.');
  }
  const cookieHeader = request.headers.get('cookie') ?? '';
  const oldToken = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`))?.slice(sessionCookieName.length + 1) ?? '';
  await migrateLegacyAccount(await legacyUserIdFromToken(oldToken), userId, email);
  const token = await createUserSession(userId);
  return new Response(null, { status: 303, headers: { Location: new URL(returnTo, request.url).toString(), 'Set-Cookie': sessionCookie(token, new URL(request.url).protocol === 'https:') } });
  } catch (error) {
    console.error('Account request failed', error);
    const stage = error instanceof Error && /^schema-(users|sessions)$/.test(error.message) ? error.message : 'account-operation';
    return Response.json({ error: 'Das Konto konnte gerade nicht geladen werden.' }, { status: 500, headers: { 'X-Rankly-Error-Stage': stage } });
  }
}
