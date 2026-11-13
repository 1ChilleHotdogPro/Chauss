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
  /** Depth for extra positions asked for with setExtras (refutations). */
  extraDepth?: number;
  /** Depth of the search that ranks every legal move (setRanking). */
  rankDepth?: number;
  /** How many lines the engine reports for a normal search. */
  multiPv?: number;
  /** Called whenever a result changed. */
  onUpdate?: () => void;
}

interface Entry {
  eval: PositionEval;
  /** Deepest search of this position that ran to the end. */
  completedDepth: number;
}

/**
 * - main: a normal search (the engine's few best lines)
 * - rank: one search that scores every legal move (a very large MultiPV)
 */
type TargetKind = 'main' | 'rank';

interface Target {
  fen: string;
  depth: number;
  kind: TargetKind;
}

/** Larger than the number of legal moves in any chess position, so every move is reported. */
const ALL_MOVES = 256;

/**
 * Decides what the engine should look at next, remembers the results per position, and turns
 * them into verdicts for the moves of the game.
 *
 * Order of work:
 *   1. the position on the board, quickly, to verdict depth;
 *   2. a ranking of every legal move, if one was asked for;
 *   3. extra positions that were asked for (refutations of bad moves);
 *   4. the other positions of the line that still lack a result, nearest first;
 *   5. the position on the board again, deeper.
 */
export class Analysis {
  readonly verdictDepth: number;
  readonly maxDepth: number;
  readonly extraDepth: number;
  readonly rankDepth: number;
  private readonly multiPv: number;
  private readonly onUpdate: () => void;

  private readonly cache = new Map<string, Entry>();
  private readonly rankCache = new Map<string, Entry>();
  private readonly judgements = new Map<string, MoveJudgement>();

  private fens: string[] = [];
  private moves: string[] = [];
  private ply = 0;
  private extras: string[] = [];
  private rankFen: string | null = null;

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
    this.extraDepth = options.extraDepth ?? 16;
    this.rankDepth = options.rankDepth ?? 12;
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

  /**
   * Positions outside the line that should be searched too (to `extraDepth`), most wanted first —
   * e.g. the position after a bad move, to find its refutation. Replaces the previous list.
   */
  setExtras(fens: readonly string[]): void {
    if (fens.length === this.extras.length && fens.every((fen, index) => fen === this.extras[index])) return;
    this.extras = [...fens];
    this.schedule();
  }

  /** Ask for (or, with null, cancel) a ranking of every legal move in a position. */
  setRanking(fen: string | null): void {
    if (fen === this.rankFen) return;
    this.rankFen = fen;
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

  /** True once `fen` has been searched to at least `depth` (or the game is over there). */
  isReady(fen: string, depth: number): boolean {
    return this.reached({ fen, depth, kind: 'main' });
  }

  /**
   * Every legal move of a position with its score, best first — available once the ranking search
   * asked for with setRanking has finished; undefined until then.
   */
  ranking(fen: string): PositionEval | undefined {
    return this.reached({ fen, depth: this.rankDepth, kind: 'rank' }) ? this.rankCache.get(fen)?.eval : undefined;
  }

  /** True while the engine still has work to do. */
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

    if (!this.isReady(before, this.verdictDepth) || !this.isReady(after, this.verdictDepth)) return undefined;
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

  private store(kind: TargetKind): Map<string, Entry> {
    return kind === 'rank' ? this.rankCache : this.cache;
  }

  private reached(target: Target): boolean {
    const entry = this.store(target.kind).get(target.fen);
    return entry !== undefined && entry.completedDepth >= target.depth;
  }

  private nextTarget(): Target | null {
    const candidates: Target[] = [];
    const current = this.fens[this.ply];
    if (current !== undefined) candidates.push({ fen: current, depth: this.verdictDepth, kind: 'main' });
    if (this.rankFen !== null) candidates.push({ fen: this.rankFen, depth: this.rankDepth, kind: 'rank' });
    for (const fen of this.extras) candidates.push({ fen, depth: this.extraDepth, kind: 'main' });

    // The rest of the line, nearest to the current position first (the move just played matters most).
    for (let distance = 1; distance < this.fens.length; distance++) {
      for (const index of [this.ply - distance, this.ply + distance]) {
        const fen = this.fens[index];
        if (fen !== undefined) candidates.push({ fen, depth: this.verdictDepth, kind: 'main' });
      }
    }
    if (current !== undefined) candidates.push({ fen: current, depth: this.maxDepth, kind: 'main' });

    return candidates.find((target) => !this.reached(target)) ?? null;
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
    const running = this.running;
    if (running && running.fen === target.fen && running.depth === target.depth && running.kind === target.kind) return;
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
      multiPv: target.kind === 'rank' ? ALL_MOVES : this.multiPv,
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
    // A normal search reports a known number of lines: publish as soon as they are all in.
    // A ranking has as many lines as there are legal moves: publish when the depth is over.
    if (target.kind === 'main' && this.batch.size >= this.multiPv) this.commitBatch(target);
  }

  private handleDone(target: Target, bestMove: string | null): void {
    this.commitBatch(target);
    const store = this.store(target.kind);
    let entry = store.get(target.fen);
    if (!entry) {
      // The engine finished without reporting anything; remember that so we do not ask forever.
      entry = { eval: { fen: target.fen, depth: 0, lines: [], terminal: false }, completedDepth: 0 };
      store.set(target.fen, entry);
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

    const store = this.store(target.kind);
    const entry = store.get(target.fen);
    if (entry && entry.eval.depth > depth) return;
    if (entry && entry.eval.depth === depth && entry.eval.lines.length > lines.length) return;

    const evaluation: PositionEval = { fen: target.fen, depth, lines, terminal: entry?.eval.terminal ?? false };
    store.set(target.fen, { eval: evaluation, completedDepth: entry?.completedDepth ?? -1 });
    this.onUpdate();
  }
}
