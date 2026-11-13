import { Chess } from 'chess.js';
import type { ExplorerMove, ExplorerPosition } from '../explorer/types';
import type { CrawlSource } from './crawl';
import { positionKey } from './format';

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

function toPosition(fen: string, games: Record<string, number> | undefined): ExplorerPosition {
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
      opening: null,
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
    const position = toPosition(fen, found?.entry[source]);
    position.opening = nameByKey.get(positionKey(fen)) ?? null;
    return position;
  };
  return {
    asked,
    masters: async (fen) => answer('masters', fen),
    lichess: async (fen) => answer('lichess', fen),
  };
}
