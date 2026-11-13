import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { assembleSnapshot, listedMoves, positionsToEvaluate, recommendReply, stringifySnapshot } from './assemble';
import { crawl, type CrawlNode, type CrawlThresholds } from './crawl';
import { positionKey, validateSnapshot, type Counts, type Snapshot, type SnapshotMeta } from './format';
import { fakeSource, fenAfter, type FakeBook } from './testData';

const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const P = 'e4 e5 Nf3 Nc6 c3';
const THRESHOLDS: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 };

const BOOK: FakeBook = {
  '': { lichess: { e4: 6000, d4: 4000 }, masters: { e4: 500, d4: 500 } },
  e4: { lichess: { e5: 5000, c5: 800 }, masters: { e5: 300, c5: 190 } },
  'e4 c5': { lichess: { Nf3: 700, Nc3: 100 }, masters: { Nf3: 180, Nc3: 10 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 500 }, masters: { c3: 10 } },
  // 1000 games: Nf6 and d5 are followed; d6 (2%) and Bc5 (1.5%) are only listed; h6 (0.5%) is too rare to list.
  [P]: { lichess: { Nf6: 600, d5: 360, d6: 20, Bc5: 15, h6: 5 }, masters: { Nf6: 6 } },
  [`${P} Nf6`]: { lichess: { d4: 500 }, masters: {} },
  [`${P} d5`]: { lichess: {}, masters: {} },
};

const key = (line: string) => positionKey(fenAfter(line));
const cp = (value: number): Score => ({ type: 'cp', value });

const META: Omit<SnapshotMeta, 'counts'> & { counts: { explorerRequests: number; evaluations: number } } = {
  formatVersion: 1,
  createdAt: '2026-11-13T10:00:00.000Z',
  explorerHost: 'https://explorer.lichess.org',
  lichess: { ratings: [1000, 1200], speeds: ['blitz', 'rapid', 'classical'] },
  rootLine: ROOT,
  thresholds: { ...THRESHOLDS, listShare: 0.01, maxListedMoves: 12 },
  engine: { name: 'Test Engine', depth: 18 },
  counts: { explorerRequests: 18, evaluations: 0 },
};

async function crawled() {
  return crawl(fakeSource(BOOK), { rootLine: ROOT, thresholds: THRESHOLDS });
}

describe('listedMoves', () => {
  it('keeps followed moves and other reasonably common ones, drops the rare rest', async () => {
    const result = await crawled();
    const ponziani = result.nodes.get(key(P))!;
    const listed = listedMoves(ponziani, { listShare: 0.01, maxListedMoves: 12 });
    expect(listed.map((m) => m.san)).toEqual(['Nf6', 'd5', 'd6', 'Bc5']);
  });

  it('never drops a followed move to respect the maximum', async () => {
    const result = await crawled();
    const ponziani = result.nodes.get(key(P))!;
    expect(listedMoves(ponziani, { listShare: 0.01, maxListedMoves: 3 }).map((m) => m.san)).toEqual(['Nf6', 'd5', 'd6']);
    expect(listedMoves(ponziani, { listShare: 0.01, maxListedMoves: 1 }).map((m) => m.san)).toEqual(['Nf6', 'd5']);
  });

  it('lists a move that is common only among masters', () => {
    const node: CrawlNode = {
      key: 'k',
      fen: fenAfter(P),
      ply: 5,
      kind: 'tree',
      masters: [10, 5, 5],
      lichess: [5000, 0, 5000],
      moves: [
        { uci: 'g8f6', san: 'Nf6', masters: [9, 5, 5], lichess: [5000, 0, 4990], fenAfter: 'x' },
        { uci: 'f7f5', san: 'f5', masters: [1, 0, 0], lichess: [0, 0, 10], fenAfter: 'y' }, // 5% of masters, 0.1% of Lichess
        { uci: 'h7h6', san: 'h6', masters: [0, 0, 0], lichess: [0, 0, 5], fenAfter: 'z' },
      ],
    };
    expect(listedMoves(node, { listShare: 0.01, maxListedMoves: 12 }).map((m) => m.san)).toEqual(['Nf6', 'f5']);
  });
});

