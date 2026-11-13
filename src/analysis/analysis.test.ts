import { describe, expect, it } from 'vitest';
import type { AnalyseRequest } from '../engine/engine';
import type { UciScore } from '../engine/uci';
import { Analysis, type AnalysisEngine } from './analysis';

// 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? (allows 4.Qxf7#)
const F0 = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const F1 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const F2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
const F3 = 'rnbqkbnr/pppp1ppp/8/4p2Q/4P3/8/PPPP1PPP/RNB1KBNR b KQkq - 1 2';
const FENS = [F0, F1, F2, F3];
const MOVES = ['e2e4', 'e7e5', 'd1h5'];

/** A scripted engine: the test sees each request and answers it by hand. */
class FakeEngine implements AnalysisEngine {
  requests: AnalyseRequest[] = [];
  stops = 0;

  analyse(request: AnalyseRequest): void {
    this.requests.push(request);
  }

  stop(): void {
    this.stops += 1;
  }

  get last(): AnalyseRequest {
    const request = this.requests.at(-1);
    if (!request) throw new Error('no request was made');
    return request;
  }

  /** What has been asked for so far, as "position-name@depth". */
  asked(): string[] {
    const names = new Map(FENS.map((fen, index) => [fen, `F${index}`]));
    return this.requests.map((r) => `${names.get(r.fen) ?? r.fen}@${r.depth}`);
  }

  /** Answer the newest request: one set of lines at `depth`, then finish. */
  answer(
    lines: { score: UciScore; pv: string[] }[],
    options: { depth?: number; finish?: boolean; bestMove?: string | null } = {},
  ): void {
    const request = this.last;
    const depth = options.depth ?? request.depth;
    lines.forEach((line, index) =>
      request.onInfo({ depth, multipv: index + 1, score: line.score, pv: line.pv }),
    );
    if (options.finish !== false) {
      request.onDone(options.bestMove === undefined ? (lines[0]?.pv[0] ?? null) : options.bestMove);
    }
  }
}

const cp = (value: number): UciScore => ({ type: 'cp', value });
const three = (best: string, score: UciScore) => [
  { score, pv: [best] },
  { score: cp(-500), pv: ['a2a3'] },
  { score: cp(-600), pv: ['h2h3'] },
];

function setup(options: { verdictDepth?: number; maxDepth?: number } = {}) {
  const engine = new FakeEngine();
  let updates = 0;
  const analysis = new Analysis(engine, {
    verdictDepth: options.verdictDepth ?? 12,
    maxDepth: options.maxDepth ?? 20,
    multiPv: 3,
    onUpdate: () => {
      updates += 1;
    },
  });
  return { engine, analysis, updates: () => updates };
}

