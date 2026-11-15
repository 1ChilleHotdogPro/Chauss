import { Chess } from 'chess.js';
import type { PieceSymbol, Side } from './game';

/** Standard piece values in pawns. */
export const PIECE_VALUES: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** What each side starts with. */
const START_COUNTS = { p: 8, n: 2, b: 2, r: 2, q: 1 } as const;
type Countable = keyof typeof START_COUNTS;
/** Display order: the most valuable first. */
const DISPLAY_ORDER: readonly Countable[] = ['q', 'r', 'b', 'n', 'p'];

export interface Material {
  /** Pieces each side has lost, most valuable first. `white` = White pieces that were taken. */
  lost: Record<Side, Countable[]>;
  /** Pawns' worth of material on the board, White minus Black: positive = White is ahead. */
  balance: number;
}

/**
 * Work out the material from a position (FEN) alone, so it is right wherever in the game you look.
 * A promoted pawn is not counted as a lost pawn, and the new piece is not counted as extra.
 */
export function materialFromFen(fen: string): Material {
  const counts: Record<Side, Record<Countable, number>> = {
    white: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    black: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const row of new Chess(fen).board()) {
    for (const square of row) {
      if (!square || square.type === 'k') continue;
      counts[square.color === 'w' ? 'white' : 'black'][square.type]++;
    }
  }

  const lost: Record<Side, Countable[]> = { white: [], black: [] };
  const points: Record<Side, number> = { white: 0, black: 0 };
  for (const side of ['white', 'black'] as const) {
    const have = counts[side];
    let promotions = 0;
    for (const type of DISPLAY_ORDER) {
      if (type !== 'p') promotions += Math.max(0, have[type] - START_COUNTS[type]);
      points[side] += have[type] * PIECE_VALUES[type];
    }
    for (const type of DISPLAY_ORDER) {
      let missing = Math.max(0, START_COUNTS[type] - have[type]);
      if (type === 'p') missing = Math.max(0, missing - promotions);
      for (let i = 0; i < missing; i++) lost[side].push(type);
    }
  }
  return { lost, balance: points.white - points.black };
}
