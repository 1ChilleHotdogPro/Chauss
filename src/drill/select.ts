import type { Card } from '../repertoire/repertoire';
import type { Progress } from './progress';
import { isDue, isNew } from './srs';

/** Why a card was chosen as the next thing to drill. */
export type TargetReason =
  /** It was asked before and its time has come. */
  | 'due'
  /** It has never been asked. */
  | 'new'
  /** Nothing is due and nothing is new: practising ahead of schedule. */
  | 'ahead';

export interface DrillCounts {
  due: number;
  new: number;
  total: number;
}

export function countCards(cards: Iterable<Card>, progress: Progress, now: number): DrillCounts {
  const counts: DrillCounts = { due: 0, new: 0, total: 0 };
  for (const card of cards) {
    counts.total += 1;
    const state = progress.cards[card.key];
    if (isNew(state)) counts.new += 1;
    else if (isDue(state, now)) counts.due += 1;
  }
  return counts;
}

/**
 * Which card to aim the next drill at:
 *   1. cards that are due, the longest overdue first;
 *   2. then cards never seen, the ones that come up most often in real games first;
 *   3. then, with nothing due and nothing new, the card that will be due soonest.
 * `skip` leaves out cards already drilled in this sitting (unless nothing else is left).
 */
export function pickTarget(
  cards: Iterable<Card>,
  progress: Progress,
  now: number,
  skip: ReadonlySet<string> = new Set(),
): { card: Card; reason: TargetReason } | null {
  const all = [...cards];
  if (all.length === 0) return null;
  const pool = all.some((card) => !skip.has(card.key)) ? all.filter((card) => !skip.has(card.key)) : all;
  const dueAt = (card: Card): number => progress.cards[card.key]?.due ?? 0;

  const due = pool.filter((card) => isDue(progress.cards[card.key], now)).sort((a, b) => dueAt(a) - dueAt(b));
  if (due[0]) return { card: due[0], reason: 'due' };

  const fresh = pool
    .filter((card) => isNew(progress.cards[card.key]))
    // Most common first; between equals, the shorter line first (learn the trunk before the twigs).
    .sort((a, b) => b.reach - a.reach || a.line.length - b.line.length);
  if (fresh[0]) return { card: fresh[0], reason: 'new' };

  const soonest = [...pool].sort((a, b) => dueAt(a) - dueAt(b))[0]!;
  return { card: soonest, reason: 'ahead' };
}
