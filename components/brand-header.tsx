import Link from 'next/link';
import { Trophy } from 'lucide-react';

export function BrandHeader({ action }: { action?: React.ReactNode }) {
  return (
    <header className="rankly-header mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-2.5 font-black tracking-[-0.04em]"
        aria-label="Rankly Startseite"
      >
        <span className="grid size-9 rotate-3 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[3px_3px_0_var(--ink)]">
          <Trophy className="size-4.5 -rotate-3" />
        </span>
        <span className="text-lg sm:text-xl">RANKLY</span>
      </Link>
      {action}
    </header>
  );
}
