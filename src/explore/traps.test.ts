import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { assembleSnapshot, positionsToEvaluate } from '../snapshot/assemble';
import { crawl, type CrawlThresholds } from '../snapshot/crawl';
import { positionKey, type Snapshot } from '../snapshot/format';
import { fakeSource, fenAfter, type FakeBook } from '../snapshot/testData';
import { pathsFromRoot, trapCandidates, validateTrapFile, type Trap, type TrapFile, type TrapRule } from './traps';

const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const P = 'e4 e5 Nf3 Nc6 c3';
const THRESHOLDS: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 };
const RULE: TrapRule = { minShare: 0.05, minGames: 50, minDrop: 20, maxCandidates: 10 };
const cp = (value: number): Score => ({ type: 'cp', value });
const key = (line: string) => positionKey(fenAfter(line));

// Made-up numbers. At the Ponziani position (Black to move, 1000 games):
//   Nf6 (500) is fine, f6 (300) loses a lot, Qh4 (150) loses even more, g5 (50 = 5%) loses a lot.
// After 3...Nf6 (White to move, 500 games): d4 (300) is fine, Ng5 (200) is White's own blunder.
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000 }, masters: { e4: 500 } },
  e4: { lichess: { e5: 5000, c5: 800 }, masters: { e5: 300 } },
  'e4 c5': { lichess: { Nf3: 700, g4: 100 }, masters: { Nf3: 180 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 1000 }, masters: { c3: 10 } },
  [P]: { lichess: { Nf6: 500, f6: 300, Qh4: 150, g5: 50 }, masters: { Nf6: 6 } },
  [`${P} Nf6`]: { lichess: { d4: 300, Ng5: 200 }, masters: { d4: 6 } },
  [`${P} f6`]: { lichess: { d4: 250 }, masters: {} },
};

async function snapshot(scores: Record<string, Score>): Promise<Snapshot> {
  const result = await crawl(fakeSource(BOOK), { rootLine: ROOT, thresholds: THRESHOLDS });
  const evals = new Map<string, Score>();
  for (const positionKeyValue of positionsToEvaluate(result, { listShare: 0.01, maxListedMoves: 12 }).keys()) {
    evals.set(positionKeyValue, cp(20));
  }
  for (const [line, score] of Object.entries(scores)) evals.set(key(line), score);
  return assembleSnapshot(result, evals, {
    formatVersion: 1,
    createdAt: '2026-11-13T10:00:00.000Z',
    explorerHost: 'https://explorer.lichess.org',
    lichess: { ratings: [1000, 1200], speeds: ['blitz'] },
    rootLine: ROOT,
    thresholds: { ...THRESHOLDS, listShare: 0.01, maxListedMoves: 12 },
    engine: { name: 'Test Engine', depth: 18 },
    counts: { explorerRequests: 0, evaluations: 0 },
  });
}

const SCORES: Record<string, Score> = {
  [`${P} f6`]: cp(300), // Black's f6: White +3.0 -> about 25 points for Black
  [`${P} f6 d4`]: cp(310), // ... and White's natural reply keeps that advantage
  [`${P} Qh4`]: cp(700), // about 43 points
  [`${P} g5`]: cp(450), // about 32 points, played in exactly 5% of games (50 of 1000)
  [`${P} Nf6 Ng5`]: cp(-400), // White's own blunder
  'e4 c5 g4': cp(-500), // a blunder in a sideline: not part of the opening tree
};

describe('pathsFromRoot', () => {
  it('gives the moves that lead to each position', async () => {
    const paths = pathsFromRoot(await snapshot({}));
    expect(paths.get(key(''))).toEqual([]);
    expect(paths.get(key(P))).toEqual(ROOT);
    expect(paths.get(key(`${P} Nf6`))).toEqual([...ROOT, 'Nf6']);
    expect(paths.get(key('e4 c5'))).toEqual(['e4', 'c5']);
  });
});

