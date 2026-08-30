import { Trophy } from 'lucide-react';

export function BrandHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
      <a href="/" className="flex items-center gap-2.5 font-black tracking-[-0.04em]" aria-label="Rankly Startseite">
        <span className="grid size-9 rotate-3 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[3px_3px_0_var(--ink)]"><Trophy className="size-4.5 -rotate-3" /></span>
        <span className="text-xl">RANKLY</span>
      </a>
      {action}
    </header>
  );
}
