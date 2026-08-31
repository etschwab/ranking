import { chatGPTSignInPath, getChatGPTUser } from '@/app/chatgpt-auth';
import { getRankingAccess, hasAccess } from '@/db/ranking-access';
import { getUserProfile } from '@/db/profiles';
import { addRankingComment } from '@/db/social';

type RouteContext = { params: Promise<{ slug: string }> };

export async function POST(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: 'Bitte melde dich zuerst an.', signInPath: chatGPTSignInPath(`/r/${slug}`) }, { status: 401 });
  const access = await getRankingAccess(slug, user.userId);
  if (!access) return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  if (!hasAccess(request, slug, access)) return Response.json({ error: 'Dieses Ranking ist privat.' }, { status: 403 });
  const value = await request.json() as { body?: unknown };
  const body = typeof value.body === 'string' ? value.body.trim().slice(0, 500) : '';
  if (!body) return Response.json({ error: 'Schreibe zuerst einen Kommentar.' }, { status: 400 });
  const profile = await getUserProfile(user);
  const id = await addRankingComment(slug, user.userId, profile.displayName, body);
  return id ? Response.json({ id }, { status: 201 }) : Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
}
