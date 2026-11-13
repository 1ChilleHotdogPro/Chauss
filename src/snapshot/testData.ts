import { Chess } from 'chess.js';
import type { Score } from '../analysis/eval';
import type { ExplorerMove, ExplorerPosition } from '../explorer/types';
import { assembleSnapshot, positionsToEvaluate } from './assemble';
import { crawl, type CrawlSource, type CrawlThresholds } from './crawl';
import { positionKey, type Snapshot } from './format';

/**
 * A tiny made-up explorer for tests: for each position (given as the moves that reach it), the
 * moves each source "knows" and how many games each has. Not real statistics.
 */
export type FakeBook = Record<string, { masters?: Record<string, number>; lichess?: Record<string, number> }>;

/** The position after a sequence of moves in normal notation ("" = the start position). */
export function fenAfter(line: string): string {
  const chess = new Chess();
  for (const san of line.split(' ').filter(Boolean)) chess.move(san);
  return chess.fen();
}

function toPosition(
  fen: string,
  games: Record<string, number> | undefined,
  nameOf: (fen: string) => { eco: string; name: string } | null,
): ExplorerPosition {
  const moves: ExplorerMove[] = Object.entries(games ?? {}).map(([san, total]) => {
    const played = new Chess(fen).move(san);
    // Split the games 50% / 10% / 40% so the three numbers are all exercised.
    const white = Math.floor(total * 0.5);
    const draws = Math.floor(total * 0.1);
    return {
      uci: `${played.from}${played.to}${played.promotion ?? ''}`,
      san,
      white,
      draws,
      black: total - white - draws,
      averageRating: 1200,
      // Like Lichess: a move carries the name of the position it leads to, if that has one.
      opening: nameOf(played.after),
    };
  });
  return {
    white: moves.reduce((sum, move) => sum + move.white, 0),
    draws: moves.reduce((sum, move) => sum + move.draws, 0),
    black: moves.reduce((sum, move) => sum + move.black, 0),
    moves,
    opening: null,
  };
}

/** The opening moves used by the test trees. */
export const TEST_ROOT_LINE = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];

/**
 * Crawl a made-up book and assemble a snapshot from it, the way the real script does.
 * Every position gets the score +0.20 unless `scores` (by move line) says otherwise.
 */
export async function buildTestSnapshot(
  book: FakeBook,
  scores: Record<string, Score> = {},
  thresholds: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 },
): Promise<Snapshot> {
  const result = await crawl(fakeSource(book), { rootLine: TEST_ROOT_LINE, thresholds });
  const listing = { listShare: 0.01, maxListedMoves: 12 };
  const evals = new Map<string, Score>();
  for (const key of positionsToEvaluate(result, listing).keys()) evals.set(key, { type: 'cp', value: 20 });
  for (const [line, score] of Object.entries(scores)) evals.set(positionKey(fenAfter(line)), score);
  return assembleSnapshot(result, evals, {
    formatVersion: 1,
    createdAt: '2026-11-13T10:00:00.000Z',
    explorerHost: 'https://explorer.lichess.org',
    lichess: { ratings: [1000, 1200], speeds: ['blitz', 'rapid', 'classical'] },
    rootLine: TEST_ROOT_LINE,
    thresholds: { ...thresholds, ...listing },
    engine: { name: 'Test Engine', depth: 18 },
    counts: { explorerRequests: 0, evaluations: 0 },
  });
}

export interface FakeSource extends CrawlSource {
  /** Every request made, as "masters <moves>" / "lichess <moves>". */
  asked: string[];
}

export function fakeSource(book: FakeBook, names: Record<string, { eco: string; name: string }> = {}): FakeSource {
  const byKey = new Map<string, { line: string; entry: FakeBook[string] }>();
  for (const [line, entry] of Object.entries(book)) byKey.set(positionKey(fenAfter(line)), { line, entry });
  const nameByKey = new Map(Object.entries(names).map(([line, name]) => [positionKey(fenAfter(line)), name]));

  const asked: string[] = [];
  const answer = (source: 'masters' | 'lichess', fen: string): ExplorerPosition => {
    const found = byKey.get(positionKey(fen));
    asked.push(`${source} ${found?.line ?? fen}`);
    const nameOf = (positionFen: string) => nameByKey.get(positionKey(positionFen)) ?? null;
    const position = toPosition(fen, found?.entry[source], nameOf);
    position.opening = nameOf(fen);
    return position;
  };
  return {
    asked,
    masters: async (fen) => answer('masters', fen),
    lichess: async (fen) => answer('lichess', fen),
  };
}
