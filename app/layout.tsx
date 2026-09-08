import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { PwaRegister } from '@/app/pwa-register';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const viewport: Viewport = { themeColor: '#287b6f' };

export const metadata: Metadata = {
  metadataBase: new URL('https://care.danspelt.com'),
  title: 'CareBoard — Household care, clearly coordinated',
  description:
    'A simple private chore board for coordinating household care workers, assignments, and completed work.',
  manifest: '/manifest.webmanifest',
  icons: {
    icon: { url: '/favicon.svg', type: 'image/svg+xml', sizes: 'any' },
  },
  appleWebApp: { capable: true, title: 'CareBoard', statusBarStyle: 'default' },
  openGraph: {
    title: 'CareBoard — Household care, clearly coordinated',
    description: 'Assign each household chore once and see exactly what is claimed and complete.',
    type: 'website',
    images: [
      {
        url: '/og.png',
        width: 1680,
        height: 945,
        alt: 'CareBoard — Household care, clearly coordinated',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'CareBoard — Household care, clearly coordinated',
    description: 'Assign each household chore once and see exactly what is claimed and complete.',
    images: ['/og.png'],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
