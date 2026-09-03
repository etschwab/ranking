// SSO client for the central ESCH Account (auth.etienneschwab.ch). Rankly does not use
// Supabase for anything else - the OAuth code exchange is only used once, to read the
// signed-in person's email/name and bootstrap or update their local Rankly account.

export const SSO_STATE_COOKIE = 'rankly-sso-state';
export const SSO_VERIFIER_COOKIE = 'rankly-sso-verifier';
export const SSO_NEXT_COOKIE = 'rankly-sso-next';
const SSO_FLOW_MAX_AGE = 10 * 60;

export type SsoConfig = {
  authUrl: string;
  clientId: string;
  clientSecret: string;
  authorizeEndpoint: string;
  tokenEndpoint: string;
};

export type SsoIdentity = { sub: string; email: string; displayName: string };

function normalizeOrigin(value: string, variableName: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error(`${variableName} ist keine gültige URL.`);
  }
  const isLocal = url.hostname === 'localhost' || url.hostname.endsWith('.localhost') || url.hostname === '127.0.0.1';
  if (process.env.NODE_ENV === 'production' && (url.protocol !== 'https:' || isLocal)) {
    throw new Error(`${variableName} muss in Produktion eine öffentliche HTTPS-URL sein.`);
  }
  return url.origin;
}

export function getSsoConfig(): SsoConfig | null {
  const authUrlRaw = process.env.NEXT_PUBLIC_AUTH_URL?.trim();
  const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const clientId = process.env.SUPABASE_OAUTH_CLIENT_ID?.trim();
  const clientSecret = process.env.SUPABASE_OAUTH_CLIENT_SECRET?.trim();

  if (!authUrlRaw && !supabaseUrlRaw && !clientId && !clientSecret) return null;

  if (!authUrlRaw || !supabaseUrlRaw || !clientId || !clientSecret) {
    throw new Error(
      'Für SSO müssen NEXT_PUBLIC_AUTH_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_OAUTH_CLIENT_ID und SUPABASE_OAUTH_CLIENT_SECRET gemeinsam gesetzt sein.'
    );
  }

  const authUrl = normalizeOrigin(authUrlRaw, 'NEXT_PUBLIC_AUTH_URL');
  const supabaseUrl = normalizeOrigin(supabaseUrlRaw, 'NEXT_PUBLIC_SUPABASE_URL');

  return {
    authUrl,
    clientId,
    clientSecret,
    authorizeEndpoint: `${supabaseUrl}/auth/v1/oauth/authorize`,
    tokenEndpoint: `${supabaseUrl}/auth/v1/oauth/token`
  };
}

function randomBase64Url(byteLength = 32) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

export async function createPkceFlow() {
  const verifier = randomBase64Url(48);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  let binary = '';
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return {
    verifier,
    challenge: btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, ''),
    state: randomBase64Url(32)
  };
}

export function buildAuthorizationUrl(config: SsoConfig, redirectUri: string, challenge: string, state: string) {
  const url = new URL(config.authorizeEndpoint);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('scope', 'email profile');
  return url;
}

export function constantTimeEqual(left: string, right: string) {
  let mismatch = left.length ^ right.length;
  const length = Math.max(left.length, right.length);
  for (let index = 0; index < length; index += 1) mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  return mismatch === 0;
}

function decodeIdentity(accessToken: string): SsoIdentity | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(payload.length / 4) * 4, '=');
    const claims = JSON.parse(atob(normalized)) as {
      sub?: unknown;
      email?: unknown;
      user_metadata?: { full_name?: unknown; name?: unknown };
    };
    if (typeof claims.sub !== 'string' || typeof claims.email !== 'string') return null;
    const metaName =
      (typeof claims.user_metadata?.full_name === 'string' && claims.user_metadata.full_name.trim()) ||
      (typeof claims.user_metadata?.name === 'string' && claims.user_metadata.name.trim()) ||
      '';
    const displayName = (metaName || claims.email.split('@')[0]).slice(0, 50);
    return { sub: claims.sub, email: claims.email, displayName };
  } catch {
    return null;
  }
}

export async function exchangeSsoCode(config: SsoConfig, code: string, verifier: string, redirectUri: string): Promise<SsoIdentity | null> {
  try {
    const credentials = btoa(`${config.clientId}:${config.clientSecret}`);
    const response = await fetch(config.tokenEndpoint, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: redirectUri, code_verifier: verifier }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8_000)
    });
    if (!response.ok) return null;
    const data = (await response.json()) as { access_token?: unknown };
    return typeof data.access_token === 'string' ? decodeIdentity(data.access_token) : null;
  } catch {
    return null;
  }
}

export function setSsoFlowCookies(headers: Headers, flow: { state: string; verifier: string; nextPath: string }, secure: boolean) {
  const options = `Path=/auth/sso; HttpOnly; SameSite=Lax; Max-Age=${SSO_FLOW_MAX_AGE}${secure ? '; Secure' : ''}`;
  headers.append('Set-Cookie', `${SSO_STATE_COOKIE}=${flow.state}; ${options}`);
  headers.append('Set-Cookie', `${SSO_VERIFIER_COOKIE}=${flow.verifier}; ${options}`);
  headers.append('Set-Cookie', `${SSO_NEXT_COOKIE}=${encodeURIComponent(flow.nextPath)}; ${options}`);
}

export function clearSsoFlowCookies(headers: Headers, secure: boolean) {
  const options = `Path=/auth/sso; HttpOnly; SameSite=Lax; Max-Age=0${secure ? '; Secure' : ''}`;
  headers.append('Set-Cookie', `${SSO_STATE_COOKIE}=; ${options}`);
  headers.append('Set-Cookie', `${SSO_VERIFIER_COOKIE}=; ${options}`);
  headers.append('Set-Cookie', `${SSO_NEXT_COOKIE}=; ${options}`);
}

export function cookieValue(request: Request, name: string) {
  return (request.headers.get('cookie') ?? '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1) ?? '';
}
