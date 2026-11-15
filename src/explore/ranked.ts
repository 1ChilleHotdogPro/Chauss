import type { ExploreMove, ExplorePosition } from './position';
import type { RankedMove } from './ranking';

/** True when some move listed here has no Stockfish score yet, so it cannot be flagged. */
export function needsScores(position: ExplorePosition): boolean {
  return position.moves.some((move) => move.eval === undefined);
}

/**
 * Add Stockfish's verdict to the listed moves that have none (positions outside the bundled data),
 * using a ranking of every legal move there. Moves that already carry a score keep it.
 */
export function withRanking(position: ExplorePosition, rows: readonly RankedMove[]): ExplorePosition {
  const byUci = new Map(rows.map((row) => [row.uci, row]));
  const scored = new Map<string, ExploreMove>();
  const moves = position.moves.map((move) => {
    const row = move.eval === undefined ? byUci.get(move.uci) : undefined;
    const next = row ? { ...move, eval: row.score, judgement: row.judgement, flag: row.flag } : move;
    scored.set(move.uci, next);
    return next;
  });
  const pick = (list: readonly ExploreMove[]) => list.map((move) => scored.get(move.uci) ?? move);
  return {
    ...position,
    moves,
    bookMoves: pick(position.bookMoves),
    popularMoves: pick(position.popularMoves),
  };
}
