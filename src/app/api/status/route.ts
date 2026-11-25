// Up/down check behind the homepage's status dots.
import { NextResponse } from 'next/server';
import { APPS } from '@/lib/site';

export const dynamic = 'force-dynamic';

const CACHE_MS = 60_000;
const TIMEOUT_MS = 4_000;

let cache: { at: number; data: Record<string, boolean> } | null = null;

async function isUp(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: 'HEAD',
      redirect: 'manual',
      cache: 'no-store',
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    // A redirect or a 401 still means the app is up.
    return res.status < 500;
  } catch {
    return false;
  }
}

export async function GET() {
  if (!cache || Date.now() - cache.at > CACHE_MS) {
    const results = await Promise.all(APPS.map(async (app) => [app.id, await isUp(app.url)] as const));
    cache = { at: Date.now(), data: Object.fromEntries(results) };
  }
  return NextResponse.json(cache.data, { headers: { 'Cache-Control': 'public, max-age=30' } });
}
