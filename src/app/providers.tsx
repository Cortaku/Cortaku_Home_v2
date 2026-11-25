'use client';

import { ThemeProvider } from 'next-themes';
import ArcadeProvider from '@/components/ArcadeProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <ArcadeProvider>{children}</ArcadeProvider>
    </ThemeProvider>
  );
}
