/**
 * Spaced repetition: when to ask about a card again. This is the classic SM-2 scheme with a
 * simple right / wrong answer:
 *   - right: the gap grows — 1 day, then 6 days, then the previous gap times the card's "ease";
 *   - wrong: the card starts over and comes back within minutes, and its ease drops a little, so
 *     cards you keep missing return more often for good.
 */
export interface CardState {
  /** Correct answers in a row. */
  streak: number;
  /** The current gap between reviews, in days (0 = still being learned). */
  intervalDays: number;
  /** How quickly the gap grows (1.3 = slowly, for hard cards; 2.5 = the starting value). */
  ease: number;
  /** When the card is due again (milliseconds since 1970). */
  due: number;
  /** Totals, for the statistics. */
  attempts: number;
  errors: number;
  /** When it was last asked (milliseconds since 1970), or null if never. */
  lastSeen: number | null;
}

export const DAY_MS = 24 * 60 * 60 * 1000;
/** A missed card comes back after this long. */
export const RELEARN_MS = 10 * 60 * 1000;
const MIN_EASE = 1.3;
const START_EASE = 2.5;
const MAX_EASE = 2.8;

export function newCardState(): CardState {
  return { streak: 0, intervalDays: 0, ease: START_EASE, due: 0, attempts: 0, errors: 0, lastSeen: null };
}

/** The card's state after being asked once more. Does not change the state passed in. */
export function review(state: CardState, correct: boolean, now: number): CardState {
  const next: CardState = { ...state, attempts: state.attempts + 1, lastSeen: now };

  if (!correct) {
    next.errors = state.errors + 1;
    next.streak = 0;
    next.intervalDays = 0;
    next.ease = Math.max(MIN_EASE, state.ease - 0.2);
    next.due = now + RELEARN_MS;
    return next;
  }

  next.streak = state.streak + 1;
  if (next.streak === 1) next.intervalDays = 1;
  else if (next.streak === 2) next.intervalDays = 6;
  else next.intervalDays = Math.round(state.intervalDays * state.ease);
  next.ease = Math.min(MAX_EASE, state.ease + 0.05);
  next.due = now + next.intervalDays * DAY_MS;
  return next;
}

/** A card that has been asked at least once and whose time has come. */
export function isDue(state: CardState | undefined, now: number): boolean {
  return state !== undefined && state.lastSeen !== null && state.due <= now;
}

/** Never asked yet. */
export function isNew(state: CardState | undefined): boolean {
  return state === undefined || state.lastSeen === null;
}

/** Share of answers that were right, 0-1; null before the first attempt. */
export function accuracy(state: CardState | undefined): number | null {
  if (!state || state.attempts === 0) return null;
  return (state.attempts - state.errors) / state.attempts;
}
