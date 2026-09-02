import { getCurrentUser, signInPath } from '@/app/auth';
import { getRankingAccess, hasAccess } from '@/db/ranking-access';
import { toggleRankingReaction } from '@/db/social';
import { isReactionEmoji, isReactionTargetType } from '@/lib/reactions';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.', signInPath: signInPath(`/r/${slug}`) }, { status: 401 });
  const access = await getRankingAccess(slug, user.userId);
  if (!access) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  if (!hasAccess(request, slug, access)) return Response.json({ error: 'Dieses Ranking ist privat.' }, { status: 403 });
  const value = await request.json() as { targetType?: unknown; targetId?: unknown; emoji?: unknown };
  if (!isReactionTargetType(value.targetType) || typeof value.targetId !== 'string' || !isReactionEmoji(value.emoji)) {
    return Response.json({ error: 'Ungültige Reaktion.' }, { status: 400 });
  }
  const result = await toggleRankingReaction(slug, value.targetType, value.targetId, user.userId, value.emoji);
  return result === 'not-found' ? Response.json({ error: 'Ziel nicht gefunden.' }, { status: 404 }) : Response.json({ status: result });
}
