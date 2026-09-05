import type { Metadata } from 'next';
import { getRanking } from '@/db/rankings';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const ranking = await getRanking(slug);
  if (!ranking)
    return {
      title: 'Ranking nicht gefunden | Rankly',
      openGraph: { images: [] },
      twitter: { images: [] },
    };
  const description =
    ranking.description ||
    `Stimme bei „${ranking.title}“ ab und ordne alle Optionen von S bis D ein.`;
  const images = ranking.hasPreviewImage
    ? [
        {
          url: `https://rankly.etienneschwab.ch/api/rankings/${ranking.slug}/preview`,
          width: 1200,
          height: 630,
          alt: ranking.title,
        },
      ]
    : [];
  return {
    title: `${ranking.title} | Rankly`,
    description,
    openGraph: { title: ranking.title, description, images },
    twitter: {
      card: images.length ? 'summary_large_image' : 'summary',
      title: ranking.title,
      description,
      images,
    },
  };
}

export default function RankingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
