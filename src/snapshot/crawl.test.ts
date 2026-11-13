import { describe, expect, it } from 'vitest';
import { countReachable, crawl, meetsThreshold, mergeMoves, type CrawlThresholds } from './crawl';
import { positionKey } from './format';
import { fakeSource, fenAfter, type FakeBook } from './testData';

const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const P = 'e4 e5 Nf3 Nc6 c3'; // the Ponziani position

const THRESHOLDS: CrawlThresholds = {
  minShare: 0.03,
  minGamesLichess: 100,
  minGamesMasters: 5,
  maxPly: 30,
  maxPositions: 1000,
};

/** Made-up numbers, chosen to sit just above and just below the thresholds. */
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000, d4: 4000 }, masters: { e4: 500, d4: 500 } },
  e4: {
    lichess: { e5: 5000, c5: 800, a6: 100, e6: 100 }, // a6, e6: 1.7% of 6000 -> too rare
    masters: { e5: 300, c5: 190, e6: 10 }, // e6: 2% -> too rare
  },
  'e4 c5': { lichess: { Nf3: 700, Nc3: 100 }, masters: { Nf3: 180, Nc3: 10 } },
  'e4 e5': { lichess: { Nf3: 4000, Bc4: 1000 }, masters: { Nf3: 280, Bc4: 20 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000, Nf6: 600, d6: 400 }, masters: { Nc6: 200, Nf6: 80 } },
  'e4 e5 Nf3 Nf6': { lichess: { Nxe5: 400, Nc3: 200 }, masters: { Nxe5: 60, d4: 20 } },
  'e4 e5 Nf3 d6': { lichess: { d4: 300, Bc4: 100 }, masters: {} },
  'e4 e5 Nf3 Nc6': { lichess: { Bc4: 1500, Bb5: 1000, c3: 500 }, masters: { Bb5: 190, c3: 10 } },
  [P]: {
    // d6: followed (exactly 100 games). Bc5: 10 games -> not. f5: only via the masters rule.
    lichess: { Nf6: 250, d5: 150, d6: 100, Bc5: 10, f5: 5 },
    masters: { Nf6: 6, d5: 3, f5: 5 },
  },
  [`${P} Nf6`]: { lichess: { d4: 400, d3: 50 }, masters: { d4: 6 } }, // d3: 50 games -> not followed
  [`${P} Nf6 d4`]: { lichess: { Nxe4: 120, d6: 100, exd4: 80 }, masters: { Nxe4: 5, exd4: 1 } },
  [`${P} Nf6 d4 Nxe4`]: { lichess: { d5: 110 }, masters: { d5: 5 } },
  [`${P} d5`]: { lichess: { Qa4: 100, exd5: 50 }, masters: { Qa4: 3 } },
  [`${P} d6`]: { lichess: { d4: 100 }, masters: {} },
  [`${P} d6 d4`]: { lichess: { Nf6: 100 }, masters: {} }, // transposes to "... Nf6 d4 d6"
};

const key = (line: string) => positionKey(fenAfter(line));

async function run(thresholds: Partial<CrawlThresholds> = {}) {
  const source = fakeSource(BOOK, { [P]: { eco: 'C44', name: 'Ponziani Opening' } });
  const result = await crawl(source, { rootLine: ROOT, thresholds: { ...THRESHOLDS, ...thresholds } });
  const kindOf = (line: string) => result.nodes.get(key(line))?.kind;
  return { source, result, kindOf };
}

describe('meetsThreshold', () => {
  const node = { lichess: [500, 100, 400] as [number, number, number], masters: [50, 20, 30] as [number, number, number] };
  const t = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5 };

  it('needs both the share and the number of games, in one source', () => {
    expect(meetsThreshold({ lichess: [60, 10, 30], masters: [0, 0, 0] }, node, t)).toBe(true); // 100 games, 10%
    expect(meetsThreshold({ lichess: [60, 9, 30], masters: [0, 0, 0] }, node, t)).toBe(false); // 99 games
    expect(meetsThreshold({ lichess: [0, 0, 0], masters: [3, 1, 1] }, node, t)).toBe(true); // 5 master games, 5%
    expect(meetsThreshold({ lichess: [0, 0, 0], masters: [2, 1, 1] }, node, t)).toBe(false); // 4 master games
  });

  it('rejects a move with plenty of games but too small a share', () => {
    const big = { lichess: [50_000, 10_000, 40_000] as [number, number, number], masters: [0, 0, 0] as [number, number, number] };
    expect(meetsThreshold({ lichess: [1500, 0, 1400], masters: [0, 0, 0] }, big, t)).toBe(false); // 2.9%
    expect(meetsThreshold({ lichess: [1500, 0, 1500], masters: [0, 0, 0] }, big, t)).toBe(true); // 3.0%
  });

  it('never follows anything from a position with no games', () => {
    const empty = { lichess: [0, 0, 0] as [number, number, number], masters: [0, 0, 0] as [number, number, number] };
    expect(meetsThreshold({ lichess: [0, 0, 0], masters: [0, 0, 0] }, empty, { ...t, minGamesLichess: 0 })).toBe(false);
  });
});

