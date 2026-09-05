import { getCurrentUser, signInPath } from '@/app/auth';
import { getRankingAccess, hasAccess } from '@/db/ranking-access';
import { getRankingSocial } from '@/db/social';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const user = await getCurrentUser();
  const access = await getRankingAccess(slug, user?.userId);
  if (!access)
    return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  if (!hasAccess(request, slug, access))
    return Response.json(
      { error: 'Dieses Ranking ist privat.', accessMode: access.accessMode },
      { status: 403 },
    );
  const social = await getRankingSocial(slug, user?.userId);
  if (!social)
    return Response.json({ error: 'Ranking nicht gefunden.' }, { status: 404 });
  return Response.json({
    ...social,
    signedIn: Boolean(user),
    signInPath: signInPath(`/r/${slug}`),
  });
}
