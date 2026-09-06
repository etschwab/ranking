import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { BrandHeader } from '@/components/brand-header';
import { rankingTemplates } from '@/lib/templates';

export default function TemplatesPage() {
  const categories = [
    ...new Set(rankingTemplates.map((template) => template.category)),
  ];

  return (
    <main className="rankly-page min-h-screen pb-24">
      <BrandHeader
        action={
          <Link
            href="/"
            className="flex items-center gap-2 text-sm font-black text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" /> Zurück
          </Link>
        }
      />
      <section className="mx-auto max-w-6xl px-5 pt-10 sm:px-8">
        <p className="text-sm font-black uppercase tracking-[0.15em] text-primary">
          Vorlagen
        </p>
        <h1 className="mt-2 text-5xl font-black tracking-[-0.055em] sm:text-6xl">
          Ranking-Vorlagen
        </h1>
        <p className="mt-3 max-w-2xl font-medium text-muted-foreground">
          Starte in wenigen Sekunden mit einer fertigen Vorlage - Titel und
          Optionen sind schon ausgefüllt, du musst nur noch anpassen und teilen.
        </p>

        {categories.map((category) => (
          <div key={category} className="mt-10">
            <h2 className="text-2xl font-black">{category}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rankingTemplates
                .filter((template) => template.category === category)
                .map((template) => (
                  <Link
                    key={template.slug}
                    href={`/?template=${template.slug}#ranking-title`}
                    className="group rounded-[1.5rem] border-[3px] border-foreground bg-card p-5 shadow-[6px_6px_0_var(--ink)] transition hover:-translate-y-1"
                  >
                    <span className="grid size-11 place-items-center rounded-xl border-2 border-foreground bg-[#d9cffd]">
                      <template.icon className="size-5" />
                    </span>
                    <h3 className="mt-4 text-xl font-black tracking-tight">
                      {template.title}
                    </h3>
                    <p className="mt-1.5 font-medium text-muted-foreground">
                      {template.description}
                    </p>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {template.options.slice(0, 4).map((option) => (
                        <li
                          key={option}
                          className="rounded-full border-2 border-foreground/25 bg-background px-2.5 py-1 text-xs font-black"
                        >
                          {option}
                        </li>
                      ))}
                      {template.options.length > 4 && (
                        <li className="rounded-full border-2 border-foreground/25 bg-background px-2.5 py-1 text-xs font-black">
                          +{template.options.length - 4}
                        </li>
                      )}
                    </ul>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-primary underline-offset-4 group-hover:underline">
                      Vorlage verwenden
                    </span>
                  </Link>
                ))}
            </div>
          </div>
        ))}
      </section>
    </main>
  );
}
