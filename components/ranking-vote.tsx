'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core';
import { ArrowDownToLine, BarChart3, CheckCircle2, Clock3, Cloud, Copy, GripVertical, Info, LockKeyhole, LogIn, Pencil, RotateCcw, Send, Share2, Undo2, UserRound, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BrandHeader } from '@/components/brand-header';
import { RankingAccessGate } from '@/components/ranking-access-gate';
import { RankingSocial } from '@/components/ranking-social';
import type { RankingAccessMode, RankingData, RankingItem } from '@/db/rankings';

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
    <div
      ref={setNodeRef}
      className="flex items-center overflow-hidden rounded-xl border-2 border-foreground bg-background text-sm font-black shadow-[2px_2px_0_var(--ink)] transition focus-within:ring-4 focus-within:ring-primary/25 hover:-translate-y-0.5"
      style={{ transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined, opacity: isDragging ? 0.25 : 1 }}
    >
      <button {...listeners} {...attributes} className="flex touch-none cursor-grab items-center gap-1.5 px-3 py-2.5 text-left active:cursor-grabbing" aria-label={`${item.label} in eine andere Stufe ziehen`}><GripVertical className="size-3.5 opacity-50" />{item.label}</button>
      <button onClick={onUnassign} className="grid self-stretch place-items-center border-l-2 border-foreground px-2 text-muted-foreground transition hover:bg-muted hover:text-foreground" aria-label={`${item.label} zurück zu Noch einordnen`} title="Zurück zu Noch einordnen"><X className="size-3.5" /></button>
    </div>
  );
}

function TierRow({ tier, items, last, unassign, dragging }: { tier: (typeof tiers)[number]; items: RankingItem[]; last: boolean; unassign: (id: string) => void; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: `tier-${tier.score}` });
  return (
    <div ref={setNodeRef} className={`relative grid min-h-24 grid-cols-[72px_1fr] transition-all sm:grid-cols-[112px_1fr] ${!last ? 'border-b-[3px] border-foreground' : ''} ${isOver ? 'z-10 bg-[#e9e4ff] ring-4 ring-inset ring-primary' : dragging ? 'bg-primary/[0.035]' : ''}`}>
      <div className="grid place-items-center border-r-[3px] border-foreground" style={{ background: tier.color }}><span className="text-3xl font-black sm:text-4xl">{tier.label}</span><span className="hidden text-[10px] font-black uppercase tracking-wider opacity-65 sm:block">{tier.helper}</span></div>
      <div className="flex flex-wrap content-center items-center gap-2.5 p-3 sm:p-4">
        {items.map((item) => <DraggableChip key={item.id} item={item} onUnassign={() => unassign(item.id)} />)}
        {!items.length && <span className={`flex items-center gap-2 text-sm font-bold ${isOver ? 'text-primary' : 'text-muted-foreground/50'}`}><ArrowDownToLine className="size-4" />{isOver ? `In ${tier.label} ablegen` : `${tier.helper} – hier ablegen`}</span>}
        {isOver && items.length > 0 && <span className="flex items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-black text-primary-foreground"><ArrowDownToLine className="size-3.5" /> Hier ablegen</span>}
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

function UnrankedZone({ children, dragging }: { children: React.ReactNode; dragging: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'unranked' });
  return <section ref={setNodeRef} className={`mt-8 rounded-[1.5rem] border-[3px] p-5 transition-all sm:p-7 ${isOver ? 'border-primary bg-[#e9e4ff] ring-4 ring-primary/20' : dragging ? 'border-dashed border-foreground bg-[#fff5e7]' : 'border-foreground bg-[#fff5e7]'}`}>{children}</section>;
}

