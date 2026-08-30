'use client';

import { useState } from 'react';
import { CheckCircle2, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function CopyLinkButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(`${window.location.origin}${path}`);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }
  return <Button variant="outline" onClick={copy} className="border-2 border-foreground font-black">{copied ? <CheckCircle2 /> : <Copy />} {copied ? 'Kopiert' : 'Link kopieren'}</Button>;
}
