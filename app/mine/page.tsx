import {
  BarChart3,
  Clock3,
  Globe2,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Pencil,
  Plus,
  UserRound,
  Users,
} from "lucide-react";
import { requireChatGPTUser, chatGPTSignOutPath } from "@/app/chatgpt-auth";
import { BrandHeader } from "@/components/brand-header";
import { CopyLinkButton } from "@/components/copy-link-button";
import { getRankingsForOwner } from "@/db/rankings";
import { getUserProfile } from "@/db/profiles";

export const dynamic = "force-dynamic";

export default async function MyRankingsPage() {
  const user = await requireChatGPTUser("/mine");
  const profile = await getUserProfile(user);
  const rankings = await getRankingsForOwner(user.userId);
  return (
    <main className="rankly-page min-h-screen pb-24">
      <BrandHeader
        action={
          <div className="flex items-center gap-3">
            <a
              href="/profile"
              className="flex items-center gap-2 text-sm font-black"
            >
              <UserRound className="size-4" />
              <span className="hidden sm:inline">{profile.displayName}</span>
            </a>
            <a
              href={chatGPTSignOutPath("/")}
              target="_top"
              className="flex items-center gap-2 text-sm font-black"
            >
              <LogOut className="size-4" /> Abmelden
            </a>
          </div>
        }
      />
      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.15em] text-primary">
              Dein Bereich
            </p>
            <h1 className="mt-2 text-5xl font-black tracking-[-0.055em] sm:text-6xl">
              Meine Rankings
            </h1>
            <p className="mt-3 font-medium text-muted-foreground">
              Ergebnisse öffnen oder den Abstimmungslink erneut teilen.
            </p>
          </div>
          <a
            href="/#erstellen"
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-primary px-5 font-black text-primary-foreground shadow-[3px_3px_0_var(--ink)]"
          >
            <Plus className="size-5" /> Neues Ranking
          </a>
        </div>

        {rankings.length === 0 ? (
          <div className="mt-12 rounded-[1.75rem] border-[3px] border-foreground bg-card p-10 text-center shadow-[7px_7px_0_var(--ink)]">
            <h2 className="text-3xl font-black">Noch nichts gerankt</h2>
            <p className="mt-2 font-medium text-muted-foreground">
              Erstelle dein erstes Ranking und teile es mit deiner Gruppe.
            </p>
          </div>
        ) : (
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            {rankings.map((ranking, index) => {
              const closed =
                ranking.closesAt !== null && Date.now() >= ranking.closesAt;
              const AccessIcon =
                ranking.accessMode === "password"
                  ? KeyRound
                  : ranking.accessMode === "invite"
                    ? Mail
                    : Globe2;
              return (
                <article
                  key={ranking.slug}
                  className="rankly-card overflow-hidden rounded-[1.5rem] border-[3px] border-foreground bg-card shadow-[6px_6px_0_var(--ink)]"
                >
                  <div
                    className="h-3 border-b-2 border-foreground"
                    style={{
                      background: [
                        "var(--tier-s)",
                        "var(--tier-a)",
                        "var(--tier-c)",
                        "#d9cffd",
                      ][index % 4],
                    }}
                  />
                  <div className="p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-black tracking-tight">
                          {ranking.title}
                        </h2>
                        {ranking.description && (
                          <p className="mt-2 line-clamp-2 font-medium text-muted-foreground">
                            {ranking.description}
                          </p>
                        )}
                      </div>
                      <span className="flex shrink-0 items-center gap-1.5 rounded-full border-2 border-foreground bg-[#fff1a8] px-3 py-1 text-sm font-black">
                        <Users className="size-4" /> {ranking.ballotCount}
                      </span>
                    </div>
                    {ranking.closesAt && (
                      <p
                        className={`mt-4 flex items-center gap-2 text-sm font-black ${closed ? "text-[#8a1717]" : "text-muted-foreground"}`}
                      >
                        {closed ? (
                          <LockKeyhole className="size-4" />
                        ) : (
                          <Clock3 className="size-4" />
                        )}
                        {closed
                          ? "Abstimmung geschlossen"
                          : `Offen bis ${new Date(ranking.closesAt).toLocaleString("de-CH", { dateStyle: "medium", timeStyle: "short" })}`}
                      </p>
                    )}
                    <p className="mt-3 flex items-center gap-2 text-sm font-black text-muted-foreground">
                      <AccessIcon className="size-4" />
                      {ranking.accessMode === "password"
                        ? "Mit Passwort geschützt"
                        : ranking.accessMode === "invite"
                          ? "Nur per Einladung"
                          : "Öffentlich per Link"}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-2">
                      <a
                        href={`/r/${ranking.slug}/results`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-black text-primary-foreground"
                      >
                        <BarChart3 className="size-4" /> Auswertung
                      </a>
                      <a
                        href={`/r/${ranking.slug}/edit`}
                        className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-foreground bg-card px-3 text-sm font-black"
                      >
                        <Pencil className="size-4" /> Bearbeiten
                      </a>
                      <CopyLinkButton
                        path={
                          ranking.accessMode === "invite" && ranking.inviteToken
                            ? `/r/${ranking.slug}?invite=${ranking.inviteToken}`
                            : `/r/${ranking.slug}`
                        }
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