export function RankingVote({ slug }: { slug: string }) {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [account, setAccount] = useState<{ user: { displayName: string; email: string } | null; signInPath: string } | null>(null);
  const [editToken, setEditToken] = useState<string | null>(null);
  const [hasSavedVote, setHasSavedVote] = useState(false);
  const [restoredDraft, setRestoredDraft] = useState(false);
  const [voteReady, setVoteReady] = useState(false);
  const [scoreHistory, setScoreHistory] = useState<Record<string, number>[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const [accessMode, setAccessMode] = useState<RankingAccessMode | null>(null);
  const [accessRevision, setAccessRevision] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));
  const collisionDetection = useCallback<CollisionDetection>((args) => {
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) return pointerCollisions;
    const intersections = rectIntersection(args);
    return intersections.length > 0 ? intersections : closestCenter(args);
  }, []);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const invite = new URLSearchParams(window.location.search).get('invite');
        if (invite) {
          const inviteResponse = await fetch(`/api/rankings/${slug}/access`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ invite }) });
          const inviteData = await inviteResponse.json() as { error?: string };
          if (!inviteResponse.ok) {
            if (!cancelled) { setAccessMode('invite'); setError(inviteData.error ?? 'Dieser Einladungslink ist ungültig.'); }
            return;
          }
          window.history.replaceState({}, '', `/r/${slug}`);
        }
        const [rankingResponse, accountResponse] = await Promise.all([
          fetch(`/api/rankings/${slug}`),
          fetch(`/api/me?returnTo=${encodeURIComponent(`/r/${slug}`)}`),
        ]);
        const data = await rankingResponse.json() as RankingData & { error?: string; accessMode?: RankingAccessMode };
        if (accountResponse.ok) {
          const accountData = await accountResponse.json() as { user: { displayName: string; email: string } | null; signInPath: string };
          if (!cancelled) setAccount(accountData);
        }
        if (rankingResponse.status === 403 && data.accessMode) {
          if (!cancelled) { setAccessMode(data.accessMode); setError(''); }
          return;
        }
        if (!rankingResponse.ok) throw new Error(data.error ?? 'Ranking nicht gefunden.');
        if (cancelled) return;
        setRanking(data);
        setAccessMode(null);
        const storedToken = localStorage.getItem(`rankly-ballot-${slug}`);
        let loadedSavedVote = false;
        if (storedToken) {
          const savedResponse = await fetch(`/api/rankings/${slug}/vote?token=${encodeURIComponent(storedToken)}`);
          if (savedResponse.ok) {
            const saved = await savedResponse.json() as { scores: Record<string, number> };
            if (!cancelled) { setEditToken(storedToken); setScores(saved.scores); setHasSavedVote(true); }
            loadedSavedVote = true;
          } else { localStorage.removeItem(`rankly-ballot-${slug}`); }
        }
        if (!loadedSavedVote) {
          try {
            const draft = JSON.parse(localStorage.getItem(`rankly-vote-draft-${slug}`) ?? '{}') as Record<string, number>;
            const validDraft = Object.fromEntries(Object.entries(draft).filter(([itemId, score]) => data.items.some((item) => item.id === itemId) && Number.isInteger(score) && score >= 1 && score <= 5));
            if (Object.keys(validDraft).length > 0 && !cancelled) { setScores(validDraft); setRestoredDraft(true); }
          } catch { localStorage.removeItem(`rankly-vote-draft-${slug}`); }
        }
        if (!cancelled) setVoteReady(true);
      } catch (reason) { if (!cancelled) setError(reason instanceof Error ? reason.message : 'Ranking nicht gefunden.'); }
      finally { if (!cancelled) setLoading(false); }
    }
    void load();
    return () => { cancelled = true; };
  }, [accessRevision, slug]);

  useEffect(() => {
    if (!voteReady) return;
    if (Object.keys(scores).length > 0) localStorage.setItem(`rankly-vote-draft-${slug}`, JSON.stringify(scores));
    else localStorage.removeItem(`rankly-vote-draft-${slug}`);
  }, [scores, slug, voteReady]);

  useEffect(() => {
    if (!ranking?.closesAt || ranking.closesAt <= now) return;
    const timer = window.setTimeout(() => setNow(Date.now()), Math.min(ranking.closesAt - Date.now() + 100, 2_147_000_000));
    return () => window.clearTimeout(timer);
  }, [now, ranking?.closesAt]);

  const assigned = Object.keys(scores).length;
  const complete = ranking ? assigned === ranking.items.length : false;
  const grouped = useMemo(() => new Map(tiers.map((tier) => [tier.score, ranking?.items.filter((item) => scores[item.id] === tier.score) ?? []])), [ranking, scores]);
  const activeItem = ranking?.items.find((item) => item.id === activeId);
  const closed = ranking?.closesAt !== null && ranking?.closesAt !== undefined && now >= ranking.closesAt;

  function remember(current: Record<string, number>) {
    setScoreHistory((history) => [...history.slice(-19), current]);
  }
  function assign(itemId: string, score: number) {
    remember(scores);
    setScores({ ...scores, [itemId]: score });
    const item = ranking?.items.find((candidate) => candidate.id === itemId);
    const tier = tiers.find((candidate) => candidate.score === score);
    if (item && tier) setLiveMessage(`${item.label} wurde Stufe ${tier.label} zugeordnet.`);
  }
  function unassign(itemId: string) {
    remember(scores);
    const next = { ...scores };
    delete next[itemId];
    setScores(next);
    const item = ranking?.items.find((candidate) => candidate.id === itemId);
    if (item) setLiveMessage(`${item.label} wurde zurückgesetzt.`);
  }
  function undo() {
    setScoreHistory((history) => {
      if (history.length === 0) return history;
      const previous = history[history.length - 1];
      setScores(previous);
      setLiveMessage('Die letzte Änderung wurde rückgängig gemacht.');
      return history.slice(0, -1);
    });
  }
  function resetScores() {
    if (Object.keys(scores).length === 0) return;
    remember(scores);
    setScores({});
    setLiveMessage('Alle Zuordnungen wurden zurückgesetzt.');
  }
  function handleDragStart(event: DragStartEvent) {
    const itemId = String(event.active.id);
    setActiveId(itemId);
    const item = ranking?.items.find((candidate) => candidate.id === itemId);
    if (item) setLiveMessage(`${item.label} wird verschoben.`);
  }
  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    if (!event.over) return;
    const itemId = String(event.active.id);
    const target = String(event.over.id);
    if (target === 'unranked') unassign(itemId);
    else if (target.startsWith('tier-')) {
      const score = Number(target.slice(5));
      if (score >= 1 && score <= 5) assign(itemId, score);
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
      localStorage.removeItem(`rankly-vote-draft-${slug}`);
      setEditToken(data.editToken);
      setHasSavedVote(true);
      setSubmitted(true);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.'); }
    finally { setSubmitting(false); }
  }

  if (loading) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="font-black">Ranking wird geladen…</p></div></main>;
  if (accessMode) return <RankingAccessGate slug={slug} accessMode={accessMode} onUnlocked={() => { setLoading(true); setAccessRevision((value) => value + 1); }} />;
  if (!ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-black">Nicht gefunden</h1><p className="mt-3 text-muted-foreground">{error}</p><a href="/" className="mt-6 inline-block font-black text-primary underline">Eigenes Ranking erstellen</a></div></main>;

  if (closed) return (
    <main className="rankly-page min-h-screen"><BrandHeader />
      <section className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center">
        <span className="grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#fff1a8] shadow-[6px_6px_0_var(--ink)]"><LockKeyhole className="size-10" /></span>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">Abstimmung beendet</p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">Die Frist ist abgelaufen.</h1>
        <p className="mt-4 max-w-lg text-lg font-medium text-muted-foreground">Für „{ranking.title}“ können keine Stimmen mehr abgegeben oder geändert werden.</p>
        <a href={`/r/${slug}/results`} className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-6 text-base font-black text-primary-foreground shadow-[3px_3px_0_var(--ink)]"><BarChart3 className="size-5" /> Ergebnis ansehen</a>
      </section>
    </main>
  );

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
    <main className="rankly-page min-h-screen pb-28">
      <BrandHeader action={<Button variant="outline" className="border-2 border-foreground font-black" onClick={copyLink}>{copied ? <CheckCircle2 /> : <Copy />}<span className="hidden sm:inline">{copied ? 'Link kopiert' : 'Teilen'}</span></Button>} />
      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="text-sm font-black uppercase tracking-[0.15em] text-primary">Deine Abstimmung</p><h1 className="mt-2 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">{ranking.title}</h1>{ranking.description && <p className="mt-4 max-w-2xl text-lg font-medium text-muted-foreground">{ranking.description}</p>}</div>
          <div className="flex flex-col items-start gap-2 md:items-end"><div className="flex items-center gap-2 font-black text-muted-foreground"><Users className="size-5" /> {ranking.ballotCount} {ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'}</div>{ranking.closesAt && <div className="flex items-center gap-2 rounded-full border-2 border-foreground bg-[#fff1a8] px-3 py-1.5 text-sm font-black"><Clock3 className="size-4" /> Offen bis {new Date(ranking.closesAt).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })}</div>}</div>
        </div>
        {hasSavedVote && <div className="mt-7 flex items-center gap-2 rounded-xl border-2 border-[#18713b] bg-[#d9f7e4] px-4 py-3 font-bold text-[#125a2f]"><Pencil className="size-5" /> Deine gespeicherte Abstimmung ist geladen und kann geändert werden.</div>}
        {restoredDraft && !hasSavedVote && <div className="mt-7 flex items-center gap-2 rounded-xl border-2 border-primary bg-[#e9e4ff] px-4 py-3 font-bold text-primary"><Cloud className="size-5" /> Dein letzter Entwurf wurde auf diesem Gerät wiederhergestellt.</div>}

        <div className="mt-8 grid gap-4 rounded-[1.5rem] border-2 border-foreground bg-card p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-6">
          <div><div className="flex items-center gap-2"><Info className="size-5 text-primary" /><h2 className="font-black">So funktioniert’s</h2></div><p className="mt-1 text-sm font-semibold text-muted-foreground">Ziehe Optionen in eine Stufe oder tippe direkt auf S bis D. Bereits einsortierte Optionen kannst du jederzeit weiterziehen.</p></div>
          <div className="min-w-40"><div className="mb-2 flex justify-between text-xs font-black"><span>Fortschritt</span><span>{assigned}/{ranking.items.length}</span></div><div className="h-3 overflow-hidden rounded-full border-2 border-foreground bg-muted"><div className="h-full bg-primary transition-[width] duration-300" style={{ width: `${(assigned / ranking.items.length) * 100}%` }} /></div></div>
        </div>

        <p className="sr-only" aria-live="polite">{liveMessage}</p>
        <DndContext sensors={sensors} collisionDetection={collisionDetection} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveId(null)}>
          <div className="mt-6 overflow-hidden rounded-[1.5rem] border-[3px] border-foreground bg-card shadow-[7px_7px_0_var(--ink)]">
            {tiers.map((tier, index) => <TierRow key={tier.score} tier={tier} items={grouped.get(tier.score) ?? []} last={index === tiers.length - 1} unassign={unassign} dragging={Boolean(activeId)} />)}
          </div>

          <UnrankedZone dragging={Boolean(activeId)}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-2xl font-black tracking-tight">Noch einordnen</h2><p className="text-sm font-semibold text-muted-foreground">Nicht sicher? Du kannst jede Entscheidung später ändern.</p></div>{activeId && scores[activeId] && <span className="flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-3 py-1.5 text-sm font-black"><RotateCcw className="size-4" /> Hier ablegen zum Zurücksetzen</span>}</div>
            <div className="grid gap-3 md:grid-cols-2">{ranking.items.filter((item) => !scores[item.id]).map((item) => <UnrankedCard key={item.id} item={item} assign={(score) => assign(item.id, score)} />)}</div>
            {complete && <div className="flex items-center gap-3 rounded-xl border-2 border-[#18713b] bg-[#d9f7e4] px-4 py-4 font-bold text-[#125a2f]"><CheckCircle2 className="size-6 shrink-0" /><div><p className="font-black">Alles eingeordnet!</p><p className="text-sm">Prüfe deine Auswahl oder speichere sie direkt.</p></div></div>}
          </UnrankedZone>

          <DragOverlay>{activeItem ? <div className="rotate-2 rounded-xl border-2 border-foreground bg-card px-4 py-3 font-black shadow-[5px_5px_0_var(--ink)]"><span className="flex items-center gap-2"><GripVertical className="size-4" />{activeItem.label}</span></div> : null}</DragOverlay>
        </DndContext>

        <section className="sticky bottom-4 z-20 mt-8 flex flex-col gap-4 rounded-[1.5rem] border-[3px] border-foreground bg-card/95 p-4 shadow-[7px_7px_0_var(--ink)] backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:p-5">
          <div className="flex items-center gap-3"><span className="grid size-10 place-items-center rounded-xl border-2 border-foreground bg-[#d9cffd]"><UserRound className="size-5" /></span><div><p className="text-xs font-black uppercase tracking-wider text-muted-foreground">Du stimmst ab als</p><p className="font-black">{account?.user?.displayName ?? 'Angemeldete Person'}</p></div></div>
          <Button disabled={!complete || submitting} onClick={submitVote} className="h-12 border-2 border-foreground px-6 text-base font-black shadow-[3px_3px_0_var(--ink)]">{submitting ? 'Wird gespeichert…' : complete ? hasSavedVote ? 'Änderungen speichern' : 'Abstimmung senden' : `Noch ${ranking.items.length - assigned} einordnen`} <Send /></Button>
        </section>
        <RankingSocial slug={slug} items={ranking.items} />
        {error && <p role="alert" className="mt-5 rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
        <div className="mt-5 flex flex-wrap gap-4">{scoreHistory.length > 0 && <button onClick={undo} className="flex items-center gap-2 text-sm font-black text-primary hover:underline"><Undo2 className="size-4" /> Letzte Änderung rückgängig</button>}{assigned > 0 && <button onClick={resetScores} className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"><RotateCcw className="size-4" /> Alles zurücksetzen</button>}</div>
      </section>
    </main>
  );
}
