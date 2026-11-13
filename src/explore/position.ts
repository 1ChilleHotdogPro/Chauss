import { judgeMove, sideToMove, winPercent, type Judgement, type Score } from '../analysis/eval';
import type { Side } from '../game/game';
import { sumCounts, type Counts, type SnapshotNode } from '../snapshot/format';

/** How one move did in one source (book or Lichess). */
export interface MoveStats {
  games: number;
  /** Share of the games at this position in which the move was played, 0-1. */
  share: number;
  /** Results of those games, 0-100 each (they add up to 100). */
  whitePercent: number;
  drawPercent: number;
  blackPercent: number;
}

export type MoveFlag = 'none' | 'inaccuracy' | 'mistake' | 'blunder';

export interface ExploreMove {
  uci: string;
  san: string;
  /** Master games ("Book"); null when no master has played it. */
  book: MoveStats | null;
  /** Lichess games at the chosen level ("Popular at your level"); null when nobody there has. */
  popular: MoveStats | null;
  /** The opening this move leads to, when it has a name of its own. */
  opening?: string;
  /** Stockfish's score after the move, from White's point of view. */
  eval?: Score;
  /** How the move compares with the best move here; absent when a score is missing. */
  judgement?: Judgement;
  flag: MoveFlag;
  /** Key of the position the move leads to, when the bundled data continues there. */
  next?: string;
}

export interface ExplorePosition {
  fen: string;
  mover: Side;
  opening?: { eco: string; name: string };
  bookGames: number;
  popularGames: number;
  /** Stockfish's score of the position, from White's point of view. */
  eval?: Score;
  /** Every known move, most popular at the chosen level first. */
  moves: ExploreMove[];
  /** The moves masters have played, most played first. */
  bookMoves: ExploreMove[];
  /** The moves played at the chosen level, most played first. */
  popularMoves: ExploreMove[];
  /** The one recommended reply, where the data names one (lightly covered sidelines). */
  recommended?: string;
}

/** The part of a snapshot position that is needed; live explorer data is brought into the same shape. */
export type PositionData = Pick<SnapshotNode, 'fen' | 'masters' | 'lichess' | 'moves'> &
  Partial<Pick<SnapshotNode, 'opening' | 'eval' | 'recommended'>>;

function stats(counts: Counts, positionGames: number): MoveStats | null {
  const games = sumCounts(counts);
  if (games === 0) return null;
  // Round two of the three and let the third take the rest, so they always add up to 100.
  const whitePercent = Math.round((counts[0] / games) * 100);
  const drawPercent = Math.round((counts[1] / games) * 100);
  return {
    games,
    share: positionGames > 0 ? games / positionGames : 0,
    whitePercent,
    drawPercent,
    blackPercent: Math.max(0, 100 - whitePercent - drawPercent),
  };
}

function flagOf(judgement: Judgement | undefined): MoveFlag {
  const verdict = judgement?.verdict;
  return verdict === 'inaccuracy' || verdict === 'mistake' || verdict === 'blunder' ? verdict : 'none';
}

/**
 * Everything the Explore screen shows for one position: the two sources side by side, and each
 * move flagged by how much it gives away.
 *
 * A move is judged with the same rule as moves played on the board (drop in the mover's winning
 * chances: 10 / 20 / 30 points). The yardstick is the best that is known here: the position's own
 * score or the best-scoring listed move, whichever is better for the side to move.
 */
export function buildExplorePosition(data: PositionData): ExplorePosition {
  const mover = sideToMove(data.fen);
  const bookGames = sumCounts(data.masters);
  const popularGames = sumCounts(data.lichess);

  const known = [data.eval, ...data.moves.map((move) => move.eval)].filter((score): score is Score => score !== undefined);
  let best: Score | undefined;
  for (const score of known) {
    if (best === undefined || winPercent(score, mover) > winPercent(best, mover)) best = score;
  }

  const moves: ExploreMove[] = data.moves.map((move) => {
    const out: ExploreMove = {
      uci: move.uci,
      san: move.san,
      book: stats(move.masters, bookGames),
      popular: stats(move.lichess, popularGames),
      flag: 'none',
    };
    if (move.opening) out.opening = move.opening;
    if (move.next !== undefined) out.next = move.next;
    if (move.eval) {
      out.eval = move.eval;
      if (best) {
        out.judgement = judgeMove({ before: best, after: move.eval, mover, playedBest: false });
        out.flag = flagOf(out.judgement);
      }
    }
    return out;
  });

  const byGames = (pick: (move: ExploreMove) => MoveStats | null) => (a: ExploreMove, b: ExploreMove) =>
    (pick(b)?.games ?? 0) - (pick(a)?.games ?? 0);

  const position: ExplorePosition = {
    fen: data.fen,
    mover,
    bookGames,
    popularGames,
    moves,
    bookMoves: moves.filter((move) => move.book !== null).sort(byGames((move) => move.book)),
    popularMoves: moves.filter((move) => move.popular !== null).sort(byGames((move) => move.popular)),
  };
  if (data.opening) position.opening = data.opening;
  if (data.eval) position.eval = data.eval;
  if (data.recommended) position.recommended = data.recommended;
  return position;
}

/**
 * "Popular mistakes": moves that people at the chosen level really play (at least `minShare` of
 * the games here) and that are a mistake or a blunder. Worst first.
 */
export function popularMistakes(position: ExplorePosition, minShare = 0.02): ExploreMove[] {
  return position.popularMoves
    .filter((move) => (move.flag === 'mistake' || move.flag === 'blunder') && (move.popular?.share ?? 0) >= minShare)
    .sort((a, b) => (b.judgement?.drop ?? 0) - (a.judgement?.drop ?? 0));
}
