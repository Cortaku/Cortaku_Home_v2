import { describe, expect, it } from 'vitest';
import { hash, roadPalette } from './road';

const brightness = (hex: string) => {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
};

describe('road palette', () => {
  it('derives every colour from the ground, edge lightest and joints darkest', () => {
    const p = roadPalette([42, 94, 62]);
    expect(p.face).toBe('#2a5e3e');
    const order = [p.edge, p.speck, p.top, p.face, p.lip, p.joint].map(brightness);
    for (let i = 1; i < order.length; i++) expect(order[i]).toBeLessThan(order[i - 1]);
  });
});

describe('detail placement', () => {
  it('is repeatable and spread across 0..1', () => {
    expect(hash(12345)).toBe(hash(12345));
    const values = Array.from({ length: 2000 }, (_, i) => hash(i));
    expect(Math.min(...values)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...values)).toBeLessThan(1);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    expect(mean).toBeGreaterThan(0.45);
    expect(mean).toBeLessThan(0.55);
  });
});
