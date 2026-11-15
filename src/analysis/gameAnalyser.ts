import { Chess } from 'chess.js';
import type { Side } from '../game/game';
import type { AnalysisEngine, EvalLine, PositionEval } from './analysis';
import type { BookLookup } from './book';
import { classifyMove, type MoveClassification } from './classify';
import { sideToMove, toWhiteScore } from './eval';

/** How long the engine looks at each position: to a fixed depth, or for a fixed time. */
export type SearchLimit = { kind: 'depth'; depth: number } | { kind: 'time'; ms: number };

/** One move of the game to analyse. */
export interface GameMove {
  san: string;
  /** Engine spelling ("g1f3"). */
  uci: string;
  fenAfter: string;
}

export interface AnalysedMove extends MoveClassification {
  /** 1 = the first move of the game. */
  ply: number;
  san: string;
  uci: string;
  color: Side;
  fenBefore: string;
  fenAfter: string;
}

export interface GameReport {
  /** positions[i] is the position after move i (positions[0] the start); undefined until searched. */
  positions: (PositionEval | undefined)[];
  /** moves[i] is move i + 1, undefined until both of its positions are searched. */
  moves: (AnalysedMove | undefined)[];
  /** Positions searched so far, out of `total`. */
  done: number;
  total: number;
}

export type AnalysisOutcome = 'done' | 'cancelled';

/** The engine reports the best two moves, so an only move ("great") can be recognised. */
const MULTI_PV = 2;
/** Depth sent along with a timed search; the time limit decides. */
const TIMED_DEPTH = 99;

/** The result for a finished game (mate or a dead draw), so the engine needn't look at it. */
function finishedPosition(fen: string): PositionEval | undefined {
  let board: Chess;
  try {
    board = new Chess(fen);
  } catch {
    return undefined;
  }
  if (board.isCheckmate()) {
    const loser = sideToMove(fen);
    const line: EvalLine = { score: { type: 'mate', winner: loser === 'white' ? 'black' : 'white', moves: 0 }, pv: [] };
    return { fen, depth: 0, lines: [line], terminal: true };
  }
  if (board.isStalemate() || board.isInsufficientMaterial()) {
    return { fen, depth: 0, lines: [{ score: { type: 'cp', value: 0 }, pv: [] }], terminal: true };
  }
  return undefined;
}

/**
 * Analyses a whole game, one position at a time, and classifies each move as soon as the
 * positions before and after it are known. Cancel at any time.
 */
export class GameAnalyser {
  private run = 0;
  private cancelRun: (() => void) | null = null;

  constructor(
    private readonly engine: AnalysisEngine,
    private readonly limit: SearchLimit,
  ) {}

  /** True while an analysis is in progress. */
  running(): boolean {
    return this.cancelRun !== null;
  }

  /**
   * Analyse the game from `startFen` through `moves`. `onProgress` is called after every position
   * with the report so far (a fresh object each time). Starting again cancels the previous run.
   */
  start(
    startFen: string,
    moves: readonly GameMove[],
    book: BookLookup,
    onProgress: (report: GameReport) => void,
  ): Promise<AnalysisOutcome> {
    this.cancel();
    const run = ++this.run;
    const fens = [startFen, ...moves.map((move) => move.fenAfter)];
    let report: GameReport = {
      positions: fens.map(() => undefined),
      moves: moves.map(() => undefined),
      done: 0,
      total: fens.length,
    };
    let inBook = true;

    return new Promise<AnalysisOutcome>((resolve) => {
      this.cancelRun = () => {
        this.cancelRun = null;
        this.engine.stop();
        resolve('cancelled');
      };

      const classifyUpTo = (index: number, positions: GameReport['positions'], analysed: GameReport['moves']) => {
        // Move `index` (1-based) leads from positions[index - 1] to positions[index].
        const before = positions[index - 1];
        const after = positions[index];
        const move = moves[index - 1];
        if (!before || !after || !move) return;
        const fenBefore = fens[index - 1]!;
        inBook = inBook && book.isBook(fenBefore, move.uci);
        const prev = analysed[index - 2];
        const classified = classifyMove({
          before,
          after,
          uci: move.uci,
          isBook: inBook,
          previous: prev ? { classification: prev.classification, winBefore: prev.winBefore } : undefined,
        });
        if (classified) {
          analysed[index - 1] = {
            ...classified,
            ply: index,
            san: move.san,
            uci: move.uci,
            color: sideToMove(fenBefore),
            fenBefore,
            fenAfter: move.fenAfter,
          };
        }
      };

      const store = (index: number, evaluation: PositionEval) => {
        const positions = [...report.positions];
        const analysed = [...report.moves];
        positions[index] = evaluation;
        if (index > 0) classifyUpTo(index, positions, analysed);
        report = { positions, moves: analysed, done: index + 1, total: fens.length };
        onProgress(report);
      };

      const searchFrom = (index: number) => {
        if (run !== this.run || this.cancelRun === null) return;
        if (index >= fens.length) {
          this.cancelRun = null;
          resolve('done');
          return;
        }
        const fen = fens[index]!;
        const finished = finishedPosition(fen);
        if (finished) {
          store(index, finished);
          searchFrom(index + 1);
          return;
        }
        const mover = sideToMove(fen);
        const lines = new Map<number, EvalLine>();
        let depth = 0;
        this.engine.analyse({
          fen,
          depth: this.limit.kind === 'depth' ? this.limit.depth : TIMED_DEPTH,
          movetime: this.limit.kind === 'time' ? this.limit.ms : undefined,
          multiPv: MULTI_PV,
          onInfo: (info) => {
            if (run !== this.run) return;
            depth = Math.max(depth, info.depth);
            lines.set(info.multipv, { score: toWhiteScore(info.score, mover), pv: info.pv });
          },
          onDone: () => {
            if (run !== this.run || this.cancelRun === null) return;
            const sorted = [...lines.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line);
            store(index, { fen, depth, lines: sorted, terminal: sorted.length === 0 });
            searchFrom(index + 1);
          },
        });
      };

      searchFrom(0);
    });
  }

  /** Stop the analysis in progress (its promise resolves as 'cancelled'). */
  cancel(): void {
    this.cancelRun?.();
  }
}
