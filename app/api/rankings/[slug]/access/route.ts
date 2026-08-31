import { accessCookie, getRankingAccess } from '@/db/ranking-access';
import { secureEqual, verifyPassword } from '@/lib/passwords';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const access = await getRankingAccess(slug);
    if (!access) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
    const body = await request.json() as { password?: unknown; invite?: unknown };
    let valid = access.accessMode === 'public';
    if (access.accessMode === 'password' && access.passwordHash && typeof body.password === 'string' && body.password.length <= 100) {
      valid = await verifyPassword(body.password, access.passwordHash);
    }
    if (access.accessMode === 'invite' && access.inviteToken && typeof body.invite === 'string') {
      valid = secureEqual(body.invite, access.inviteToken);
    }
    if (!valid || !access.accessToken) return Response.json({ error: access.accessMode === 'password' ? 'Das Passwort ist nicht korrekt.' : 'Dieser Einladungslink ist ungültig.' }, { status: 403 });
    return Response.json({ ok: true }, { headers: { 'Set-Cookie': accessCookie(request, slug, access.accessToken) } });
  } catch {
    return Response.json({ error: 'Der Zugriff konnte nicht freigeschaltet werden.' }, { status: 500 });
  }
}
