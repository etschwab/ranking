import { BarChart3, CheckCircle2, LogOut, Plus, UserRound } from 'lucide-react';
import { requireUser, signOutPath } from '@/app/auth';
import { BrandHeader } from '@/components/brand-header';
import { ProfileForm } from '@/components/profile-form';
import { getUserProfile } from '@/db/profiles';
import { getRankingsForOwner, getRankingsForParticipant } from '@/db/rankings';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireUser('/profile');
  const profile = await getUserProfile(user);
  const [createdRankings, answeredRankings] = await Promise.all([
    getRankingsForOwner(user.userId),
    getRankingsForParticipant(user.userId),
  ]);
  return (
    <main className="rankly-page min-h-screen pb-24">
      <BrandHeader
        action={
          <a
            href={signOutPath('/')}
            target="_top"
            className="flex items-center gap-2 text-sm font-black"
          >
            <LogOut className="size-4" /> Abmelden
          </a>
        }
      />
      <section className="mx-auto max-w-5xl px-5 pt-10 sm:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-primary">
              Dein Konto
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-[-0.055em] sm:text-6xl">
              Mein Profil
            </h1>
            <p className="mt-3 max-w-xl font-medium text-muted-foreground">
              Bestimme, unter welchem Namen du bei Rankly sichtbar bist.
            </p>
          </div>
          <a
            href="/mine"
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-card px-5 font-black shadow-[3px_3px_0_var(--ink)]"
          >
            <BarChart3 className="size-5" /> Meine Rankings
          </a>
        </div>
        <div className="rankly-card mt-10 flex items-center gap-4 rounded-[1.5rem] border-[3px] border-foreground bg-[#d9cffd] p-5 shadow-[5px_5px_0_var(--ink)]">
          <span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-foreground bg-card">
            <UserRound className="size-7" />
          </span>
          <div>
            <p className="text-sm font-black uppercase tracking-wider text-muted-foreground">
              Angemeldet als
            </p>
            <p className="text-2xl font-black">{profile.displayName}</p>
          </div>
        </div>
        <ProfileForm initialName={profile.displayName} email={profile.email} />
        <div className="mt-14 grid gap-10 lg:grid-cols-2">
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-primary">
                  Von dir erstellt
                </p>
                <h2 className="mt-1 text-3xl font-black">Eigene Rankings</h2>
              </div>
              <span className="rounded-full border-2 border-foreground bg-[#fff1a8] px-3 py-1 text-sm font-black">
                {createdRankings.length}
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {createdRankings.length === 0 ? (
                <EmptyCard
                  text="Du hast noch kein Ranking erstellt."
                  href="/#erstellen"
                  label="Ranking erstellen"
                />
              ) : (
                createdRankings.map((ranking) => (
                  <RankingCard
                    key={ranking.slug}
                    title={ranking.title}
                    description={ranking.description}
                    meta={`${ranking.ballotCount} Abstimmung${ranking.ballotCount === 1 ? '' : 'en'}`}
                    href={`/r/${ranking.slug}/results`}
                    action="Auswertung öffnen"
                  />
                ))
              )}
            </div>
          </section>
          <section>
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black uppercase tracking-wider text-primary">
                  Von dir beantwortet
                </p>
                <h2 className="mt-1 text-3xl font-black">Meine Abstimmungen</h2>
              </div>
              <span className="rounded-full border-2 border-foreground bg-[#d9f7e4] px-3 py-1 text-sm font-black">
                {answeredRankings.length}
              </span>
            </div>
            <div className="mt-5 grid gap-3">
              {answeredRankings.length === 0 ? (
                <EmptyCard
                  text="Du hast noch an keinem Ranking teilgenommen."
                  href="/"
                  label="Rankly entdecken"
                />
              ) : (
                answeredRankings.map((ranking) => (
                  <RankingCard
                    key={ranking.slug}
                    title={ranking.title}
                    description={ranking.description}
                    meta={`Abgestimmt am ${new Date(ranking.votedAt).toLocaleDateString('de-CH')}`}
                    href={`/r/${ranking.slug}/results`}
                    action="Ergebnis ansehen"
                  />
                ))
              )}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}

function RankingCard({
  title,
  description,
  meta,
  href,
  action,
}: {
  title: string;
  description: string;
  meta: string;
  href: string;
  action: string;
}) {
  return (
    <article className="rounded-2xl border-[3px] border-foreground bg-card p-5 shadow-[4px_4px_0_var(--ink)]">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-1 size-5 shrink-0 text-primary" />
        <div className="min-w-0">
          <h3 className="text-xl font-black">{title}</h3>
          {description && (
            <p className="mt-1 line-clamp-2 text-sm font-medium text-muted-foreground">
              {description}
            </p>
          )}
          <p className="mt-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
            {meta}
          </p>
          <a
            href={href}
            className="mt-4 inline-flex items-center gap-2 font-black text-primary underline underline-offset-4"
          >
            <BarChart3 className="size-4" /> {action}
          </a>
        </div>
      </div>
    </article>
  );
}

function EmptyCard({
  text,
  href,
  label,
}: {
  text: string;
  href: string;
  label: string;
}) {
  return (
    <div className="rounded-2xl border-[3px] border-dashed border-foreground bg-card p-6 text-center">
      <p className="font-semibold text-muted-foreground">{text}</p>
      <a
        href={href}
        className="mt-4 inline-flex items-center gap-2 font-black text-primary underline underline-offset-4"
      >
        <Plus className="size-4" /> {label}
      </a>
    </div>
  );
}
