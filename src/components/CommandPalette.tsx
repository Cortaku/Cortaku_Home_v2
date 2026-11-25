'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Search } from 'lucide-react';
import { useArcade } from './ArcadeProvider';
import { APPS, EMAIL, EMAIL_LINK, SOCIALS } from '@/lib/site';

type Command = { id: string; label: string; hint: string; run: () => void };

/** Ctrl/Cmd+K quick search. */
export default function CommandPalette() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const { openGame, nextScene } = useArcade();
  const { resolvedTheme, setTheme } = useTheme();

  const commands = useMemo<Command[]>(() => {
    const visit = (url: string) => () => window.open(url, '_blank', 'noopener,noreferrer');
    return [
      { id: 'play', label: 'Play the jump game', hint: 'Arcade', run: openGame },
      { id: 'scores', label: 'See the high scores', hint: 'Arcade', run: () => document.getElementById('scores')?.scrollIntoView() },
      ...APPS.map((app) => ({ id: app.id, label: app.title, hint: app.blurb, run: visit(app.url) })),
      ...SOCIALS.filter((s) => s.id !== 'email').map((s) => ({ id: s.id, label: s.title, hint: s.handle, run: visit(s.url) })),
      {
        id: 'email',
        label: 'Email me',
        hint: 'Copies the address and opens your mail app',
        run: () => {
          navigator.clipboard?.writeText(EMAIL).catch(() => {});
          window.location.href = EMAIL_LINK;
        },
      },
      { id: 'theme', label: 'Switch between day and night', hint: 'Look', run: () => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark') },
      { id: 'scene', label: 'Change the background scene', hint: 'Look', run: nextScene },
    ];
  }, [openGame, nextScene, resolvedTheme, setTheme]);

  const q = query.trim().toLowerCase();
  const results = q ? commands.filter((c) => `${c.label} ${c.hint}`.toLowerCase().includes(q)) : commands;
  const current = Math.min(active, Math.max(0, results.length - 1));

  const open = () => {
    setQuery('');
    setActive(0);
    dialogRef.current?.showModal();
  };

  const choose = (command: Command | undefined) => {
    if (!command) return;
    dialogRef.current?.close();
    command.run();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (dialogRef.current?.open) dialogRef.current.close();
        else open();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <button type="button" className="palette-trigger" onClick={open} aria-label="Open quick search">
        <Search className="size-4" aria-hidden="true" />
        <span className="palette-trigger-text">Jump to…</span>
        <kbd>Ctrl K</kbd>
      </button>

      <dialog
        ref={dialogRef}
        className="palette"
        aria-label="Quick search"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
      >
        <div className="palette-box">
          <input
            autoFocus
            type="text"
            value={query}
            placeholder="Play, Plex, YouTube…"
            aria-label="Search the site"
            onChange={(e) => { setQuery(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setActive((current + 1) % Math.max(1, results.length)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((current - 1 + results.length) % Math.max(1, results.length)); }
              else if (e.key === 'Enter') { e.preventDefault(); choose(results[current]); }
            }}
          />
          <ul role="listbox" aria-label="Results">
            {results.map((command, i) => (
              <li key={command.id} role="option" aria-selected={i === current}>
                <button type="button" tabIndex={-1} onClick={() => choose(command)} onPointerMove={() => setActive(i)}>
                  <span>{command.label}</span>
                  <span className="palette-hint">{command.hint}</span>
                </button>
              </li>
            ))}
            {results.length === 0 && <li className="palette-empty">Nothing matches “{query}”.</li>}
          </ul>
        </div>
      </dialog>
    </>
  );
}