describe('positionsToEvaluate', () => {
  it('covers every stored position and the result of every listed move, each once', async () => {
    const result = await crawled();
    const positions = positionsToEvaluate(result, { listShare: 0.01, maxListedMoves: 12 });

    for (const node of result.nodes.values()) expect(positions.get(node.key)).toBe(node.fen);
    // Listed but not followed: its resulting position still gets a score.
    expect(positions.has(key(`${P} d6`))).toBe(true);
    expect(positions.has(key(`${P} Bc5`))).toBe(true);
    // Too rare to list: no score needed.
    expect(positions.has(key(`${P} h6`))).toBe(false);
    // White's other first move is listed at the start position.
    expect(positions.has(key('d4'))).toBe(true);
    expect(new Set(positions.keys()).size).toBe(positions.size);
  });
});

describe('recommendReply', () => {
  const move = (uci: string, masters: number, score: Score | undefined) => ({
    uci,
    masters: [masters, 0, 0] as Counts,
    eval: score,
  });

  it("recommends the masters' favourite when the engine is content with it", () => {
    // White to move: +0.30 for the favourite, +0.45 for the engine's pick: about 1.4 points apart.
    expect(recommendReply([move('g1f3', 180, cp(30)), move('b1c3', 10, cp(45))], 'white')).toBe('g1f3');
  });

  it("recommends the best-scoring masters move when the favourite gives away too much", () => {
    // +0.00 against +1.50 is about 13 points of winning chances.
    expect(recommendReply([move('g1f3', 180, cp(0)), move('b1c3', 10, cp(150))], 'white')).toBe('b1c3');
  });

  it('does not recommend a move no master has played, even if the engine loves it', () => {
    const moves = [move('g1f3', 180, cp(0)), move('b1c3', 10, cp(20)), move('h2h4', 0, cp(300))];
    expect(recommendReply(moves, 'white')).toBe('b1c3');
  });

  it("judges from Black's side when Black is to move", () => {
    // Scores are from White's view: -1.50 is good for Black.
    expect(recommendReply([move('g8f6', 180, cp(0)), move('d7d5', 10, cp(-150))], 'black')).toBe('d7d5');
    expect(recommendReply([move('g8f6', 180, cp(-140)), move('d7d5', 10, cp(-150))], 'black')).toBe('g8f6');
  });

  it('falls back to the best-scoring move when masters have no games', () => {
    expect(recommendReply([move('g1f3', 0, cp(10)), move('b1c3', 0, cp(40))], 'white')).toBe('b1c3');
  });

  it('ignores moves without a score, and gives nothing when no move has one', () => {
    expect(recommendReply([move('g1f3', 180, undefined), move('b1c3', 10, cp(20))], 'white')).toBe('b1c3');
    expect(recommendReply([move('g1f3', 180, undefined)], 'white')).toBeUndefined();
    expect(recommendReply([], 'white')).toBeUndefined();
  });
});

