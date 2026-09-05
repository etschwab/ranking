import { RankingResults } from '@/components/ranking-results';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <RankingResults slug={slug} />;
}