describe('what gets analysed, and in which order', () => {
  it('starts with the position on the board at verdict depth', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    expect(engine.asked()).toEqual(['F0@12']);
    expect(analysis.busy()).toBe(true);
  });

  it('then deepens the position on the board, then stops', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    expect(engine.asked()).toEqual(['F0@12', 'F0@20']);
    engine.answer(three('e2e4', cp(28)));
    expect(engine.asked()).toEqual(['F0@12', 'F0@20']);
    expect(analysis.busy()).toBe(false);
  });

  it('fills in the other positions of the line, nearest first, before deepening', () => {
    const { engine, analysis } = setup();
    analysis.setLine(FENS, MOVES, 3);
    engine.answer(three('b8c6', cp(-20))); // F3 (on the board)
    engine.answer(three('g1f3', cp(25))); // F2 (just before it)
    engine.answer(three('e7e5', cp(-30))); // F1
    engine.answer(three('e2e4', cp(30))); // F0
    expect(engine.asked()).toEqual(['F3@12', 'F2@12', 'F1@12', 'F0@12', 'F3@20']);
  });

  it('looks both ways when the position shown is in the middle of the line', () => {
    const { engine, analysis } = setup();
    analysis.setLine(FENS, MOVES, 1);
    engine.answer(three('e7e5', cp(-30)));
    engine.answer(three('e2e4', cp(30)));
    engine.answer(three('g1f3', cp(25)));
    engine.answer(three('b8c6', cp(-20)));
    expect(engine.asked()).toEqual(['F1@12', 'F0@12', 'F2@12', 'F3@12', 'F1@20']);
  });

  it('does not restart a search when told the same thing again', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    analysis.setLine([F0], [], 0);
    analysis.setLine([F0], [], 0);
    expect(engine.asked()).toEqual(['F0@12']);
  });

  it('switches to the new position when a move is played mid-search', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    analysis.setLine([F0, F1], ['e2e4'], 1);
    expect(engine.asked()).toEqual(['F0@12', 'F1@12']);

    // A late answer to the abandoned search is ignored.
    engine.requests[0]!.onInfo({ depth: 12, multipv: 1, score: cp(99), pv: ['a2a3'] });
    engine.requests[0]!.onDone('a2a3');
    expect(analysis.evalFor(F0)).toBeUndefined();
    expect(engine.asked()).toEqual(['F0@12', 'F1@12']);
  });

  it('reuses results when stepping back and forth', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0, F1], ['e2e4'], 1);
    engine.answer(three('e7e5', cp(-30)));
    engine.answer(three('e2e4', cp(30)));
    expect(engine.asked()).toEqual(['F1@12', 'F0@12']);

    analysis.setLine([F0, F1], ['e2e4'], 0);
    analysis.setLine([F0, F1], ['e2e4'], 1);
    analysis.setLine([F0, F1], ['e2e4'], 0);
    expect(engine.asked()).toEqual(['F1@12', 'F0@12']);
    expect(analysis.current()?.lines[0]?.pv).toEqual(['e2e4']);
  });

  it('stops the engine when the line changes to one that is fully known', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    analysis.setLine([F0, F1], ['e2e4'], 1); // F1 search starts
    expect(engine.stops).toBe(0);
    analysis.setLine([F0], [], 0); // back to a line with nothing left to do
    expect(engine.stops).toBe(1);
    expect(analysis.busy()).toBe(false);
  });
});

describe('collecting results', () => {
  it("converts scores to White's point of view", () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0, F1], ['e2e4'], 1); // Black to move in F1
    engine.answer(three('e7e5', cp(-30)), { finish: false });
    expect(analysis.current()?.lines[0]).toEqual({ score: { type: 'cp', value: 30 }, pv: ['e7e5'] });
    expect(analysis.current()?.lines[1]?.score).toEqual({ type: 'cp', value: 500 });
  });

  it('publishes a depth once all its lines are in, and notifies', () => {
    const { engine, analysis, updates } = setup();
    analysis.setLine([F0], [], 0);
    const request = engine.last;

    request.onInfo({ depth: 5, multipv: 1, score: cp(20), pv: ['e2e4'] });
    request.onInfo({ depth: 5, multipv: 2, score: cp(15), pv: ['d2d4'] });
    expect(analysis.current()).toBeUndefined(); // still waiting for the third line
    request.onInfo({ depth: 5, multipv: 3, score: cp(10), pv: ['g1f3'] });

    expect(analysis.current()?.depth).toBe(5);
    expect(analysis.current()?.lines.map((l) => l.pv[0])).toEqual(['e2e4', 'd2d4', 'g1f3']);
    expect(updates()).toBe(1);
  });

  it('publishes a depth with fewer lines when the next depth starts (few legal moves)', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    const request = engine.last;
    request.onInfo({ depth: 5, multipv: 1, score: cp(20), pv: ['e2e4'] });
    expect(analysis.current()).toBeUndefined();
    request.onInfo({ depth: 6, multipv: 1, score: cp(22), pv: ['e2e4'] });
    expect(analysis.current()?.depth).toBe(5);
    request.onDone('e2e4');
    expect(analysis.current()?.depth).toBe(6);
  });

  it('keeps the deeper result while a new search starts again from depth 1', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30))); // depth 12 done, deepening to 20 begins
    engine.answer(three('a2a3', cp(-10)), { depth: 3, finish: false });
    expect(analysis.current()?.depth).toBe(12);
    expect(analysis.current()?.lines[0]?.pv).toEqual(['e2e4']);

    engine.answer(three('d2d4', cp(33)), { depth: 13, finish: false });
    expect(analysis.current()?.depth).toBe(13);
    expect(analysis.current()?.lines[0]?.pv).toEqual(['d2d4']);
  });

  it('marks a finished game and never asks about it again', () => {
    const { engine, analysis } = setup();
    const mated = 'r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 0 4';
    analysis.setLine([mated], [], 0);
    // What the real engine sends for a checkmated side.
    engine.last.onInfo({ depth: 0, multipv: 1, score: { type: 'mate', value: 0 }, pv: [] });
    engine.last.onDone(null);

    expect(analysis.current()).toEqual({
      fen: mated,
      depth: 0,
      lines: [{ score: { type: 'mate', winner: 'white', moves: 0 }, pv: [] }],
      terminal: true,
    });
    expect(engine.requests).toHaveLength(1);
    expect(analysis.busy()).toBe(false);
  });

  it('copes with an engine that finishes without saying anything', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.last.onDone('e2e4');
    expect(engine.requests).toHaveLength(1); // no endless retry
    expect(analysis.current()?.lines).toEqual([]);
  });
});

