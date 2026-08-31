'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Copy, Medal, Pencil, RefreshCw, Share2, Users } from 'lucide-react';
import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/ui/button';
import type { RankingData, RankingItem } from '@/db/rankings';

const tiers = [
  { label: 'D', score: 1, color: 'var(--tier-d)' },
  { label: 'C', score: 2, color: 'var(--tier-c)' },
  { label: 'B', score: 3, color: 'var(--tier-b)' },
  { label: 'A', score: 4, color: 'var(--tier-a)' },
  { label: 'S', score: 5, color: 'var(--tier-s)' },
];

function resultTier(item: RankingItem) {
  return tiers.find((tier) => tier.score === Math.max(1, Math.min(5, Math.round(item.average ?? 1)))) ?? tiers[0];
}

export function RankingResults({ slug }: { slug: string }) {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(`/api/rankings/${slug}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Ranking nicht gefunden.');
      setRanking(data);
      setError('');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Ranking nicht gefunden.'); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, [slug]);
  const sorted = useMemo(() => [...(ranking?.items ?? [])].sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || a.position - b.position), [ranking]);

  async function copyVoteLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  if (loading && !ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center font-black">Auswertung wird geladen…</div></main>;
  if (!ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-black">Nicht gefunden</h1><p className="mt-3 text-muted-foreground">{error}</p></div></main>;

  return (
    <main className="min-h-screen bg-background pb-24">
      <BrandHeader action={<div className="flex items-center gap-2"><a href={`/r/${slug}`} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-black hover:bg-muted sm:inline-flex"><Pencil className="size-4" /> Meine Stimme</a><Button variant="outline" onClick={copyVoteLink} className="border-2 border-foreground font-black">{copied ? <CheckCircle2 /> : <Share2 />}<span className="hidden sm:inline">{copied ? 'Link kopiert' : 'Abstimmung teilen'}</span></Button></div>} />
      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-sm font-black uppercase tracking-[0.15em] text-primary">Live-Auswertung</p><h1 className="mt-2 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">{ranking.title}</h1>{ranking.description && <p className="mt-4 max-w-2xl text-lg font-medium text-muted-foreground">{ranking.description}</p>}</div>
          <div className="flex items-center gap-3"><span className="flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-4 py-2 font-black"><Users className="size-5" /> {ranking.ballotCount} {ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'}</span><Button variant="outline" size="icon" className="size-11 border-2 border-foreground" onClick={load} aria-label="Ergebnisse aktualisieren"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
        </div>

        {ranking.ballotCount === 0 ? (
          <div className="mt-12 rounded-[1.75rem] border-[3px] border-foreground bg-card p-10 text-center shadow-[7px_7px_0_var(--ink)]">
            <span className="mx-auto grid size-16 place-items-center rounded-2xl border-2 border-foreground bg-[#d9cffd]"><BarChart3 className="size-8" /></span>
            <h2 className="mt-6 text-3xl font-black">Noch keine Stimmen</h2><p className="mt-2 font-medium text-muted-foreground">Teile den Link – nach der ersten Abstimmung erscheint hier das Gruppenranking.</p>
            <Button onClick={copyVoteLink} className="mt-6 h-12 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]"><Copy /> Link kopieren</Button>
          </div>
        ) : (
          <>
            <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[1.75rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
                <div className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border-2 border-foreground bg-[#fff1a8]"><Medal /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Gesamtrangliste</p><h2 className="text-2xl font-black">Eure Favoriten</h2></div></div>
                <ol className="space-y-3">{sorted.map((item, index) => { const tier = resultTier(item); return <li key={item.id} className="grid grid-cols-[42px_52px_1fr_auto] items-center gap-3 rounded-xl border-2 border-foreground bg-background p-3"><span className="text-center text-lg font-black text-muted-foreground">#{index + 1}</span><span className="grid size-11 place-items-center rounded-lg border-2 border-foreground text-xl font-black" style={{ background: tier.color }}>{tier.label}</span><span className="min-w-0 font-black">{item.label}</span><span className="text-sm font-black text-muted-foreground">{item.average?.toFixed(2)}</span></li>; })}</ol>
              </section>

              <section className="rounded-[1.75rem] border-[3px] border-foreground bg-[#fff5e7] p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Verteilung</p><h2 className="mt-1 text-2xl font-black">So wurde abgestimmt</h2>
                <div className="mt-6 space-y-6">{sorted.slice(0, 6).map((item) => <div key={item.id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-black">{item.label}</span><span className="font-bold text-muted-foreground">{item.votes}×</span></div><div className="flex h-7 overflow-hidden rounded-lg border-2 border-foreground bg-card">{tiers.slice().reverse().map((tier) => { const count = item.distribution[String(tier.score)] ?? 0; const width = item.votes ? (count / item.votes) * 100 : 0; return width > 0 ? <div key={tier.score} className="grid place-items-center text-[10px] font-black" style={{ width: `${width}%`, background: tier.color }} title={`${tier.label}: ${count}`}>{width >= 13 ? tier.label : ''}</div> : null; })}</div></div>)}</div>
              </section>
            </div>

            <section className="mt-8 flex flex-col items-start justify-between gap-5 rounded-[1.5rem] border-2 border-foreground bg-[#d9cffd] p-6 sm:flex-row sm:items-center"><div><h2 className="text-2xl font-black">Noch mehr Meinungen sammeln?</h2><p className="mt-1 font-semibold text-muted-foreground">Teile die Abstimmung und aktualisiere später die Auswertung.</p></div><Button onClick={copyVoteLink} className="h-12 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]">{copied ? <CheckCircle2 /> : <Copy />} {copied ? 'Kopiert' : 'Abstimmungslink kopieren'}</Button></section>
          </>
        )}
      </section>
    </main>
  );
}
