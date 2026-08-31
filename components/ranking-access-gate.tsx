'use client';

import { useState } from 'react';
import { KeyRound, Link2, LockKeyhole } from 'lucide-react';
import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { RankingAccessMode } from '@/db/rankings';

export function RankingAccessGate({
  slug,
  accessMode,
  onUnlocked,
}: {
  slug: string;
  accessMode: RankingAccessMode;
  onUnlocked: () => void;
}) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function unlock(event: { preventDefault(): void }) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${slug}/access`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? 'Zugriff verweigert.');
      onUnlocked();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : 'Zugriff verweigert.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <BrandHeader />
      <section className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center">
        <span className="grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#d9cffd] shadow-[6px_6px_0_var(--ink)]">
          <LockKeyhole className="size-10" />
        </span>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">
          Privates Ranking
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">
          Zugriff geschützt.
        </h1>
        {accessMode === 'password' ? (
          <form
            onSubmit={unlock}
            className="mt-7 grid w-full gap-3 rounded-[1.25rem] border-2 border-foreground bg-card p-5 text-left shadow-[4px_4px_0_var(--ink)]"
          >
            <label
              htmlFor="ranking-access-password"
              className="text-sm font-black"
            >
              Passwort
            </label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="ranking-access-password"
                type="password"
                required
                  autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 border-2 border-foreground pl-12 font-bold"
              />
            </div>
            {error && (
              <p role="alert" className="text-sm font-bold text-[#8a1717]">
                {error}
              </p>
            )}
            <Button
              disabled={submitting}
              className="h-12 border-2 border-foreground font-black shadow-[3px_3px_0_var(--ink)]"
            >
              {submitting ? 'Wird geprüft…' : 'Ranking öffnen'} <LockKeyhole />
            </Button>
          </form>
        ) : (
          <div className="mt-7 w-full rounded-[1.25rem] border-2 border-foreground bg-card p-6 shadow-[4px_4px_0_var(--ink)]">
            <Link2 className="mx-auto size-7 text-primary" />
            <p className="mt-3 font-black">
              Du brauchst einen gültigen Einladungslink.
            </p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">
              Bitte öffne den vollständigen Link, den dir der Ersteller
              geschickt hat.
            </p>
            {error && (
              <p role="alert" className="mt-3 text-sm font-bold text-[#8a1717]">
                {error}
              </p>
            )}
          </div>
        )}
      </section>
    </main>
  );
}
