import { describe, expect, it } from 'vitest';
import { moveAccuracy, summarize } from './accuracy';

describe('moveAccuracy', () => {
  it('is about 100 for no loss and falls as the loss grows', () => {
    expect(moveAccuracy(0)).toBeCloseTo(99.99, 1);
    expect(moveAccuracy(10)).toBeLessThan(moveAccuracy(5));
    expect(moveAccuracy(30)).toBeLessThan(moveAccuracy(10));
  });

  it('stays between 0 and 100', () => {
    expect(moveAccuracy(100)).toBeGreaterThanOrEqual(0);
    expect(moveAccuracy(-5)).toBeLessThanOrEqual(100);
  });
});

describe('summarize', () => {
  it('averages accuracy per side and counts each label', () => {
    const summary = summarize([
      { color: 'white', drop: 0, classification: 'best' },
      { color: 'black', drop: 40, classification: 'blunder' },
      { color: 'white', drop: 12, classification: 'inaccuracy' },
      undefined,
    ]);
    expect(summary.white.accuracy).toBeCloseTo((moveAccuracy(0) + moveAccuracy(12)) / 2);
    expect(summary.black.accuracy).toBeCloseTo(moveAccuracy(40));
    expect(summary.white.counts.best).toBe(1);
    expect(summary.white.counts.inaccuracy).toBe(1);
    expect(summary.black.counts.blunder).toBe(1);
    expect(summary.black.counts.best).toBe(0);
  });

  it('has no accuracy for a side without moves', () => {
    expect(summarize([]).white.accuracy).toBeUndefined();
  });
});
