'use client';

// What the browser remembers about the player.
import { useSyncExternalStore } from 'react';

export type Profile = {
  best: number;
  /** Best in any mode. Skins unlock against this. */
  bestEver: number;
  /** UTC date `dailyBest` belongs to. */
  dailyDate: string;
  dailyBest: number;
  skin: string;
  muted: boolean;
  /** Last leaderboard name, offered again next time. */
  name: string;
  /** Secret skins found on the site. */
  secrets: string[];
};

const DEFAULTS: Profile = { best: 0, bestEver: 0, dailyDate: '', dailyBest: 0, skin: 'classic', muted: false, name: '', secrets: [] };

const KEY = 'cortaku.profile';
/** Where the original game stored its high score. */
const LEGACY_BEST_KEY = 'highScore';

/** UTC, so every player shares one daily course. */
export function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

let cached: Profile | null = null;
const listeners = new Set<() => void>();

function read(): Profile {
  if (cached) return cached;
  let stored: Partial<Profile> = {};
  let legacyBest = 0;
  try {
    stored = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Profile>;
    legacyBest = Number(localStorage.getItem(LEGACY_BEST_KEY)) || 0;
  } catch {
    // Storage blocked or corrupt: use defaults.
  }
  const profile = { ...DEFAULTS, ...stored };
  profile.best = Math.max(profile.best, legacyBest);
  profile.bestEver = Math.max(profile.bestEver, profile.best);
  cached = profile;
  return profile;
}

export function getProfile(): Profile {
  return read();
}

export function updateProfile(patch: Partial<Profile>) {
  cached = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cached));
    localStorage.setItem(LEGACY_BEST_KEY, String(cached.best));
  } catch {
    // Storage blocked: the change lasts for this visit only.
  }
  listeners.forEach((listener) => listener());
}

/** Unlocks a secret skin. False if it was already found. */
export function unlockSecret(id: string): boolean {
  const { secrets } = read();
  if (secrets.includes(id)) return false;
  updateProfile({ secrets: [...secrets, id] });
  return true;
}

/** The daily best for `day` (today by default); 0 if the stored one is from another day. */
export function dailyBestOn(profile: Profile, day = todayKey()): number {
  return profile.dailyDate === day ? profile.dailyBest : 0;
}

/** True when the run beat the player's best for that mode. `day` is the daily run's date. */
export function recordRun(mode: 'endless' | 'daily', score: number, day = todayKey()): boolean {
  const profile = read();
  const previous = mode === 'daily' ? dailyBestOn(profile, day) : profile.best;
  if (score <= previous) return false;
  const bestEver = Math.max(profile.bestEver, score);
  if (mode === 'daily') updateProfile({ dailyDate: day, dailyBest: score, bestEver });
  else updateProfile({ best: score, bestEver });
  return true;
}

/** Another tab saved the profile: drop the cached copy, or the next save here would write the old one back. */
function onStorage(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return;
  cached = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  if (listeners.size === 0) window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.removeEventListener('storage', onStorage);
  };
}

export function useProfile(): Profile {
  return useSyncExternalStore(subscribe, read, () => DEFAULTS);
}
