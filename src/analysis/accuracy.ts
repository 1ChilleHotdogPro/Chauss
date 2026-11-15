import type { Side } from '../game/game';
import type { Classification } from './classify';

/**
 * Accuracy (0-100) of one move from the drop in the mover's winning chances (win-% points).
 * The curve is WintrChess's (https://github.com/WintrCat/wintrchess, accuracy.ts, GPL-3.0):
 * 103.16 · e^(−4 · loss) − 3.17, with the loss as a fraction (drop / 100).
 */
export function moveAccuracy(drop: number): number {
  const accuracy = 103.16 * Math.exp((-4 * Math.max(0, drop)) / 100) - 3.17;
  return Math.min(100, Math.max(0, accuracy));
}

export interface SideSummary {
  /** Mean accuracy of the side's analysed moves; undefined when it has none. */
  accuracy: number | undefined;
  counts: Record<Classification, number>;
}

export const CLASSIFICATIONS: readonly Classification[] = [
  'brilliant',
  'great',
  'best',
  'excellent',
  'good',
  'book',
  'forced',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

function emptyCounts(): Record<Classification, number> {
  return Object.fromEntries(CLASSIFICATIONS.map((name) => [name, 0])) as Record<Classification, number>;
}

/** Per side: the plain mean of its move accuracies, and how many moves got each label. */
export function summarize(
  moves: readonly ({ color: Side; drop: number; classification: Classification } | undefined)[],
): Record<Side, SideSummary> {
  const sums: Record<Side, { total: number; count: number; counts: Record<Classification, number> }> = {
    white: { total: 0, count: 0, counts: emptyCounts() },
    black: { total: 0, count: 0, counts: emptyCounts() },
  };
  for (const move of moves) {
    if (!move) continue;
    const side = sums[move.color];
    side.total += moveAccuracy(move.drop);
    side.count += 1;
    side.counts[move.classification] += 1;
  }
  const finish = (side: (typeof sums)[Side]): SideSummary => ({
    accuracy: side.count > 0 ? side.total / side.count : undefined,
    counts: side.counts,
  });
  return { white: finish(sums.white), black: finish(sums.black) };
}
