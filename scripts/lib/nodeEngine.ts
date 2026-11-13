import { spawn, type ChildProcess } from 'node:child_process';
import { sideToMove, toWhiteScore, type Score } from '../../src/analysis/eval';
import { Engine, type Transport } from '../../src/engine/engine';
import type { UciScore } from '../../src/engine/uci';

/**
 * Runs the Stockfish file from public/engine/ as a separate Node process — the same engine the
 * browser uses, driven by the same Engine class.
 */
export function createNodeTransport(enginePath: string): Transport & { child: ChildProcess } {
  const child = spawn(process.execPath, [enginePath], { stdio: ['pipe', 'pipe', 'pipe'] });
  let onLine: (line: string) => void = () => {};
  let onError: (message: string) => void = () => {};
  let buffer = '';

  child.stdout.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let index: number;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (line) onLine(line);
    }
  });
  child.stderr.on('data', (chunk: Buffer) => onError(chunk.toString().slice(0, 300)));
  child.on('error', (error) => onError(error.message));

  return {
    child,
    post: (command) => {
      child.stdin.write(`${command}\n`);
    },
    onLine: (handler) => {
      onLine = handler;
    },
    onError: (handler) => {
      onError = handler;
    },
    terminate: () => {
      child.kill();
    },
  };
}

export interface Evaluator {
  /** Resolves with the engine's own name once it is ready. */
  ready(): Promise<string>;
  /** Stockfish's score for a position at the fixed depth, from White's point of view. */
  evaluate(fen: string): Promise<Score>;
  /** The same, together with the engine's best line (moves in engine spelling). */
  evaluateLine(fen: string): Promise<{ score: Score; pv: string[] }>;
  close(): void;
}

/** One position at a time, to a fixed depth, best line only. */
export function createEvaluator(enginePath: string, depth: number): Evaluator {
  let failure: string | null = null;
  let whenReady: { resolve: (name: string) => void; reject: (error: Error) => void } | null = null;
  const engine = new Engine(createNodeTransport(enginePath), {
    multiPv: 1,
    onStateChange: (state) => {
      if (state === 'ready') whenReady?.resolve(engine.name());
      if (state === 'failed') {
        failure = engine.error() || 'the engine stopped';
        whenReady?.reject(new Error(failure));
      }
    },
  });

  const evaluateLine = (fen: string): Promise<{ score: Score; pv: string[] }> =>
    new Promise((resolve, reject) => {
      if (failure) {
        reject(new Error(failure));
        return;
      }
      let last: { score: UciScore; pv: string[] } | null = null;
      engine.analyse({
        fen,
        depth,
        onInfo: (info) => {
          if (info.multipv === 1) last = { score: info.score, pv: info.pv };
        },
        onDone: () => {
          if (last) resolve({ score: toWhiteScore(last.score, sideToMove(fen)), pv: last.pv });
          else reject(new Error(`the engine gave no score for ${fen}`));
        },
      });
    });

  return {
    ready: () =>
      new Promise((resolve, reject) => {
        if (engine.state() === 'ready') resolve(engine.name());
        else if (engine.state() === 'failed') reject(new Error(engine.error()));
        else whenReady = { resolve, reject };
      }),
    evaluate: async (fen) => (await evaluateLine(fen)).score,
    evaluateLine,
    close: () => engine.dispose(),
  };
}
