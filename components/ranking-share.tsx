'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { CheckCircle2, Copy, MessageCircle, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function RankingShare({ slug, title }: { slug: string; title: string }) {
  const [url, setUrl] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const shareUrl = `${window.location.origin}/r/${slug}`;
    setUrl(shareUrl);
    void QRCode.toDataURL(shareUrl, { width: 360, margin: 2, color: { dark: '#241d1a', light: '#ffffff' }, errorCorrectionLevel: 'M' }).then(setQrCode);
  }, [slug]);

  async function copy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const whatsAppUrl = `https://wa.me/?text=${encodeURIComponent(`Stimme bei „${title}“ auf Rankly ab: ${url}`)}`;

  return (
    <section className="mt-10 rounded-[1.5rem] border-[3px] border-foreground bg-[#d9cffd] p-5 shadow-[6px_6px_0_var(--ink)] sm:p-6">
      <div className="grid gap-5 sm:grid-cols-[132px_1fr] sm:items-center">
        <div className="grid aspect-square w-32 place-items-center overflow-hidden rounded-xl border-2 border-foreground bg-white p-2">{qrCode ? <img src={qrCode} alt={`QR-Code für ${title}`} className="size-full" /> : <QrCode className="size-12 animate-pulse" />}</div>
        <div><p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">Einfach teilen</p><h2 className="mt-1 text-2xl font-black">QR-Code oder WhatsApp</h2><p className="mt-1 break-all text-sm font-semibold text-muted-foreground">{url || `rankly.etienneschwab.ch/r/${slug}`}</p><div className="mt-4 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={copy} className="h-11 border-2 border-foreground bg-card font-black">{copied ? <CheckCircle2 /> : <Copy />} {copied ? 'Kopiert' : 'Link kopieren'}</Button><a href={whatsAppUrl} target="_blank" rel="noreferrer" className="inline-flex h-11 items-center gap-2 rounded-lg border-2 border-[#145f32] bg-[#25d366] px-4 font-black text-[#103e23] shadow-[2px_2px_0_#145f32]"><MessageCircle className="size-5" /> WhatsApp</a></div></div>
      </div>
    </section>
  );
}
