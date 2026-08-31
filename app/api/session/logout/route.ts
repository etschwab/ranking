import { expiredSessionCookie, safeReturnPath } from '@/app/chatgpt-auth';

export async function GET(request: Request) {
  const returnTo = safeReturnPath(new URL(request.url).searchParams.get('returnTo') ?? '/');
  return new Response(null, { status: 303, headers: { Location: new URL(returnTo, request.url).toString(), 'Set-Cookie': expiredSessionCookie() } });
}
