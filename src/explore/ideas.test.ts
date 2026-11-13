import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { assembleSnapshot, positionsToEvaluate } from '../snapshot/assemble';
import { crawl, type CrawlThresholds } from '../snapshot/crawl';
import { positionKey, type Snapshot } from '../snapshot/format';
import { fakeSource, fenAfter, type FakeBook } from '../snapshot/testData';
import { failedCheck, failedChecks, ideaFor, nodeAfter, type Idea } from './ideas';

const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const P = 'e4 e5 Nf3 Nc6 c3';
const THRESHOLDS: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 };
const cp = (value: number): Score => ({ type: 'cp', value });
const key = (line: string) => positionKey(fenAfter(line));

// Made-up numbers. At the opening position: masters prefer Nf6 (6 of 10), amateurs too (500 of
// 1000), f6 is popular (300) and bad. After 3...Nf6 masters always play d4.
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000 }, masters: { e4: 500 } },
  e4: { lichess: { e5: 5000 }, masters: { e5: 300 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 1000 }, masters: { c3: 10 } },
  [P]: { lichess: { Nf6: 500, f6: 300, d5: 200 }, masters: { Nf6: 6, d5: 4 } },
  [`${P} Nf6`]: { lichess: { d4: 300, d3: 200 }, masters: { d4: 6 } },
};

async function snapshot(): Promise<Snapshot> {
  const result = await crawl(fakeSource(BOOK), { rootLine: ROOT, thresholds: THRESHOLDS });
  const evals = new Map<string, Score>();
  for (const k of positionsToEvaluate(result, { listShare: 0.01, maxListedMoves: 12 }).keys()) evals.set(k, cp(20));
  evals.set(key(`${P} f6`), cp(300));
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

describe('nodeAfter', () => {
  it('follows moves from the start position', async () => {
    const data = await snapshot();
    expect(nodeAfter(data, [])?.fen).toBe(fenAfter(''));
    expect(nodeAfter(data, ROOT)?.fen).toBe(fenAfter(P));
    expect(nodeAfter(data, [...ROOT, 'Nf6'])?.fen).toBe(fenAfter(`${P} Nf6`));
    expect(nodeAfter(data, [...ROOT, 'h5'])).toBeUndefined();
    expect(nodeAfter(data, ['d4'])).toBeUndefined();
  });
});

describe('failedCheck', () => {
  it('accepts statements the data supports', async () => {
    const data = await snapshot();
    const pass = (check: Parameters<typeof failedCheck>[1]) => expect(failedCheck(data, check)).toBeNull();
    pass({ kind: 'book-top', line: ROOT, san: 'Nf6', minShare: 0.5 });
    pass({ kind: 'popular-top', line: ROOT, san: 'Nf6', minShare: 0.5 });
    pass({ kind: 'book-top', line: [...ROOT, 'Nf6'], san: 'd4', minShare: 0.99 });
    pass({ kind: 'popular-share', line: ROOT, san: 'f6', min: 0.25, max: 0.35 });
    pass({ kind: 'book-share', line: ROOT, san: 'f6', max: 0 }); // no master plays it
    pass({ kind: 'book-share', line: ROOT, san: 'd5', min: 0.3 });
    pass({ kind: 'flagged', line: ROOT, san: 'f6', atLeast: 'mistake' });
    pass({ kind: 'flagged', line: ROOT, san: 'f6', atLeast: 'inaccuracy' });
    pass({ kind: 'sound', line: ROOT, san: 'Nf6' });
    pass({ kind: 'score', line: ROOT, min: 0, max: 0.5 });
  });

  it('rejects statements the data does not support, saying why', async () => {
    const data = await snapshot();
    const fail = (check: Parameters<typeof failedCheck>[1]) => failedCheck(data, check);
    expect(fail({ kind: 'book-top', line: ROOT, san: 'd5' })).toMatch(/top move is Nf6, not d5/);
    expect(fail({ kind: 'book-top', line: ROOT, san: 'Nf6', minShare: 0.7 })).toMatch(/Nf6 has only 60\.0%/);
    expect(fail({ kind: 'popular-top', line: ROOT, san: 'f6' })).toMatch(/top move is Nf6/);
    expect(fail({ kind: 'popular-share', line: ROOT, san: 'f6', max: 0.1 })).toMatch(/f6 has 30\.0%/);
    expect(fail({ kind: 'flagged', line: ROOT, san: 'f6', atLeast: 'blunder' })).toMatch(/flagged "mistake", not at least "blunder"/);
    expect(fail({ kind: 'flagged', line: ROOT, san: 'Nf6', atLeast: 'inaccuracy' })).toMatch(/flagged "none"/);
    expect(fail({ kind: 'sound', line: ROOT, san: 'f6' })).toMatch(/f6 is flagged "mistake"/);
    expect(fail({ kind: 'score', line: ROOT, min: 1 })).toMatch(/score after .* is 0\.20/);
    expect(fail({ kind: 'sound', line: ROOT, san: 'h5' })).toMatch(/h5 is not listed/);
    expect(fail({ kind: 'sound', line: ['d4'], san: 'd5' })).toMatch(/no position after d4/);
  });
});

describe('ideaFor', () => {
  const idea: Idea = {
    line: ROOT,
    text: 'Masters answer with Nf6 most often; the popular f6 is a mistake.',
    checks: [
      { kind: 'book-top', line: ROOT, san: 'Nf6' },
      { kind: 'flagged', line: ROOT, san: 'f6', atLeast: 'mistake' },
    ],
  };

  it('gives the remark at its position, and nothing elsewhere', async () => {
    const data = await snapshot();
    expect(failedChecks(data, idea)).toEqual([]);
    expect(ideaFor(data, [idea], fenAfter(P))).toBe(idea.text);
    expect(ideaFor(data, [idea], fenAfter(`${P} Nf6`))).toBeNull();
    expect(ideaFor(data, [], fenAfter(P))).toBeNull();
  });

  it('finds the position whatever the move counters say', async () => {
    const data = await snapshot();
    const fen = fenAfter(P).replace(/ 0 3$/, ' 7 12');
    expect(ideaFor(data, [idea], fen)).toBe(idea.text);
  });

  it('stays silent when the data no longer backs the sentence', async () => {
    const data = await snapshot();
    const outdated: Idea = { ...idea, checks: [{ kind: 'book-top', line: ROOT, san: 'd5' }] };
    expect(failedChecks(data, outdated)).toHaveLength(1);
    expect(ideaFor(data, [outdated], fenAfter(P))).toBeNull();
  });
});
