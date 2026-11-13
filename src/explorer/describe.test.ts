import { describe, expect, it } from 'vitest';
import { describeResult } from './describe';
import type { ExplorerPosition } from './types';

const position: ExplorerPosition = {
  white: 1_000_000,
  draws: 100_000,
  black: 900_000,
  moves: [{ uci: 'e2e4', san: 'e4', white: 600_000, draws: 50_000, black: 500_000, averageRating: 1200, opening: null }],
  opening: null,
};

describe('describeResult', () => {
  it('reports success with the number of games and the top move', () => {
    expect(describeResult({ status: 'ok', data: position, fromCache: false })).toEqual({
      ok: true,
      text: 'Connected. 2,000,000 games in this position; most played move: e4.',
    });
  });

  it('reports success even when there are no games', () => {
    const empty = { ...position, white: 0, draws: 0, black: 0, moves: [] };
    const described = describeResult({ status: 'ok', data: empty, fromCache: false });
    expect(described.ok).toBe(true);
    expect(described.text).toContain('no games');
  });

  it('explains each problem in plain words', () => {
    expect(describeResult({ status: 'no-token' }).text).toMatch(/No token set/);
    expect(describeResult({ status: 'unauthorized' }).text).toMatch(/rejected the token \(error 401\)/);
    expect(describeResult({ status: 'network-error', message: 'Failed to fetch' }).text).toBe(
      'Could not reach Lichess. Check your internet connection. (Failed to fetch)',
    );
    expect(describeResult({ status: 'bad-response', message: 'HTTP 503' }).text).toBe(
      'Lichess sent an unexpected answer. (HTTP 503)',
    );
    for (const status of ['no-token', 'unauthorized'] as const) {
      expect(describeResult({ status }).ok).toBe(false);
    }
  });

  it('says how long to wait when rate-limited', () => {
    const described = describeResult({ status: 'rate-limited', retryAt: 160_000 }, 100_500);
    expect(described.ok).toBe(false);
    expect(described.text).toBe(
      'Lichess says: too many requests (error 429). Wait about 60 seconds before trying again.',
    );
    // Never "0 seconds" or a negative number.
    expect(describeResult({ status: 'rate-limited', retryAt: 100 }, 5000).text).toContain('about 1 seconds');
  });
});
