// Runs the real Stockfish file from public/engine/ under Node and drives it with the same
// Engine and Analysis classes the browser uses. Proves the committed engine file works and that
// our reading of its output matches what it really sends.
//
// Plain JavaScript on purpose: it needs Node's child_process, and the project has no Node type
// definitions installed.
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { afterEach, describe, expect, it } from 'vitest';
import { createEvaluator, createNodeTransport as startEngine } from '../../scripts/lib/nodeEngine.ts';
import { Analysis } from '../../src/analysis/analysis.ts';
import { Engine } from '../../src/engine/engine.ts';
import { ENGINE_FILE } from '../../src/engine/workerTransport.ts';
import { Game } from '../../src/game/game.ts';

const enginePath = fileURLToPath(new URL(`../../public/${ENGINE_FILE}`, import.meta.url));
const children = [];

/** The engine as a child process (the launcher the snapshot script uses), remembered for clean-up. */
function createNodeTransport() {
  const transport = startEngine(enginePath);
  children.push(transport.child);
  return transport;
}

function waitFor(check, what, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    const started = Date.now();
    const timer = setInterval(() => {
      const value = check();
      if (value) {
        clearInterval(timer);
        resolve(value);
      } else if (Date.now() - started > timeoutMs) {
        clearInterval(timer);
        reject(new Error(`timed out waiting for ${what}`));
      }
    }, 10);
  });
}

afterEach(() => {
  for (const child of children.splice(0)) child.kill();
});

describe('the committed Stockfish file, run for real', () => {
  it('starts up and introduces itself', async () => {
    const engine = new Engine(createNodeTransport(), { multiPv: 3 });
    await waitFor(() => engine.state() !== 'loading', 'the engine to start');
    expect(engine.error()).toBe('');
    expect(engine.state()).toBe('ready');
    expect(engine.name()).toMatch(/^Stockfish 19/);
  });

  it('returns a legal best move and three lines for the start position', async () => {
    const engine = new Engine(createNodeTransport(), { multiPv: 3 });
    const infos = [];
    let best;
    engine.analyse({
      fen: new Chess().fen(),
      depth: 10,
      onInfo: (info) => infos.push(info),
      onDone: (move) => {
        best = move;
      },
    });
    await waitFor(() => best !== undefined, 'a best move');

    const legal = new Chess().moves({ verbose: true }).map((m) => m.from + m.to);
    expect(legal).toContain(best);

    const deepest = infos.filter((info) => info.depth === 10);
    expect(deepest.map((info) => info.multipv)).toEqual([1, 2, 3]);
    for (const info of deepest) {
      expect(legal).toContain(info.pv[0]);
      // The start position is roughly equal: no engine thinks either side is a pawn up.
      expect(info.score.type).toBe('cp');
      expect(Math.abs(info.score.value)).toBeLessThan(100);
    }
  });

  it('finds the mate after 3...Nf6?? and the analysis calls the move a blunder', async () => {
    const game = new Game();
    // 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? allows 4.Qxf7#
    const moves = ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'f1c4', 'g8f6'];
    for (const move of moves) {
      if (!game.play(move.slice(0, 2), move.slice(2, 4))) throw new Error(`setup: ${move} rejected`);
    }
    const fens = [game.startFen, ...game.history().map((m) => m.fenAfter)];

    const engine = new Engine(createNodeTransport(), { multiPv: 3 });
    const analysis = new Analysis(engine, { verdictDepth: 10, maxDepth: 12, multiPv: 3 });
    analysis.setLine(fens, moves, 6);

    const blunder = await waitFor(() => analysis.judgement(6), 'a verdict for Nf6');
    expect(blunder.verdict).toBe('blunder');
    expect(blunder.note).toEqual({ kind: 'allows-mate', moves: 1 });
    expect(blunder.winAfter).toBe(0);
    expect(blunder.bestMove).not.toBe('g8f6');

    const current = analysis.current();
    expect(current.lines[0].score).toEqual({ type: 'mate', winner: 'white', moves: 1 });
    expect(current.lines[0].pv[0]).toBe('h5f7');

    // The sensible opening moves before it are not criticised.
    await waitFor(() => !analysis.busy(), 'the whole line to be analysed');
    for (const ply of [1, 2]) {
      expect(['best', 'good']).toContain(analysis.judgement(ply).verdict);
    }
  });

  it('the snapshot evaluator scores positions from White\'s point of view', async () => {
    const evaluator = createEvaluator(enginePath, 10);
    try {
      expect(await evaluator.ready()).toMatch(/^Stockfish 19/);
      // White to move and mating in one.
      expect(await evaluator.evaluate('r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4')).toEqual({
        type: 'mate',
        winner: 'white',
        moves: 1,
      });
      // Black to move, a queen down: clearly winning for White, so a large positive score.
      const queenUp = await evaluator.evaluate('rnb1kbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1');
      expect(queenUp.type).toBe('cp');
      expect(queenUp.value).toBeGreaterThan(500);
      // Checkmate already on the board, Black to move: White has won.
      expect(await evaluator.evaluate('r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4')).toEqual({
        type: 'mate',
        winner: 'white',
        moves: 0,
      });
    } finally {
      evaluator.close();
    }
  });

  it('recognises a checkmate on the board as a finished game', async () => {
    const mated = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    const engine = new Engine(createNodeTransport(), { multiPv: 3 });
    const analysis = new Analysis(engine, { verdictDepth: 10, maxDepth: 12, multiPv: 3 });
    analysis.setLine([mated], [], 0);
    await waitFor(() => !analysis.busy(), 'the analysis to finish');
    expect(analysis.current().terminal).toBe(true);
    expect(analysis.current().lines[0].score).toEqual({ type: 'mate', winner: 'white', moves: 0 });
  });
});
