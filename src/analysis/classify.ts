/*
 * Classifies one move of a game the way game-review sites do (best, great, blunder, miss, ...).
 *
 * The order of checks, the mate tables, and the "great" (only move) and "brilliant" (sacrifice)
 * tests are adapted from WintrChess by WintrCat (https://github.com/WintrCat/wintrchess),
 * shared/src/lib/reporter/{classify.ts,classification/*,utils/criticalMove.ts}, GPL-3.0.
 * Differences, on purpose:
 *  - losses are measured in Lichess win-% points (eval.ts), with Chauss's own thresholds for
 *    inaccuracy / mistake / blunder (10 / 20 / 30), so every mode of the app agrees;
 *  - "miss" is Chauss's own rule (WintrChess has none): see `isMiss`.
 */
import { Chess, type Move } from 'chess.js';
import type { PositionEval } from './analysis';
import { judgeMove, sideToMove, VERDICT_THRESHOLDS, winPercent, type Judgement, type Score } from './eval';
import { parseUciMove } from './pv';
import {
  attackingMoves,
  captureSquare,
  flip,
  hasDangerLevels,
  isPieceSafe,
  isPieceTrapped,
  unsafePieces,
} from './pieceSafety';
import type { Side } from '../game/game';

export type Classification =
  | 'brilliant'
  | 'great'
  | 'best'
  | 'excellent'
  | 'good'
  | 'book'
  | 'forced'
  | 'inaccuracy'
  | 'mistake'
  | 'blunder'
  | 'miss';

/** Win-% drop (for a move that is not the engine's first choice) below which each label applies. */
const GOOD_MOVE_THRESHOLDS = { best: 1, excellent: 4.5, good: VERDICT_THRESHOLDS.inaccuracy } as const;
/** Win-% gap between the best and second-best move that makes the best one an only move ("great"). */
const GREAT_GAP = 10;
/** Eval (centipawns, mover's view) from which the position is won anyway, so nothing is "great". */
const STILL_WINNING_CP = 700;
/** A move "hands back" the opponent's error when the mover ends within this many points of before it. */
const MISS_MARGIN = 5;

/** How good each label is, for "at least best" comparisons (higher is better). */
const RANK: Record<Classification, number> = {
  blunder: 0,
  miss: 0,
  mistake: 1,
  inaccuracy: 2,
  good: 3,
  excellent: 4,
  best: 5,
  great: 5,
  brilliant: 5,
  forced: 5,
  book: 5,
};

export interface ClassifyInput {
  /** The position before the move and the engine's lines for it (best first, ideally two). */
  before: PositionEval;
  /** The position after the move and the engine's best line there. */
  after: PositionEval;
  /** The move played, in engine spelling ("g1f3"). */
  uci: string;
  isBook: boolean;
  /** The opponent's move just before this one, when there was one. */
  previous?: { classification: Classification; winBefore: number };
}

export interface MoveClassification extends Judgement {
  classification: Classification;
  /** The engine's first choice in the position before the move. */
  bestMove: string | undefined;
}

/** A score as the mover sees it: centipawns, or a signed mate length (positive = the mover mates). */
type Subjective = { type: 'cp'; value: number } | { type: 'mate'; value: number };

function subjective(score: Score, mover: Side): Subjective {
  if (score.type === 'cp') return { type: 'cp', value: mover === 'white' ? score.value : -score.value };
  return { type: 'mate', value: score.winner === mover ? score.moves : -score.moves };
}

/** Classification by how much the move lowered the mover's chances (WintrChess's point-loss tables). */
function byLoss(before: Score, after: Score, mover: Side, drop: number): Classification {
  const prev = subjective(before, mover);
  const cur = subjective(after, mover);

  if (prev.type === 'mate' && cur.type === 'mate') {
    if (prev.value > 0 && cur.value < 0) return cur.value < -3 ? 'mistake' : 'blunder';
    // Positive: the mate got longer (for the winner) or shorter (for the loser).
    const mateLoss = cur.value - prev.value;
    if (mateLoss < 0 || (mateLoss === 0 && cur.value < 0)) return 'best';
    if (mateLoss < 2) return 'excellent';
    if (mateLoss < 7) return 'good';
    return 'inaccuracy';
  }
  if (prev.type === 'mate' && prev.value > 0) {
    // The mover had a forced mate, and it is gone.
    if (cur.value >= 800) return 'excellent';
    if (cur.value >= 400) return 'good';
    if (cur.value >= 200) return 'inaccuracy';
    if (cur.value >= 0) return 'mistake';
    return 'blunder';
  }
  if (prev.type === 'cp' && cur.type === 'mate') {
    if (cur.value > 0) return 'best';
    if (cur.value >= -2) return 'blunder';
    if (cur.value >= -5) return 'mistake';
    return 'inaccuracy';
  }

  if (drop < GOOD_MOVE_THRESHOLDS.best) return 'best';
  if (drop < GOOD_MOVE_THRESHOLDS.excellent) return 'excellent';
  if (drop < GOOD_MOVE_THRESHOLDS.good) return 'good';
  if (drop < VERDICT_THRESHOLDS.mistake) return 'inaccuracy';
  if (drop < VERDICT_THRESHOLDS.blunder) return 'mistake';
  return 'blunder';
}

interface Context {
  board: Chess; // before the move
  played: Move;
  boardAfter: Chess;
  mover: Side;
  before: PositionEval;
  after: Score;
}

