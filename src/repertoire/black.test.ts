// The repertoire, the drill and the bot when the user plays Black (a small made-up Caro-Kann tree).
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { pickOpponentMove, trapRoutes } from '../bot/choose';
import { DrillSession } from '../drill/session';
import { buildExplorePosition } from '../explore/position';
import type { Trap } from '../explore/traps';
import { assembleSnapshot, positionsToEvaluate } from '../snapshot/assemble';
import { crawl, type CrawlThresholds } from '../snapshot/crawl';
import { positionKey, type Counts, type Snapshot, type SnapshotMove } from '../snapshot/format';
import { fakeSource, fenAfter, type FakeBook } from '../snapshot/testData';
import { buildRepertoire, cardLabel, chooseMove } from './repertoire';

const cp = (value: number): Score => ({ type: 'cp', value });
const key = (line: string) => positionKey(fenAfter(line));
const ROOT = ['e4', 'c6'];
const THRESHOLDS: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 };

/** Made-up numbers (not theory). */
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000, d4: 3000 }, masters: { e4: 500, d4: 300 } },
  e4: { lichess: { c6: 700, e5: 5000 }, masters: { c6: 100, e5: 300 } },
  'e4 c6': { lichess: { d4: 500, Nc3: 150 }, masters: { d4: 80, Nc3: 15 } },
  'e4 c6 d4': { lichess: { d5: 480 }, masters: { d5: 80 } },
  'e4 c6 Nc3': { lichess: { d5: 140 }, masters: { d5: 15 } },
  'e4 c6 d4 d5': { lichess: { e5: 250, Nc3: 200 }, masters: { e5: 50, Nc3: 30 } },
  'e4 c6 d4 d5 e5': { lichess: { Bf5: 200, c5: 40 }, masters: { Bf5: 40, c5: 10 } },
  d4: { lichess: { d5: 2000, Nf6: 800 }, masters: { d5: 200, Nf6: 80 } },
};

async function snapshot(scores: Record<string, Score> = {}): Promise<Snapshot> {
  const result = await crawl(fakeSource(BOOK), { rootLine: ROOT, thresholds: THRESHOLDS, side: 'black' });
  const evals = new Map<string, Score>();
  const listing = { listShare: 0.01, maxListedMoves: 12 };
  for (const k of positionsToEvaluate(result, listing).keys()) evals.set(k, cp(20));
  for (const [line, score] of Object.entries(scores)) evals.set(positionKey(fenAfter(line)), score);
  return assembleSnapshot(result, evals, {
    formatVersion: 1,
    createdAt: '2026-11-13T10:00:00.000Z',
    explorerHost: 'https://explorer.lichess.org',
    lichess: { ratings: [1000, 1200], speeds: ['blitz'] },
    side: 'black',
    rootLine: ROOT,
    thresholds: { ...THRESHOLDS, listShare: 0.01, maxListedMoves: 12 },
    engine: { name: 'Test Engine', depth: 18 },
    counts: { explorerRequests: 0, evaluations: 0 },
  });
}

describe('chooseMove as Black', () => {
  const move = (san: string, masters: number, score: Score): SnapshotMove => ({
    uci: `${san.toLowerCase()}xx`,
    san,
    masters: [masters, 0, 0] as Counts,
    lichess: [0, 0, 0] as Counts,
    eval: score,
  });
  const node = (moves: SnapshotMove[]) => ({ moves, masters: [100, 0, 0] as Counts });

  it("judges scores from Black's side: a lower White score is better", () => {
    // Book move Bf5 is +0.8 for White, c5 is -0.8: about 15 points better for Black.
    const moves = [move('Bf5', 40, cp(80)), move('c5', 10, cp(-80))];
    expect(chooseMove(node(moves), 'black')).toMatchObject({
      move: { san: 'c5' },
      reason: { kind: 'engine-over-book', bookMove: 'Bf5' },
    });
    // The same numbers for White: the book move is also the better one.
    expect(chooseMove(node(moves), 'white')).toMatchObject({ move: { san: 'Bf5' }, reason: { kind: 'book' } });
  });
});

