import { safeReturnPath } from '@/app/auth';
import { buildAuthorizationUrl, createPkceFlow, getSsoConfig, setSsoFlowCookies } from '@/lib/sso';

export async function GET(request: Request) {
  const config = getSsoConfig();
  if (!config) {
    const params = new URLSearchParams({ error: 'Die zentrale Anmeldung ist für diese Umgebung noch nicht eingerichtet.' });
    return Response.redirect(new URL(`/login?${params}`, request.url), 303);
  }

  const url = new URL(request.url);
  const nextPath = safeReturnPath(url.searchParams.get('next') ?? '/');
  const flow = await createPkceFlow();
  const redirectUri = `${url.origin}/auth/sso/callback`;

  const headers = new Headers({ Location: buildAuthorizationUrl(config, redirectUri, flow.challenge, flow.state).toString() });
  setSsoFlowCookies(headers, { state: flow.state, verifier: flow.verifier, nextPath }, url.protocol === 'https:');

  return new Response(null, { status: 303, headers });
}
