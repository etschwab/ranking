'use client';

import { useState } from 'react';
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { RankingData } from '@/db/rankings';

type EditItem = { key: string; id?: string; label: string };

export function RankingEditForm({ ranking }: { ranking: RankingData }) {
  const [title, setTitle] = useState(ranking.title);
  const [description, setDescription] = useState(ranking.description);
  const [items, setItems] = useState<EditItem[]>(ranking.items.map((item) => ({ key: item.id, id: item.id, label: item.label })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function updateItem(key: string, label: string) {
    setItems((current) => current.map((item) => item.key === key ? { ...item, label } : item));
  }

  function moveItem(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    setItems((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addItem() {
    if (items.length >= 30) return;
    setItems((current) => [...current, { key: crypto.randomUUID(), label: '' }]);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${ranking.slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description, items: items.map(({ id, label }) => ({ id, label })) }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      window.location.href = `/r/${ranking.slug}/results`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-7">
      {ranking.ballotCount > 0 && <div className="flex gap-3 rounded-xl border-2 border-[#9a6513] bg-[#fff1a8] p-4 text-sm font-bold text-[#6f4708]"><AlertTriangle className="size-5 shrink-0" /><p>Dieses Ranking hat bereits {ranking.ballotCount} {ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'}. Gelöschte Optionen verlieren ihre Bewertungen; neue Optionen können bestehende Teilnehmer später ergänzen.</p></div>}
      <section className="grid gap-5 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
        <label className="grid gap-2 text-sm font-black" htmlFor="edit-title">Titel<Input id="edit-title" required minLength={3} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 border-2 border-foreground px-4 text-base font-bold" /></label>
        <label className="grid gap-2 text-sm font-black" htmlFor="edit-description">Beschreibung <span className="font-semibold text-muted-foreground">(optional)</span><Textarea id="edit-description" maxLength={280} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 border-2 border-foreground px-4 py-3 text-base" /></label>
      </section>

      <section className="rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Optionen</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Umbenennen, sortieren oder neue hinzufügen.</p></div><span className="rounded-full border-2 border-foreground bg-[#d9cffd] px-3 py-1 text-sm font-black">{items.length}/30</span></div>
        <ol className="mt-6 grid gap-3">{items.map((item, index) => <li key={item.key} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-xl border-2 border-foreground bg-background p-2"><span className="grid size-9 place-items-center rounded-lg bg-muted text-sm font-black">{index + 1}</span><Input required maxLength={80} value={item.label} onChange={(event) => updateItem(item.key, event.target.value)} aria-label={`Option ${index + 1}`} className="h-10 border-0 bg-transparent px-2 font-bold shadow-none focus-visible:ring-0" /><div className="flex"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-25" aria-label={`${item.label || `Option ${index + 1}`} nach oben`}><ArrowUp className="size-4" /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-25" aria-label={`${item.label || `Option ${index + 1}`} nach unten`}><ArrowDown className="size-4" /></button><button type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} disabled={items.length <= 2} className="grid size-9 place-items-center rounded-lg text-[#9a2820] hover:bg-[#ffe2df] disabled:opacity-25" aria-label={`${item.label || `Option ${index + 1}`} entfernen`}><Trash2 className="size-4" /></button></div></li>)}</ol>
        <Button type="button" variant="outline" onClick={addItem} disabled={items.length >= 30} className="mt-4 h-11 border-2 border-dashed border-foreground font-black"><Plus /> Option hinzufügen</Button>
      </section>

      {error && <p role="alert" className="rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-[1.25rem] border-[3px] border-foreground bg-card/95 p-4 shadow-[6px_6px_0_var(--ink)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"><a href="/mine" className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Abbrechen</a><div className="flex flex-col gap-2 sm:flex-row"><a href={`/r/${ranking.slug}/results`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-black hover:bg-muted"><BarChart3 className="size-4" /> Auswertung</a><Button type="submit" disabled={saving || items.length < 2} className="h-11 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]">{saving ? 'Wird gespeichert…' : 'Änderungen speichern'} <Save /></Button></div></div>
    </form>
  );
}
