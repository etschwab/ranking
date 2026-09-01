import { getChatGPTUser } from '@/app/chatgpt-auth';
import { getRanking, getRankingParticipants } from '@/db/rankings';
import { getRankingAccess, hasAccess } from '@/db/ranking-access';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const user = await getChatGPTUser();
  const access = await getRankingAccess(slug, user?.userId);
  if (!access) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  if (!hasAccess(request, slug, access)) return Response.json({ error: 'Dieses Ranking ist privat.', accessMode: access.accessMode }, { status: 403 });
  const ranking = await getRanking(slug);
  if (!ranking) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  return Response.json({ participants: await getRankingParticipants(ranking.id) });
}
