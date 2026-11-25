import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Pixelify_Sans } from 'next/font/google';
import { Providers } from './providers';
import { SITE_URL, TAGLINE } from '@/lib/site';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const pixel = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixel', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Cortaku',
  description: `${TAGLINE} A personal corner of the internet with a jump game and a global leaderboard.`,
  openGraph: {
    title: 'Cortaku',
    description: TAGLINE,
    url: SITE_URL,
    siteName: 'Cortaku',
    type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'Cortaku', description: TAGLINE },
};

export const viewport: Viewport = {
  // The game pads itself with safe-area insets.
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fff7f5' },
    { media: '(prefers-color-scheme: dark)', color: '#110e22' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${pixel.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
