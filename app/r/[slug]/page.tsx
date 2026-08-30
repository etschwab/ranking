import { RankingVote } from '@/components/ranking-vote';

export default async function RankingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <RankingVote slug={slug} />;
}
