import { deleteUserSession, expiredSessionCookie, safeReturnPath, sessionCookieName } from '@/app/auth';

export async function GET(request: Request) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get('returnTo') ?? '/');
  const cookieHeader = request.headers.get('cookie') ?? '';
  const token = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`))?.slice(sessionCookieName.length + 1) ?? '';
  await deleteUserSession(token);
  return new Response(null, { status: 303, headers: { Location: new URL(returnTo, request.url).toString(), 'Set-Cookie': expiredSessionCookie() } });
}