describe('extra positions (refutations)', () => {
  const EXTRA = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2';
  const EXTRA2 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2';

  it('are searched after the position on the board and before the rest of the line', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0, F1], ['e2e4'], 1);
    analysis.setExtras([EXTRA]);
    engine.answer(three('e7e5', cp(-30))); // F1, on the board
    expect(engine.last.fen).toBe(EXTRA);
    expect(engine.last.depth).toBe(analysis.extraDepth);
    expect(analysis.isReady(EXTRA, analysis.extraDepth)).toBe(false);

    engine.answer(three('b8c6', cp(-25)));
    expect(analysis.isReady(EXTRA, analysis.extraDepth)).toBe(true);
    expect(analysis.evalFor(EXTRA)?.lines[0]?.pv).toEqual(['b8c6']);
    expect(engine.last.fen).toBe(F0); // now the rest of the line
  });

  it('are taken in the order given, and asking again for the same list changes nothing', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    analysis.setExtras([EXTRA, EXTRA2]);
    analysis.setExtras([EXTRA, EXTRA2]);
    analysis.setExtras([EXTRA, EXTRA2]);
    expect(engine.requests.map((r) => r.fen)).toEqual([F0, EXTRA]);
    engine.answer(three('b8c6', cp(-25)));
    expect(engine.last.fen).toBe(EXTRA2);
  });

  it('are dropped when no longer wanted', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    analysis.setExtras([EXTRA]);
    expect(analysis.busy()).toBe(true);
    analysis.setExtras([]);
    expect(engine.stops).toBe(1);
    expect(analysis.busy()).toBe(false);
  });

  it('do not delay the position on the board', () => {
    const { engine, analysis } = setup();
    analysis.setExtras([EXTRA]);
    analysis.setLine([F0], [], 0);
    expect(engine.last.fen).toBe(F0);
  });
});

describe('ranking every legal move', () => {
  const ranked = [
    { score: cp(30), pv: ['e2e4'] },
    { score: cp(25), pv: ['d2d4'] },
    { score: cp(20), pv: ['g1f3'] },
    { score: cp(10), pv: ['c2c4'] },
    { score: cp(-40), pv: ['g2g4'] },
  ];

  it('runs one search that asks the engine for all moves, right after the position on the board', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    analysis.setRanking(F0);
    engine.answer(three('e2e4', cp(30)));

    expect(engine.last.fen).toBe(F0);
    expect(engine.last.depth).toBe(analysis.rankDepth);
    expect(engine.last.multiPv).toBe(256);
    expect(analysis.ranking(F0)).toBeUndefined();

    engine.answer(ranked);
    expect(analysis.ranking(F0)?.lines.map((line) => line.pv[0])).toEqual(['e2e4', 'd2d4', 'g1f3', 'c2c4', 'g2g4']);
    expect(analysis.busy()).toBe(false);
  });

  it('is only available once the search has finished', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    analysis.setRanking(F0);
    engine.answer(ranked, { depth: 6, finish: false });
    expect(analysis.ranking(F0)).toBeUndefined();
    engine.answer(ranked, { depth: analysis.rankDepth });
    expect(analysis.ranking(F0)?.depth).toBe(analysis.rankDepth);
  });

  it('is kept apart from the normal result for the same position', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.answer(three('d2d4', cp(33)));
    analysis.setRanking(F0);
    engine.answer(ranked);
    // The normal result (three lines, used for bar and arrows) is untouched.
    expect(analysis.current()?.lines).toHaveLength(3);
    expect(analysis.current()?.lines[0]?.pv).toEqual(['d2d4']);
    expect(analysis.ranking(F0)?.lines).toHaveLength(5);
  });

  it('is remembered: asking again does not search again', () => {
    const { engine, analysis } = setup({ maxDepth: 12 });
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    analysis.setRanking(F0);
    engine.answer(ranked);
    const count = engine.requests.length;
    analysis.setRanking(null);
    analysis.setRanking(F0);
    expect(engine.requests).toHaveLength(count);
    expect(analysis.ranking(F0)?.lines).toHaveLength(5);
  });

  it('can be cancelled mid-search', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0], [], 0);
    engine.answer(three('e2e4', cp(30)));
    analysis.setRanking(F0);
    expect(engine.last.multiPv).toBe(256);
    analysis.setRanking(null);
    // Straight on to deepening the position on the board, with the normal number of lines.
    expect(engine.last.depth).toBe(20);
    expect(engine.last.multiPv).toBe(3);
  });
});

