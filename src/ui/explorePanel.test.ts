import { describe, expect, it } from 'vitest';
import { compactNumber, sharePercent } from './explorePanel';

describe('compactNumber', () => {
  it('shortens game counts to K, M and B', () => {
    expect(compactNumber(908)).toBe('908');
    expect(compactNumber(9_999)).toBe('9,999');
    expect(compactNumber(12_345)).toBe('12.3K');
    expect(compactNumber(3_092_272)).toBe('3.1M');
    // The Lichess database at the start position: over a billion games, not "1162.4M".
    expect(compactNumber(1_162_400_000)).toBe('1.2B');
  });
});

describe('sharePercent', () => {
  it('rounds to whole percents and shows tiny shares as "<1%"', () => {
    expect(sharePercent(0.583)).toBe('58%');
    expect(sharePercent(0.004)).toBe('<1%');
    expect(sharePercent(0)).toBe('0%');
  });
});
