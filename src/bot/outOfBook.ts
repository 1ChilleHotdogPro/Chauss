import type { PositionEval } from '../analysis/analysis';
import { formatScore, sideToMove, winPercent, type Score } from '../analysis/eval';
import { numberedLine, pvToSan } from '../analysis/pv';
import type { ExploreView } from '../explore/source';

/**
 * Is the position on the board still inside the opening data?
 *  - loading: not known yet (live data on its way);
 *  - in: there is data to go on — for Black, moves that people at the chosen level play; for
 *    White, any listed move;
 *  - out: the game has left the known tree.
 */
export type TreeStatus = 'loading' | 'in' | 'out';

export function treeStatus(view: ExploreView): TreeStatus {
  if (view.status === 'loading') return 'loading';
  if (view.status === 'unavailable') return 'out';
  const { position } = view;
  if (position.mover === 'black') {
    return position.popularMoves.some((move) => (move.popular?.games ?? 0) > 0) ? 'in' : 'out';
  }
  return position.moves.length > 0 ? 'in' : 'out';
}

export type StrengthId = 'easy' | 'medium' | 'hard';

/** How strongly Stockfish plays Black once the opening data has run out ("play on"). */
export interface Strength {
  id: StrengthId;
  label: string;
  /** Stockfish's own "Skill Level" option: 0 (weakest) to 20 (full strength). */
  skill: number;
  /** How many half-moves deep it looks. */
  depth: number;
}

export const STRENGTHS: readonly Strength[] = [
  { id: 'easy', label: 'Easy', skill: 0, depth: 4 },
  { id: 'medium', label: 'Medium', skill: 5, depth: 8 },
  { id: 'hard', label: 'Hard', skill: 10, depth: 12 },
];

export function strengthById(id: string | null | undefined): Strength {
  return STRENGTHS.find((strength) => strength.id === id) ?? STRENGTHS[0]!;
}

/** "White is slightly better (+0.6)." — who stands better, in words a beginner can use. */
export function describeBalance(score: Score): string {
  if (score.type === 'mate') {
    const who = score.winner === 'white' ? 'White' : 'Black';
    if (score.moves === 0) return `Checkmate: ${who} has won.`;
    return `${who} can force checkmate in ${score.moves} ${score.moves === 1 ? 'move' : 'moves'}.`;
  }
  const white = winPercent(score, 'white');
  const lead = Math.abs(white - 50);
  const who = white >= 50 ? 'White' : 'Black';
  const text = formatScore(score);
  if (lead < 5) return `The position is about equal (${text}).`;
  if (lead < 12) return `${who} is slightly better (${text}).`;
  if (lead < 25) return `${who} is clearly better (${text}).`;
  return `${who} is winning (${text}).`;
}

export interface StopSummary {
  /** Who stands better, e.g. "White is slightly better (+0.6)." */
  balance: string;
  /** The best move for the side to move, e.g. "8...d6"; null when the game is over. */
  best: string | null;
  /** Stockfish's main line with move numbers; null when the game is over. */
  line: string | null;
  /** Search depth of the result. */
  depth: number;
}

/**
 * What Stockfish thinks of the position where the game left the opening data. Null while the
 * engine has not reported yet.
 */
export function stopSummary(evaluation: PositionEval | undefined, maxPlies = 8): StopSummary | null {
  if (!evaluation) return null;
  const best = evaluation.lines[0];
  if (!best) return null;
  const sans = pvToSan(evaluation.fen, best.pv, maxPlies);
  const first = sans[0];
  let bestText: string | null = null;
  if (first !== undefined) {
    const number = Number(evaluation.fen.split(' ')[5]) || 1;
    bestText = sideToMove(evaluation.fen) === 'white' ? `${number}.${first}` : `${number}...${first}`;
  }
  return {
    balance: describeBalance(best.score),
    best: bestText,
    line: sans.length > 0 ? numberedLine(evaluation.fen, sans) : null,
    depth: evaluation.depth,
  };
}