describe('mergeMoves', () => {
  it('puts both sources side by side, most played first, with the resulting position', async () => {
    const source = fakeSource(BOOK);
    const fen = fenAfter(P);
    const moves = mergeMoves(fen, await source.masters(fen), await source.lichess(fen));
    expect(moves.map((m) => m.san)).toEqual(['Nf6', 'd5', 'd6', 'Bc5', 'f5']);

    const nf6 = moves[0]!;
    expect(nf6.uci).toBe('g8f6');
    expect(nf6.lichess).toEqual([125, 25, 100]);
    expect(nf6.masters).toEqual([3, 0, 3]);
    expect(nf6.fenAfter).toBe(fenAfter(`${P} Nf6`));

    expect(moves.find((m) => m.san === 'd6')?.masters).toEqual([0, 0, 0]); // unknown to masters
  });

  it('spells castling as a king move even if the source writes king-takes-rook', () => {
    const fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    const answer = {
      white: 10,
      draws: 0,
      black: 0,
      opening: null,
      moves: [{ uci: 'e1h1', san: 'O-O', white: 10, draws: 0, black: 0, averageRating: 1500, opening: null }],
    };
    const [castle] = mergeMoves(fen, answer, { ...answer, moves: [] });
    expect(castle?.uci).toBe('e1g1');
    expect(castle?.san).toBe('O-O');
  });

  it('drops moves that are not legal in the position', () => {
    const fen = fenAfter('');
    const bogus = {
      white: 1,
      draws: 0,
      black: 0,
      opening: null,
      moves: [
        { uci: 'e2e5', san: 'e5', white: 1, draws: 0, black: 0, averageRating: 0, opening: null },
        { uci: 'e2e4', san: 'e4', white: 1, draws: 0, black: 0, averageRating: 0, opening: null },
      ],
    };
    expect(mergeMoves(fen, bogus, { ...bogus, moves: [] }).map((m) => m.san)).toEqual(['e4']);
  });

  it('keeps the opening name a move leads to', () => {
    const fen = fenAfter('e4 e5 Nf3 Nc6');
    const answer = {
      white: 1,
      draws: 0,
      black: 0,
      opening: null,
      moves: [
        { uci: 'c2c3', san: 'c3', white: 1, draws: 0, black: 0, averageRating: 0, opening: { eco: 'C44', name: 'Ponziani Opening' } },
      ],
    };
    expect(mergeMoves(fen, { ...answer, moves: [] }, answer)[0]?.opening).toBe('Ponziani Opening');
  });
});

