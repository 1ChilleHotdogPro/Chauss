import type { UciScore } from '../engine/uci';
import type { Side } from '../game/game';

/**
 * A score from White's point of view, whoever is to move.
 * Centipawns ("cp"): 100 = White is one pawn ahead, -100 = Black is.
 * Mate: who delivers it and in how many moves (0 = the mate is already on the board).
 */
export type Score = { type: 'cp'; value: number } | { type: 'mate'; winner: Side; moves: number };

export type Verdict = 'best' | 'good' | 'inaccuracy' | 'mistake' | 'blunder';

/** Minimum drop in winning chances (percentage points) for each verdict. */
export const VERDICT_THRESHOLDS = { inaccuracy: 10, mistake: 20, blunder: 30 } as const;

export interface Judgement {
  verdict: Verdict;
  /** The mover's winning chances (0-100) before and after the move. */
  winBefore: number;
  winAfter: number;
  /** winBefore - winAfter, never negative. */
  drop: number;
  /** Set when a forced mate is involved; `moves` is the length of that mate. */
  note?: { kind: 'allows-mate' | 'missed-mate'; moves: number };
}

export function opposite(side: Side): Side {
  return side === 'white' ? 'black' : 'white';
}

/** Which side is to move in a FEN string. */
export function sideToMove(fen: string): Side {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}

/** Engines report scores for the side to move; convert once to White's point of view. */
export function toWhiteScore(score: UciScore, mover: Side): Score {
  if (score.type === 'cp') {
    if (score.value === 0) return { type: 'cp', value: 0 };
    return { type: 'cp', value: mover === 'white' ? score.value : -score.value };
  }
  // mate N > 0: the side to move mates. N < 0: it gets mated. N = 0: it is already mated.
  return score.value > 0
    ? { type: 'mate', winner: mover, moves: score.value }
    : { type: 'mate', winner: opposite(mover), moves: Math.abs(score.value) };
}

/** Lichess's formula: winning chances (0-100) for the side that is `cp` centipawns ahead. */
export function winPercentFromCp(cp: number): number {
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * cp)) - 1);
}

/** Winning chances (0-100) for `side`. A forced mate counts as 100 (or 0). */
export function winPercent(score: Score, side: Side): number {
  if (score.type === 'mate') return score.winner === side ? 100 : 0;
  const white = winPercentFromCp(score.value);
  return side === 'white' ? white : 100 - white;
}

/** "+0.3", "-1.2", "0.0"; mates as "#3" (White mates), "#-3" (Black mates), "#" (checkmate now). */
export function formatScore(score: Score): string {
  if (score.type === 'mate') {
    if (score.moves === 0) return '#';
    return score.winner === 'white' ? `#${score.moves}` : `#-${score.moves}`;
  }
  const pawns = score.value / 100;
  const text = Math.abs(pawns).toFixed(1);
  if (text === '0.0') return '0.0';
  return pawns > 0 ? `+${text}` : `-${text}`;
}

function isMateFor(score: Score, side: Side): score is Extract<Score, { type: 'mate' }> {
  return score.type === 'mate' && score.winner === side;
}

/**
 * Judge a move by how much it lowered the mover's winning chances.
 * `before` is the engine's score of the position before the move (with best play),
 * `after` the score of the position after it.
 */
export function judgeMove(input: {
  before: Score;
  after: Score;
  mover: Side;
  /** True when the move is the engine's own first choice. */
  playedBest: boolean;
}): Judgement {
  const { before, after, mover, playedBest } = input;
  const winBefore = winPercent(before, mover);
  const winAfter = winPercent(after, mover);
  const drop = Math.max(0, winBefore - winAfter);

  // The engine's first choice is never criticised: any drop is just the search seeing deeper.
  if (playedBest) return { verdict: 'best', winBefore, winAfter, drop };

  let verdict: Verdict = 'good';
  if (drop >= VERDICT_THRESHOLDS.blunder) verdict = 'blunder';
  else if (drop >= VERDICT_THRESHOLDS.mistake) verdict = 'mistake';
  else if (drop >= VERDICT_THRESHOLDS.inaccuracy) verdict = 'inaccuracy';

  const judgement: Judgement = { verdict, winBefore, winAfter, drop };
  const opponent = opposite(mover);

  if (isMateFor(after, opponent) && !isMateFor(before, opponent)) {
    judgement.note = { kind: 'allows-mate', moves: after.moves };
  } else if (isMateFor(before, mover) && !isMateFor(after, mover)) {
    judgement.note = { kind: 'missed-mate', moves: before.moves };
    // Still winning easily, perhaps — but a forced mate was there, so say something.
    if (verdict === 'good') judgement.verdict = 'inaccuracy';
  }
  return judgement;
}
