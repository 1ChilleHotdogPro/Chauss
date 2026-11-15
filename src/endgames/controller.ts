import { Chess } from 'chess.js';
import { pvToSan } from '../analysis/pv';
import type { GameStatus, Side } from '../game/game';
import { userSide, type EndgameDrill, type EndgamePosition } from './drills';
import { capturesOnReply, judgeMove, moveLimit, starsFor, wrongText, type SearchResult } from './judge';
import type { Search } from './search';

export type EndgameState =
  | 'your-move' // the user may move
  | 'judging' // Stockfish is checking the user's move
  | 'opponent' // the other side is about to reply
  | 'solved'
  | 'failed'
  | 'engine-failed';

export type EndgameFeedback =
  | { kind: 'none' }
  | { kind: 'good'; text: string }
  | { kind: 'wrong'; text: string; /** Stockfish's move, in engine spelling, for an arrow. */ hint: string | null }
  | { kind: 'solved'; text: string }
  | { kind: 'failed'; text: string };

export interface PositionResult {
  solved: boolean;
  stars: number;
  /** The user's moves, wrong tries not counted. */
  moves: number;
  mistakes: number;
}

export interface EndgameView {
  drill: EndgameDrill;
  index: number;
  position: EndgamePosition;
  side: Side;
  startFen: string;
  /** Every move played from the start position, both sides, in standard notation. */
  sans: readonly string[];
  fen: string;
  state: EndgameState;
  movesMade: number;
  /** 'mate' goal: the most moves allowed before the position counts as failed. */
  moveLimit: number | null;
  mistakes: number;
  feedback: EndgameFeedback;
  /** This run's result for every position (null: not finished yet). */
  results: readonly (PositionResult | null)[];
  /** True once the last position is finished and Next was pressed: show the summary. */
  runFinished: boolean;
  error: string | null;
}

export interface EndgameControllerOptions {
  drill: EndgameDrill;
  search: Search;
  /** Called after every change of the view. */
  onChange(): void;
  /** Called when a position is finished (solved or failed). */
  onResult?(position: EndgamePosition, result: PositionResult): void;
  /** Pause before the other side's reply, so the user sees their own move land. */
  wait?(ms: number): Promise<void>;
  replyDelayMs?: number;
}

const defaultWait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function statusOf(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isDraw()) return 'draw';
  return 'playing';
}

/**
 * One endgame drill: its positions one after another. In each, the user plays one side and Stockfish
 * defends with the other; every user move is judged by Stockfish (see judge.ts).
 *
 * Kept free of the page so it can be tested with a fake engine.
 */
export class EndgameController {
  private readonly drill: EndgameDrill;
  private readonly search: Search;
  private readonly options: EndgameControllerOptions;
  private index = 0;
  private chess: Chess;
  private sans: string[] = [];
  private state: EndgameState = 'your-move';
  private movesMade = 0;
  private mistakes = 0;
  private feedback: EndgameFeedback = { kind: 'none' };
  private results: (PositionResult | null)[];
  private runFinished = false;
  private error: string | null = null;
  /** Stockfish on the position the user must move in (started as soon as the turn begins). */
  private before: Promise<SearchResult> | null = null;
  /** Bumped on every restart, so the answer of an older search is ignored. */
  private generation = 0;

  constructor(options: EndgameControllerOptions) {
    this.options = options;
    this.drill = options.drill;
    this.search = options.search;
    this.results = options.drill.positions.map(() => null);
    this.chess = new Chess(this.position().fen);
  }

  private position(): EndgamePosition {
    return this.drill.positions[this.index]!;
  }

  view(): EndgameView {
    const position = this.position();
    return {
      drill: this.drill,
      index: this.index,
      position,
      side: userSide(position.fen),
      startFen: position.fen,
      sans: [...this.sans],
      fen: this.chess.fen(),
      state: this.state,
      movesMade: this.movesMade,
      moveLimit: this.drill.goal === 'mate' ? moveLimit(position.par, this.drill) : null,
      mistakes: this.mistakes,
      feedback: this.feedback,
      results: [...this.results],
      runFinished: this.runFinished,
      error: this.error,
    };
  }

  /** Start (or restart) position `index` of the drill. */
  start(index = this.index): void {
    this.generation += 1;
    this.index = Math.min(Math.max(0, index), this.drill.positions.length - 1);
    this.chess = new Chess(this.position().fen);
    this.sans = [];
    this.movesMade = 0;
    this.mistakes = 0;
    this.feedback = { kind: 'none' };
    this.runFinished = false;
    this.error = null;
    this.beginTurn();
    this.options.onChange();
  }

  retry(): void {
    this.start(this.index);
  }

  /** The next position, or the summary after the last one. */
  next(): void {
    if (this.index + 1 < this.drill.positions.length) {
      this.start(this.index + 1);
    } else {
      this.generation += 1;
      this.runFinished = true;
      this.options.onChange();
    }
  }

