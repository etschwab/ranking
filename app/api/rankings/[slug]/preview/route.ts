import { getRankingPreviewImage } from '@/db/rankings';

type RouteContext = { params: Promise<{ slug: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { slug } = await params;
  const result = await getRankingPreviewImage(slug);
  if (!result?.previewImageData) return new Response(null, { status: 404 });
  const match = result.previewImageData.match(
    /^data:(image\/(?:webp|png|jpeg));base64,(.+)$/,
  );
  if (!match) return new Response(null, { status: 404 });
  return new Response(Buffer.from(match[2], 'base64'), {
    headers: {
      'content-type': match[1],
      'cache-control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  });
}
