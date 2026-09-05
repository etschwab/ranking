import {
  createUserSession,
  legacyUserIdFromToken,
  safeReturnPath,
  sessionCookie,
  sessionCookieName,
} from '@/app/auth';
import {
  authenticateWithEmail,
  migrateLegacyAccount,
  registerWithEmail,
} from '@/db/accounts';

function formString(form: FormData, key: string, fallback = '') {
  const value = form.get(key);
  return typeof value === 'string' ? value : fallback;
}

function redirectToLogin(
  request: Request,
  returnTo: string,
  mode: string,
  error: string,
) {
  const params = new URLSearchParams({ returnTo, mode, error });
  return Response.redirect(new URL(`/login?${params}`, request.url), 303);
}

export async function POST(request: Request) {
  let failureReturnTo = '/';
  try {
    const form = await request.formData();
    const mode =
      formString(form, 'mode', 'login') === 'register' ? 'register' : 'login';
    const email = formString(form, 'email')
      .trim()
      .toLocaleLowerCase('en-US')
      .slice(0, 254);
    const password = formString(form, 'password');
    const displayName = formString(form, 'displayName').trim().slice(0, 50);
    const returnTo = safeReturnPath(formString(form, 'returnTo', '/'));
    failureReturnTo = returnTo;
    if (
      !/^\S+@\S+\.\S+$/.test(email) ||
      password.length < 8 ||
      password.length > 100
    ) {
      return redirectToLogin(
        request,
        returnTo,
        mode,
        'Bitte gib eine gültige E-Mail-Adresse und ein Passwort mit mindestens 8 Zeichen ein.',
      );
    }
    let userId: string | null;
    if (mode === 'register') {
      if (displayName.length < 2)
        return redirectToLogin(
          request,
          returnTo,
          mode,
          'Dein Name muss mindestens 2 Zeichen lang sein.',
        );
      userId = await registerWithEmail(email, password, displayName);
      if (!userId)
        return redirectToLogin(
          request,
          returnTo,
          mode,
          'Für diese E-Mail-Adresse besteht bereits ein Konto.',
        );
    } else {
      userId = await authenticateWithEmail(email, password);
      if (!userId)
        return redirectToLogin(
          request,
          returnTo,
          mode,
          'E-Mail-Adresse oder Passwort ist nicht korrekt.',
        );
    }
    const cookieHeader = request.headers.get('cookie') ?? '';
    const oldToken =
      cookieHeader
        .split(';')
        .map((part) => part.trim())
        .find((part) => part.startsWith(`${sessionCookieName}=`))
        ?.slice(sessionCookieName.length + 1) ?? '';
    await migrateLegacyAccount(
      await legacyUserIdFromToken(oldToken),
      userId,
      email,
    );
    const token = await createUserSession(userId);
    return new Response(null, {
      status: 303,
      headers: {
        Location: new URL(returnTo, request.url).toString(),
        'Set-Cookie': sessionCookie(
          token,
          new URL(request.url).protocol === 'https:',
        ),
      },
    });
  } catch (error) {
    console.error('Account request failed', error);
    const params = new URLSearchParams({
      returnTo: failureReturnTo,
      error:
        'Das Konto konnte gerade nicht geladen werden. Bitte versuche es erneut.',
    });
    return Response.redirect(new URL(`/login?${params}`, request.url), 303);
  }
}
