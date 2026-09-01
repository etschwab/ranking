import { getChatGPTUser } from '@/app/chatgpt-auth';
import { deleteOwnedRanking, duplicateOwnedRanking, getOwnedRanking, getRanking, hasUserVoted, isSlugAvailable, updateOwnedRanking, type RankingAccessMode, type ResultsVisibility, type VotingNameMode } from '@/db/rankings';
import { getRankingAccess, hasAccess, hasVotePinAccess } from '@/db/ranking-access';
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
  const viewerHasVoted = await hasUserVoted(ranking.id, user?.userId);
  const closed = !ranking.isOpen || (ranking.closesAt !== null && Date.now() >= ranking.closesAt);
  const canViewResults = access.isOwner || ranking.resultsVisibility === 'always' || (ranking.resultsVisibility === 'after_vote' && viewerHasVoted) || (ranking.resultsVisibility === 'after_close' && closed);
  const items = canViewResults ? ranking.items : ranking.items.map((item) => ({ ...item, average: null, averageRankPosition: null, votes: 0, distribution: {} }));
  return Response.json({ ...ranking, items, viewerHasVoted, canViewResults, votePinUnlocked: hasVotePinAccess(request, slug, access) });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  try {
    const user = await getChatGPTUser();
    if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.' }, { status: 401 });
    const { slug } = await params;
    const body = await request.json() as { slug?: unknown; title?: unknown; description?: unknown; isOpen?: unknown; closesAt?: unknown; accessMode?: unknown; password?: unknown; nameMode?: unknown; oneVotePerUser?: unknown; resultsVisibility?: unknown; votePin?: unknown; removeVotePin?: unknown; previewImageData?: unknown; items?: unknown; tiers?: unknown };
    const customSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : slug;
    const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
    const description = typeof body.description === 'string' ? body.description.trim().slice(0, 280) : '';
    const closesAt = typeof body.closesAt === 'number' && Number.isFinite(body.closesAt) ? Math.trunc(body.closesAt) : null;
    const accessMode: RankingAccessMode = body.accessMode === 'password' || body.accessMode === 'invite' ? body.accessMode : 'public';
    const password = typeof body.password === 'string' ? body.password : '';
    const nameMode: VotingNameMode = body.nameMode === 'anonymous' ? 'anonymous' : 'required';
    const oneVotePerUser = body.oneVotePerUser !== false;
    const resultsVisibility: ResultsVisibility = body.resultsVisibility === 'after_vote' || body.resultsVisibility === 'after_close' ? body.resultsVisibility : 'always';
    const votePin = typeof body.votePin === 'string' ? body.votePin.trim() : '';
    const previewImageData = body.previewImageData === null ? null : typeof body.previewImageData === 'string' && /^data:image\/(?:webp|png|jpeg);base64,/.test(body.previewImageData) && body.previewImageData.length <= 500_000 ? body.previewImageData : undefined;
    const items = Array.isArray(body.items) ? body.items.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const item = value as { id?: unknown; label?: unknown; imageData?: unknown };
      const label = typeof item.label === 'string' ? item.label.trim().slice(0, 80) : '';
      if (!label) return [];
      const imageData = item.imageData === null ? null : typeof item.imageData === 'string' && /^data:image\/(?:webp|png|jpeg);base64,/.test(item.imageData) && item.imageData.length <= 120_000 ? item.imageData : undefined;
      return [{ id: typeof item.id === 'string' ? item.id : undefined, label, imageData }];
    }).slice(0, 30) : [];
    const tiers = Array.isArray(body.tiers) ? body.tiers.flatMap((value) => {
      if (!value || typeof value !== 'object') return [];
      const tier = value as { id?: unknown; label?: unknown; color?: unknown };
      const label = typeof tier.label === 'string' ? tier.label.trim().slice(0, 24) : '';
      const color = typeof tier.color === 'string' && /^#[0-9a-f]{6}$/i.test(tier.color) ? tier.color : '';
      if (!label || !color) return [];
      return [{ id: typeof tier.id === 'string' ? tier.id : undefined, label, color }];
    }).slice(0, 8) : [];
    if (title.length < 3) return Response.json({ error: 'Bitte gib einen Titel mit mindestens 3 Zeichen ein.' }, { status: 400 });
    if (!/^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/.test(customSlug)) return Response.json({ error: 'Der Kurzlink muss 3 bis 32 Zeichen lang sein und darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten.' }, { status: 400 });
    if (items.length < 2) return Response.json({ error: 'Bitte behalte mindestens 2 Optionen.' }, { status: 400 });
    if (items.reduce((total, item) => total + (item.imageData?.length ?? 0), 0) > 3_600_000) return Response.json({ error: 'Die Bilder sind zusammen zu gross.' }, { status: 400 });
    if (tiers.length < 2) return Response.json({ error: 'Bitte verwende mindestens 2 Stufen.' }, { status: 400 });
    if (body.closesAt !== null && body.closesAt !== undefined && closesAt === null) return Response.json({ error: 'Die Abstimmungsfrist ist ungültig.' }, { status: 400 });
    if (accessMode === 'password' && password && (password.length < 6 || password.length > 100)) return Response.json({ error: 'Das neue Passwort muss 6 bis 100 Zeichen lang sein.' }, { status: 400 });
    if (votePin && !/^\d{4,8}$/.test(votePin)) return Response.json({ error: 'Die Abstimmungs-PIN muss aus 4 bis 8 Ziffern bestehen.' }, { status: 400 });
    if (new Set(items.map((item) => item.label.toLocaleLowerCase('de'))).size !== items.length) {
      return Response.json({ error: 'Jede Option darf nur einmal vorkommen.' }, { status: 400 });
    }
    const submittedIds = items.flatMap((item) => item.id ? [item.id] : []);
    if (new Set(submittedIds).size !== submittedIds.length) {
      return Response.json({ error: 'Ungültige doppelte Option.' }, { status: 400 });
    }
    const submittedTierIds = tiers.flatMap((tier) => tier.id ? [tier.id] : []);
    if (new Set(submittedTierIds).size !== submittedTierIds.length) return Response.json({ error: 'Ungültige doppelte Stufe.' }, { status: 400 });
    const passwordHash = accessMode === 'password' && password ? await hashPassword(password) : undefined;
    const votePinHash = votePin ? await hashPassword(votePin) : body.removeVotePin === true ? null : undefined;
    const isOpen = typeof body.isOpen === 'boolean' ? body.isOpen : undefined;
    const owned = await getOwnedRanking(slug, user.userId);
    if (!owned) return Response.json({ error: 'Du darfst dieses Ranking nicht bearbeiten.' }, { status: 403 });
    if (!await isSlugAvailable(customSlug, owned.id)) return Response.json({ error: 'Dieser Kurzlink ist bereits vergeben.' }, { status: 409 });
    const updated = await updateOwnedRanking(slug, user.userId, { slug: customSlug, title, description, isOpen, closesAt, accessMode, passwordHash, nameMode, oneVotePerUser, resultsVisibility, votePinHash, previewImageData, items, tiers });
    if (!updated) return Response.json({ error: 'Du darfst dieses Ranking nicht bearbeiten.' }, { status: 403 });
    return Response.json({ ok: true, slug: updated });
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
