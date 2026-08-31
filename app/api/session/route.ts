import { createSession, safeReturnPath, sessionCookie } from '@/app/chatgpt-auth';

export async function POST(request: Request) {
  const form = await request.formData();
  const displayName = String(form.get('displayName') ?? '').trim().slice(0, 50);
  const returnTo = safeReturnPath(String(form.get('returnTo') ?? '/'));
  if (displayName.length < 2) return Response.redirect(new URL(`/login?returnTo=${encodeURIComponent(returnTo)}`, request.url), 303);
  const token = await createSession(displayName);
  return new Response(null, { status: 303, headers: { Location: new URL(returnTo, request.url).toString(), 'Set-Cookie': sessionCookie(token, new URL(request.url).protocol === 'https:') } });
}
