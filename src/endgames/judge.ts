import type { UciScore } from '../engine/uci';
import type { GameStatus } from '../game/game';
import type { EndgameDrill, EndgameGoal } from './drills';

/** What Stockfish said about a position: the score for the side to move and its best line. */
export interface SearchResult {
  /** null when the position has no legal move (the game is over). */
  score: UciScore | null;
  /** Best line in engine spelling, e.g. ["d1d7", "e8f8"]. Empty when the game is over. */
  pv: string[];
}

/** 'win' goal: the user's side must stay at least this many centipawns ahead (3 pawns). */
export const WIN_CP = 300;
/** 'draw' goal: the user's side may be at most this many centipawns behind (1.5 pawns). */
export const DRAW_CP = 150;

export type WrongReason =
  | 'stalemate' // no legal move for the other side, not in check: a draw
  | 'draw' // a draw by repetition, the 50-move rule or too little material
  | 'hangs' // the other side can simply take a piece
  | 'lost' // the forced mate (or the win, or the draw) is gone
  | 'slow'; // still winning, but much slower than the best move

export type MoveJudgement =
  | { ok: true; /** The goal is reached with this move (mate, or the position is held long enough). */ done: boolean }
  | { ok: false; reason: WrongReason };

export interface JudgeInput {
  goal: EndgameGoal;
  slack: number;
  /** Stockfish on the position BEFORE the user's move (user to move). */
  before: SearchResult;
  /** The game state right AFTER the user's move. */
  statusAfter: GameStatus;
  /** Stockfish on the position after the user's move (the other side to move). Null when the game is over. */
  after: SearchResult | null;
  /** True when the other side's best reply captures a piece (see `capturesOnReply`). */
  replyCaptures: boolean;
  /** How many moves the user has made with this one, and how many the position is played for. */
  movesMade: number;
  par: number;
}

/** "Mate in N" for the side to move, or null when the score is not a mate for it. */
function mateFor(score: UciScore | null): number | null {
  return score?.type === 'mate' && score.value > 0 ? score.value : null;
}

/** Moves the side NOT to move needs to mate (from a negative mate score of the side to move). */
function mateAgainst(score: UciScore | null): number | null {
  return score?.type === 'mate' && score.value < 0 ? -score.value : null;
}

/** The user's score in centipawns after their move (the score is from the other side's view); mate = ±100000. */
function userCp(score: UciScore | null): number {
  if (!score) return 0;
  if (score.type === 'mate') return score.value < 0 ? 100_000 : -100_000;
  return -score.value;
}

/** Is the user's move right, given what Stockfish says before and after it? */
export function judgeMove(input: JudgeInput): MoveJudgement {
  const { goal, statusAfter, after } = input;

  if (statusAfter === 'checkmate') return { ok: true, done: true };
  if (statusAfter === 'stalemate' || statusAfter === 'draw') {
    if (goal === 'draw') return { ok: true, done: true };
    return { ok: false, reason: statusAfter === 'stalemate' ? 'stalemate' : 'draw' };
  }

  if (goal === 'mate') {
    const remaining = mateAgainst(after?.score ?? null);
    if (remaining === null) return { ok: false, reason: input.replyCaptures ? 'hangs' : 'lost' };
    const best = mateFor(input.before.score);
    // This move plus what is left, compared with the best move from before.
    if (best !== null && remaining + 1 > best + input.slack) return { ok: false, reason: 'slow' };
    return { ok: true, done: false };
  }

  const cp = userCp(after?.score ?? null);
  const threshold = goal === 'win' ? WIN_CP : -DRAW_CP;
  if (cp < threshold) return { ok: false, reason: input.replyCaptures ? 'hangs' : 'lost' };
  return { ok: true, done: input.movesMade >= input.par };
}

/** True when the first move of `pv` (in the position `fen`) lands on an occupied square. */
export function capturesOnReply(fen: string, pv: readonly string[]): boolean {
  const move = pv[0];
  if (!move) return false;
  const target = move.slice(2, 4);
  const rows = fen.split(' ')[0]!.split('/');
  const file = target.charCodeAt(0) - 97;
  const rank = Number(target[1]);
  const row = rows[8 - rank];
  if (!row || file < 0 || file > 7) return false;
  let column = 0;
  for (const char of row) {
    if (/\d/.test(char)) column += Number(char);
    else {
      if (column === file) return true;
      column += 1;
    }
    if (column > file) return false;
  }
  return false;
}

/** One sentence on why a move was wrong, for a beginner. `bestSan` is the move Stockfish preferred. */
export function wrongText(reason: WrongReason, goal: EndgameGoal, bestSan: string | null): string {
  const better = bestSan ? ` ${bestSan} was better.` : '';
  switch (reason) {
    case 'stalemate':
      return `Stalemate! The king has no legal move but is not in check, so the game is a draw. Always leave it a square until you can give mate.${better}`;
    case 'draw':
      return `That allows a draw (by repetition or the 50-move rule).${better}`;
    case 'hangs':
      return `That leaves a piece where it can simply be taken.${better}`;
    case 'lost':
      return goal === 'mate'
        ? `After that there is no forced mate any more.${better}`
        : goal === 'win'
          ? `That throws the win away.${better}`
          : `That loses: the draw is gone.${better}`;
    case 'slow':
      return `That still wins, but it lets the king out of the box and takes much longer.${better}`;
  }
}

/** The user's result for one position, in stars: 0 = not solved, 3 = clean and fast. */
export function starsFor(input: { solved: boolean; mistakes: number; moves: number; par: number; drill: Pick<EndgameDrill, 'goal' | 'judging'> }): number {
  if (!input.solved) return 0;
  if (input.mistakes > 0) return 1;
  if (input.drill.goal === 'mate' && input.moves > input.par + input.drill.judging.slack) return 2;
  return 3;
}

/** The most moves the user may make in a position before it counts as failed. */
export function moveLimit(par: number, drill: Pick<EndgameDrill, 'judging'>): number {
  return par + drill.judging.extraMoves;
}