describe('assembleSnapshot', () => {
  async function build(): Promise<Snapshot> {
    const result = await crawled();
    const evals = new Map<string, Score>();
    for (const positionKeyValue of positionsToEvaluate(result, { listShare: 0.01, maxListedMoves: 12 }).keys()) {
      evals.set(positionKeyValue, cp(20));
    }
    evals.set(key('e4 c5 Nf3'), cp(35));
    evals.set(key('e4 c5 Nc3'), cp(25));
    return assembleSnapshot(result, evals, { ...META, counts: { explorerRequests: 18, evaluations: evals.size } });
  }

  it('produces a snapshot that passes validation', async () => {
    expect(validateSnapshot(await build())).toEqual([]);
  });

  it('keeps both sources separate on every position and move', async () => {
    const snapshot = await build();
    const ponziani = snapshot.nodes[key(P)]!;
    expect(ponziani.kind).toBe('tree');
    // Sum over the five moves of the 50% / 10% / 40% split used by the test data.
    expect(ponziani.lichess).toEqual([499, 99, 402]);
    expect(ponziani.masters).toEqual([3, 0, 3]);
    const nf6 = ponziani.moves[0]!;
    expect(nf6).toMatchObject({ uci: 'g8f6', san: 'Nf6', lichess: [300, 60, 240], masters: [3, 0, 3] });
  });

  it('links followed moves to their positions and leaves the others unlinked', async () => {
    const snapshot = await build();
    const ponziani = snapshot.nodes[key(P)]!;
    expect(ponziani.moves.map((m) => m.san)).toEqual(['Nf6', 'd5', 'd6', 'Bc5']);
    expect(ponziani.moves[0]?.next).toBe(key(`${P} Nf6`));
    expect(ponziani.moves[1]?.next).toBe(key(`${P} d5`));
    expect(ponziani.moves[2]?.next).toBeUndefined();
    expect(ponziani.moves.every((m) => m.eval !== undefined)).toBe(true);
    expect(ponziani.eval).toEqual(cp(20));
  });

  it('gives each sideline one recommended reply', async () => {
    const snapshot = await build();
    const sicilian = snapshot.nodes[key('e4 c5')]!;
    expect(sicilian.kind).toBe('sideline');
    expect(sicilian.recommended).toBe('g1f3');
    expect(sicilian.moves.every((m) => m.next === undefined)).toBe(true);
    // Only sidelines carry a recommendation.
    expect(snapshot.nodes[key(P)]?.recommended).toBeUndefined();
  });

  it('counts positions and moves in the meta data', async () => {
    const snapshot = await build();
    expect(snapshot.meta.counts.positions).toBe(Object.keys(snapshot.nodes).length);
    expect(snapshot.meta.counts.moves).toBe(
      Object.values(snapshot.nodes).reduce((sum, node) => sum + node.moves.length, 0),
    );
    expect(snapshot.meta.counts.explorerRequests).toBe(18);
    expect(snapshot.rootKey).toBe(key(''));
  });

  it('writes one position per line and reads back identically', async () => {
    const snapshot = await build();
    const text = stringifySnapshot(snapshot);
    expect(JSON.parse(text)).toEqual(snapshot);
    expect(text.split('\n').length).toBe(Object.keys(snapshot.nodes).length + 5);
    expect(text.endsWith('}}\n')).toBe(true);
  });
});

describe('validateSnapshot', () => {
  async function good(): Promise<Snapshot> {
    const result = await crawled();
    return assembleSnapshot(result, new Map(), { ...META, counts: { explorerRequests: 0, evaluations: 0 } });
  }
  const broken = async (change: (snapshot: Snapshot) => void): Promise<string[]> => {
    const snapshot = structuredClone(await good());
    change(snapshot);
    return validateSnapshot(snapshot);
  };

  it('rejects things that are not snapshots', () => {
    expect(validateSnapshot(null)).toEqual(['not an object']);
    expect(validateSnapshot({})).toContain('nodes is missing');
    expect(validateSnapshot({ meta: {}, nodes: {} })).toContain('rootKey does not name a position');
  });

  it('catches a wrong format version and a bad date', async () => {
    expect(await broken((s) => ((s.meta as { formatVersion: number }).formatVersion = 2))).toContain('meta.formatVersion is not 1');
    expect(await broken((s) => (s.meta.createdAt = 'yesterday'))).toContain('meta.createdAt is not a date');
  });

  it('catches a link to a position that is not there', async () => {
    const problems = await broken((s) => (s.nodes[key(P)]!.moves[0]!.next = 'nowhere'));
    expect(problems.join('\n')).toMatch(/next points to a position that is not in the snapshot/);
  });

  it('catches bad counts, bad moves and a wrong key', async () => {
    expect((await broken((s) => (s.nodes[key(P)]!.lichess = [1, 2] as unknown as Counts))).join('\n')).toMatch(/bad lichess counts/);
    expect((await broken((s) => (s.nodes[key(P)]!.moves[0]!.uci = 'Nf6'))).join('\n')).toMatch(/bad uci/);
    expect((await broken((s) => s.nodes[key(P)]!.moves.push({ ...s.nodes[key(P)]!.moves[0]! }))).join('\n')).toMatch(/listed twice/);
    expect((await broken((s) => (s.nodes[key(P)]!.fen = fenAfter('e4')))).join('\n')).toMatch(/fen does not match its key/);
    expect((await broken((s) => (s.nodes[key('e4 c5')]!.recommended = 'a2a3'))).join('\n')).toMatch(/recommended move is not one of its moves/);
    expect((await broken((s) => (s.nodes[key(P)]!.eval = { type: 'cp' } as unknown as Score))).join('\n')).toMatch(/bad eval/);
  });
});
