import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { assembleSnapshot, positionsToEvaluate } from '../snapshot/assemble';
import { crawl, type CrawlThresholds } from '../snapshot/crawl';
import { positionKey, type Counts, type Snapshot, type SnapshotMove } from '../snapshot/format';
import { fakeSource, fenAfter, type FakeBook } from '../snapshot/testData';
import { blackReplies, buildRepertoire, cardLabel, chooseMove } from './repertoire';

const cp = (value: number): Score => ({ type: 'cp', value });
const key = (line: string) => positionKey(fenAfter(line));

function move(san: string, masters: number, lichess: number, score?: Score, next?: string): SnapshotMove {
  const out: SnapshotMove = {
    uci: `${san.toLowerCase()}xx`,
    san,
    masters: [masters, 0, 0] as Counts,
    lichess: [lichess, 0, 0] as Counts,
  };
  if (score) out.eval = score;
  if (next) out.next = next;
  return out;
}
const node = (moves: SnapshotMove[]) => ({
  moves,
  masters: [moves.reduce((sum, m) => sum + m.masters[0], 0), 0, 0] as Counts,
});

describe('chooseMove', () => {
  it("picks the masters' favourite when Stockfish is content with it", () => {
    const chosen = chooseMove(node([move('d4', 80, 100, cp(30)), move('d3', 20, 500, cp(40))]));
    expect(chosen?.move.san).toBe('d4');
    expect(chosen?.reason).toEqual({ kind: 'book', games: 80, share: 0.8 });
  });

  it('prefers a better-scoring book move when the favourite gives away too much', () => {
    // +0.0 against +1.5 is about 13 points of winning chances.
    const chosen = chooseMove(node([move('d3', 80, 100, cp(0)), move('d4', 20, 100, cp(150))]));
    expect(chosen?.move.san).toBe('d4');
    expect(chosen?.reason).toEqual({ kind: 'engine-over-book', bookMove: 'd3' });
  });

  it('does not let a move with a handful of master games count as "the book"', () => {
    // Bc4 has 2 master games (below the minimum of 5): d4 is the book move even with fewer than... nothing else.
    const chosen = chooseMove(node([move('Bc4', 2, 900, cp(60)), move('d4', 30, 100, cp(30))]));
    expect(chosen?.move.san).toBe('d4');
    expect(chosen?.reason.kind).toBe('book');
  });

  it('falls back to the best-scoring move where masters have not been', () => {
    const chosen = chooseMove(node([move('d3', 0, 500, cp(10)), move('d4', 1, 100, cp(45)), move('h3', 0, 50, cp(-20))]));
    expect(chosen?.move.san).toBe('d4');
    expect(chosen?.reason).toEqual({ kind: 'engine' });
  });

  it('keeps the favourite when no other book move scores better', () => {
    // The only book move gives away a lot compared with an amateur move — but there is no book alternative.
    const chosen = chooseMove(node([move('d3', 40, 100, cp(0)), move('Ng5', 0, 100, cp(300))]));
    expect(chosen?.move.san).toBe('d3');
    expect(chosen?.reason.kind).toBe('book');
  });

  it('ignores moves without a score, and gives nothing when none has one', () => {
    expect(chooseMove(node([move('d4', 80, 100), move('d3', 20, 100, cp(10))]))?.move.san).toBe('d3');
    expect(chooseMove(node([move('d4', 80, 100)]))).toBeUndefined();
    expect(chooseMove(node([]))).toBeUndefined();
  });

  it('respects a custom tolerance', () => {
    const position = node([move('d3', 80, 100, cp(0)), move('d4', 20, 100, cp(60))]); // about 5.5 points apart
    expect(chooseMove(position, { tolerance: 5, minBookGames: 5 })?.move.san).toBe('d4');
    expect(chooseMove(position, { tolerance: 10, minBookGames: 5 })?.move.san).toBe('d3');
  });
});

// A small made-up tree to walk.
const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const P = 'e4 e5 Nf3 Nc6 c3';
const THRESHOLDS: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 };
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000 }, masters: { e4: 500 } },
  e4: { lichess: { e5: 5000, c5: 1000 }, masters: { e5: 300 } },
  'e4 c5': { lichess: { Nf3: 700 }, masters: { Nf3: 180 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 1000 }, masters: { c3: 10 } },
  // Black: Nf6 60%, d5 30%, f6 10% (f6 is listed but the tree does not continue after it).
  [P]: { lichess: { Nf6: 600, d5: 300, f6: 90 }, masters: { Nf6: 6 } },
  // White after Nf6: masters play d4; amateurs prefer d3.
  [`${P} Nf6`]: { lichess: { d4: 250, d3: 350 }, masters: { d4: 6 } },
  // Black after 4.d4: Nxe4 75%, exd4 25%.
  [`${P} Nf6 d4`]: { lichess: { Nxe4: 150, exd4: 100 }, masters: { Nxe4: 5 } },
  [`${P} Nf6 d4 Nxe4`]: { lichess: { d5: 120 }, masters: { d5: 5 } },
  [`${P} Nf6 d4 exd4`]: { lichess: { e5: 100 }, masters: {} },
  [`${P} Nf6 d3`]: { lichess: { d5: 300 }, masters: {} },
  // White after d5: no master games; Qa4 scores best.
  [`${P} d5`]: { lichess: { exd5: 200, Qa4: 100 }, masters: {} },
};

