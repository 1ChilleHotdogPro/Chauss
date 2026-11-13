import { describe, expect, it } from 'vitest';
import type { SnapshotMeta } from './format';
import { describeSnapshot } from './load';

const META: SnapshotMeta = {
  formatVersion: 1,
  createdAt: '2026-11-13T23:30:00.000Z',
  explorerHost: 'https://explorer.lichess.org',
  lichess: { ratings: [1000, 1200], speeds: ['blitz', 'rapid', 'classical'] },
  rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'c3'],
  thresholds: {
    minShare: 0.03,
    minGamesLichess: 2000,
    minGamesMasters: 5,
    listShare: 0.01,
    maxListedMoves: 12,
    maxPly: 24,
    maxPositions: 800,
  },
  engine: { name: 'Stockfish 19 Lite WASM', depth: 18 },
  counts: { positions: 1234, moves: 9876, explorerRequests: 2468, evaluations: 5000 },
};

describe('describeSnapshot', () => {
  it('says how big it is, when it was built and from what', () => {
    expect(describeSnapshot(META)).toBe(
      '1,234 positions, built on 13 November 2026 from master games and Lichess games rated 1000-1399 ' +
        '(blitz, rapid, classical). Scores by Stockfish 19 Lite WASM at depth 18.',
    );
  });

  it('uses the UTC date, whatever the time zone of the reader', () => {
    expect(describeSnapshot({ ...META, createdAt: '2026-01-01T00:10:00.000Z' })).toContain('1 January 2026');
  });
});
