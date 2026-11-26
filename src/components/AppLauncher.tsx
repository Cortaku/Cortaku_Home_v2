'use client';

import { useEffect, useState } from 'react';
import { ArrowUpRight, BookOpen, Camera, Dumbbell, Music, Tv, Utensils, type LucideIcon } from 'lucide-react';
import { APPS } from '@/lib/site';

const ICONS: Record<string, LucideIcon> = {
  fitness: Dumbbell,
  mealie: Utensils,
  plex: Tv,
  audiobooks: BookOpen,
  photos: Camera,
  music: Music,
};

export default function AppLauncher() {
  const [status, setStatus] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => { if (!cancelled) setStatus(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const allAsleep = status !== null && APPS.every((app) => status[app.id] === false);

  return (
    <>
      {allAsleep && (
        <p className="launcher-note" role="status">
          <span className="launcher-zzz" aria-hidden="true">z<span>z</span><span>z</span></span>
          The homelab is napping right now. These apps will be back when it wakes up.
        </p>
      )}
      <ul className="launcher">
        {APPS.map((app) => {
          const Icon = ICONS[app.id];
          const up = status?.[app.id];
          const state = up === undefined ? 'checking' : up ? 'up' : 'asleep';
          const label = state === 'checking' ? 'Checking' : state === 'up' ? 'Online' : 'Napping';
          return (
            <li key={app.id}>
              <a href={app.url} target="_blank" rel="noopener noreferrer" className="tile" data-hue={app.hue}>
                <span className="tile-icon">
                  <Icon className="size-6" aria-hidden="true" />
                </span>
                <span className="tile-text">
                  <span className="tile-title">{app.title}</span>
                  <span className="tile-blurb">{app.blurb}</span>
                </span>
                <span className="status" data-state={state} title={label}>
                  <span className="sr-only">{label}</span>
                </span>
                <ArrowUpRight className="tile-arrow size-4" aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
    </>
  );
}
