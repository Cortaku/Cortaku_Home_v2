import { describe, expect, it } from 'vitest';
import { dailyNumber, shareText } from './share';

describe('share text', () => {
  it('numbers daily runs from the first one', () => {
    expect(dailyNumber('2026-11-24')).toBe(1);
    expect(dailyNumber('2026-11-25')).toBe(2);
    expect(dailyNumber('2027-11-24')).toBe(366);
  });

  it('shows one blossom per zone cleared, then the crash', () => {
    expect(shareText({ mode: 'daily', date: '2026-11-25', score: 1858, zone: 3 })).toBe(
      'Cortaku Daily #2 · Nov 25\n🌸🌸🌸💥 1,858\ncortaku.com',
    );
    expect(shareText({ mode: 'endless', date: '2026-11-25', score: 120, zone: 0 })).toBe('Cortaku Endless\n💥 120\ncortaku.com');
  });

  it('caps the blossoms on very long runs', () => {
    expect(shareText({ mode: 'endless', date: '2026-11-25', score: 99999, zone: 14 }).split('\n')[1]).toBe(`${'🌸'.repeat(10)}+4💥 99,999`);
  });
});
