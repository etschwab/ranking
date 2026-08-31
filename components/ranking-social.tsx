'use client';

import { useCallback, useEffect, useState } from 'react';
import { LogIn, MessageCircle, RefreshCw, Send, SmilePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import type { RankingItem } from '@/db/rankings';
import type { RankingComment, ReactionSummary } from '@/db/social';
import { reactionEmojis, type ReactionEmoji, type ReactionTargetType } from '@/lib/reactions';

type SocialResponse = {
  itemReactions: Record<string, ReactionSummary[]>;
  comments: RankingComment[];
  signedIn: boolean;
  signInPath: string;
  error?: string;
};

function reactionState(reactions: ReactionSummary[], emoji: ReactionEmoji) {
  return reactions.find((reaction) => reaction.emoji === emoji) ?? { emoji, count: 0, reacted: false };
}

function ReactionButtons({ reactions, disabled, label, onReact }: { reactions: ReactionSummary[]; disabled: boolean; label: string; onReact: (emoji: ReactionEmoji) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5" aria-label={`Reaktionen für ${label}`}>
      {reactionEmojis.map((emoji) => {
        const state = reactionState(reactions, emoji);
        return <button key={emoji} type="button" aria-pressed={state.reacted} aria-label={`${emoji} auf ${label}${state.count ? `, ${state.count} Reaktionen` : ''}`} disabled={disabled} onClick={() => onReact(emoji)} className={`inline-flex h-9 min-w-10 items-center justify-center gap-1 rounded-lg border-2 px-2 text-sm font-black transition hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60 ${state.reacted ? 'border-foreground bg-[#d9cffd] shadow-[2px_2px_0_var(--ink)]' : 'border-foreground/25 bg-card hover:border-foreground'}`}><span aria-hidden>{emoji}</span>{state.count > 0 && <span>{state.count}</span>}</button>;
      })}
    </div>
  );
}

export function RankingSocial({ slug, items }: { slug: string; items: RankingItem[] }) {
  const [social, setSocial] = useState<SocialResponse | null>(null);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/rankings/${slug}/social`, { cache: 'no-store' });
      const data = await response.json() as SocialResponse;
      if (!response.ok) throw new Error(data.error ?? 'Reaktionen konnten nicht geladen werden.');
      setSocial(data);
      setError('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reaktionen konnten nicht geladen werden.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  function requireLogin() {
    if (social?.signedIn) return false;
    if (social?.signInPath) window.location.href = social.signInPath;
    return true;
  }

  async function react(targetType: ReactionTargetType, targetId: string, emoji: ReactionEmoji) {
    if (requireLogin()) return;
    const key = `${targetType}:${targetId}:${emoji}`;
    setPending(key);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${slug}/reactions`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ targetType, targetId, emoji }) });
      const data = await response.json() as { error?: string; signInPath?: string };
      if (response.status === 401 && data.signInPath) { window.location.href = data.signInPath; return; }
      if (!response.ok) throw new Error(data.error ?? 'Reaktion konnte nicht gespeichert werden.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Reaktion konnte nicht gespeichert werden.');
    } finally {
      setPending('');
    }
  }

  async function submitComment(event: React.FormEvent) {
    event.preventDefault();
    if (!comment.trim() || requireLogin()) return;
    setPending('comment');
    setError('');
    try {
      const response = await fetch(`/api/rankings/${slug}/comments`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ body: comment }) });
      const data = await response.json() as { error?: string; signInPath?: string };
      if (response.status === 401 && data.signInPath) { window.location.href = data.signInPath; return; }
      if (!response.ok) throw new Error(data.error ?? 'Kommentar konnte nicht gesendet werden.');
      setComment('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kommentar konnte nicht gesendet werden.');
    } finally {
      setPending('');
    }
  }

  return (
    <section className="mt-10 rounded-[1.75rem] border-[3px] border-foreground bg-[#fff5e7] p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-primary"><SmilePlus className="size-5" /> Reaktionen</p><h2 className="mt-1 text-3xl font-black tracking-tight">Was fühlt die Runde?</h2><p className="mt-1 font-semibold text-muted-foreground">Reagiere auf Optionen und diskutiere gemeinsam in den Kommentaren.</p></div>
        <button type="button" onClick={() => void load()} disabled={loading} className="grid size-10 place-items-center rounded-xl border-2 border-foreground bg-card" aria-label="Reaktionen aktualisieren"><RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} /></button>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-2">
        {items.map((item) => <article key={item.id} className="rounded-xl border-2 border-foreground bg-card p-4"><h3 className="mb-3 font-black">{item.label}</h3><ReactionButtons label={item.label} reactions={social?.itemReactions[item.id] ?? []} disabled={pending.startsWith(`item:${item.id}:`)} onReact={(emoji) => void react('item', item.id, emoji)} /></article>)}
      </div>

      <div className="mt-8 border-t-[3px] border-foreground pt-7">
        <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl border-2 border-foreground bg-[#d9cffd]"><MessageCircle className="size-5" /></span><div><h2 className="text-2xl font-black">Kommentare</h2><p className="text-sm font-semibold text-muted-foreground">{social?.comments.length ?? 0} Beiträge</p></div></div>
        {social?.signedIn ? <form onSubmit={submitComment} className="mt-5 grid gap-3"><Textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} required placeholder="Was denkst du über dieses Ranking?" className="min-h-24 border-2 border-foreground bg-card px-4 py-3" /><div className="flex items-center justify-between gap-3"><span className="text-xs font-bold text-muted-foreground">{comment.length}/500</span><Button type="submit" disabled={!comment.trim() || pending === 'comment'} className="h-11 border-2 border-foreground px-5 font-black shadow-[3px_3px_0_var(--ink)]">{pending === 'comment' ? 'Wird gesendet…' : 'Kommentieren'} <Send /></Button></div></form> : <a href={social?.signInPath ?? `/login?returnTo=${encodeURIComponent(`/r/${slug}`)}`} className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 font-black text-primary-foreground shadow-[3px_3px_0_var(--ink)]"><LogIn className="size-4" /> Zum Reagieren anmelden</a>}

        <div className="mt-6 space-y-3">
          {social?.comments.map((entry) => <article key={entry.id} className="rounded-xl border-2 border-foreground bg-card p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black">{entry.authorName}</p><time className="text-xs font-bold text-muted-foreground" dateTime={new Date(entry.createdAt).toISOString()}>{new Date(entry.createdAt).toLocaleString('de-CH', { dateStyle: 'medium', timeStyle: 'short' })}</time></div><p className="mt-2 whitespace-pre-wrap break-words font-medium leading-relaxed">{entry.body}</p><div className="mt-3"><ReactionButtons label={`Kommentar von ${entry.authorName}`} reactions={entry.reactions} disabled={pending.startsWith(`comment:${entry.id}:`)} onReact={(emoji) => void react('comment', entry.id, emoji)} /></div></article>)}
          {!loading && social?.comments.length === 0 && <div className="rounded-xl border-2 border-dashed border-foreground/35 bg-card/70 p-6 text-center font-semibold text-muted-foreground">Noch keine Kommentare – starte die Unterhaltung.</div>}
        </div>
      </div>
      {error && <p role="alert" className="mt-5 rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 font-bold text-[#8a1717]">{error}</p>}
    </section>
  );
}
