'use client';

import { useState } from 'react';
import { CheckCircle2, Mail, Save, UserRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function ProfileForm({
  initialName,
  email,
}: {
  initialName: string;
  email: string;
}) {
  const [displayName, setDisplayName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ displayName }),
      });
      const data = (await response.json()) as {
        displayName?: string;
        error?: string;
      };
      if (!response.ok || !data.displayName)
        throw new Error(
          data.error ?? 'Profil konnte nicht gespeichert werden.',
        );
      setDisplayName(data.displayName);
      setSavedName(data.displayName);
      setSaved(true);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Profil konnte nicht gespeichert werden.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={submit}
      className="mt-8 grid gap-6 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[7px_7px_0_var(--ink)] sm:p-7"
    >
      <label className="grid gap-2 text-sm font-black" htmlFor="display-name">
        Anzeigename
        <span className="relative">
          <UserRound className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="display-name"
            required
            minLength={2}
            maxLength={50}
            value={displayName}
            onChange={(event) => {
              setDisplayName(event.target.value);
              setSaved(false);
            }}
            className="h-12 border-2 border-foreground pl-12 text-base font-bold"
          />
        </span>
        <span className="font-semibold text-muted-foreground">
          Dieser Name erscheint bei deinen Abstimmungen.
        </span>
      </label>
      <div className="grid gap-2 text-sm font-black">
        E-Mail-Adresse
        <div className="flex h-12 items-center gap-3 rounded-md border-2 border-foreground bg-muted px-4 font-semibold text-muted-foreground">
          <Mail className="size-5" /> {email}
        </div>
        <span className="font-semibold text-muted-foreground">
          Die E-Mail stammt aus deinem Login und kann hier nicht geändert
          werden.
        </span>
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 text-sm font-bold text-[#8a1717]"
        >
          {error}
        </p>
      )}
      {saved && (
        <p className="flex items-center gap-2 rounded-xl border-2 border-[#18713b] bg-[#d9f7e4] px-4 py-3 text-sm font-bold text-[#125a2f]">
          <CheckCircle2 className="size-5" /> Dein Profil wurde gespeichert.
        </p>
      )}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm font-semibold text-muted-foreground">
          Aktuell sichtbar als{' '}
          <strong className="text-foreground">{savedName}</strong>
        </p>
        <Button
          type="submit"
          disabled={saving || displayName.trim() === savedName}
          className="h-12 border-2 border-foreground px-6 text-base font-black shadow-[3px_3px_0_var(--ink)]"
        >
          {saving ? 'Wird gespeichert…' : 'Name speichern'} <Save />
        </Button>
      </div>
    </form>
  );
}