describe('buildRepertoire as Black', () => {
  it("starts before Black's first move, so the first card is the opening move itself", async () => {
    const repertoire = buildRepertoire(await snapshot());
    expect(repertoire.side).toBe('black');
    expect(repertoire.startLine).toEqual(['e4']);
    expect(repertoire.startKey).toBe(key('e4'));
    const first = repertoire.cards.get(key('e4'))!;
    // Masters play 1...e5 more often, but the opening's own move comes first.
    expect(first.move.san).toBe('c6');
    expect(first.reason).toEqual({ kind: 'opening-move' });
    expect(cardLabel(first)).toBe('After 1.e4');
  });

  it('makes a card for every position where Black is to move, and no others', async () => {
    const repertoire = buildRepertoire(await snapshot());
    const moves = Object.fromEntries([...repertoire.cards.values()].map((card) => [card.line.join(' '), card.move.san]));
    expect(moves).toEqual({
      e4: 'c6',
      'e4 c6 d4': 'd5',
      'e4 c6 Nc3': 'd5',
      'e4 c6 d4 d5 e5': 'Bf5',
    });
    expect(repertoire.cards.has(key('d4'))).toBe(false); // a sideline, not drilled
    expect(repertoire.cards.get(key('e4 c6 d4 d5 e5'))!.reach).toBeCloseTo((500 / 650) * (250 / 450), 6);
    expect(cardLabel(repertoire.cards.get(key('e4 c6 d4'))!)).toBe('After 2.d4');
  });

  it('defaults to the side the snapshot records', async () => {
    expect(buildRepertoire(await snapshot()).side).toBe('black');
  });
});

describe('DrillSession as Black', () => {
  it('asks for 1...c6 first, then plays White weighted by the data', async () => {
    const data = await snapshot();
    const repertoire = buildRepertoire(data);
    const session = new DrillSession(data, repertoire, null, () => 0);
    expect(session.line()).toEqual(['e4']);
    expect(session.card()?.move.san).toBe('c6');

    expect(session.answer('b7b6').result).toBe('wrong');
    expect(session.answer('c7c6')).toMatchObject({ result: 'correct', firstTry: false });
    expect(session.lastOpponentMove()?.san).toBe('d4'); // White's most played at ticket 0
    expect(session.line()).toEqual(['e4', 'c6', 'd4']);
    expect(session.card()?.move.san).toBe('d5');
  });

  it('follows the path to a target card', async () => {
    const data = await snapshot();
    const repertoire = buildRepertoire(data);
    const target = repertoire.cards.get(key('e4 c6 Nc3'))!;
    const session = new DrillSession(data, repertoire, target, () => 0);
    session.answer('c7c6');
    expect(session.line()).toEqual(['e4', 'c6', 'Nc3']); // not d4, which the dice would pick
  });
});

describe('the bot as White (the opponent of a Black user)', () => {
  const position = (line: string) => {
    const fen = fenAfter(line);
    const node = BOOK[line]!;
    const total = (record: Record<string, number> | undefined): number =>
      Object.values(record ?? {}).reduce((a, b) => a + b, 0);
    const moves = Object.entries(node.lichess ?? {}).map(([san, games]) => {
      const played = new Chess(fen).move(san);
      return {
        uci: `${played.from}${played.to}`,
        san,
        masters: [node.masters?.[san] ?? 0, 0, 0] as Counts,
        lichess: [games, 0, 0] as Counts,
        eval: cp(20),
      };
    });
    return buildExplorePosition({ fen, masters: [total(node.masters), 0, 0], lichess: [total(node.lichess), 0, 0], moves });
  };

  it("plays White moves and leaves Black's turn to the user", () => {
    expect(pickOpponentMove(position('e4 c6'), 'black', 'realistic', new Map(), () => 0)?.move.san).toBe('d4');
    expect(pickOpponentMove(position('e4 c6'), 'black', 'realistic', new Map(), () => 0.999)?.move.san).toBe('Nc3');
    expect(pickOpponentMove(position('e4 c6 d4 d5 e5'), 'black', 'realistic', new Map())).toBeNull();
  });

  it("collects White's moves along an exploit trap", () => {
    const trap: Trap = {
      id: 'x',
      line: ['e4', 'c6', 'd4', 'd5', 'e5', 'Bf5'],
      fen: fenAfter('e4 c6 d4 d5 e5 Bf5'),
      victim: 'white',
      kind: 'exploit',
      move: { uci: 'g2g4', san: 'g4' },
      popular: { games: 10, share: 0.1 },
      book: { games: 0, share: 0 },
      scoreBefore: cp(20),
      scoreAfter: cp(-300),
      drop: 25,
      verdict: 'mistake',
      refutation: { uci: ['f5g4'], san: ['Bxg4'], why: 'test' },
    };
    const routes = trapRoutes([trap], 'black');
    const found = new Set([...routes.values()].flatMap((set) => [...set]));
    expect(found).toEqual(new Set(['e2e4', 'd2d4', 'e4e5', 'g2g4']));
    expect(trapRoutes([{ ...trap, kind: 'avoid', victim: 'black' }], 'black').size).toBe(0);
  });
});
