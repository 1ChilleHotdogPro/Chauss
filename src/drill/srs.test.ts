import { describe, expect, it } from 'vitest';
import { accuracy, DAY_MS, isDue, isNew, newCardState, RELEARN_MS, review, type CardState } from './srs';

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

/** Answer a card several times in a row, each time exactly when it falls due. */
function answer(results: boolean[], start: CardState = newCardState()): { state: CardState; time: number } {
  let state = start;
  let time = NOW;
  for (const correct of results) {
    state = review(state, correct, time);
    time = state.due;
  }
  return { state, time };
}

describe('review', () => {
  it('spaces correct answers out: 1 day, 6 days, then growing by the ease', () => {
    const first = review(newCardState(), true, NOW);
    expect(first.intervalDays).toBe(1);
    expect(first.due).toBe(NOW + DAY_MS);
    expect(first.streak).toBe(1);

    const second = review(first, true, first.due);
    expect(second.intervalDays).toBe(6);

    const third = review(second, true, second.due);
    expect(third.intervalDays).toBe(Math.round(6 * second.ease)); // 6 x 2.6 = 16
    expect(third.intervalDays).toBe(16);
    expect(third.due).toBe(second.due + 16 * DAY_MS);

    const fourth = review(third, true, third.due);
    expect(fourth.intervalDays).toBeGreaterThan(third.intervalDays * 2);
  });

  it('brings a missed card back within minutes and starts its spacing over', () => {
    const { state: learned } = answer([true, true, true]);
    const missed = review(learned, false, NOW + 100 * DAY_MS);
    expect(missed.streak).toBe(0);
    expect(missed.intervalDays).toBe(0);
    expect(missed.due).toBe(NOW + 100 * DAY_MS + RELEARN_MS);

    // Getting it right again starts from one day, not from where it was.
    const again = review(missed, true, missed.due);
    expect(again.intervalDays).toBe(1);
  });

  it('makes cards you miss come back more often for good', () => {
    const easy = answer([true, true, true, true]).state;
    const hard = answer([false, false, false, true, true, true, true]).state;
    expect(hard.ease).toBeLessThan(easy.ease);
    expect(hard.intervalDays).toBeLessThan(easy.intervalDays);
  });

  it('keeps the ease within sensible limits', () => {
    expect(answer(Array.from({ length: 30 }, () => false)).state.ease).toBe(1.3);
    expect(answer(Array.from({ length: 30 }, () => true)).state.ease).toBe(2.8);
  });

  it('counts attempts and errors and remembers when it was last asked', () => {
    const { state } = answer([true, false, true, false, false]);
    expect(state.attempts).toBe(5);
    expect(state.errors).toBe(3);
    expect(state.lastSeen).not.toBeNull();
    expect(accuracy(state)).toBeCloseTo(0.4, 10);
  });

  it('does not change the state it was given', () => {
    const before = newCardState();
    const copy = { ...before };
    review(before, true, NOW);
    review(before, false, NOW);
    expect(before).toEqual(copy);
  });
});

describe('isDue / isNew / accuracy', () => {
  it('treats a never-asked card as new, not as due', () => {
    expect(isNew(undefined)).toBe(true);
    expect(isNew(newCardState())).toBe(true);
    expect(isDue(undefined, NOW)).toBe(false);
    expect(isDue(newCardState(), NOW)).toBe(false);
    expect(accuracy(undefined)).toBeNull();
    expect(accuracy(newCardState())).toBeNull();
  });

  it('knows when a card is due', () => {
    const state = review(newCardState(), true, NOW);
    expect(isNew(state)).toBe(false);
    expect(isDue(state, NOW)).toBe(false);
    expect(isDue(state, NOW + DAY_MS - 1)).toBe(false);
    expect(isDue(state, NOW + DAY_MS)).toBe(true);
  });
});
