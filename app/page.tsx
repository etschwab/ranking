'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  Check,
  Clapperboard,
  Clock3,
  Gamepad2,
  Gift,
  Globe2,
  KeyRound,
  Link2,
  ListChecks,
  LockKeyhole,
  LogIn,
  Mail,
  MapPinned,
  Plus,
  Save,
  Share2,
  Sparkles,
  Trophy,
  Utensils,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const demoTiers = [
  { label: 'S', color: 'var(--tier-s)', items: ['Interstellar', 'Parasite'] },
  { label: 'A', color: 'var(--tier-a)', items: ['Dune: Part Two'] },
  { label: 'B', color: 'var(--tier-b)', items: ['Barbie', 'The Batman'] },
  { label: 'C', color: 'var(--tier-c)', items: ['Tenet'] },
];

const creatorPresets = [
  {
    label: 'Reiseziele',
    icon: MapPinned,
    title: 'Unser nächstes Reiseziel',
    description: 'Wohin soll unser nächster gemeinsamer Trip gehen?',
    options: ['Japan', 'Island', 'Portugal', 'Kanada', 'Griechenland'],
  },
  {
    label: 'Filmabend',
    icon: Clapperboard,
    title: 'Filmabend',
    description: 'Was schauen wir als Nächstes?',
    options: [
      'Dune: Part Two',
      'Parasite',
      'Interstellar',
      'Barbie',
      'The Batman',
    ],
  },
  {
    label: 'Restaurants',
    icon: Utensils,
    title: 'Wo gehen wir essen?',
    description: 'Unser nächstes gemeinsames Dinner.',
    options: [
      'Italienisch',
      'Japanisch',
      'Mexikanisch',
      'Indisch',
      'Libanesisch',
    ],
  },
  {
    label: 'Games',
    icon: Gamepad2,
    title: 'Unsere besten Games',
    description: 'Welche Spiele gehören ganz nach oben?',
    options: [
      'Minecraft',
      'The Legend of Zelda',
      'Baldur’s Gate 3',
      'Mario Kart',
      'Fortnite',
    ],
  },
  {
    label: 'Bewerber',
    icon: BriefcaseBusiness,
    title: 'Bewerber vergleichen',
    description: 'Gemeinsame Einschätzung für die nächste Besetzung.',
    options: ['Bewerber A', 'Bewerber B', 'Bewerber C', 'Bewerber D'],
  },
  {
    label: 'Geschenkideen',
    icon: Gift,
    title: 'Die besten Geschenkideen',
    description: 'Welche Idee macht am meisten Freude?',
    options: [
      'Gemeinsamer Ausflug',
      'Fotobuch',
      'Konzerttickets',
      'Wellness',
      'Lieblingsrestaurant',
    ],
  },
];

