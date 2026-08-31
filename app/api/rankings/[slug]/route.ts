import { getChatGPTUser } from '@/app/chatgpt-auth';
import { deleteOwnedRanking, getRanking, updateOwnedRanking } from '@/db/rankings';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const ranking = await getRanking(slug);
  if (!ranking) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  return Response.json(ranking);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { title?: unknown; description?: unknown; closesAt?: unknown; items?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 280) : '';
    const closesAt = typeof body.closesAt === 'number' && Number.isFinite(body.closesAt) ? Math.trunc(body.closesAt) : null;
    const items = Array.isArray(body.items) ? body.items.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as { id?: unknown; label?: unknown };
      const label = typeof item.label === 'string' ? item.label.trim().slice(0, 80) : '';
      if (!label) return [];
      return [{ id: typeof item.id === 'string' ? item.id : undefined, label }];
    }).slice(0, 30) : [];
    if (title.length < 3) return Response.json({ error: 'Bitte gib einen Titel mit mindestens 3 Zeichen ein.' }, { status: 400 });
    if (items.length < 2) return Response.json({ error: 'Bitte behalte mindestens 2 Optionen.' }, { status: 400 });
    if (body.closesAt !== null && body.closesAt !== undefined && closesAt === null) return Response.json({ error: 'Die Abstimmungsfrist ist ungültig.' }, { status: 400 });
    if (new Set(items.map((item) => item.label.toLocaleLowerCase('de'))).size !== items.length) {
      return Response.json({ error: 'Jede Option darf nur einmal vorkommen.' }, { status: 400 });
    }
    const submittedIds = items.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(submittedIds).size !== submittedIds.length) {
      return Response.json({ error: 'Ungültige doppelte Option.' }, { status: 400 });
    }
    const updated = await updateOwnedRanking(slug, user.userId, { title, description, closesAt, items });
    if (!updated) return Response.json({ error: 'Du darfst dieses Ranking nicht bearbeiten.' }, { status: 403 });
    return Response.json({ ok: true, slug });
  } catch {
    return Response.json({ error: 'Das Ranking konnte nicht gespeichert werden.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: RouteContext) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { confirmationTitle?: unknown };
    const confirmationTitle = typeof body.confirmationTitle === 'string' ? body.confirmationTitle.trim() : '';
    const result = await deleteOwnedRanking(slug, user.userId, confirmationTitle);
    if (result === 'not-owned') return Response.json({ error: 'Du darfst dieses Ranking nicht löschen.' }, { status: 403 });
    if (result === 'title-mismatch') return Response.json({ error: 'Der eingegebene Titel stimmt nicht überein.' }, { status: 400 });
    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: 'Das Ranking konnte nicht gelöscht werden.' }, { status: 500 });
  }
}
