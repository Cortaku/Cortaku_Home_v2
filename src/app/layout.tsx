import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Pixelify_Sans } from 'next/font/google';
import { Providers } from './providers';
import { ANALYTICS_TOKEN, SITE_URL, TAGLINE } from '@/lib/site';
import { THEME_BY_CLOCK_SCRIPT } from '@/lib/theme';
import './globals.css';

const display = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-display', display: 'swap' });
const pixel = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixel', display: 'swap' });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: 'Cortaku',
  description: `${TAGLINE}. A personal corner of the internet with a jump game and a global leaderboard.`,
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

// Cloudflare Web Analytics, only on the real site so local and preview visits don't count.
const ANALYTICS_SCRIPT = `if(/(^|\\.)cortaku\\.com$/.test(location.hostname)){var s=document.createElement('script');s.defer=true;s.src='https://static.cloudflareinsights.com/beacon.min.js';s.setAttribute('data-cf-beacon','{"token":"${ANALYTICS_TOKEN}"}');document.head.appendChild(s)}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${display.variable} ${pixel.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BY_CLOCK_SCRIPT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
        <script dangerouslySetInnerHTML={{ __html: ANALYTICS_SCRIPT }} />
      </body>
    </html>
  );
}