/** Moves that are easy to find, forced, or played in a won or lost position are never great or brilliant. */
function isCandidate(ctx: Context): boolean {
  const second = ctx.before.lines[1]?.score;
  if (second) {
    const sub = subjective(second, ctx.mover);
    if (sub.type === 'cp' && sub.value >= STILL_WINNING_CP) return false;
  } else {
    const sub = subjective(ctx.after, ctx.mover);
    if (sub.type === 'cp' && sub.value >= STILL_WINNING_CP) return false;
  }
  if (subjective(ctx.after, ctx.mover).value < 0) return false;
  if (ctx.played.promotion === 'q') return false;
  if (ctx.board.inCheck()) return false;
  return true;
}

/** "Great": the only move that keeps the position — the second-best move was much worse. */
function isGreat(ctx: Context): boolean {
  if (!isCandidate(ctx)) return false;
  const after = subjective(ctx.after, ctx.mover);
  if (after.type === 'mate' && after.value > 0) return false; // finding a mate is not "only move" play
  if (ctx.played.captured) {
    const taken = { color: flip(ctx.played.color), square: captureSquare(ctx.played), type: ctx.played.captured };
    if (!isPieceSafe(ctx.board, taken)) return false; // taking free material is easy to find
  }
  const top = ctx.before.lines[0]?.score;
  const second = ctx.before.lines[1]?.score;
  if (!top || !second) return false;
  return winPercent(top, ctx.mover) - winPercent(second, ctx.mover) >= GREAT_GAP;
}

/** "Brilliant": a good move that leaves a piece to be taken (a real sacrifice). */
function isBrilliant(ctx: Context): boolean {
  if (!isCandidate(ctx)) return false;
  if (ctx.played.promotion) return false;
  const color = ctx.played.color;
  // Nothing left to be taken: no sacrifice (and no need for the costlier checks below).
  const unsafeAfter = unsafePieces(ctx.boardAfter, color, ctx.played);
  if (unsafeAfter.length === 0) return false;
  const unsafeBefore = unsafePieces(ctx.board, color);

  // Moving a piece out of danger is not a sacrifice.
  if (!ctx.boardAfter.inCheck() && unsafeAfter.length < unsafeBefore.length) return false;
  // Taking the piece would cost the taker as much or more: not really on offer.
  if (unsafeAfter.every((piece) => hasDangerLevels(ctx.boardAfter, piece, attackingMoves(ctx.boardAfter, piece, false)))) {
    return false;
  }
  const trappedBefore = unsafeBefore.filter((piece) => isPieceTrapped(ctx.board, piece));
  const trappedAfter = unsafeAfter.filter((piece) => isPieceTrapped(ctx.boardAfter, piece));
  const movedWasTrapped = trappedBefore.some((piece) => piece.square === ctx.played.from);
  if (trappedAfter.length === unsafeAfter.length || movedWasTrapped || trappedAfter.length < trappedBefore.length) {
    return false;
  }
  return true;
}

/**
 * Chauss's "miss": the opponent just made a mistake or blunder, and this move gives the chance back —
 * the mover ends up about where they were before the opponent's error (not much better, not far worse).
 */
function isMiss(base: Classification, judgement: Judgement, previous: ClassifyInput['previous']): boolean {
  if (!previous || (previous.classification !== 'mistake' && previous.classification !== 'blunder')) return false;
  if (RANK[base] > RANK.inaccuracy || judgement.drop < VERDICT_THRESHOLDS.inaccuracy) return false;
  const beforeTheirError = 100 - previous.winBefore;
  return Math.abs(judgement.winAfter - beforeTheirError) <= MISS_MARGIN;
}

function playMove(fen: string, uci: string): { board: Chess; played: Move; boardAfter: Chess } | null {
  const move = parseUciMove(uci);
  if (!move) return null;
  try {
    const board = new Chess(fen);
    const boardAfter = new Chess(fen);
    const played = boardAfter.move(move);
    return { board, played, boardAfter };
  } catch {
    return null;
  }
}

/** Classify a move from the engine's results for the positions before and after it. */
export function classifyMove(input: ClassifyInput): MoveClassification | undefined {
  const { before, after, uci, isBook, previous } = input;
  const top = before.lines[0];
  const afterScore = after.lines[0]?.score;
  const moved = playMove(before.fen, uci);
  if (!top || !afterScore || !moved) return undefined;

  const mover = sideToMove(before.fen);
  const bestMove = top.pv[0];
  const playedBest = bestMove === uci;
  const judgement = judgeMove({ before: top.score, after: afterScore, mover, playedBest });
  const result = (classification: Classification): MoveClassification => ({
    ...judgement,
    classification,
    bestMove,
  });

  if (moved.board.moves().length <= 1) return result('forced');
  if (isBook) return result('book');
  if (moved.boardAfter.isCheckmate()) return result('best');

  const ctx: Context = { ...moved, mover, before, after: afterScore };
  let classification = playedBest ? 'best' : byLoss(top.score, afterScore, mover, judgement.drop);
  if (playedBest && isGreat(ctx)) classification = 'great';
  if (RANK[classification] >= RANK.best && isBrilliant(ctx)) classification = 'brilliant';
  if (isMiss(classification, judgement, previous)) classification = 'miss';
  return result(classification);
}