describe('crawl', () => {
  it('walks the fixed moves to the opening and marks them as the prelude', async () => {
    const { kindOf } = await run();
    for (const line of ['', 'e4', 'e4 e5', 'e4 e5 Nf3', 'e4 e5 Nf3 Nc6']) expect(kindOf(line)).toBe('prelude');
    expect(kindOf(P)).toBe('tree');
  });

  it("records Black's early alternatives as sidelines and goes no deeper there", async () => {
    const { kindOf, result } = await run();
    expect(kindOf('e4 c5')).toBe('sideline');
    expect(kindOf('e4 e5 Nf3 Nf6')).toBe('sideline');
    expect(kindOf('e4 e5 Nf3 d6')).toBe('sideline');
    // Too rare (under 3%): not even a sideline.
    expect(kindOf('e4 a6')).toBeUndefined();
    expect(kindOf('e4 e6')).toBeUndefined();
    // Nothing below a sideline, however popular.
    expect(kindOf('e4 c5 Nf3')).toBeUndefined();
    expect(result.nodes.get(key('e4 c5'))?.moves.every((move) => move.follow === undefined)).toBe(true);
  });

  it("does not follow White's other choices before the opening", async () => {
    const { kindOf } = await run();
    expect(kindOf('d4')).toBeUndefined();
    expect(kindOf('e4 e5 Bc4')).toBeUndefined();
    expect(kindOf('e4 e5 Nf3 Nc6 Bc4')).toBeUndefined();
    expect(kindOf('e4 e5 Nf3 Nc6 Bb5')).toBeUndefined();
  });

  it('follows moves inside the opening that meet the thresholds, in either source', async () => {
    const { kindOf } = await run();
    expect(kindOf(`${P} Nf6`)).toBe('tree');
    expect(kindOf(`${P} d5`)).toBe('tree');
    expect(kindOf(`${P} d6`)).toBe('tree'); // exactly 100 Lichess games
    expect(kindOf(`${P} f5`)).toBe('tree'); // 5 Lichess games, but 5 master games
    expect(kindOf(`${P} Bc5`)).toBeUndefined(); // 10 games
    expect(kindOf(`${P} Nf6 d3`)).toBeUndefined(); // 50 games
    expect(kindOf(`${P} Nf6 d4 exd4`)).toBeUndefined(); // 80 Lichess games, 1 master game
    expect(kindOf(`${P} Nf6 d4 Nxe4 d5`)).toBe('tree');
  });

  it('still lists the moves it does not follow', async () => {
    const { result } = await run();
    const ponziani = result.nodes.get(key(P))!;
    expect(ponziani.moves.map((m) => m.san)).toEqual(['Nf6', 'd5', 'd6', 'Bc5', 'f5']);
    expect(ponziani.moves.map((m) => m.follow)).toEqual(['tree', 'tree', 'tree', undefined, 'tree']);
    // Sum over the five moves of the 50% / 10% / 40% split used by the test data.
    expect(ponziani.lichess).toEqual([257, 51, 207]);
  });

  it('stores a position reached by two move orders once', async () => {
    const { source, result } = await run();
    expect(key(`${P} Nf6 d4 d6`)).toBe(key(`${P} d6 d4 Nf6`));
    const viaNf6 = result.nodes.get(key(`${P} Nf6 d4`))!.moves.find((m) => m.san === 'd6');
    const viaD6 = result.nodes.get(key(`${P} d6 d4`))!.moves.find((m) => m.san === 'Nf6');
    expect(viaNf6?.follow).toBe('tree');
    expect(viaD6?.follow).toBe('tree');
    expect(positionKey(viaNf6!.fenAfter)).toBe(positionKey(viaD6!.fenAfter));

    // Asked once per source, not twice.
    const fen = fenAfter(`${P} Nf6 d4 d6`);
    expect(source.asked.filter((entry) => entry.endsWith(fen))).toHaveLength(2);
  });

  it('asks each source exactly once per stored position', async () => {
    const { source, result } = await run();
    expect(source.asked).toHaveLength(result.nodes.size * 2);
    expect(new Set(source.asked).size).toBe(source.asked.length);
  });

  it('gives positions without a name of their own the name of their line', async () => {
    const { result } = await run();
    expect(result.nodes.get(key(P))?.opening).toEqual({ eco: 'C44', name: 'Ponziani Opening' });
    expect(result.nodes.get(key(`${P} Nf6 d4 Nxe4`))?.opening?.name).toBe('Ponziani Opening');
    expect(result.nodes.get(key('e4'))?.opening).toBeUndefined();
  });

  it('respects the depth limit', async () => {
    const { result, kindOf } = await run({ maxPly: 6 });
    expect(kindOf(`${P} Nf6`)).toBe('tree'); // ply 6
    expect(kindOf(`${P} Nf6 d4`)).toBeUndefined(); // ply 7
    expect(Math.max(...[...result.nodes.values()].map((n) => n.ply))).toBe(6);
    expect(result.truncated).toBe(false);
  });

  it('keeps the most played positions when the position limit cuts the tree', async () => {
    const full = await run();
    expect(full.result.truncated).toBe(false);

    // 8 positions before the opening (5 prelude + 3 sidelines) + the Ponziani + 2 more.
    const { result, kindOf } = await run({ maxPositions: 11 });
    expect(result.truncated).toBe(true);
    expect(result.nodes.size).toBe(11);
    expect(kindOf(`${P} Nf6`)).toBe('tree'); // 250 games: kept
    expect(kindOf(`${P} Nf6 d4`)).toBe('tree'); // 400 games: kept
    expect(kindOf(`${P} d5`)).toBeUndefined(); // 150 games: cut
    // The early sidelines are never the ones that get cut.
    expect(kindOf('e4 c5')).toBe('sideline');
    expect(kindOf('e4 e5 Nf3 d6')).toBe('sideline');
  });

  it('visits book lines before lines that only Lichess players choose', async () => {
    // 8 positions before the opening + the Ponziani + 3 more.
    const { kindOf } = await run({ maxPositions: 12 });
    // f5 has just 5 Lichess games but qualifies through the masters data: it is kept ...
    expect(kindOf(`${P} f5`)).toBe('tree');
    // ... ahead of d5, which has 150 Lichess games but too few master games.
    expect(kindOf(`${P} d5`)).toBeUndefined();
  });

  it('says how to get a complete tree when the position limit cut it', async () => {
    const full = await run();
    expect(full.result.truncated).toBe(false);
    expect(full.result.largestCut).toBe(0);

    // With room for 11 positions, the most played move that had to be left out is d5 (150 games).
    const cut = await run({ maxPositions: 11 });
    expect(cut.result.truncated).toBe(true);
    expect(cut.result.largestCut).toBe(150);

    // Asking for more than that many games gives a tree that fits and is complete.
    const complete = await run({ maxPositions: 11, minGamesLichess: 151, minGamesMasters: 6 });
    expect(complete.result.truncated).toBe(false);
    expect(complete.result.nodes.size).toBeLessThanOrEqual(11);
  });

  it('lists but does not follow a move into a differently named opening', async () => {
    // Pretend Lichess calls the position after 3...d5 by another opening's name.
    const source = fakeSource(BOOK, {
      [P]: { eco: 'C44', name: 'Ponziani Opening' },
      [`${P} Nf6`]: { eco: 'C44', name: 'Ponziani Opening: Jaenisch Counterattack' },
      [`${P} d5`]: { eco: 'C50', name: 'Some Other Opening: A Variation' },
    });
    const result = await crawl(source, { rootLine: ROOT, thresholds: THRESHOLDS });
    expect(result.family).toBe('Ponziani Opening');

    const ponziani = result.nodes.get(key(P))!;
    const d5 = ponziani.moves.find((m) => m.san === 'd5')!;
    expect(d5.opening).toBe('Some Other Opening: A Variation');
    expect(d5.follow).toBeUndefined(); // listed, with its name, but the tree stops there
    expect(result.nodes.has(key(`${P} d5`))).toBe(false);

    // A variation of the same opening is followed as usual.
    expect(ponziani.moves.find((m) => m.san === 'Nf6')?.follow).toBe('tree');
    expect(result.nodes.get(key(`${P} Nf6`))?.opening?.name).toBe('Ponziani Opening: Jaenisch Counterattack');
    // Moves without a name of their own stay in the opening.
    expect(ponziani.moves.find((m) => m.san === 'd6')?.follow).toBe('tree');
    // countReachable applies the same rule.
    expect(countReachable(result, ROOT, THRESHOLDS)).toBe(result.nodes.size);
  });

  it('reports progress', async () => {
    const source = fakeSource(BOOK);
    const seen: number[] = [];
    const result = await crawl(source, { rootLine: ROOT, thresholds: THRESHOLDS }, (visited) => seen.push(visited));
    expect(seen).toEqual(Array.from({ length: result.nodes.size }, (_, index) => index + 1));
  });
});

describe('countReachable', () => {
  it('matches the crawl for the same thresholds', async () => {
    const { result } = await run();
    expect(countReachable(result, ROOT, THRESHOLDS)).toBe(result.nodes.size);
  });

  it('predicts the size for stricter thresholds without asking again', async () => {
    const { result, source } = await run();
    const before = source.asked.length;
    const strict = { ...THRESHOLDS, minGamesLichess: 120, minGamesMasters: 6 };
    const predicted = countReachable(result, ROOT, strict);
    expect(source.asked.length).toBe(before);

    const fresh = await run(strict);
    expect(predicted).toBe(fresh.result.nodes.size);
    expect(predicted).toBeLessThan(result.nodes.size);
  });
});
