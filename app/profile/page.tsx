import { BarChart3, LogOut, UserRound } from 'lucide-react';
import { chatGPTSignOutPath, requireChatGPTUser } from '@/app/chatgpt-auth';
import { BrandHeader } from '@/components/brand-header';
import { ProfileForm } from '@/components/profile-form';
import { getUserProfile } from '@/db/profiles';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  const user = await requireChatGPTUser('/profile');
  const profile = await getUserProfile(user);
  return (
    <main className="min-h-screen bg-background pb-24">
      <BrandHeader action={<a href={chatGPTSignOutPath('/')} target="_top" className="flex items-center gap-2 text-sm font-black"><LogOut className="size-4" /> Abmelden</a>} />
      <section className="mx-auto max-w-3xl px-5 pt-10 sm:px-8">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div><p className="text-sm font-black uppercase tracking-[0.15em] text-primary">Dein Konto</p><h1 className="mt-2 text-5xl font-black tracking-[-0.055em] sm:text-6xl">Mein Profil</h1><p className="mt-3 max-w-xl font-medium text-muted-foreground">Bestimme, unter welchem Namen du bei Rankly sichtbar bist.</p></div>
          <a href="/mine" className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border-2 border-foreground bg-card px-5 font-black shadow-[3px_3px_0_var(--ink)]"><BarChart3 className="size-5" /> Meine Rankings</a>
        </div>
        <div className="mt-10 flex items-center gap-4 rounded-[1.5rem] border-2 border-foreground bg-[#d9cffd] p-5"><span className="grid size-14 shrink-0 place-items-center rounded-2xl border-2 border-foreground bg-card"><UserRound className="size-7" /></span><div><p className="text-sm font-black uppercase tracking-wider text-muted-foreground">Angemeldet als</p><p className="text-2xl font-black">{profile.displayName}</p></div></div>
        <ProfileForm initialName={profile.displayName} email={profile.email} />
      </section>
    </main>
  );
}
