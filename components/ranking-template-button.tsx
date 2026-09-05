'use client';

import { useState } from 'react';
import { WandSparkles } from 'lucide-react';

export function RankingTemplateButton({ slug }: { slug: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function createTemplate() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`/api/rankings/${slug}`, { method: 'POST' });
      const data = (await response.json()) as { slug?: string; error?: string };
      if (!response.ok || !data.slug)
        throw new Error(data.error ?? 'Vorlage konnte nicht erstellt werden.');
      window.location.href = `/r/${data.slug}/edit`;
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Vorlage konnte nicht erstellt werden.',
      );
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={createTemplate}
        disabled={loading}
        className="inline-flex h-9 items-center gap-2 rounded-lg border-2 border-foreground bg-[#fff1a8] px-3 text-sm font-black disabled:opacity-60"
      >
        <WandSparkles className="size-4" />{' '}
        {loading ? 'Wird erstellt…' : 'Als Vorlage'}
      </button>
      {error && (
        <span className="mt-1 text-xs font-bold text-[#8a1717]">{error}</span>
      )}
    </span>
  );
}