describe('trapCandidates', () => {
  it('finds popular losing moves for both sides, most played first', async () => {
    const candidates = trapCandidates(await snapshot(SCORES), RULE);
    expect(candidates.map((c) => [c.move.san, c.victim])).toEqual([
      ['f6', 'black'],
      ['Ng5', 'white'],
      ['Qh4', 'black'],
      ['g5', 'black'],
    ]);
    const f6 = candidates[0]!;
    expect(f6.line).toEqual(ROOT);
    expect(f6.games).toBe(300);
    expect(f6.share).toBeCloseTo(0.3, 5);
    expect(f6.drop).toBeGreaterThan(20);
    // White's blunder is measured from White's side.
    expect(candidates[1]!.line).toEqual([...ROOT, 'Nf6']);
    expect(candidates[1]!.drop).toBeGreaterThan(30);
  });

  it('ignores moves that are too rare, lose too little, or lie outside the opening tree', async () => {
    const data = await snapshot(SCORES);
    const sans = (rule: Partial<TrapRule>) => trapCandidates(data, { ...RULE, ...rule }).map((c) => c.move.san);
    expect(sans({ minShare: 0.06 })).toEqual(['f6', 'Ng5', 'Qh4']); // g5 has exactly 5%
    expect(sans({ minGames: 160 })).toEqual(['f6', 'Ng5']);
    expect(sans({ minDrop: 30 })).toEqual(['Ng5', 'Qh4', 'g5']); // f6 is "only" a mistake
    // The Sicilian sideline's g4 is a blunder too, but sidelines are not the opening being trained.
    expect(sans({ minShare: 0, minGames: 0 })).not.toContain('g4');
    expect(sans({})).not.toContain('Nf6');
  });

  it('respects the maximum number of candidates', async () => {
    expect(trapCandidates(await snapshot(SCORES), { ...RULE, maxCandidates: 2 }).map((c) => c.move.san)).toEqual(['f6', 'Ng5']);
  });

  it('finds nothing when nobody blunders', async () => {
    expect(trapCandidates(await snapshot({}), RULE)).toEqual([]);
  });
});

describe('validateTrapFile', () => {
  const trap: Trap = {
    id: 'k|f7f6',
    line: ROOT,
    fen: fenAfter(P),
    victim: 'black',
    kind: 'exploit',
    move: { uci: 'f7f6', san: 'f6' },
    popular: { games: 300, share: 0.3 },
    book: { games: 0, share: 0 },
    scoreBefore: cp(20),
    scoreAfter: cp(300),
    drop: 25,
    verdict: 'mistake',
    refutation: { uci: ['d2d4'], san: ['d4'], why: 'No immediate material win, but Stockfish rates the position +3.0.' },
  };
  const file = (traps: unknown[]): TrapFile =>
    ({
      meta: {
        formatVersion: 1,
        createdAt: '2026-11-13T12:00:00.000Z',
        snapshotCreatedAt: '2026-11-13T10:00:00.000Z',
        engine: { name: 'Test Engine', depth: 22 },
        rule: RULE,
      },
      traps,
    }) as TrapFile;

  it('accepts a sound file, also an empty one', () => {
    expect(validateTrapFile(file([trap]))).toEqual([]);
    expect(validateTrapFile(file([]))).toEqual([]);
  });

  it('rejects broken files', () => {
    expect(validateTrapFile(null)).toEqual(['not an object']);
    expect(validateTrapFile({ meta: { formatVersion: 1 } })).toContain('traps is missing');
    expect(validateTrapFile(file([trap, trap])).join('\n')).toMatch(/listed twice/);
    expect(validateTrapFile(file([{ ...trap, kind: 'avoid' }])).join('\n')).toMatch(/kind does not match the victim/);
    expect(validateTrapFile(file([{ ...trap, verdict: 'good' }])).join('\n')).toMatch(/bad verdict/);
    expect(validateTrapFile(file([{ ...trap, refutation: { uci: [], san: [], why: '' } }])).join('\n')).toMatch(/bad refutation/);
    expect(validateTrapFile(file([{ ...trap, scoreAfter: { type: 'cp' } }])).join('\n')).toMatch(/bad scores/);
  });
});
