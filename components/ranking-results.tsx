'use client';
/* oxlint-disable next/no-img-element -- option thumbnails are pre-compressed data URLs */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { BarChart3, CheckCircle2, Clock3, Copy, Crown, Download, FileText, GitCompare, Image as ImageIcon, LockKeyhole, Medal, Pencil, Radio, RefreshCw, Share2, Sparkles, Users, Zap } from 'lucide-react';
import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/ui/button';
import { RankingAccessGate } from '@/components/ranking-access-gate';
import { RankingSocial } from '@/components/ranking-social';
import type { RankingAccessMode, RankingData, RankingItem, RankingParticipant, RankingTier } from '@/db/rankings';

function resultTier(item: RankingItem, tiers: RankingTier[]) {
  const score = Math.max(1, Math.min(tiers.length, Math.round(item.average ?? 1)));
  return tiers.find((tier) => tier.score === score) ?? tiers[tiers.length - 1];
}

function scoreDeviation(item: RankingItem) {
  if (!item.votes || item.average === null) return 0;
  const variance = Object.entries(item.distribution).reduce((sum, [score, count]) => sum + Number(count) * (Number(score) - item.average!) ** 2, 0) / item.votes;
  return Math.sqrt(variance);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function clipped(context: CanvasRenderingContext2D, text: string, maxWidth: number) {
  if (context.measureText(text).width <= maxWidth) return text;
  let value = text;
  while (value.length > 1 && context.measureText(`${value}…`).width > maxWidth) value = value.slice(0, -1);
  return `${value}…`;
}

export function RankingResults({ slug }: { slug: string }) {
  const [ranking, setRanking] = useState<RankingData | null>(null);
  const [participants, setParticipants] = useState<RankingParticipant[]>([]);
  const [participantA, setParticipantA] = useState('');
  const [participantB, setParticipantB] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [accessMode, setAccessMode] = useState<RankingAccessMode | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await fetch(`/api/rankings/${slug}`, { cache: 'no-store' });
      const data = await response.json() as RankingData & { error?: string; accessMode?: RankingAccessMode };
      if (response.status === 403 && data.accessMode) {
        setAccessMode(data.accessMode);
        setError('');
        return;
      }
      if (!response.ok) throw new Error(data.error ?? 'Ranking nicht gefunden.');
      const analysisResponse = await fetch(`/api/rankings/${slug}/analysis`, { cache: 'no-store' });
      const analysis = analysisResponse.ok ? await analysisResponse.json() as { participants: RankingParticipant[] } : { participants: [] };
      setRanking(data);
      setParticipants(analysis.participants);
      setLastUpdated(Date.now());
      setNow(Date.now());
      setAccessMode(null);
      setError('');
    } catch (reason) {
      if (!silent) setError(reason instanceof Error ? reason.message : 'Ranking nicht gefunden.');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load(true);
    }, 10_000);
    return () => window.clearInterval(interval);
  }, [load]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(interval);
  }, []);

  const sorted = useMemo(() => [...(ranking?.items ?? [])].sort((a, b) => (b.average ?? 0) - (a.average ?? 0) || (a.averageRankPosition ?? 0) - (b.averageRankPosition ?? 0) || a.position - b.position), [ranking]);
  const measured = useMemo(() => sorted.filter((item) => item.votes > 0).map((item) => ({ item, deviation: scoreDeviation(item) })), [sorted]);
  const controversial = useMemo(() => (ranking?.ballotCount ?? 0) >= 2 && measured.length > 1 ? [...measured].sort((a, b) => b.deviation - a.deviation)[0] : null, [measured, ranking?.ballotCount]);
  const consensus = useMemo(() => (ranking?.ballotCount ?? 0) >= 2 && measured.length > 1 ? [...measured].sort((a, b) => a.deviation - b.deviation)[0] : null, [measured, ranking?.ballotCount]);
  const selectedA = participants.find((participant) => participant.id === participantA) ?? participants[0] ?? null;
  const selectedB = participants.find((participant) => participant.id === participantB) ?? participants.find((participant) => participant.id !== selectedA?.id) ?? null;
  const comparableItems = selectedA && selectedB ? sorted.filter((item) => selectedA.scores[item.id] && selectedB.scores[item.id]) : [];
  const similarity = ranking && comparableItems.length ? Math.max(0, Math.round((1 - comparableItems.reduce((sum, item) => sum + Math.abs(selectedA!.scores[item.id].tier - selectedB!.scores[item.id].tier), 0) / (comparableItems.length * Math.max(1, ranking.tiers.length - 1))) * 100)) : null;

  async function copyVoteLink() {
    await navigator.clipboard.writeText(`${window.location.origin}/r/${slug}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  function exportCsv() {
    if (!ranking) return;
    const escapeCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`;
    const rows: (string | number)[][] = [
      ['Rang', 'Option', 'Stufe', 'Durchschnitt', 'Stimmen', 'Standardabweichung'],
      ...sorted.map((item, index) => [index + 1, item.label, resultTier(item, ranking.tiers).label, item.average?.toFixed(2) ?? '', item.votes, scoreDeviation(item).toFixed(2)]),
      [],
      ['Teilnehmer', ...sorted.map((item) => item.label)],
      ...participants.map((participant) => [participant.voterName, ...sorted.map((item) => ranking.tiers.find((tier) => tier.score === participant.scores[item.id]?.tier)?.label ?? '')]),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map(escapeCell).join(';')).join('\n')}`;
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), `${ranking.slug}-auswertung.csv`);
  }

  function exportImage() {
    if (!ranking) return;
    const width = 1200;
    const rowHeight = 76;
    const height = 360 + sorted.length * rowHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) return;
    context.fillStyle = '#fffaf2';
    context.fillRect(0, 0, width, height);
    context.fillStyle = '#241d1a';
    context.font = '900 28px sans-serif';
    context.fillText('RANKLY · LIVE-AUSWERTUNG', 64, 68);
    context.font = '900 54px sans-serif';
    context.fillText(clipped(context, ranking.title, width - 128), 64, 140);
    context.font = '700 22px sans-serif';
    context.fillStyle = '#6f625c';
    context.fillText(`${ranking.ballotCount} ${ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'} · ${new Date().toLocaleString('de-CH')}`, 64, 182);
    const insightText = `${controversial ? `Umstritten: ${controversial.item.label}` : 'Noch keine Kontroverse'}   ·   ${consensus ? `Grösste Übereinstimmung: ${consensus.item.label}` : 'Noch keine Übereinstimmung'}`;
    context.fillStyle = '#d9cffd';
    context.fillRect(64, 220, width - 128, 72);
    context.strokeStyle = '#241d1a';
    context.lineWidth = 3;
    context.strokeRect(64, 220, width - 128, 72);
    context.fillStyle = '#241d1a';
    context.font = '800 20px sans-serif';
    context.fillText(clipped(context, insightText, width - 176), 88, 264);
    sorted.forEach((item, index) => {
      const y = 330 + index * rowHeight;
      const tier = resultTier(item, ranking.tiers);
      context.fillStyle = index % 2 ? '#fff5e7' : '#ffffff';
      context.fillRect(64, y, width - 128, 60);
      context.strokeStyle = '#241d1a';
      context.lineWidth = 2;
      context.strokeRect(64, y, width - 128, 60);
      context.fillStyle = tier.color;
      context.fillRect(82, y + 10, 80, 40);
      context.strokeRect(82, y + 10, 80, 40);
      context.fillStyle = '#241d1a';
      context.font = '900 19px sans-serif';
      context.fillText(`#${index + 1}`, 184, y + 37);
      context.fillText(clipped(context, item.label, 650), 250, y + 37);
      context.font = '800 17px sans-serif';
      context.fillText(clipped(context, tier.label, 65), 92, y + 37);
      context.fillStyle = '#6f625c';
      context.fillText(`Ø ${item.average?.toFixed(2) ?? '–'}`, 1010, y + 37);
    });
    canvas.toBlob((blob) => { if (blob) downloadBlob(blob, `${ranking.slug}-auswertung.png`); }, 'image/png');
  }

  async function exportPdf() {
    if (!ranking) return;
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10);
    pdf.setTextColor(103, 78, 214);
    pdf.text('RANKLY · LIVE-AUSWERTUNG', 16, 18);
    pdf.setTextColor(36, 29, 26);
    pdf.setFontSize(22);
    pdf.text(ranking.title, 16, 30, { maxWidth: 178 });
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    pdf.text(`${ranking.ballotCount} ${ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'} · ${new Date().toLocaleString('de-CH')}`, 16, 43);
    let y = 57;
    sorted.forEach((item, index) => {
      if (y > 278) { pdf.addPage(); y = 20; }
      const tier = resultTier(item, ranking.tiers);
      pdf.setFillColor(tier.color);
      pdf.roundedRect(16, y - 6, 20, 9, 1.5, 1.5, 'F');
      pdf.setTextColor(36, 29, 26);
      pdf.setFont('helvetica', 'bold');
      pdf.text(`#${index + 1}`, 40, y);
      pdf.text(tier.label.slice(0, 15), 53, y);
      pdf.text(item.label.slice(0, 65), 82, y);
      pdf.setFont('helvetica', 'normal');
      pdf.text(`Ø ${item.average?.toFixed(2) ?? '–'}`, 180, y, { align: 'right' });
      y += 12;
    });
    pdf.save(`${ranking.slug}-auswertung.pdf`);
  }

  if (loading && !ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center font-black">Auswertung wird geladen…</div></main>;
  if (accessMode) return <RankingAccessGate slug={slug} accessMode={accessMode} onUnlocked={() => void load()} />;
  if (!ranking) return <main className="min-h-screen bg-background"><BrandHeader /><div className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl font-black">Nicht gefunden</h1><p className="mt-3 text-muted-foreground">{error}</p></div></main>;
  const closed = ranking.closesAt !== null && now >= ranking.closesAt;

  return (
    <main className="rankly-page min-h-screen pb-24">
      <BrandHeader action={<div className="flex items-center gap-2"><a href={`/r/${slug}`} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-black hover:bg-muted sm:inline-flex"><Pencil className="size-4" /> Meine Stimme</a><Button variant="outline" onClick={copyVoteLink} className="border-2 border-foreground font-black">{copied ? <CheckCircle2 /> : <Share2 />}<span className="hidden sm:inline">{copied ? 'Link kopiert' : 'Teilen'}</span></Button></div>} />
      <section className="mx-auto max-w-6xl px-5 pt-8 sm:px-8 sm:pt-12">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div><p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.15em] text-primary"><Radio className="size-4" /> Live-Auswertung</p><h1 className="mt-2 max-w-3xl text-4xl font-black tracking-[-0.05em] sm:text-6xl">{ranking.title}</h1>{ranking.description && <p className="mt-4 max-w-2xl text-lg font-medium text-muted-foreground">{ranking.description}</p>}</div>
          <div className="flex flex-wrap items-center gap-3"><span className="flex items-center gap-2 rounded-full border-2 border-foreground bg-card px-4 py-2 font-black"><Users className="size-5" /> {ranking.ballotCount} {ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'}</span>{ranking.closesAt && <span className={`flex items-center gap-2 rounded-full border-2 border-foreground px-4 py-2 text-sm font-black ${closed ? 'bg-[#ffe2df] text-[#8a1717]' : 'bg-[#fff1a8]'}`}>{closed ? <LockKeyhole className="size-4" /> : <Clock3 className="size-4" />}{closed ? 'Geschlossen' : `Bis ${new Date(ranking.closesAt).toLocaleString('de-CH', { dateStyle: 'short', timeStyle: 'short' })}`}</span>}<Button variant="outline" size="icon" className="size-11 border-2 border-foreground" onClick={() => void load()} aria-label="Ergebnisse aktualisieren"><RefreshCw className={loading ? 'animate-spin' : ''} /></Button></div>
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-muted-foreground"><span className="flex items-center gap-2 text-[#18713b]"><span className="size-2.5 animate-pulse rounded-full bg-[#24a55a]" /> Automatische Aktualisierung alle 10 Sekunden</span>{lastUpdated && <span>Zuletzt aktualisiert: {new Date(lastUpdated).toLocaleTimeString('de-CH')}</span>}</div>

        {!ranking.canViewResults ? (
          <div className="mt-12 rounded-[1.75rem] border-[3px] border-foreground bg-card p-10 text-center shadow-[7px_7px_0_var(--ink)]"><span className="mx-auto grid size-16 place-items-center rounded-2xl border-2 border-foreground bg-[#fff1a8]"><LockKeyhole className="size-8" /></span><h2 className="mt-6 text-3xl font-black">Ergebnisse sind noch geheim</h2><p className="mx-auto mt-2 max-w-lg font-medium text-muted-foreground">{ranking.resultsVisibility === 'after_vote' ? 'Stimme zuerst selbst ab. Direkt danach wird die Auswertung für dich freigeschaltet.' : 'Die erstellende Person zeigt die Ergebnisse erst nach dem Ende der Abstimmung.'}</p>{ranking.resultsVisibility === 'after_vote' && <a href={`/r/${slug}`} className="mt-6 inline-flex h-12 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 font-black text-primary-foreground shadow-[3px_3px_0_var(--ink)]"><Pencil className="size-5" /> Jetzt abstimmen</a>}</div>
        ) : ranking.ballotCount === 0 ? (
          <div className="mt-12 rounded-[1.75rem] border-[3px] border-foreground bg-card p-10 text-center shadow-[7px_7px_0_var(--ink)]"><span className="mx-auto grid size-16 place-items-center rounded-2xl border-2 border-foreground bg-[#d9cffd]"><BarChart3 className="size-8" /></span><h2 className="mt-6 text-3xl font-black">Noch keine Stimmen</h2><p className="mt-2 font-medium text-muted-foreground">Teile den Link – nach der ersten Abstimmung erscheint hier das Gruppenranking.</p><Button onClick={copyVoteLink} className="mt-6 h-12 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]"><Copy /> Link kopieren</Button></div>
        ) : (
          <>
            <section className="mt-10 grid gap-4 md:grid-cols-2">
              <article className="rounded-[1.4rem] border-[3px] border-foreground bg-[#ffe2df] p-5 shadow-[5px_5px_0_var(--ink)]"><div className="flex items-center gap-2 text-[#8a1717]"><Zap className="size-5" /><p className="text-xs font-black uppercase tracking-[0.14em]">Umstrittenste Option</p></div><h2 className="mt-3 text-2xl font-black">{controversial?.item.label ?? 'Noch nicht bestimmbar'}</h2><p className="mt-1 text-sm font-bold text-muted-foreground">{controversial ? `Streuung ${controversial.deviation.toFixed(2)} – hier gehen die Meinungen am stärksten auseinander.` : 'Mindestens zwei bewertete Optionen werden benötigt.'}</p></article>
              <article className="rounded-[1.4rem] border-[3px] border-foreground bg-[#d9f7e4] p-5 shadow-[5px_5px_0_var(--ink)]"><div className="flex items-center gap-2 text-[#18713b]"><Sparkles className="size-5" /><p className="text-xs font-black uppercase tracking-[0.14em]">Grösste Übereinstimmung</p></div><h2 className="mt-3 text-2xl font-black">{consensus?.item.label ?? 'Noch nicht bestimmbar'}</h2><p className="mt-1 text-sm font-bold text-muted-foreground">{consensus ? `Streuung ${consensus.deviation.toFixed(2)} – bei dieser Option seid ihr euch am einigsten.` : 'Mindestens zwei bewertete Optionen werden benötigt.'}</p></article>
            </section>

            <section className="mt-10"><div className="mb-4 flex items-center gap-2"><Crown className="size-5 text-primary" /><h2 className="text-sm font-black uppercase tracking-[0.14em] text-primary">Euer Top 3 Podium</h2></div><ol className="grid gap-4 sm:grid-cols-3">{sorted.slice(0, 3).map((item, index) => { const tier = resultTier(item, ranking.tiers); return <li key={item.id} className={`rankly-card relative overflow-hidden rounded-[1.35rem] border-[3px] border-foreground bg-card p-5 shadow-[5px_5px_0_var(--ink)] ${index === 0 ? 'sm:-translate-y-2' : ''}`}><div className="absolute right-0 top-0 grid size-12 place-items-center rounded-bl-2xl border-b-2 border-l-2 border-foreground text-xl font-black" style={{ background: index === 0 ? '#fff1a8' : index === 1 ? '#e7e4df' : '#f3c6a8' }}>#{index + 1}</div><div className="flex items-center gap-3">{item.imageData && <img src={item.imageData} alt="" className="size-14 rounded-xl border-2 border-foreground object-cover" />}<span className="grid min-h-12 min-w-12 place-items-center rounded-xl border-2 border-foreground px-2 text-lg font-black" style={{ background: tier.color }}>{tier.label}</span></div><h3 className="mt-5 pr-8 text-xl font-black">{item.label}</h3><p className="mt-1 text-sm font-bold text-muted-foreground">Ø {item.average?.toFixed(2)} · {item.votes} {item.votes === 1 ? 'Stimme' : 'Stimmen'}</p></li>; })}</ol></section>

            <div className="mt-12 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[1.75rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7"><div className="mb-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border-2 border-foreground bg-[#fff1a8]"><Medal /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Gesamtrangliste</p><h2 className="text-2xl font-black">Eure Favoriten</h2></div></div><ol className="space-y-3">{sorted.map((item, index) => { const tier = resultTier(item, ranking.tiers); return <li key={item.id} className="grid grid-cols-[42px_auto_1fr_auto] items-center gap-3 rounded-xl border-2 border-foreground bg-background p-3"><span className="text-center text-lg font-black text-muted-foreground">#{index + 1}</span><div className="flex items-center gap-2">{item.imageData && <img src={item.imageData} alt="" className="size-11 rounded-lg border-2 border-foreground object-cover" />}<span className="grid min-h-11 min-w-11 place-items-center rounded-lg border-2 border-foreground px-2 text-base font-black" style={{ background: tier.color }}>{tier.label}</span></div><span className="min-w-0 font-black">{item.label}</span><span className="text-sm font-black text-muted-foreground">{item.average?.toFixed(2)}</span></li>; })}</ol></section>
              <section className="rounded-[1.75rem] border-[3px] border-foreground bg-[#fff5e7] p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7"><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Verteilung</p><h2 className="mt-1 text-2xl font-black">So wurde abgestimmt</h2><div className="mt-6 space-y-6">{sorted.slice(0, 6).map((item) => <div key={item.id}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="font-black">{item.label}</span><span className="font-bold text-muted-foreground">{item.votes}×</span></div><div className="flex h-7 overflow-hidden rounded-lg border-2 border-foreground bg-card">{ranking.tiers.map((tier) => { const count = item.distribution[String(tier.score)] ?? 0; const width = item.votes ? (count / item.votes) * 100 : 0; return width > 0 ? <div key={tier.id} className="grid place-items-center overflow-hidden text-[10px] font-black" style={{ width: `${width}%`, background: tier.color }} title={`${tier.label}: ${count}`}>{width >= 13 ? tier.label : ''}</div> : null; })}</div></div>)}</div></section>
            </div>

            <section className="mt-10 rounded-[1.75rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
              <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border-2 border-foreground bg-[#d9cffd]"><GitCompare /></span><div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Teilnehmervergleich</p><h2 className="text-2xl font-black">Wer bewertet ähnlich?</h2></div></div>
              {participants.length < 2 ? <p className="mt-5 font-semibold text-muted-foreground">Für einen Vergleich werden mindestens zwei Teilnehmer benötigt.</p> : <><div className="mt-6 grid gap-3 sm:grid-cols-[1fr_auto_1fr] sm:items-end"><label className="grid gap-2 text-sm font-black">Person A<select value={selectedA?.id ?? ''} onChange={(event) => setParticipantA(event.target.value)} className="h-12 rounded-xl border-2 border-foreground bg-background px-3 font-bold">{participants.map((participant) => <option key={participant.id} value={participant.id}>{participant.voterName}</option>)}</select></label><span className="pb-3 text-center font-black text-muted-foreground">vs.</span><label className="grid gap-2 text-sm font-black">Person B<select value={selectedB?.id ?? ''} onChange={(event) => setParticipantB(event.target.value)} className="h-12 rounded-xl border-2 border-foreground bg-background px-3 font-bold">{participants.filter((participant) => participant.id !== selectedA?.id).map((participant) => <option key={participant.id} value={participant.id}>{participant.voterName}</option>)}</select></label></div><div className="mt-5 rounded-xl border-2 border-foreground bg-[#d9f7e4] p-4 text-center"><p className="text-3xl font-black">{similarity ?? 0}%</p><p className="text-sm font-bold text-muted-foreground">Übereinstimmung über {comparableItems.length} Optionen</p></div><div className="mt-5 max-h-96 space-y-2 overflow-auto">{comparableItems.map((item) => { const scoreA = selectedA!.scores[item.id].tier; const scoreB = selectedB!.scores[item.id].tier; const tierA = ranking.tiers.find((tier) => tier.score === scoreA); const tierB = ranking.tiers.find((tier) => tier.score === scoreB); return <div key={item.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-xl border-2 border-foreground/20 p-3"><span className="font-black">{item.label}</span><span className="rounded-lg border-2 border-foreground px-3 py-1 text-sm font-black" style={{ background: tierA?.color }}>{tierA?.label}</span><span className="rounded-lg border-2 border-foreground px-3 py-1 text-sm font-black" style={{ background: tierB?.color }}>{tierB?.label}</span></div>; })}</div></>}
            </section>

            <section className="mt-10 rounded-[1.5rem] border-[3px] border-foreground bg-[#d9cffd] p-6 shadow-[6px_6px_0_var(--ink)]"><div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-center"><div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Exportieren</p><h2 className="mt-1 text-2xl font-black">Ergebnis mitnehmen</h2><p className="mt-1 font-semibold text-muted-foreground">Als fertige Grafik, PDF-Bericht oder vollständige CSV-Datei.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={exportImage} className="h-11 border-2 border-foreground bg-card font-black"><ImageIcon /> Bild</Button><Button variant="outline" onClick={() => void exportPdf()} className="h-11 border-2 border-foreground bg-card font-black"><FileText /> PDF</Button><Button onClick={exportCsv} className="h-11 border-2 border-foreground font-black shadow-[3px_3px_0_var(--ink)]"><Download /> CSV</Button></div></div></section>

            <section className="mt-8 flex flex-col items-start justify-between gap-5 rounded-[1.5rem] border-2 border-foreground bg-[#fff1a8] p-6 sm:flex-row sm:items-center"><div><h2 className="text-2xl font-black">Noch mehr Meinungen sammeln?</h2><p className="mt-1 font-semibold text-muted-foreground">Teile die Abstimmung – die Auswertung aktualisiert sich automatisch.</p></div><Button onClick={copyVoteLink} className="h-12 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]">{copied ? <CheckCircle2 /> : <Copy />} {copied ? 'Kopiert' : 'Abstimmungslink kopieren'}</Button></section>
          </>
        )}
        <RankingSocial slug={slug} items={ranking.items} />
        {error && <p role="alert" className="mt-5 rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
      </section>
    </main>
  );
}