  /** Begin the run again from the first position, forgetting this run's results. */
  restartRun(): void {
    this.results = this.drill.positions.map(() => null);
    this.start(0);
  }

  /** Stop all work (the drill screen was left). */
  dispose(): void {
    this.generation += 1;
  }

  private beginTurn(): void {
    this.state = 'your-move';
    const before = this.search(this.chess.fen(), this.drill.judging.depth);
    // A failure is reported when the move is judged; this keeps it from being "unhandled" meanwhile.
    before.catch(() => {});
    this.before = before;
  }

  /**
   * The user's move in engine spelling ("d1d7", "e7e8q"). Returns false (and changes nothing) when it is
   * not the user's turn or the move is illegal. Resolves once the move has been judged and answered.
   */
  async play(uci: string): Promise<boolean> {
    if (this.state !== 'your-move' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return false;
    const fenBefore = this.chess.fen();
    let san: string;
    try {
      san = this.chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] }).san;
    } catch {
      return false;
    }
    const generation = this.generation;
    this.sans.push(san);
    this.state = 'judging';
    this.feedback = { kind: 'none' };
    this.options.onChange();

    try {
      const before = await this.before!;
      if (generation !== this.generation) return true;
      const statusAfter = statusOf(this.chess);
      const fenAfter = this.chess.fen();
      const after = statusAfter === 'playing' ? await this.search(fenAfter, this.drill.judging.depth) : null;
      if (generation !== this.generation) return true;

      const judgement = judgeMove({
        goal: this.drill.goal,
        slack: this.drill.judging.slack,
        before,
        statusAfter,
        after,
        replyCaptures: after ? capturesOnReply(fenAfter, after.pv) : false,
        movesMade: this.movesMade + 1,
        par: this.position().par,
      });

      if (!judgement.ok) {
        // Take the move back: the user tries again from the same position.
        this.chess.undo();
        this.sans.pop();
        this.mistakes += 1;
        const best = before.pv[0] ?? null;
        const bestSan = best ? (pvToSan(fenBefore, [best])[0] ?? null) : null;
        this.feedback = { kind: 'wrong', text: `${san}? ${wrongText(judgement.reason, this.drill.goal, bestSan)}`, hint: best };
        this.state = 'your-move';
        this.options.onChange();
        return true;
      }

      this.movesMade += 1;
      if (judgement.done) {
        this.finish(true, statusAfter === 'checkmate' ? `Checkmate with ${san}!` : 'Well held!');
        return true;
      }
      const limit = this.drill.goal === 'mate' ? moveLimit(this.position().par, this.drill) : null;
      if (limit !== null && this.movesMade >= limit) {
        this.finish(false, `Out of moves: no mate after ${this.movesMade} moves (best is mate in ${this.position().par}). Try again and push the king to the edge first.`);
        return true;
      }

      const mateLeft = after?.score?.type === 'mate' && after.score.value < 0 ? -after.score.value : null;
      this.feedback = { kind: 'good', text: mateLeft !== null ? `${san} — good. Mate in ${mateLeft} from here.` : `${san} — good.` };
      this.state = 'opponent';
      this.options.onChange();

      await (this.options.wait ?? defaultWait)(this.options.replyDelayMs ?? 400);
      if (generation !== this.generation) return true;
      const reply = after?.pv[0];
      if (!reply) {
        this.finish(false, 'Stockfish gave no reply here.');
        return true;
      }
      this.chess.move({ from: reply.slice(0, 2), to: reply.slice(2, 4), promotion: reply[4] });
      this.sans.push(this.chess.history().at(-1)!);
      const statusReply = statusOf(this.chess);
      if (statusReply === 'checkmate') {
        this.finish(false, 'You were checkmated.');
        return true;
      }
      if (statusReply !== 'playing') {
        if (this.drill.goal === 'draw') this.finish(true, 'Draw — well held!');
        else this.finish(false, 'The game ended in a draw.');
        return true;
      }
      this.beginTurn();
      this.options.onChange();
      return true;
    } catch (error) {
      if (generation !== this.generation) return true;
      this.state = 'engine-failed';
      this.error = `Stockfish could not check the move: ${error instanceof Error ? error.message : String(error)}`;
      this.options.onChange();
      return true;
    }
  }

  private finish(solved: boolean, text: string): void {
    const position = this.position();
    const result: PositionResult = {
      solved,
      stars: starsFor({ solved, mistakes: this.mistakes, moves: this.movesMade, par: position.par, drill: this.drill }),
      moves: this.movesMade,
      mistakes: this.mistakes,
    };
    this.results[this.index] = result;
    this.state = solved ? 'solved' : 'failed';
    this.feedback = { kind: solved ? 'solved' : 'failed', text };
    this.options.onResult?.(position, result);
    this.options.onChange();
  }
}