export default function Home() {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState(
    'Japan\nIsland\nPortugal\nKanada\nGriechenland',
  );
  const [closesAt, setClosesAt] = useState('');
  const [accessMode, setAccessMode] = useState<
    'public' | 'password' | 'invite'
  >('public');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [account, setAccount] = useState<{
    user: { displayName: string; email: string } | null;
    signInPath: string;
    signOutPath: string;
  } | null>(null);
  const parsedOptions = useMemo(
    () => [
      ...new Set(
        options
          .split('\n')
          .map((option) => option.trim())
          .filter(Boolean),
      ),
    ],
    [options],
  );

  useEffect(() => {
    fetch('/api/me')
      .then(async (response) => {
        const data = (await response.json()) as {
          user: { displayName: string; email: string } | null;
          signInPath: string;
          signOutPath: string;
        };
        setAccount(data);
      })
      .catch(() => setAccount(null));
    try {
      const storedDraft = localStorage.getItem('rankly-creator-draft');
      if (storedDraft) {
        const draft = JSON.parse(storedDraft) as {
          title?: string;
          description?: string;
          options?: string;
          closesAt?: string;
          accessMode?: 'public' | 'password' | 'invite';
        };
        if (
          draft.title ||
          draft.description ||
          draft.options ||
          draft.closesAt
        ) {
          // oxlint-disable-next-line react/react-compiler -- restoring a locally saved draft on mount; localStorage is only available client-side, so this can't run during render
          setTitle(draft.title ?? '');
          setDescription(draft.description ?? '');
          setOptions(draft.options ?? '');
          setClosesAt(draft.closesAt ?? '');
          setAccessMode(draft.accessMode ?? 'public');
        }
      }
    } catch {
      /* Ignore invalid local drafts. */
    }
    setDraftReady(true);
  }, []);

  useEffect(() => {
    if (!draftReady) return;
    localStorage.setItem(
      'rankly-creator-draft',
      JSON.stringify({ title, description, options, closesAt, accessMode }),
    );
  }, [accessMode, closesAt, description, draftReady, options, title]);

  function applyPreset(preset: (typeof creatorPresets)[number]) {
    setTitle(preset.title);
    setDescription(preset.description);
    setOptions(preset.options.join('\n'));
    document
      .querySelector('#ranking-title')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function createRanking(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch('/api/rankings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          closesAt: closesAt ? new Date(closesAt).getTime() : null,
          accessMode,
          password,
          items: options.split('\n'),
        }),
      });
      const data = (await response.json()) as {
        slug?: string;
        error?: string;
        signInPath?: string;
      };
      if (response.status === 401 && data.signInPath) {
        window.location.assign(data.signInPath);
        return;
      }
      if (!response.ok || !data.slug)
        throw new Error(data.error ?? 'Unbekannter Fehler');
      localStorage.removeItem('rankly-creator-draft');
      window.location.assign(`/r/${data.slug}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Das Ranking konnte nicht erstellt werden.',
      );
      setSubmitting(false);
    }
  }

  return (
    <main className="rankly-page min-h-screen overflow-x-clip text-foreground">
      <header className="rankly-header mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2.5 font-black tracking-[-0.04em]"
          aria-label="Rankly Startseite"
        >
          <span className="grid size-9 rotate-3 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[3px_3px_0_var(--ink)]">
            <Trophy className="size-4.5 -rotate-3" />
          </span>
          <span className="text-xl">RANKLY</span>
        </Link>
        <nav className="flex items-center gap-2">
          {account?.user ? (
            <>
              <Link
                href="/mine"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-black transition hover:bg-muted"
              >
                <BarChart3 className="size-4" />{' '}
                <span className="hidden sm:inline">Meine Rankings</span>
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-lg bg-[#d9cffd] px-3 py-2 text-sm font-black transition hover:bg-[#cfc1fb]"
              >
                <UserRound className="size-4" />
                <span className="hidden md:inline">
                  {account.user.displayName}
                </span>
              </Link>
              <a
                href={account.signOutPath}
                target="_top"
                className="hidden text-sm font-bold text-muted-foreground hover:text-foreground lg:block"
              >
                Abmelden
              </a>
            </>
          ) : account ? (
            <a
              href={account.signInPath}
              target="_top"
              className="flex items-center gap-2 rounded-xl border-2 border-foreground bg-card px-3 py-2 text-sm font-black shadow-[2px_2px_0_var(--ink)]"
            >
              <LogIn className="size-4" /> Anmelden
            </a>
          ) : (
            <a
              href="#erstellen"
              className="text-sm font-bold text-muted-foreground"
            >
              Ranking erstellen
            </a>
          )}
        </nav>
      </header>

      <section className="mx-auto grid max-w-7xl gap-14 px-5 pb-16 pt-16 lg:grid-cols-[0.84fr_1.16fr] lg:items-center lg:px-8 lg:pb-24 lg:pt-24">
        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border-2 border-foreground bg-[#fff1a8] px-3 py-1.5 text-xs font-black uppercase tracking-[0.13em] shadow-[2px_2px_0_var(--ink)]">
            <Sparkles className="size-3.5" /> Gemeinsam entscheiden
          </div>
          <h1 className="text-balance text-[clamp(3.35rem,8vw,6.5rem)] font-black leading-[0.86] tracking-[-0.075em]">
            Sortiert eure <span className="text-primary">Favoriten.</span>
          </h1>
          <p className="mt-7 max-w-lg text-lg font-medium leading-relaxed text-muted-foreground sm:text-xl">
            Erstelle ein Tier-Ranking, teile den Link mit deiner Gruppe und sieh
            sofort, was wirklich auf Platz S gehört.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              size="lg"
              className="h-12 rounded-xl border-2 border-foreground px-5 text-base font-black shadow-[4px_4px_0_var(--ink)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_var(--ink)]"
              onClick={() =>
                document
                  .querySelector('#erstellen')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
            >
              <Plus className="size-5" /> Ranking starten
            </Button>
            <div className="flex items-center gap-2 px-2 text-sm font-bold text-muted-foreground">
              <Check className="size-4 text-[#159947]" /> In einer Minute bereit
            </div>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-2xl lg:rotate-1">
          <div className="absolute -inset-5 -z-10 rotate-2 rounded-[2.5rem] border-2 border-foreground bg-[#d9cffd]" />
          <div className="rankly-card rounded-[1.75rem] border-[3px] border-foreground bg-card p-3 shadow-[10px_10px_0_var(--ink)] sm:p-5">
            <div className="mb-4 flex items-center justify-between px-1">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.15em] text-muted-foreground">
                  Live-Vorschau
                </p>
                <h2 className="text-xl font-black tracking-tight">
                  Die besten Filme aller Zeiten
                </h2>
              </div>
              <Share2 className="size-5" />
            </div>
            <div className="space-y-2">
              {demoTiers.map((tier) => (
                <div
                  key={tier.label}
                  className="grid min-h-16 grid-cols-[64px_1fr] overflow-hidden rounded-xl border-2 border-foreground bg-background"
                >
                  <div
                    className="grid place-items-center border-r-2 border-foreground text-2xl font-black"
                    style={{ background: tier.color }}
                  >
                    {tier.label}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 p-2">
                    {tier.items.map((item) => (
                      <span
                        key={item}
                        className="rounded-lg border-2 border-foreground bg-card px-3 py-2 text-sm font-extrabold shadow-[2px_2px_0_var(--ink)]"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-5 pb-20 sm:grid-cols-3 sm:px-8">
        {[
          {
            icon: ListChecks,
            step: '01',
            title: 'Optionen sammeln',
            text: 'Thema eintragen und alles hinzufügen, was zur Wahl steht.',
            color: '#fff1a8',
          },
          {
            icon: Link2,
            step: '02',
            title: 'Link verschicken',
            text: 'Alle stimmen mit ihrem eigenen Namen und Profil ab.',
            color: '#d9cffd',
          },
          {
            icon: BarChart3,
            step: '03',
            title: 'Favoriten sehen',
            text: 'Die gemeinsame Rangliste entsteht direkt aus allen Stimmen.',
            color: '#bcefd2',
          },
        ].map((item) => (
          <article
            key={item.step}
            className="rankly-card rounded-[1.35rem] border-2 border-foreground bg-card p-5 shadow-[4px_4px_0_var(--ink)]"
          >
            <div className="flex items-center justify-between">
              <span
                className="grid size-11 place-items-center rounded-xl border-2 border-foreground"
                style={{ background: item.color }}
              >
                <item.icon className="size-5" />
              </span>
              <span className="text-sm font-black text-muted-foreground">
                {item.step}
              </span>
            </div>
            <h2 className="mt-5 text-xl font-black">{item.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-muted-foreground">
              {item.text}
            </p>
          </article>
        ))}
      </section>

      <section
        id="erstellen"
        className="border-y-[3px] border-foreground bg-[#fff5e7]/95 px-5 py-20 sm:px-8 lg:py-24"
      >
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
          <div>
            <span className="mb-4 grid size-12 place-items-center rounded-2xl border-2 border-foreground bg-[#ff8b72] shadow-[3px_3px_0_var(--ink)]">
              <BarChart3 className="size-6" />
            </span>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-primary">
              In einer Minute bereit
            </p>
            <h2 className="mt-2 text-4xl font-black tracking-[-0.045em] sm:text-5xl">
              Was wollt ihr ranken?
            </h2>
            <p className="mt-4 max-w-md font-medium leading-relaxed text-muted-foreground">
              Thema und Auswahl eintragen. Danach erhältst du direkt den Link
              zum Teilen.
            </p>
          </div>
          <form
            className="grid gap-5 rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[8px_8px_0_var(--ink)] sm:p-7"
            onSubmit={createRanking}
          >
            <div className="rounded-xl border-2 border-foreground bg-[#f7f3eb] p-4">
              <div className="flex items-center gap-2">
                <WandSparkles className="size-5 text-primary" />
                <p className="text-sm font-black">
                  Schnell starten mit einer Vorlage
                </p>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {creatorPresets.map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-foreground bg-card px-3 text-sm font-black shadow-[2px_2px_0_var(--ink)] transition hover:-translate-y-0.5"
                  >
                    <preset.icon className="size-4" /> {preset.label}
                  </button>
                ))}
              </div>
            </div>
            <label
              className="grid gap-2 text-sm font-black"
              htmlFor="ranking-title"
            >
              <span className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-background">
                  1
                </span>
                Titel
              </span>
              <Input
                id="ranking-title"
                required
                maxLength={100}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                className="h-12 rounded-xl border-2 border-foreground px-4 text-base font-bold"
                placeholder="z. B. Unser nächstes Reiseziel"
              />
            </label>
            <label
              className="grid gap-2 text-sm font-black"
              htmlFor="ranking-description"
            >
              <span className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-background">
                  2
                </span>
                Beschreibung{' '}
                <span className="font-semibold text-muted-foreground">
                  (optional)
                </span>
              </span>
              <Input
                id="ranking-description"
                maxLength={280}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="h-12 rounded-xl border-2 border-foreground px-4 text-base"
                placeholder="Worum geht es?"
              />
            </label>
            <label
              className="grid gap-2 text-sm font-black"
              htmlFor="ranking-deadline"
            >
              <span className="flex items-center gap-2">
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-background">
                  3
                </span>
                Abstimmungsfrist{' '}
                <span className="font-semibold text-muted-foreground">
                  (optional)
                </span>
              </span>
              <span className="relative">
                <Clock3 className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="ranking-deadline"
                  type="datetime-local"
                  value={closesAt}
                  onChange={(event) => setClosesAt(event.target.value)}
                  className="h-12 rounded-xl border-2 border-foreground pl-12 text-base font-bold"
                />
              </span>
              <span className="font-semibold text-muted-foreground">
                Ohne Frist bleibt die Abstimmung dauerhaft offen.
              </span>
            </label>
            <fieldset className="grid gap-3">
              <legend className="flex items-center gap-2 text-sm font-black">
                <span className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-background">
                  4
                </span>
                Zugriff
              </legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {(
                  [
                    {
                      mode: 'public',
                      icon: Globe2,
                      title: 'Öffentlich',
                      text: 'Jeder mit Link',
                    },
                    {
                      mode: 'password',
                      icon: KeyRound,
                      title: 'Passwort',
                      text: 'Passwort nötig',
                    },
                    {
                      mode: 'invite',
                      icon: Mail,
                      title: 'Einladung',
                      text: 'Geheimer Link',
                    },
                  ] as const
                ).map((choice) => (
                  <button
                    key={choice.mode}
                    type="button"
                    onClick={() => setAccessMode(choice.mode)}
                    aria-pressed={accessMode === choice.mode}
                    className={`rounded-xl border-2 p-3 text-left transition ${accessMode === choice.mode ? 'border-foreground bg-[#d9cffd] shadow-[3px_3px_0_var(--ink)]' : 'border-foreground/25 bg-background hover:border-foreground'}`}
                  >
                    <choice.icon className="size-5" />
                    <span className="mt-2 block font-black">
                      {choice.title}
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">
                      {choice.text}
                    </span>
                  </button>
                ))}
              </div>
              {accessMode === 'password' && (
                <label
                  className="grid gap-2 text-sm font-black"
                  htmlFor="ranking-password"
                >
                  <span className="flex items-center gap-2">
                    <LockKeyhole className="size-4" />
                    Passwort
                  </span>
                  <Input
                    id="ranking-password"
                    type="password"
                    required
                    minLength={6}
                    maxLength={100}
                    autoComplete="new-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="h-12 border-2 border-foreground px-4 font-bold"
                    placeholder="Mindestens 6 Zeichen"
                  />
                  <span className="font-semibold text-muted-foreground">
                    Das Passwort wird nie im Entwurf gespeichert.
                  </span>
                </label>
              )}
            </fieldset>
            <label
              className="grid gap-2 text-sm font-black"
              htmlFor="ranking-options"
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-full bg-foreground text-xs text-background">
                    5
                  </span>
                  Optionen
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs ${parsedOptions.length >= 2 ? 'bg-[#d9f7e4] text-[#125a2f]' : 'bg-muted text-muted-foreground'}`}
                >
                  {parsedOptions.length}/30
                </span>
              </span>
              <Textarea
                id="ranking-options"
                required
                className="min-h-40 rounded-xl border-2 border-foreground px-4 py-3 text-base leading-relaxed"
                value={options}
                onChange={(event) => setOptions(event.target.value)}
              />
            </label>
            {parsedOptions.length > 0 && (
              <div
                className="flex max-h-24 flex-wrap gap-2 overflow-y-auto rounded-xl bg-muted/60 p-3"
                aria-label="Erkannte Optionen"
              >
                {parsedOptions.slice(0, 30).map((option) => (
                  <span
                    key={option}
                    className="rounded-lg border border-foreground/20 bg-card px-2.5 py-1 text-xs font-bold"
                  >
                    {option}
                  </span>
                ))}
              </div>
            )}
            {error && (
              <p
                role="alert"
                className="rounded-xl border-2 border-[#a31d1d] bg-[#ffe2df] px-4 py-3 text-sm font-bold text-[#8a1717]"
              >
                {error}
              </p>
            )}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                <Save className="size-4" /> Entwurf wird automatisch gespeichert
              </p>
              <Button
                type="submit"
                disabled={submitting}
                className="h-12 rounded-xl border-2 border-foreground px-5 text-base font-black shadow-[3px_3px_0_var(--ink)]"
              >
                {submitting
                  ? 'Wird erstellt…'
                  : account && !account.user
                    ? 'Anmelden & erstellen'
                    : 'Erstellen'}{' '}
                <ArrowRight className="size-5" />
              </Button>
            </div>
          </form>
        </div>
      </section>
    </main>
  );
}
