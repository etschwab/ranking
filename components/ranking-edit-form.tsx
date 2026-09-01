'use client';
/* oxlint-disable next/no-img-element -- uploaded images are already resized client-side data URLs */

import { useState } from 'react';
import { AlertOctagon, AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, BarChart3, Clock3, CopyPlus, Eye, EyeOff, Globe2, ImagePlus, KeyRound, LockKeyhole, Mail, Plus, Save, ShieldCheck, Trash2, Unlock, UserRound, UserX, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type { OwnedRankingData, RankingAccessMode, ResultsVisibility, VotingNameMode } from '@/db/rankings';

type EditItem = { key: string; id?: string; label: string; imageData: string | null };
type EditTier = { key: string; id?: string; label: string; color: string };

function resizeImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    if (file.size > 8_000_000) { reject(new Error('Das Bild darf höchstens 8 MB gross sein.')); return; }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Das Bild konnte nicht gelesen werden.'));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error('Dieses Bildformat wird nicht unterstützt.'));
      image.onload = () => {
        const scale = Math.min(1, 360 / Math.max(image.width, image.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL('image/webp', 0.7);
        if (data.length > 120_000) reject(new Error('Das verkleinerte Bild ist noch zu gross. Bitte wähle ein anderes.'));
        else resolve(data);
      };
      if (typeof reader.result !== 'string') { reject(new Error('Das Bild konnte nicht gelesen werden.')); return; }
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function toDateTimeLocal(timestamp: number | null) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RankingEditForm({ ranking }: { ranking: OwnedRankingData }) {
  const [title, setTitle] = useState(ranking.title);
  const [description, setDescription] = useState(ranking.description);
  const [isOpen, setIsOpen] = useState(ranking.isOpen);
  const [closesAt, setClosesAt] = useState(toDateTimeLocal(ranking.closesAt));
  const [accessMode, setAccessMode] = useState<RankingAccessMode>(ranking.accessMode);
  const [password, setPassword] = useState('');
  const [nameMode, setNameMode] = useState<VotingNameMode>(ranking.nameMode);
  const [oneVotePerUser, setOneVotePerUser] = useState(ranking.oneVotePerUser);
  const [resultsVisibility, setResultsVisibility] = useState<ResultsVisibility>(ranking.resultsVisibility);
  const [votePin, setVotePin] = useState('');
  const [removeVotePin, setRemoveVotePin] = useState(false);
  const [items, setItems] = useState<EditItem[]>(ranking.items.map((item) => ({ key: item.id, id: item.id, label: item.label, imageData: item.imageData })));
  const [tiers, setTiers] = useState<EditTier[]>(ranking.tiers.map((tier) => ({ key: tier.id, id: tier.id, label: tier.label, color: tier.color })));
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmationTitle, setConfirmationTitle] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
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
    setItems((current) => [...current, { key: crypto.randomUUID(), label: '', imageData: null }]);
  }

  function moveTier(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= tiers.length) return;
    setTiers((current) => { const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  }

  async function chooseImage(key: string, file?: File) {
    if (!file) return;
    setError('');
    try {
      const imageData = await resizeImage(file);
      setItems((current) => current.map((item) => item.key === key ? { ...item, imageData } : item));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Bild konnte nicht verarbeitet werden.'); }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${ranking.slug}`, {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title, description, isOpen, closesAt: closesAt ? new Date(closesAt).getTime() : null, accessMode, password, nameMode, oneVotePerUser, resultsVisibility, votePin, removeVotePin, items: items.map(({ id, label, imageData }) => ({ id, label, imageData })), tiers: tiers.map(({ id, label, color }) => ({ id, label, color })) }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Speichern fehlgeschlagen.');
      window.location.href = `/r/${ranking.slug}/results`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Speichern fehlgeschlagen.');
      setSaving(false);
    }
  }

  async function duplicateRanking() {
    setDuplicating(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${ranking.slug}`, { method: 'POST' });
      const data = await response.json() as { slug?: string; error?: string };
      if (!response.ok || !data.slug) throw new Error(data.error ?? 'Duplizieren fehlgeschlagen.');
      window.location.href = `/r/${data.slug}/edit`;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Duplizieren fehlgeschlagen.');
      setDuplicating(false);
    }
  }

  async function deleteRanking() {
    if (confirmationTitle.trim() !== ranking.title) return;
    setDeleting(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${ranking.slug}`, {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ confirmationTitle }),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Löschen fehlgeschlagen.');
      localStorage.removeItem(`rankly-ballot-${ranking.slug}`);
      localStorage.removeItem(`rankly-vote-draft-${ranking.slug}`);
      window.location.href = '/mine';
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Löschen fehlgeschlagen.');
      setDeleting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-10 grid gap-7">
      {ranking.ballotCount > 0 && <div className="flex gap-3 rounded-xl border-2 border-[#9a6513] bg-[#fff1a8] p-4 text-sm font-bold text-[#6f4708]"><AlertTriangle className="size-5 shrink-0" /><p>Dieses Ranking hat bereits {ranking.ballotCount} {ranking.ballotCount === 1 ? 'Stimme' : 'Stimmen'}. Gelöschte Optionen verlieren ihre Bewertungen; neue Optionen können bestehende Teilnehmer später ergänzen.</p></div>}
      <section className="grid gap-5 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
        <div className={`flex flex-col justify-between gap-4 rounded-xl border-2 border-foreground p-4 sm:flex-row sm:items-center ${isOpen ? 'bg-[#d9f7e4]' : 'bg-[#ffe2df]'}`}>
          <div className="flex items-center gap-3"><span className={`grid size-11 shrink-0 place-items-center rounded-xl border-2 border-foreground ${isOpen ? 'bg-[#80d6a8]' : 'bg-[#ff9b8e]'}`}>{isOpen ? <Unlock className="size-5" /> : <LockKeyhole className="size-5" />}</span><div><h2 className="font-black">Abstimmung {isOpen ? 'geöffnet' : 'geschlossen'}</h2><p className="text-sm font-semibold text-muted-foreground">{isOpen ? 'Neue und geänderte Stimmen werden angenommen.' : 'Bestehende Ergebnisse bleiben sichtbar, Stimmen sind gesperrt.'}</p></div></div>
          <Button type="button" variant="outline" onClick={() => setIsOpen((value) => !value)} className="h-11 shrink-0 border-2 border-foreground font-black">{isOpen ? <LockKeyhole /> : <Unlock />} {isOpen ? 'Schließen' : 'Öffnen'}</Button>
        </div>
        <label className="grid gap-2 text-sm font-black" htmlFor="edit-title">Titel<Input id="edit-title" required minLength={3} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} className="h-12 border-2 border-foreground px-4 text-base font-bold" /></label>
        <label className="grid gap-2 text-sm font-black" htmlFor="edit-description">Beschreibung <span className="font-semibold text-muted-foreground">(optional)</span><Textarea id="edit-description" maxLength={280} value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 border-2 border-foreground px-4 py-3 text-base" /></label>
        <label className="grid gap-2 text-sm font-black" htmlFor="edit-deadline">Abstimmungsfrist <span className="font-semibold text-muted-foreground">(optional)</span><span className="relative"><Clock3 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" /><Input id="edit-deadline" type="datetime-local" value={closesAt} onChange={(event) => setClosesAt(event.target.value)} className="h-12 border-2 border-foreground pl-12 font-bold" /></span><span className="font-semibold text-muted-foreground">Leeren, um die Abstimmung wieder ohne Frist zu öffnen.</span></label>
        <fieldset className="grid gap-3"><legend className="text-sm font-black">Zugriff</legend><div className="grid gap-2 sm:grid-cols-3">{([
          { mode: 'public', icon: Globe2, title: 'Öffentlich', text: 'Jeder mit Link' },
          { mode: 'password', icon: KeyRound, title: 'Passwort', text: 'Geschützt' },
          { mode: 'invite', icon: Mail, title: 'Einladung', text: 'Geheimer Link' },
        ] as const).map((choice) => <button key={choice.mode} type="button" onClick={() => setAccessMode(choice.mode)} aria-pressed={accessMode === choice.mode} className={`rounded-xl border-2 p-3 text-left ${accessMode === choice.mode ? 'border-foreground bg-[#d9cffd] shadow-[3px_3px_0_var(--ink)]' : 'border-foreground/25 bg-background hover:border-foreground'}`}><choice.icon className="size-5" /><span className="mt-2 block font-black">{choice.title}</span><span className="text-xs font-semibold text-muted-foreground">{choice.text}</span></button>)}</div>{accessMode === 'password' && <label className="grid gap-2 text-sm font-black" htmlFor="edit-password">{ranking.accessMode === 'password' && ranking.hasPassword ? 'Neues Passwort (optional)' : 'Passwort'}<Input id="edit-password" type="password" required={ranking.accessMode !== 'password' || !ranking.hasPassword} minLength={6} maxLength={100} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-12 border-2 border-foreground px-4 font-bold" placeholder={ranking.accessMode === 'password' && ranking.hasPassword ? 'Leer lassen, um es beizubehalten' : 'Mindestens 6 Zeichen'} /><span className="font-semibold text-muted-foreground">Bei einer Änderung verlieren alte Freigaben automatisch ihre Gültigkeit.</span></label>}</fieldset>
      </section>

      <section className="rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border-2 border-foreground bg-[#fff1a8]"><ShieldCheck /></span><div><h2 className="text-2xl font-black">Abstimmung kontrollieren</h2><p className="text-sm font-semibold text-muted-foreground">Bestimme Identität, Mehrfachstimmen und wann Resultate sichtbar sind.</p></div></div>
        <div className="mt-6 grid gap-6">
          <fieldset className="grid gap-3"><legend className="text-sm font-black">Anzeige der Teilnehmer</legend><div className="grid gap-2 sm:grid-cols-2">{([{ value: 'required', icon: UserRound, title: 'Mit Namen', text: 'Profilname wird angezeigt' }, { value: 'anonymous', icon: UserX, title: 'Anonym', text: 'Name bleibt verborgen' }] as const).map((choice) => <button key={choice.value} type="button" onClick={() => setNameMode(choice.value)} aria-pressed={nameMode === choice.value} className={`rounded-xl border-2 p-4 text-left ${nameMode === choice.value ? 'border-foreground bg-[#d9cffd] shadow-[3px_3px_0_var(--ink)]' : 'border-foreground/25 bg-background'}`}><choice.icon className="size-5" /><span className="mt-2 block font-black">{choice.title}</span><span className="text-xs font-semibold text-muted-foreground">{choice.text}</span></button>)}</div></fieldset>
          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border-2 border-foreground bg-background p-4"><span><span className="block font-black">Nur eine Stimme pro Person</span><span className="text-sm font-semibold text-muted-foreground">Weitere Abstimmungen derselben Person aktualisieren ihre bestehende Stimme.</span></span><input type="checkbox" checked={oneVotePerUser} onChange={(event) => setOneVotePerUser(event.target.checked)} className="size-5 accent-primary" /></label>
          <fieldset className="grid gap-3"><legend className="text-sm font-black">Ergebnisse anzeigen</legend><div className="grid gap-2 sm:grid-cols-3">{([{ value: 'always', icon: Eye, title: 'Sofort', text: 'Immer sichtbar' }, { value: 'after_vote', icon: UserRound, title: 'Nach eigener Stimme', text: 'Erst selbst abstimmen' }, { value: 'after_close', icon: EyeOff, title: 'Nach dem Ende', text: 'Bis dahin geheim' }] as const).map((choice) => <button key={choice.value} type="button" onClick={() => setResultsVisibility(choice.value)} aria-pressed={resultsVisibility === choice.value} className={`rounded-xl border-2 p-3 text-left ${resultsVisibility === choice.value ? 'border-foreground bg-[#d9f7e4] shadow-[3px_3px_0_var(--ink)]' : 'border-foreground/25 bg-background'}`}><choice.icon className="size-5" /><span className="mt-2 block font-black">{choice.title}</span><span className="text-xs font-semibold text-muted-foreground">{choice.text}</span></button>)}</div></fieldset>
          <div className="grid gap-2"><label className="text-sm font-black" htmlFor="vote-pin">Abstimmungs-PIN <span className="font-semibold text-muted-foreground">(optional)</span></label><div className="flex gap-2"><Input id="vote-pin" value={votePin} onChange={(event) => { setVotePin(event.target.value.replace(/\D/g, '').slice(0, 8)); setRemoveVotePin(false); }} inputMode="numeric" pattern="[0-9]{4,8}" minLength={4} maxLength={8} className="h-12 border-2 border-foreground px-4 text-lg font-black tracking-widest" placeholder={ranking.votePinRequired && !removeVotePin ? 'Neue PIN (leer = behalten)' : '4–8 Ziffern'} />{ranking.votePinRequired && <Button type="button" variant="outline" onClick={() => { setRemoveVotePin((value) => !value); setVotePin(''); }} className={`h-12 border-2 font-black ${removeVotePin ? 'border-[#8a1717] bg-[#ffe2df] text-[#8a1717]' : 'border-foreground'}`}>{removeVotePin ? 'Wird entfernt' : 'PIN entfernen'}</Button>}</div><span className="text-sm font-semibold text-muted-foreground">Die PIN schützt nur die Stimmabgabe und kann separat vom Zugriffs-Passwort verwendet werden.</span></div>
        </div>
      </section>

      <section className="rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Stufen</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Namen, Farben und Reihenfolge selbst festlegen.</p></div><span className="rounded-full border-2 border-foreground bg-[#fff1a8] px-3 py-1 text-sm font-black">{tiers.length}/8</span></div>
        <ol className="mt-6 grid gap-3">{tiers.map((tier, index) => <li key={tier.key} className="grid grid-cols-[auto_52px_1fr_auto] items-center gap-2 rounded-xl border-2 border-foreground bg-background p-2"><span className="grid size-9 place-items-center rounded-lg text-sm font-black" style={{ background: tier.color }}>{index + 1}</span><input type="color" value={tier.color} onChange={(event) => setTiers((current) => current.map((entry) => entry.key === tier.key ? { ...entry, color: event.target.value } : entry))} className="h-10 w-12 cursor-pointer rounded-lg border-2 border-foreground bg-transparent p-1" aria-label={`Farbe von Stufe ${tier.label}`} /><Input required maxLength={24} value={tier.label} onChange={(event) => setTiers((current) => current.map((entry) => entry.key === tier.key ? { ...entry, label: event.target.value } : entry))} aria-label={`Name der Stufe ${index + 1}`} className="h-10 border-0 bg-transparent px-2 font-bold shadow-none focus-visible:ring-0" /><div className="flex"><button type="button" onClick={() => moveTier(index, -1)} disabled={index === 0} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-25" aria-label="Stufe nach oben"><ArrowUp className="size-4" /></button><button type="button" onClick={() => moveTier(index, 1)} disabled={index === tiers.length - 1} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-25" aria-label="Stufe nach unten"><ArrowDown className="size-4" /></button><button type="button" onClick={() => setTiers((current) => current.filter((entry) => entry.key !== tier.key))} disabled={tiers.length <= 2} className="grid size-9 place-items-center rounded-lg text-[#9a2820] hover:bg-[#ffe2df] disabled:opacity-25" aria-label="Stufe entfernen"><Trash2 className="size-4" /></button></div></li>)}</ol>
        <Button type="button" variant="outline" onClick={() => setTiers((current) => [...current, { key: crypto.randomUUID(), label: `Stufe ${current.length + 1}`, color: '#d9cffd' }])} disabled={tiers.length >= 8} className="mt-4 h-11 border-2 border-dashed border-foreground font-black"><Plus /> Stufe hinzufügen</Button>
      </section>

      <section className="rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
        <div className="flex items-end justify-between gap-4"><div><h2 className="text-2xl font-black">Optionen</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Umbenennen, sortieren oder neue hinzufügen.</p></div><span className="rounded-full border-2 border-foreground bg-[#d9cffd] px-3 py-1 text-sm font-black">{items.length}/30</span></div>
        <ol className="mt-6 grid gap-3">{items.map((item, index) => <li key={item.key} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-xl border-2 border-foreground bg-background p-2"><span className="grid size-9 place-items-center rounded-lg bg-muted text-sm font-black">{index + 1}</span><label className="grid size-11 cursor-pointer place-items-center overflow-hidden rounded-lg border-2 border-dashed border-foreground bg-muted" title="Bild auswählen">{item.imageData ? <img src={item.imageData} alt="" className="size-full object-cover" /> : <ImagePlus className="size-5" />}<input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void chooseImage(item.key, event.target.files?.[0])} /></label><div className="min-w-0"><Input required maxLength={80} value={item.label} onChange={(event) => updateItem(item.key, event.target.value)} aria-label={`Option ${index + 1}`} className="h-10 border-0 bg-transparent px-2 font-bold shadow-none focus-visible:ring-0" />{item.imageData && <button type="button" onClick={() => setItems((current) => current.map((entry) => entry.key === item.key ? { ...entry, imageData: null } : entry))} className="px-2 text-xs font-bold text-[#9a2820] hover:underline">Bild entfernen</button>}</div><div className="flex"><button type="button" onClick={() => moveItem(index, -1)} disabled={index === 0} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-25" aria-label={`${item.label || `Option ${index + 1}`} nach oben`}><ArrowUp className="size-4" /></button><button type="button" onClick={() => moveItem(index, 1)} disabled={index === items.length - 1} className="grid size-9 place-items-center rounded-lg hover:bg-muted disabled:opacity-25" aria-label={`${item.label || `Option ${index + 1}`} nach unten`}><ArrowDown className="size-4" /></button><button type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.key !== item.key))} disabled={items.length <= 2} className="grid size-9 place-items-center rounded-lg text-[#9a2820] hover:bg-[#ffe2df] disabled:opacity-25" aria-label={`${item.label || `Option ${index + 1}`} entfernen`}><Trash2 className="size-4" /></button></div></li>)}</ol>
        <Button type="button" variant="outline" onClick={addItem} disabled={items.length >= 30} className="mt-4 h-11 border-2 border-dashed border-foreground font-black"><Plus /> Option hinzufügen</Button>
      </section>

      <section className="rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[6px_6px_0_var(--ink)] sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl border-2 border-foreground bg-[#d9cffd]"><CopyPlus className="size-5" /></span><div><h2 className="text-xl font-black">Ranking duplizieren</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Erstellt eine geöffnete Kopie ohne Stimmen und ohne Einsendeschluss.</p></div></div><Button type="button" variant="outline" onClick={duplicateRanking} disabled={duplicating} className="h-11 border-2 border-foreground font-black"><CopyPlus /> {duplicating ? 'Wird dupliziert…' : 'Kopie erstellen'}</Button></div>
      </section>

      <section className="rounded-[1.5rem] border-[3px] border-[#8a1717] bg-[#fff7f5] p-5 shadow-[6px_6px_0_#8a1717] sm:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#ffe2df] text-[#8a1717]"><AlertOctagon className="size-6" /></span><div><h2 className="text-xl font-black text-[#8a1717]">Gefahrenzone</h2><p className="mt-1 text-sm font-semibold text-muted-foreground">Das Ranking und alle dazugehörigen Stimmen dauerhaft löschen.</p></div></div>{!deleteOpen && <Button type="button" variant="outline" onClick={() => setDeleteOpen(true)} className="h-11 border-2 border-[#8a1717] font-black text-[#8a1717] hover:bg-[#ffe2df]"><Trash2 /> Ranking löschen</Button>}</div>
        {deleteOpen && <div className="mt-6 rounded-xl border-2 border-[#8a1717] bg-card p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-[#8a1717]">Diese Aktion kann nicht rückgängig gemacht werden.</p><p className="mt-1 text-sm font-semibold text-muted-foreground">Gib zur Bestätigung den Titel <strong className="text-foreground">{ranking.title}</strong> ein.</p></div><button type="button" onClick={() => { setDeleteOpen(false); setConfirmationTitle(''); }} className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-muted" aria-label="Löschen abbrechen"><X className="size-4" /></button></div><Input value={confirmationTitle} onChange={(event) => setConfirmationTitle(event.target.value)} className="mt-4 h-11 border-2 border-[#8a1717] px-3 font-bold" placeholder={ranking.title} aria-label="Ranking-Titel zur Löschbestätigung" autoComplete="off" /><div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="ghost" onClick={() => { setDeleteOpen(false); setConfirmationTitle(''); }} disabled={deleting} className="font-black">Abbrechen</Button><Button type="button" onClick={deleteRanking} disabled={deleting || confirmationTitle.trim() !== ranking.title} className="h-11 border-2 border-[#5f1010] bg-[#a31d1d] px-5 font-black text-white shadow-[3px_3px_0_#5f1010] hover:bg-[#8a1717]"><Trash2 /> {deleting ? 'Wird gelöscht…' : 'Endgültig löschen'}</Button></div></div>}
      </section>

      {error && <p role="alert" className="rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
      <div className="sticky bottom-4 z-20 flex flex-col gap-3 rounded-[1.25rem] border-[3px] border-foreground bg-card/95 p-4 shadow-[6px_6px_0_var(--ink)] backdrop-blur sm:flex-row sm:items-center sm:justify-between"><a href="/mine" className="inline-flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Abbrechen</a><div className="flex flex-col gap-2 sm:flex-row"><a href={`/r/${ranking.slug}/results`} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 font-black hover:bg-muted"><BarChart3 className="size-4" /> Auswertung</a><Button type="submit" disabled={saving || items.length < 2 || tiers.length < 2} className="h-11 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]">{saving ? 'Wird gespeichert…' : 'Änderungen speichern'} <Save /></Button></div></div>
    </form>
  );
}