async function snapshot(): Promise<Snapshot> {
  const result = await crawl(fakeSource(BOOK), { rootLine: ROOT, thresholds: THRESHOLDS });
  const evals = new Map<string, Score>();
  for (const k of positionsToEvaluate(result, { listShare: 0.01, maxListedMoves: 12 }).keys()) evals.set(k, cp(20));
  evals.set(key(`${P} d5 Qa4`), cp(60));
  evals.set(key(`${P} d5 exd5`), cp(-10));
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

describe('buildRepertoire', () => {
  it('starts at the opening position', async () => {
    const repertoire = buildRepertoire(await snapshot());
    expect(repertoire.startKey).toBe(key(P));
    expect(repertoire.startLine).toEqual(ROOT);
  });

  it('makes a card for every White position the repertoire reaches, and no others', async () => {
    const repertoire = buildRepertoire(await snapshot());
    const moves = Object.fromEntries([...repertoire.cards.values()].map((card) => [card.line.join(' '), card.move.san]));
    expect(moves).toEqual({
      [`${P} Nf6`]: 'd4', // the book move, not the amateurs' d3
      [`${P} d5`]: 'Qa4', // no book: Stockfish's best
      [`${P} Nf6 d4 Nxe4`]: 'd5',
      [`${P} Nf6 d4 exd4`]: 'e5',
    });
    // The position after 4.d3 is in the snapshot, but our repertoire never goes there.
    expect(repertoire.cards.has(key(`${P} Nf6 d3 d5`))).toBe(false);
    // Positions before the opening and other defences are not drilled.
    expect(repertoire.cards.has(key('e4 c5'))).toBe(false);
    expect(repertoire.cards.has(key(''))).toBe(false);
  });

  it('says why each move was chosen', async () => {
    const repertoire = buildRepertoire(await snapshot());
    expect(repertoire.cards.get(key(`${P} Nf6`))?.reason).toEqual({ kind: 'book', games: 6, share: 1 });
    expect(repertoire.cards.get(key(`${P} d5`))?.reason).toEqual({ kind: 'engine' });
  });

  it("works out how often each position comes up from Black's move frequencies", async () => {
    const repertoire = buildRepertoire(await snapshot());
    const reach = (line: string) => repertoire.cards.get(key(line))!.reach;
    // Black's followed replies at the start: Nf6 600, d5 300 (f6 has no continuation).
    expect(reach(`${P} Nf6`)).toBeCloseTo(600 / 900, 6);
    expect(reach(`${P} d5`)).toBeCloseTo(300 / 900, 6);
    // After 4.d4: Nxe4 150, exd4 100.
    expect(reach(`${P} Nf6 d4 Nxe4`)).toBeCloseTo((600 / 900) * (150 / 250), 6);
    expect(reach(`${P} Nf6 d4 exd4`)).toBeCloseTo((600 / 900) * (100 / 250), 6);
  });

  it('gives each card the moves that lead to it and its position', async () => {
    const repertoire = buildRepertoire(await snapshot());
    const card = repertoire.cards.get(key(`${P} Nf6 d4 Nxe4`))!;
    expect(card.line).toEqual([...ROOT, 'Nf6', 'd4', 'Nxe4']);
    expect(card.fen).toBe(fenAfter(`${P} Nf6 d4 Nxe4`));
    expect(card.move).toEqual({ uci: 'd4d5', san: 'd5' });
  });
});

describe('blackReplies', () => {
  it('lists only the moves the snapshot continues after, weighted by Lichess games', async () => {
    const data = await snapshot();
    const replies = blackReplies(data.nodes[key(P)]!);
    expect(replies.map((reply) => [reply.move.san, reply.weight])).toEqual([
      ['Nf6', 600],
      ['d5', 300],
    ]);
  });
});

describe('cardLabel', () => {
  it('names a card after the last move before it', () => {
    expect(cardLabel({ line: [...ROOT, 'Nf6'] })).toBe('After 3...Nf6');
    expect(cardLabel({ line: [...ROOT, 'Nf6', 'd4', 'Nxe4'] })).toBe('After 4...Nxe4');
    expect(cardLabel({ line: ['e4'] })).toBe('After 1.e4');
    expect(cardLabel({ line: [] })).toBe('First move');
  });
});
