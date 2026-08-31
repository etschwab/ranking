'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { BarChart3, CheckCircle2, Copy, GripVertical, LogIn, Pencil, RotateCcw, Send, Share2, UserRound, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandHeader } from '@/components/brand-header';
import type { RankingData, RankingItem } from '@/db/rankings';

const tiers = [
  { label: 'S', score: 5, color: 'var(--tier-s)', helper: 'Spitzenklasse' },
  { label: 'A', score: 4, color: 'var(--tier-a)', helper: 'Sehr stark' },
  { label: 'B', score: 3, color: 'var(--tier-b)', helper: 'Solide' },
  { label: 'C', score: 2, color: 'var(--tier-c)', helper: 'Eher nicht' },
  { label: 'D', score: 1, color: 'var(--tier-d)', helper: 'Schlusslicht' },
];

function DraggableChip({ item, onUnassign }: { item: RankingItem; onUnassign: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={onUnassign}
      className="touch-none cursor-grab rounded-xl border-2 border-foreground bg-background px-3 py-2.5 text-left text-sm font-black shadow-[2px_2px_0_var(--ink)] transition hover:-translate-y-0.5 active:cursor-grabbing"
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.25 : 1 }}
      title="Ziehen, um die Stufe zu ändern · Klicken, um zurückzusetzen"
    >
      <span className="flex items-center gap-1.5"><GripVertical className="size-3.5 opacity-50" />{item.label}</span>
    </button>
  );
}

