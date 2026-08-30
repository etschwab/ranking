import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  metadataBase: new URL('https://ranking.etienneschwab.ch'),
  title: 'Rankly – Gemeinsam besser ranken',
  description: 'Erstelle Tier-Rankings, sammle Abstimmungen und finde euren gemeinsamen Favoriten.',
  openGraph: {
    title: 'Rankly – Gemeinsam besser ranken',
    description: 'Erstelle Tier-Rankings, sammle Abstimmungen und finde euren gemeinsamen Favoriten.',
    type: 'website',
    images: [{ url: '/og.png', width: 1200, height: 630, alt: 'Rankly – Gemeinsam besser ranken' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Rankly – Gemeinsam besser ranken',
    description: 'Erstelle Tier-Rankings, sammle Abstimmungen und finde euren gemeinsamen Favoriten.',
    images: ['/og.png'],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="de"><body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body></html>;
}
