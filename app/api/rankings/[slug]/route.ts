import { getChatGPTUser } from '@/app/chatgpt-auth';
import { deleteOwnedRanking, duplicateOwnedRanking, getRanking, updateOwnedRanking, type RankingAccessMode } from '@/db/rankings';
import { getRankingAccess, hasAccess } from '@/db/ranking-access';
import { hashPassword } from '@/lib/passwords';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const user = await getChatGPTUser();
  const access = await getRankingAccess(slug, user?.userId);
  if (!access) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  if (!hasAccess(request, slug, access)) return Response.json({ error: 'Dieses Ranking ist privat.', accessMode: access.accessMode }, { status: 403 });
  const ranking = await getRanking(slug);
  if (!ranking) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  return Response.json(ranking);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { title?: unknown; description?: unknown; isOpen?: unknown; closesAt?: unknown; accessMode?: unknown; password?: unknown; items?: unknown };
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 280) : '';
    const closesAt = typeof body.closesAt === 'number' && Number.isFinite(body.closesAt) ? Math.trunc(body.closesAt) : null;
    const accessMode: RankingAccessMode = body.accessMode === 'password' || body.accessMode === 'invite' ? body.accessMode : 'public';
    const password = typeof body.password === 'string' ? body.password : '';
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
    if (accessMode === 'password' && password && (password.length < 6 || password.length > 100)) return Response.json({ error: 'Das neue Passwort muss 6 bis 100 Zeichen lang sein.' }, { status: 400 });
    if (new Set(items.map((item) => item.label.toLocaleLowerCase('de'))).size !== items.length) {
      return Response.json({ error: 'Jede Option darf nur einmal vorkommen.' }, { status: 400 });
    }
    const submittedIds = items.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(submittedIds).size !== submittedIds.length) {
      return Response.json({ error: 'Ungültige doppelte Option.' }, { status: 400 });
    }
    const passwordHash = accessMode === 'password' && password ? await hashPassword(password) : undefined;
    const isOpen = typeof body.isOpen === 'boolean' ? body.isOpen : undefined;
    const updated = await updateOwnedRanking(slug, user.userId, { title, description, isOpen, closesAt, accessMode, passwordHash, items });
    if (!updated) return Response.json({ error: 'Du darfst dieses Ranking nicht bearbeiten.' }, { status: 403 });
    return Response.json({ ok: true, slug });
  } catch {
    return Response.json({ error: 'Das Ranking konnte nicht gespeichert werden.' }, { status: 500 });
  }
}

export async function POST(_request: Request, { params }: RouteContext) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });
    const { slug } = await params;
    const duplicateSlug = await duplicateOwnedRanking(slug, user.userId, user.email);
    if (!duplicateSlug) return Response.json({ error: 'Du darfst dieses Ranking nicht duplizieren.' }, { status: 403 });
    return Response.json({ slug: duplicateSlug }, { status: 201 });
  } catch {
    return Response.json({ error: 'Das Ranking konnte nicht dupliziert werden.' }, { status: 500 });
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
