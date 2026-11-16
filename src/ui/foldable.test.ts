import { describe, expect, it } from 'vitest';
import { gestureResult, SWIPE_DISTANCE } from './foldable';

describe('gestureResult', () => {
  it('folds on a swipe down and unfolds on a swipe up, whatever the state', () => {
    expect(gestureResult(false, SWIPE_DISTANCE)).toBe(true);
    expect(gestureResult(true, SWIPE_DISTANCE + 40)).toBe(true);
    expect(gestureResult(true, -SWIPE_DISTANCE)).toBe(false);
    expect(gestureResult(false, -80)).toBe(false);
  });

  it('toggles on a short press (a click)', () => {
    expect(gestureResult(false, 3)).toBe(true);
    expect(gestureResult(true, -5)).toBe(false);
  });
});
