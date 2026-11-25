'use client';

import { useRef } from 'react';
import { useTheme } from 'next-themes';
import { Moon, Sun } from 'lucide-react';
import { useArcade } from './ArcadeProvider';

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const { party } = useArcade();
  const toggles = useRef(0);

  const toggle = () => {
    setTheme(resolvedTheme === 'dark' ? 'light' : 'dark');
    // Easter egg: five toggles.
    toggles.current += 1;
    if (toggles.current >= 5) {
      toggles.current = 0;
      party();
    }
  };

  // Both icons render and CSS picks one, so there is no flash on load.
  return (
    <button type="button" className="icon-button" onClick={toggle} aria-label="Switch between day and night">
      <Sun className="theme-sun size-5" aria-hidden="true" />
      <Moon className="theme-moon size-5" aria-hidden="true" />
    </button>
  );
}
