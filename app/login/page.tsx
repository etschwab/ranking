import { LogIn, Mail, RotateCcw, ShieldCheck, UserPlus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getCurrentUser, safeReturnPath } from '@/app/auth';
import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSsoConfig } from '@/lib/sso';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string; mode?: string; error?: string }>;
}) {
  const { returnTo = '/', mode = 'login', error } = await searchParams;
  const safeReturnTo = safeReturnPath(returnTo);
  if (await getCurrentUser()) redirect(safeReturnTo);

  const ssoConfigured = Boolean(getSsoConfig());

  if (ssoConfigured && !error) {
    redirect(`/auth/sso/start?next=${encodeURIComponent(safeReturnTo)}`);
  }

  const registering = mode === 'register';

  return (
    <main className="rankly-page min-h-screen pb-20">
      <BrandHeader />
      <section className="mx-auto max-w-xl px-5 py-14 text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#d9cffd] shadow-[6px_6px_0_var(--ink)]">
          {registering ? (
            <UserPlus className="size-10" />
          ) : (
            <LogIn className="size-10" />
          )}
        </span>
        <p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">
          Willkommen bei Rankly
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">
          {ssoConfigured
            ? 'Anmeldung nicht abgeschlossen'
            : registering
              ? 'Konto erstellen'
              : 'Einloggen'}
        </h1>
        {!ssoConfigured && (
          <p className="mt-4 font-medium text-muted-foreground">
            Speichere deine Rankings, Abstimmungen und Vorlagen sicher in deinem
            persönlichen Konto.
          </p>
        )}
        {error && (
          <p
            role="alert"
            className="mt-6 rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 text-left text-sm font-bold text-[#8a1717]"
          >
            {error}
          </p>
        )}

        {ssoConfigured ? (
          <div className="mt-7 grid gap-3">
            <a
              href={`/auth/sso/start?next=${encodeURIComponent(safeReturnTo)}`}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border-2 border-foreground bg-background text-base font-black shadow-[3px_3px_0_var(--ink)]"
            >
              <RotateCcw className="size-4" /> Erneut versuchen
            </a>
          </div>
        ) : (
          <>
            <form
              action="/api/session"
              method="post"
              className="mt-7 grid gap-4 rounded-[1.5rem] border-[3px] border-foreground bg-card p-6 text-left shadow-[7px_7px_0_var(--ink)]"
            >
              <input type="hidden" name="returnTo" value={safeReturnTo} />
              <input
                type="hidden"
                name="mode"
                value={registering ? 'register' : 'login'}
              />
              {registering && (
                <label
                  htmlFor="display-name"
                  className="grid gap-2 text-sm font-black"
                >
                  Dein Name
                  <Input
                    id="display-name"
                    name="displayName"
                    required
                    minLength={2}
                    maxLength={50}
                    autoComplete="name"
                    className="h-12 border-2 border-foreground px-4 text-base font-bold"
                    placeholder="z. B. Etienne"
                  />
                </label>
              )}
              <label htmlFor="email" className="grid gap-2 text-sm font-black">
                E-Mail-Adresse
                <Input
                  id="email"
                  name="email"
                  required
                  type="email"
                  autoComplete="email"
                  className="h-12 border-2 border-foreground px-4 text-base font-bold"
                  placeholder="du@beispiel.ch"
                />
              </label>
              <label
                htmlFor="password"
                className="grid gap-2 text-sm font-black"
              >
                Passwort
                <Input
                  id="password"
                  name="password"
                  required
                  type="password"
                  minLength={8}
                  maxLength={100}
                  autoComplete={
                    registering ? 'new-password' : 'current-password'
                  }
                  className="h-12 border-2 border-foreground px-4 text-base font-bold"
                  placeholder="Mindestens 8 Zeichen"
                />
              </label>
              <Button
                type="submit"
                className="mt-1 h-12 border-2 border-foreground text-base font-black shadow-[3px_3px_0_var(--ink)]"
              >
                {registering ? <UserPlus /> : <LogIn />}{' '}
                {registering ? 'Konto erstellen' : 'Einloggen'}
              </Button>
            </form>
            <p className="mt-7 font-semibold text-muted-foreground">
              {registering ? 'Du hast bereits ein Konto?' : 'Noch kein Konto?'}{' '}
              <a
                className="font-black text-foreground underline underline-offset-4"
                href={`/login?returnTo=${encodeURIComponent(safeReturnTo)}&mode=${registering ? 'login' : 'register'}`}
              >
                {registering ? 'Einloggen' : 'Jetzt registrieren'}
              </a>
            </p>
          </>
        )}

        <p className="mt-4 flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground">
          <ShieldCheck className="size-4" /> Deine Zugangsdaten bleiben
          geschützt. <Mail className="size-4" />
        </p>
      </section>
    </main>
  );
}
