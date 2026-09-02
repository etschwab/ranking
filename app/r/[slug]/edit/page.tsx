import { notFound } from 'next/navigation';
import { requireUser } from '@/app/auth';
import { BrandHeader } from '@/components/brand-header';
import { RankingEditForm } from '@/components/ranking-edit-form';
import { getOwnedRanking } from '@/db/rankings';

export const dynamic = 'force-dynamic';

async function EditRankingContent({ slug }: { slug: string }) {
  const user = await requireUser(`/r/${slug}/edit`);
  const ranking = await getOwnedRanking(slug, user.userId);
  if (!ranking) notFound();
  return (
    <>
      <BrandHeader action={<a href="/mine" className="text-sm font-black text-muted-foreground hover:text-foreground">Meine Rankings</a>} />
      <section className="mx-auto max-w-4xl px-5 pb-24 pt-12 sm:px-8">
        <p className="text-sm font-black uppercase tracking-[0.15em] text-primary">Ranking verwalten</p>
        <h1 className="mt-2 text-4xl font-black tracking-[-0.05em] sm:text-6xl">Ranking bearbeiten</h1>
        <p className="mt-3 max-w-2xl font-medium text-muted-foreground">Passe Inhalt und Reihenfolge an. Der bestehende Abstimmungslink bleibt unverändert.</p>
        <RankingEditForm ranking={ranking} />
      </section>
    </>
  );
}

export default async function EditRankingPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <main className="rankly-page min-h-screen"><EditRankingContent slug={slug} /></main>;
}
