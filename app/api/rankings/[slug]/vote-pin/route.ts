import { getRankingAccess, votePinCookie } from '@/db/ranking-access';
import { verifyPassword } from '@/lib/passwords';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  try {
    const { slug } = await params;
    const access = await getRankingAccess(slug);
    if (!access)
      return Response.json(
        { error: 'Ranking nicht gefunden.' },
        { status: 404 },
      );
    if (!access.votePinHash || !access.votePinToken)
      return Response.json({ ok: true });
    const body = (await request.json()) as { pin?: unknown };
    const pin = typeof body.pin === 'string' ? body.pin.trim() : '';
    if (
      !/^\d{4,8}$/.test(pin) ||
      !(await verifyPassword(pin, access.votePinHash))
    )
      return Response.json(
        { error: 'Die PIN ist nicht korrekt.' },
        { status: 403 },
      );
    return Response.json(
      { ok: true },
      {
        headers: {
          'Set-Cookie': votePinCookie(request, slug, access.votePinToken),
        },
      },
    );
  } catch {
    return Response.json(
      { error: 'Die PIN konnte nicht geprüft werden.' },
      { status: 500 },
    );
  }
}