describe('verdicts', () => {
  it('has no verdict until both positions around the move are known', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0, F1], ['e2e4'], 1);
    expect(analysis.judgement(1)).toBeUndefined();
    engine.answer(three('e7e5', cp(-30))); // after the move
    expect(analysis.judgement(1)).toBeUndefined();
    engine.answer(three('e2e4', cp(30))); // before the move
    expect(analysis.judgement(1)?.verdict).toBe('best');
    expect(analysis.judgement(1)?.bestMove).toBe('e2e4');
  });

  it('does not judge from a search that has not finished', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0, F1], ['e2e4'], 1);
    engine.answer(three('e7e5', cp(-30)));
    engine.answer(three('e2e4', cp(30)), { depth: 12, finish: false });
    expect(analysis.judgement(1)).toBeUndefined();
  });

  it('flags a blunder that allows mate, from the mover point of view', () => {
    const { engine, analysis } = setup();
    // 3...Nf6?? in the position after 3.Bc4
    const before = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
    const after = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    analysis.setLine([before, after], ['g8f6'], 1);
    engine.answer(three('h5f7', { type: 'mate', value: 1 })); // White to move mates in 1
    engine.answer(three('g7g6', cp(40))); // Black to move was fine with g6

    const judgement = analysis.judgement(1);
    expect(judgement?.verdict).toBe('blunder');
    expect(judgement?.note).toEqual({ kind: 'allows-mate', moves: 1 });
    expect(judgement?.bestMove).toBe('g7g6');
    expect(judgement?.winAfter).toBe(0);
    expect(judgement?.winBefore).toBeGreaterThan(50);
  });

  it('grades by the size of the drop', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0, F1], ['e2e4'], 1);
    engine.answer(three('e7e5', cp(150))); // Black to move and +1.5 for Black
    engine.answer(three('d2d4', cp(30))); // White was slightly better and had d4
    const judgement = analysis.judgement(1);
    // White: about 52.8% -> about 36.5%: a drop of roughly 16 points.
    expect(judgement?.drop).toBeGreaterThan(10);
    expect(judgement?.drop).toBeLessThan(20);
    expect(judgement?.verdict).toBe('inaccuracy');
    expect(judgement?.bestMove).toBe('d2d4');
  });

  it('keeps a verdict once given, even if deeper searches change the scores', () => {
    const { engine, analysis } = setup();
    analysis.setLine([F0, F1], ['e2e4'], 1);
    engine.answer(three('e7e5', cp(150)));
    engine.answer(three('d2d4', cp(30)));
    expect(analysis.judgement(1)?.verdict).toBe('inaccuracy');

    // The deepening search of the position on the board now says it is equal after all.
    engine.answer(three('e7e5', cp(0)));
    expect(analysis.current()?.lines[0]?.score).toEqual({ type: 'cp', value: 0 });
    expect(analysis.judgement(1)?.verdict).toBe('inaccuracy');
  });

  it('returns undefined for moves that do not exist', () => {
    const { analysis } = setup();
    analysis.setLine([F0], [], 0);
    expect(analysis.judgement(0)).toBeUndefined();
    expect(analysis.judgement(1)).toBeUndefined();
    expect(analysis.judgement(7)).toBeUndefined();
  });
});
