import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  metadataBase: new URL('https://care.danspelt.com'),
  title: 'CareBoard — Household care, clearly coordinated',
  description:
    'A simple private chore board for coordinating household care workers, assignments, and completed work.',
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
      </body>
    </html>
  );
}
