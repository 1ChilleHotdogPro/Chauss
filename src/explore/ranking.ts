import type { PositionEval } from '../analysis/analysis';
import { judgeMove, sideToMove, type Judgement, type Score } from '../analysis/eval';
import { pvToSan } from '../analysis/pv';
import type { MoveFlag } from './position';

export interface RankedMove {
  uci: string;
  san: string;
  /** Stockfish's score after the move, from White's point of view. */
  score: Score;
  /** Compared with the best move in the position. */
  judgement: Judgement;
  flag: MoveFlag;
}

/**
 * Turn a "rank every legal move" search into rows for the screen: each legal move with its score
 * and how much worse it is than the best one. Most punished first — the point of the list is to
 * see which moves lose, and how badly.
 */
export function buildRanking(evaluation: PositionEval): RankedMove[] {
  const best = evaluation.lines[0];
  if (!best) return [];
  const mover = sideToMove(evaluation.fen);

  const rows: RankedMove[] = [];
  evaluation.lines.forEach((line, index) => {
    const uci = line.pv[0];
    if (!uci) return;
    const san = pvToSan(evaluation.fen, [uci])[0];
    if (!san) return;
    const judgement = judgeMove({ before: best.score, after: line.score, mover, playedBest: index === 0 });
    const verdict = judgement.verdict;
    rows.push({
      uci,
      san,
      score: line.score,
      judgement,
      flag: verdict === 'inaccuracy' || verdict === 'mistake' || verdict === 'blunder' ? verdict : 'none',
    });
  });
  // The engine lists best first; show the worst first, keeping the engine's order among equals.
  return rows.reverse();
}
