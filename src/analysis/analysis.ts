import type { AnalyseRequest } from '../engine/engine';
import type { InfoLine } from '../engine/uci';
import { judgeMove, sideToMove, toWhiteScore, type Judgement, type Score } from './eval';

/** One of the engine's candidate lines for a position. */
export interface EvalLine {
  /** Score from White's point of view. */
  score: Score;
  /** The expected moves in engine spelling ("g1f3"). Empty when the game is over. */
  pv: string[];
}

export interface PositionEval {
  fen: string;
  /** Search depth the lines come from. */
  depth: number;
  /** Best line first. */
  lines: EvalLine[];
  /** True when the side to move has no legal move (checkmate or stalemate). */
  terminal: boolean;
}

export interface MoveJudgement extends Judgement {
  /** The engine's first choice in the position before the move, in engine spelling. */
  bestMove: string | undefined;
}

/** The part of the engine the analysis needs (the real Engine, or a fake in tests). */
export interface AnalysisEngine {
  analyse(request: AnalyseRequest): void;
  stop(): void;
}

export interface AnalysisOptions {
  /** Depth every position of the line is searched to; verdicts are based on it. */
  verdictDepth?: number;
  /** Depth the position on the board is deepened to afterwards. */
  maxDepth?: number;
  /** How many lines the engine reports (must match the engine's MultiPV setting). */
  multiPv?: number;
  /** Called whenever a result changed. */
  onUpdate?: () => void;
}

interface Entry {
  eval: PositionEval;
  /** Deepest search of this position that ran to the end. */
  completedDepth: number;
}

interface Target {
  fen: string;
  depth: number;
}

/**
 * Decides what the engine should look at next, remembers the results per position, and turns
 * them into verdicts for the moves of the game.
 *
 * Order of work: first the position on the board (quickly, to verdict depth), then the other
 * positions of the line that still lack a result (nearest first), then the position on the board
 * again, deeper.
 */
export class Analysis {
  readonly verdictDepth: number;
  readonly maxDepth: number;
  private readonly multiPv: number;
  private readonly onUpdate: () => void;

  private readonly cache = new Map<string, Entry>();
  private readonly judgements = new Map<string, MoveJudgement>();

  private fens: string[] = [];
  private moves: string[] = [];
  private ply = 0;

  private running: Target | null = null;
  private batchDepth = -1;
  private batch = new Map<number, EvalLine>();
  /** True when the batch holds lines that have not been stored yet. */
  private batchDirty = false;

  constructor(
    private readonly engine: AnalysisEngine,
    options: AnalysisOptions = {},
  ) {
    this.verdictDepth = options.verdictDepth ?? 12;
    this.maxDepth = Math.max(options.maxDepth ?? 20, this.verdictDepth);
    this.multiPv = options.multiPv ?? 3;
    this.onUpdate = options.onUpdate ?? (() => {});
  }

  /**
   * Tell the analysis what is on screen.
   * @param fens  positions of the line: fens[0] is the start, fens[i] the position after move i
   * @param moves the moves in engine spelling; moves[i] leads from fens[i] to fens[i + 1]
   * @param ply   index into `fens` of the position being shown
   */
  setLine(fens: readonly string[], moves: readonly string[], ply: number): void {
    this.fens = [...fens];
    this.moves = [...moves];
    this.ply = Math.max(0, Math.min(ply, this.fens.length - 1));
    this.schedule();
  }

  /** The best result so far for the position on the board. */
  current(): PositionEval | undefined {
    const fen = this.fens[this.ply];
    return fen === undefined ? undefined : this.cache.get(fen)?.eval;
  }

  evalFor(fen: string): PositionEval | undefined {
    return this.cache.get(fen)?.eval;
  }

  /** True while the engine still has work to do for the current line. */
  busy(): boolean {
    return this.running !== null;
  }