function TierRow({ tier, items, last, unassign }: { tier: (typeof tiers)[number]; items: RankingItem[]; last: boolean; unassign: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier.score}` });
  return (
    <div ref={setNodeRef} className={`grid min-h-20 grid-cols-[70px_1fr] transition-colors sm:grid-cols-[100px_1fr] ${!last ? 'border-b-[3px] border-foreground' : ''} ${isOver ? 'bg-[#e9e4ff]' : ''}`}>
      <div className="grid place-items-center border-r-[3px] border-foreground" style={{ background: tier.color }}><span className="text-3xl font-black sm:text-4xl">{tier.label}</span><span className="hidden text-[10px] font-black uppercase tracking-wider opacity-65 sm:block">{tier.helper}</span></div>
      <div className="flex flex-wrap items-center gap-2.5 p-3">
        {items.map((item) => <DraggableChip key={item.id} item={item} onUnassign={() => unassign(item.id)} />)}
        {!items.length && <span className={`text-sm font-bold ${isOver ? 'text-primary' : 'text-muted-foreground/50'}`}>{isOver ? `Hier in ${tier.label} ablegen` : 'Hierher ziehen'}</span>}
      </div>
    </div>
  );
}

function UnrankedCard({ item, assign }: { item: RankingItem; assign: (score: number) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id });
  return (
    <div ref={setNodeRef} className="rounded-xl border-2 border-foreground bg-card p-3" style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.25 : 1 }}>
      <div className="mb-3 flex items-center justify-between gap-3"><p className="font-black">{item.label}</p><button {...listeners} {...attributes} className="touch-none cursor-grab rounded-lg border-2 border-foreground bg-muted p-1.5 active:cursor-grabbing" aria-label={`${item.label} ziehen`} title="In eine Stufe ziehen"><GripVertical className="size-4" /></button></div>
      <div className="grid grid-cols-5 gap-2">{tiers.map((tier) => <button key={tier.score} aria-label={`${item.label} als ${tier.label} einstufen`} onClick={() => assign(tier.score)} className="h-10 rounded-lg border-2 border-foreground text-sm font-black transition hover:-translate-y-0.5" style={{ background: tier.color }}>{tier.label}</button>)}</div>
    </div>
  );
}

function UnrankedZone({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unranked' });
  return <section ref={setNodeRef} className={`mt-10 rounded-[1.5rem] border-2 border-foreground p-5 transition-colors sm:p-7 ${isOver ? 'bg-[#e9e4ff]' : 'bg-[#fff5e7]'}`}>{children}</section>;
}

export function RankingVote({ slug }: { slug: string }) {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [account, setAccount] = useState<{ user: { displayName: string; email: string } | null; signInPath: string } | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [hasSavedVote, setHasSavedVote] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [rankingResponse, accountResponse] = await Promise.all([
          fetch(`/api/rankings/${slug}`),
          fetch(`/api/me?returnTo=${encodeURIComponent(`/r/${slug}`)}`),
        ]);
        const data = await rankingResponse.json() as RankingData & { error?: string };
        if (accountResponse.ok) {
          const accountData = await accountResponse.json() as { user: { displayName: string; email: string } | null; signInPath: string };
          if (!cancelled) setAccount(accountData);
        }
        if (!rankingResponse.ok) throw new Error(data.error ?? 'Ranking nicht gefunden.');
        if (cancelled) return;
        setRanking(data);
        const storedToken = localStorage.getItem(`rankly-ballot-${slug}`);
        if (storedToken) {
          const savedResponse = await fetch(`/api/rankings/${slug}/vote?token=${encodeURIComponent(storedToken)}`);
          if (savedResponse.ok) {
            const saved = await savedResponse.json() as { scores: Record<string, number> };
            if (!cancelled) { setEditToken(storedToken); setScores(saved.scores); setHasSavedVote(true); }
          } else { localStorage.removeItem(`rankly-ballot-${slug}`); }
        }
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Ranking nicht gefunden.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [slug]);

  const assigned = Object.keys(scores).length;
  const complete = ranking ? assigned === ranking.items.length : false;
  const grouped = useMemo(() => new Map(tiers.map((tier) => [tier.score, ranking?.items.filter((item) => scores[item.id] === tier.score) ?? []])), [ranking, scores]);
  const activeItem = ranking?.items.find((item) => item.id === activeId);

  function unassign(itemId: string) { setScores((current) => { const next = { ...current }; delete next[itemId]; return next; }); }
  function handleDragStart(event: DragStartEvent) { setActiveId(String(event.active.id)); }
  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const itemId = String(event.active.id);
    const target = String(event.over.id);
    if (target === 'unranked') unassign(itemId);
    else if (target.startsWith('tier-')) {
      const score = Number(target.slice(5));
      if (score >= 1 && score <= 5) setScores((current) => ({ ...current, [itemId]: score }));
    }
  }

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
      const response = await fetch(`/api/rankings/${slug}/vote`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ scores, editToken }) });
      const data = await response.json() as { error?: string; editToken?: string; updated?: boolean; signInPath?: string };
      if (response.status === 401 && data.signInPath) {
        window.location.href = data.signInPath;
        return;
      }
      if (!response.ok || !data.editToken) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      localStorage.setItem(`rankly-ballot-${slug}`, data.editToken);
      setEditToken(data.editToken);
      setHasSavedVote(true);
      setSubmitted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="font-black">Ranking wird geladen…</p></div></main>;
  if (!ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-black">Nicht gefunden</h1><p className="mt-3 text-muted-foreground">{error}</p><a href="/" className="mt-6 inline-block font-black text-primary underline">Eigenes Ranking erstellen</a></div></main>;

  if (account && !account.user) return (
    <main className="min-h-screen bg-background"><BrandHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center">
        <span className="grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#d9cffd] shadow-[6px_6px_0_var(--ink)]"><UserRound className="size-10" /></span>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">Persönlich abstimmen</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">Melde dich mit deinem Namen an.</h1>
        <p className="mt-4 max-w-lg text-lg font-medium text-muted-foreground">Dein Profilname wird automatisch bei deiner Abstimmung gespeichert. Eine separate Namenseingabe ist nicht mehr nötig.</p>
        <a href={account.signInPath} target="_top" className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 text-base font-black text-primary-foreground shadow-[3px_3px_0_var(--ink)]"><LogIn className="size-5" /> Anmelden und abstimmen</a>
      </section>
    </main>
  );

  if (submitted) return (
    <main className="min-h-screen bg-background"><BrandHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center">
        <span className="grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#80d6a8] shadow-[6px_6px_0_var(--ink)]"><CheckCircle2 className="size-10" /></span>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">Ranking gespeichert</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">Deine Auswahl ist sicher.</h1>
        <p className="mt-4 text-lg font-medium text-muted-foreground">Du kannst sie auf diesem Gerät jederzeit wieder öffnen und bearbeiten.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Button className="h-12 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]" onClick={() => { window.location.href = `/r/${slug}/results`; }}><BarChart3 /> Auswertung ansehen</Button><Button variant="outline" className="h-12 border-2 border-foreground px-5 font-black" onClick={() => setSubmitted(false)}><Pencil /> Ranking bearbeiten</Button><Button variant="outline" className="h-12 border-2 border-foreground px-5 font-black" onClick={copyLink}>{copied ? <CheckCircle2 /> : <Share2 />} {copied ? 'Kopiert' : 'Freunde einladen'}</Button></div>
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
        {hasSavedVote && <div className="mt-7 flex items-center gap-2 rounded-xl border-2 border-[#18713b] bg-[#d9f7e4] px-4 py-3 font-bold text-[#125a2f]"><Pencil className="size-5" /> Deine gespeicherte Abstimmung ist geladen und kann geändert werden.</div>}

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="mt-10 overflow-hidden rounded-[1.5rem] border-[3px] border-foreground bg-card shadow-[7px_7px_0_var(--ink)]">
            {tiers.map((tier, index) => <TierRow key={tier.score} tier={tier} items={grouped.get(tier.score) ?? []} last={index === tiers.length - 1} unassign={unassign} />)}
          </div>

          <UnrankedZone>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black tracking-tight">Noch einordnen</h2><p className="text-sm font-semibold text-muted-foreground">Ziehe jede Option in eine Stufe – oder tippe auf S bis D.</p></div><span className="rounded-full border-2 border-foreground bg-card px-3 py-1.5 text-sm font-black">{assigned}/{ranking.items.length} fertig</span></div>
            <div className="grid gap-3 md:grid-cols-2">{ranking.items.filter((item) => !scores[item.id]).map((item) => <UnrankedCard key={item.id} item={item} assign={(score) => setScores((current) => ({ ...current, [item.id]: score }))} />)}</div>
            {complete && <div className="mt-6 flex items-center gap-2 rounded-xl border-2 border-[#18713b] bg-[#d9f7e4] px-4 py-3 font-bold text-[#125a2f]"><CheckCircle2 className="size-5" /> Alles eingeordnet – du kannst speichern oder weiter umsortieren.</div>}
          </UnrankedZone>

          <DragOverlay>{activeItem ? <div className="rotate-2 rounded-xl border-2 border-foreground bg-card px-4 py-3 font-black shadow-[5px_5px_0_var(--ink)]"><span className="flex items-center gap-2"><GripVertical className="size-4" />{activeItem.label}</span></div> : null}</DragOverlay>
        </DndContext>

        <section className="mt-8 flex flex-col gap-4 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[5px_5px_0_var(--ink)] sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border-2 border-foreground bg-[#d9cffd]"><UserRound className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Du stimmst ab als</p><p className="font-black">{account?.user?.displayName ?? 'Angemeldete Person'}</p></div></div>
          <Button disabled={!complete || submitting} onClick={submitVote} className="h-12 border-2 border-foreground px-6 text-base font-black shadow-[3px_3px_0_var(--ink)]">{submitting ? 'Wird gespeichert…' : hasSavedVote ? 'Änderungen speichern' : 'Abstimmung senden'} <Send /></Button>
        </section>
        {error && <p role="alert" className="mt-5 rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
        {assigned > 0 && <button onClick={() => setScores({})} className="mt-5 flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"><RotateCcw className="size-4" /> Auswahl zurücksetzen</button>}
      </section>
    </main>
  );
}
