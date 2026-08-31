import { LogIn, Trophy, UserRound } from 'lucide-react';
import { redirect } from 'next/navigation';
import { getChatGPTUser, safeReturnPath } from '@/app/chatgpt-auth';
import { BrandHeader } from '@/components/brand-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ returnTo?: string }> }) {
  const { returnTo = '/' } = await searchParams;
  const safeReturnTo = safeReturnPath(returnTo);
  if (await getChatGPTUser()) redirect(safeReturnTo);
  return <main className="rankly-page min-h-screen"><BrandHeader /><section className="mx-auto flex max-w-xl flex-col items-center px-5 py-20 text-center"><span className="grid size-20 place-items-center rounded-[1.7rem] border-[3px] border-foreground bg-[#d9cffd] shadow-[6px_6px_0_var(--ink)]"><UserRound className="size-10" /></span><p className="mt-8 text-sm font-black uppercase tracking-[0.15em] text-primary">Willkommen bei Rankly</p><h1 className="mt-2 text-5xl font-black tracking-[-0.055em]">Wie heisst du?</h1><p className="mt-4 max-w-md text-lg font-medium text-muted-foreground">Dein Name erscheint bei deinen Abstimmungen und kann später im Profil geändert werden.</p><form action="/api/session" method="post" className="mt-8 grid w-full gap-4 rounded-[1.5rem] border-[3px] border-foreground bg-card p-6 text-left shadow-[7px_7px_0_var(--ink)]"><input type="hidden" name="returnTo" value={safeReturnTo} /><label htmlFor="display-name" className="text-sm font-black">Dein Name</label><Input id="display-name" name="displayName" required minLength={2} maxLength={50} autoComplete="name" className="h-12 border-2 border-foreground px-4 text-base font-bold" placeholder="z. B. Etienne" /><Button className="h-12 border-2 border-foreground text-base font-black shadow-[3px_3px_0_var(--ink)]"><LogIn /> Einloggen</Button><p className="flex items-center justify-center gap-2 text-xs font-semibold text-muted-foreground"><Trophy className="size-4" /> Kein Passwort und kein Konto nötig.</p></form></section></main>;
}
