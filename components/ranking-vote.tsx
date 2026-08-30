'use client';

import { useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Copy, RotateCcw, Send, Share2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BrandHeader } from '@/components/brand-header';
import type { RankingData } from '@/db/rankings';

const tiers = [
  { label: 'S', score: 5, color: 'var(--tier-s)', helper: 'Spitzenklasse' },
  { label: 'A', score: 4, color: 'var(--tier-a)', helper: 'Sehr stark' },
  { label: 'B', score: 3, color: 'var(--tier-b)', helper: 'Solide' },
  { label: 'C', score: 2, color: 'var(--tier-c)', helper: 'Eher nicht' },
  { label: 'D', score: 1, color: 'var(--tier-d)', helper: 'Schlusslicht' },
];

export function RankingVote({ slug }: { slug: string }) {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [voterName, setVoterName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch(`/api/rankings/${slug}`).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Ranking nicht gefunden.');
      setRanking(data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'Ranking nicht gefunden.')).finally(() => setLoading(false));
  }, [slug]);

  const assigned = Object.keys(scores).length;
  const complete = ranking ? assigned === ranking.items.length : false;
  const grouped = useMemo(() => new Map(tiers.map((tier) => [tier.score, ranking?.items.filter((item) => scores[item.id] === tier.score) ?? []])), [ranking, scores]);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function submitVote() {
    if (!complete) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${slug}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ voterName, scores }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      localStorage.setItem(`rankly-voted-${slug}`, 'true');
      setSubmitted(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.');
    } finally { setSubmitting(false); }
  }

  if (loading) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="font-black">Ranking wird geladen…</p></div></main>;
  if (!ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-black">Nicht gefunden</h1><p className="mt-3 text-muted-foreground">{error}</p><a href="/" className="mt-6 inline-block font-black text-primary underline">Eigenes Ranking erstellen</a></div></main>;

  if (submitted) return (
    <main className="min-h-screen bg-background"><BrandHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center">
        <span className="grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#80d6a8] shadow-[6px_6px_0_var(--ink)]"><CheckCircle2 className="size-10" /></span>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">Stimme gespeichert</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">Danke fürs Ranken!</h1>
        <p className="mt-4 text-lg font-medium text-muted-foreground">Deine Einordnung ist jetzt Teil des Gesamtergebnisses.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Button className="h-12 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]" onClick={() => { window.location.href = `/r/${slug}/results`; }}><BarChart3 /> Auswertung ansehen</Button><Button variant="outline" className="h-12 border-2 border-foreground px-5 font-black" onClick={copyLink}>{copied ? <CheckCircle2 /> : <Share2 />} {copied ? 'Kopiert' : 'Freunde einladen'}</Button></div>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-background pb-28">
      <BrandHeader action={<Button variant="outline" className="border-2 border-foreground font-black" onClick={copyLink}>{copied ? <CheckCircle2 /> : <Copy />}<span className="hidden sm:inline">{copied ? 'Link kopiert' : 'Teilen'}</span></Button>} />
      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-sm font-black uppercase tracking-[0.15em] text-primary">Deine Abstimmung</p><h1 className="mt-2 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">{ranking.title}</h1>{ranking.description && <p className="mt-4 max-w-2xl text-lg font-medium text-muted-foreground">{ranking.description}</p>}</div>
          <div className="flex items-center gap-2 font-black text-muted-foreground"><Users className="size-5" /> {ranking.ballotCount} {ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'}</div>
        </div>

        <div className="mt-10 overflow-hidden rounded-[1.5rem] border-[3px] border-foreground bg-card shadow-[7px_7px_0_var(--ink)]">
          {tiers.map((tier, index) => (
            <div key={tier.score} className={`grid min-h-20 grid-cols-[70px_1fr] sm:grid-cols-[100px_1fr] ${index < tiers.length - 1 ? 'border-b-[3px] border-foreground' : ''}`}>
              <div className="grid place-items-center border-r-[3px] border-foreground" style={{ background: tier.color }}><span className="text-3xl font-black sm:text-4xl">{tier.label}</span><span className="hidden text-[10px] font-black uppercase tracking-wider opacity-65 sm:block">{tier.helper}</span></div>
              <div className="flex flex-wrap items-center gap-2.5 p-3">
                {grouped.get(tier.score)?.map((item) => <button key={item.id} onClick={() => setScores((current) => { const next = { ...current }; delete next[item.id]; return next; })} className="rounded-xl border-2 border-foreground bg-background px-3 py-2.5 text-left text-sm font-black shadow-[2px_2px_0_var(--ink)] transition hover:-translate-y-0.5" title="Zurück zu noch nicht eingeordnet">{item.label}</button>)}
                {!grouped.get(tier.score)?.length && <span className="text-sm font-bold text-muted-foreground/50">Noch leer</span>}
              </div>
            </div>
          ))}
        </div>

        <section className="mt-10 rounded-[1.5rem] border-2 border-foreground bg-[#fff5e7] p-5 sm:p-7">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black tracking-tight">Noch einordnen</h2><p className="text-sm font-semibold text-muted-foreground">Wähle für jede Option eine Stufe.</p></div><span className="rounded-full border-2 border-foreground bg-card px-3 py-1.5 text-sm font-black">{assigned}/{ranking.items.length} fertig</span></div>
          <div className="grid gap-3 md:grid-cols-2">
            {ranking.items.filter((item) => !scores[item.id]).map((item) => (
              <div key={item.id} className="rounded-xl border-2 border-foreground bg-card p-3"><p className="mb-3 font-black">{item.label}</p><div className="grid grid-cols-5 gap-2">{tiers.map((tier) => <button key={tier.score} aria-label={`${item.label} als ${tier.label} einstufen`} onClick={() => setScores((current) => ({ ...current, [item.id]: tier.score }))} className="h-10 rounded-lg border-2 border-foreground text-sm font-black transition hover:-translate-y-0.5" style={{ background: tier.color }}>{tier.label}</button>)}</div></div>
            ))}
          </div>
          {complete && <div className="mt-6 flex items-center gap-2 rounded-xl border-2 border-[#18713b] bg-[#d9f7e4] px-4 py-3 font-bold text-[#125a2f]"><CheckCircle2 className="size-5" /> Alles eingeordnet – bereit zum Absenden.</div>}
        </section>

        <section className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[5px_5px_0_var(--ink)] sm:flex-row sm:items-end sm:p-6">
          <label className="flex-1 text-sm font-black">Dein Name <span className="font-semibold text-muted-foreground">(optional)</span><Input value={voterName} onChange={(event) => setVoterName(event.target.value)} maxLength={50} placeholder="z. B. Etienne" className="mt-2 h-12 border-2 border-foreground px-4" /></label>
          <Button disabled={!complete || submitting} onClick={submitVote} className="h-12 border-2 border-foreground px-6 text-base font-black shadow-[3px_3px_0_var(--ink)]">{submitting ? 'Wird gespeichert…' : 'Abstimmung senden'} <Send /></Button>
        </section>
        {error && <p role="alert" className="mt-5 rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
        {assigned > 0 && <button onClick={() => setScores({})} className="mt-5 flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"><RotateCcw className="size-4" /> Auswahl zurücksetzen</button>}
      </section>
    </main>
  );
}