  /**
   * The verdict for move number `ply` of the line (1 = the first move), or undefined while the
   * positions before and after it have not both been searched to verdict depth.
   * Once given, a verdict does not change, so marks do not flicker as the search deepens.
   */
  judgement(ply: number): MoveJudgement | undefined {
    const before = this.fens[ply - 1];
    const after = this.fens[ply];
    const move = this.moves[ply - 1];
    if (before === undefined || after === undefined || move === undefined) return undefined;

    const key = `${before}|${move}`;
    const known = this.judgements.get(key);
    if (known) return known;

    if (!this.reached(before, this.verdictDepth) || !this.reached(after, this.verdictDepth)) return undefined;
    const bestBefore = this.cache.get(before)?.eval.lines[0];
    const bestAfter = this.cache.get(after)?.eval.lines[0];
    if (!bestBefore || !bestAfter) return undefined;

    const bestMove = bestBefore.pv[0];
    const judgement: MoveJudgement = {
      ...judgeMove({
        before: bestBefore.score,
        after: bestAfter.score,
        mover: sideToMove(before),
        playedBest: bestMove === move,
      }),
      bestMove,
    };
    this.judgements.set(key, judgement);
    return judgement;
  }

  private reached(fen: string, depth: number): boolean {
    const entry = this.cache.get(fen);
    return entry !== undefined && entry.completedDepth >= depth;
  }

  private nextTarget(): Target | null {
    const current = this.fens[this.ply];
    if (current === undefined) return null;
    if (!this.reached(current, this.verdictDepth)) return { fen: current, depth: this.verdictDepth };

    // The rest of the line, nearest to the current position first (the move just played matters most).
    for (let distance = 1; distance < this.fens.length; distance++) {
      for (const index of [this.ply - distance, this.ply + distance]) {
        const fen = this.fens[index];
        if (fen !== undefined && !this.reached(fen, this.verdictDepth)) return { fen, depth: this.verdictDepth };
      }
    }

    if (!this.reached(current, this.maxDepth)) return { fen: current, depth: this.maxDepth };
    return null;
  }

  private schedule(): void {
    const target = this.nextTarget();
    if (!target) {
      if (this.running) {
        this.running = null;
        this.engine.stop();
      }
      return;
    }
    if (this.running && this.running.fen === target.fen && this.running.depth === target.depth) return;
    this.start(target);
  }

  private start(target: Target): void {
    this.running = target;
    this.batchDepth = -1;
    this.batch = new Map();
    this.batchDirty = false;
    const mover = sideToMove(target.fen);

    this.engine.analyse({
      fen: target.fen,
      depth: target.depth,
      onInfo: (info) => {
        if (this.running === target) this.handleInfo(target, mover, info);
      },
      onDone: (bestMove) => {
        if (this.running === target) this.handleDone(target, bestMove);
      },
    });
  }

  private handleInfo(target: Target, mover: 'white' | 'black', info: InfoLine): void {
    if (info.depth !== this.batchDepth) {
      // A new depth begins: whatever was collected for the previous one is complete.
      this.commitBatch(target);
      this.batchDepth = info.depth;
      this.batch = new Map();
    }
    this.batch.set(info.multipv, { score: toWhiteScore(info.score, mover), pv: info.pv });
    this.batchDirty = true;
    if (this.batch.size >= this.multiPv) this.commitBatch(target);
  }

  private handleDone(target: Target, bestMove: string | null): void {
    this.commitBatch(target);
    let entry = this.cache.get(target.fen);
    if (!entry) {
      // The engine finished without reporting anything; remember that so we do not ask forever.
      entry = { eval: { fen: target.fen, depth: 0, lines: [], terminal: false }, completedDepth: 0 };
      this.cache.set(target.fen, entry);
    }
    if (bestMove === null) {
      entry.eval = { ...entry.eval, terminal: true };
      entry.completedDepth = Infinity; // nothing more to find in a finished game
    } else {
      entry.completedDepth = Math.max(entry.completedDepth, target.depth);
    }
    this.running = null;
    this.schedule();
    this.onUpdate();
  }

  /** Store the lines collected for one depth, unless a deeper result is already known. */
  private commitBatch(target: Target): void {
    if (!this.batchDirty) return;
    this.batchDirty = false;
    const lines = [...this.batch.entries()].sort((a, b) => a[0] - b[0]).map(([, line]) => line);
    const depth = this.batchDepth;

    const entry = this.cache.get(target.fen);
    if (entry && entry.eval.depth > depth) return;
    if (entry && entry.eval.depth === depth && entry.eval.lines.length > lines.length) return;

    const evaluation: PositionEval = { fen: target.fen, depth, lines, terminal: entry?.eval.terminal ?? false };
    this.cache.set(target.fen, { eval: evaluation, completedDepth: entry?.completedDepth ?? -1 });
    this.onUpdate();
  }
}
