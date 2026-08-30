'use client';

import { useState } from 'react';
import { ArrowRight, BarChart3, Check, Plus, Share2, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const demoTiers = [
  { label: 'S', color: 'var(--tier-s)', items: ['Interstellar', 'Parasite'] },
  { label: 'A', color: 'var(--tier-a)', items: ['Dune: Part Two'] },
  { label: 'B', color: 'var(--tier-b)', items: ['Barbie', 'The Batman'] },
  { label: 'C', color: 'var(--tier-c)', items: ['Tenet'] },
];

export default function Home() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState('Japan\nIsland\nPortugal\nKanada\nGriechenland');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function createRanking(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/rankings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description, items: options.split('\n') }),
      });
      const data = await response.json() as { slug?: string; error?: string };
      if (!response.ok || !data.slug) throw new Error(data.error ?? 'Unbekannter Fehler');
      window.location.href = `/r/${data.slug}`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Das Ranking konnte nicht erstellt werden.');
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen overflow-hidden bg-background text-foreground">
      <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <a href="#" className="flex items-center gap-2.5 font-black tracking-[-0.04em]" aria-label="Rankly Startseite">
          <span className="grid size-9 rotate-3 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[3px_3px_0_var(--ink)]">
            <Trophy className="size-4.5 -rotate-3" />
          </span>
          <span className="text-xl">RANKLY</span>
        </a>
        <a href="#erstellen" className="text-sm font-bold text-muted-foreground transition hover:text-foreground">Ranking erstellen</a>
      </header>

      <section className="mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-9 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:px-8 lg:pb-28 lg:pt-16">
        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-[#fff1a8] px-3 py-1.5 text-xs font-black uppercase tracking-[0.13em] shadow-[2px_2px_0_var(--ink)]">
            <Sparkles className="size-3.5" /> Gemeinsam entscheiden
          </div>
          <h1 className="text-balance text-[clamp(3.35rem,8vw,6.5rem)] font-black leading-[0.86] tracking-[-0.075em]">
            Sortiert eure <span className="text-primary">Favoriten.</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg font-medium leading-relaxed text-muted-foreground sm:text-xl">
            Erstelle ein Tier-Ranking, teile den Link mit deiner Gruppe und sieh sofort, was wirklich auf Platz S gehört.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" className="h-12 rounded-xl border-2 border-foreground px-5 text-base font-black shadow-[4px_4px_0_var(--ink)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_var(--ink)]" onClick={() => document.querySelector('#erstellen')?.scrollIntoView({ behavior: 'smooth' })}>
              <Plus className="size-5" /> Ranking starten
            </Button>
            <div className="flex items-center gap-2 px-2 text-sm font-bold text-muted-foreground"><Check className="size-4 text-[#159947]" /> Ohne Anmeldung</div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:rotate-1">
          <div className="absolute -inset-5 -z-10 rotate-2 rounded-[2.5rem] bg-[#d9cffd]" />
          <div className="rounded-[1.75rem] border-[3px] border-foreground bg-card p-3 shadow-[10px_10px_0_var(--ink)] sm:p-5">
            <div className="mb-4 flex items-center justify-between px-1">
              <div><p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">Live-Vorschau</p><h2 className="text-xl font-black tracking-tight">Die besten Filme aller Zeiten</h2></div>
              <Share2 className="size-5" />
            </div>
            <div className="space-y-2">
              {demoTiers.map((tier) => (
                <div key={tier.label} className="grid min-h-16 grid-cols-[64px_1fr] overflow-hidden rounded-xl border-2 border-foreground bg-background">
                  <div className="grid place-items-center border-r-2 border-foreground text-2xl font-black" style={{ background: tier.color }}>{tier.label}</div>
                  <div className="flex flex-wrap items-center gap-2 p-2">
                    {tier.items.map((item) => <span key={item} className="rounded-lg border-2 border-foreground bg-card px-3 py-2 text-sm font-extrabold shadow-[2px_2px_0_var(--ink)]">{item}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section id="erstellen" className="border-y-2 border-foreground bg-[#fff5e7] px-5 py-20 sm:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl border-2 border-foreground bg-[#ff8b72] shadow-[3px_3px_0_var(--ink)]"><BarChart3 className="size-6" /></span>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-primary">In einer Minute bereit</p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">Was wollt ihr ranken?</h2>
            <p className="mt-4 max-w-md font-medium leading-relaxed text-muted-foreground">Thema und Auswahl eintragen. Danach erhältst du direkt den Link zum Teilen.</p>
          </div>
          <form className="grid gap-5 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[8px_8px_0_var(--ink)] sm:p-7" onSubmit={createRanking}>
            <label className="grid gap-2 text-sm font-black">Titel<Input required maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 rounded-xl border-2 border-foreground px-4 text-base font-bold" placeholder="z. B. Unser nächstes Reiseziel" /></label>
            <label className="grid gap-2 text-sm font-black">Kurze Beschreibung <Input maxLength={280} value={description} onChange={(event) => setDescription(event.target.value)} className="h-12 rounded-xl border-2 border-foreground px-4 text-base" placeholder="Optional: Worum geht es?" /></label>
            <label className="grid gap-2 text-sm font-black">Optionen <Textarea required className="min-h-36 rounded-xl border-2 border-foreground px-4 py-3 text-base leading-relaxed" value={options} onChange={(event) => setOptions(event.target.value)} /></label>
            {error && <p role="alert" className="rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 text-sm font-bold text-[#8a1717]">{error}</p>}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Eine Option pro Zeile · mindestens 2</p>
              <Button disabled={submitting} className="h-12 rounded-xl border-2 border-foreground px-5 text-base font-black shadow-[3px_3px_0_var(--ink)]">{submitting ? 'Wird erstellt…' : 'Erstellen'} <ArrowRight className="size-5" /></Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
