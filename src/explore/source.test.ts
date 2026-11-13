import { describe, expect, it } from 'vitest';
import { defaultSettings, type ExplorerSettings } from '../explorer/settings';
import type { ExplorerPosition, ExplorerResult } from '../explorer/types';
import { positionKey, type Snapshot } from '../snapshot/format';
import { ExploreSource } from './source';

const PONZIANI = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';
const ELSEWHERE = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const SNAPSHOT: Snapshot = {
  meta: {
    formatVersion: 1,
    createdAt: '2026-11-13T10:00:00.000Z',
    explorerHost: 'https://explorer.lichess.org',
    lichess: { ratings: [1000, 1200], speeds: ['blitz', 'rapid', 'classical'] },
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'c3'],
    thresholds: { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, listShare: 0.01, maxListedMoves: 12, maxPly: 24, maxPositions: 800 },
    engine: { name: 'Test Engine', depth: 18 },
    counts: { positions: 1, moves: 1, explorerRequests: 2, evaluations: 2 },
  },
  rootKey: positionKey(PONZIANI),
  nodes: {
    [positionKey(PONZIANI)]: {
      fen: PONZIANI,
      ply: 5,
      kind: 'tree',
      opening: { eco: 'C44', name: 'Ponziani Opening' },
      masters: [40, 40, 20],
      lichess: [500, 100, 400],
      eval: { type: 'cp', value: 15 },
      moves: [
        { uci: 'g8f6', san: 'Nf6', masters: [30, 30, 10], lichess: [300, 60, 240], eval: { type: 'cp', value: 15 }, next: 'somewhere' },
      ],
    },
  },
};

/** Live answers: a different (made-up) spread than the snapshot, so the two can be told apart. */
const LIVE_LICHESS: ExplorerPosition = {
  white: 70,
  draws: 10,
  black: 20,
  moves: [
    { uci: 'f8c5', san: 'Bc5', white: 50, draws: 5, black: 5, averageRating: 1700, opening: null },
    { uci: 'g8f6', san: 'Nf6', white: 20, draws: 5, black: 15, averageRating: 1700, opening: null },
  ],
  opening: { eco: 'C44', name: 'Ponziani Opening' },
};
const LIVE_MASTERS: ExplorerPosition = {
  white: 4,
  draws: 4,
  black: 2,
  moves: [{ uci: 'g8f6', san: 'Nf6', white: 4, draws: 4, black: 2, averageRating: 2500, opening: null }],
  opening: null,
};

function setup(options: {
  snapshot?: Snapshot | null | undefined;
  settings?: Partial<ExplorerSettings>;
  masters?: ExplorerResult;
  lichess?: ExplorerResult;
  liveDelayMs?: number;
} = {}) {
  const calls: string[] = [];
  let updates = 0;
  const settings = { ...defaultSettings(), ...options.settings };
  const state = { snapshot: 'snapshot' in options ? options.snapshot : SNAPSHOT };
  const source = new ExploreSource({
    snapshot: () => state.snapshot,
    settings: () => settings,
    client: {
      masters: async (fen) => {
        calls.push(`masters ${fen}`);
        return options.masters ?? { status: 'ok', data: LIVE_MASTERS, fromCache: false };
      },
      lichess: async (fen, filter) => {
        calls.push(`lichess ${fen} ${filter.ratings.join(',')} ${filter.speeds.join(',')}`);
        return options.lichess ?? { status: 'ok', data: LIVE_LICHESS, fromCache: false };
      },
    },
    onUpdate: () => {
      updates += 1;
    },
    liveDelayMs: options.liveDelayMs ?? 0,
  });
  /** Let the pending live requests finish. */
  const settle = (ms = 5) => new Promise((resolve) => setTimeout(resolve, ms));
  return { source, calls, settle, updates: () => updates, state };
}

describe('ExploreSource', () => {
  it('is loading until the bundled data has arrived', () => {
    const { source, calls } = setup({ snapshot: undefined });
    expect(source.view(PONZIANI)).toEqual({ status: 'loading' });
    expect(calls).toEqual([]);
  });

  it('uses the bundled data when it covers the position and matches the chosen groups', () => {
    const { source, calls } = setup({ settings: { token: 'lip_x' } });
    const view = source.view(PONZIANI);
    expect(view.status).toBe('ready');
    if (view.status !== 'ready') return;
    expect(view.origin).toBe('snapshot');
    expect(view.note).toBeUndefined();
    expect(view.position.opening?.name).toBe('Ponziani Opening');
    expect(view.position.popularGames).toBe(1000);
    // No request to Lichess, even though a token is set.
    expect(calls).toEqual([]);
  });

  it('treats the same groups in another order as the same choice', () => {
    const { source, calls } = setup({ settings: { ratings: [1200, 1000], speeds: ['classical', 'blitz', 'rapid'] } });
    expect(source.view(PONZIANI)).toMatchObject({ status: 'ready', origin: 'snapshot' });
    expect(calls).toEqual([]);
  });

  it('explains what to do for a position outside the bundled data when no token is set', () => {
    const { source, calls } = setup();
    const view = source.view(ELSEWHERE);
    expect(view.status).toBe('unavailable');
    if (view.status === 'unavailable') expect(view.reason).toMatch(/outside the bundled opening data.*token in Settings/);
    expect(calls).toEqual([]);
  });

  it('looks up a position outside the bundled data live when a token is set', async () => {
    const { source, calls, settle, updates } = setup({ settings: { token: 'lip_x' } });
    expect(source.view(ELSEWHERE)).toEqual({ status: 'loading' });
    await settle();
    expect(updates()).toBe(1);

    const view = source.view(ELSEWHERE);
    expect(view).toMatchObject({ status: 'ready', origin: 'live' });
    if (view.status === 'ready') {
      expect(view.position.popularGames).toBe(100);
      expect(view.position.bookGames).toBe(10);
    }
    // One masters and one Lichess request, with the chosen groups.
    expect(calls).toEqual([`masters ${ELSEWHERE}`, `lichess ${ELSEWHERE} 1000,1200 blitz,rapid,classical`]);

    // Looking again does not ask again.
    source.view(ELSEWHERE);
    source.view(ELSEWHERE);
    await settle();
    expect(calls).toHaveLength(2);
  });

  it('uses live data for other rating groups, keeping the bundled Stockfish scores', async () => {
    const { source, settle } = setup({ settings: { token: 'lip_x', ratings: [1600] } });
    expect(source.view(PONZIANI)).toEqual({ status: 'loading' });
    await settle();

    const view = source.view(PONZIANI);
    expect(view).toMatchObject({ status: 'ready', origin: 'live' });
    if (view.status !== 'ready') return;
    expect(view.position.popularMoves.map((m) => m.san)).toEqual(['Bc5', 'Nf6']);
    expect(view.position.popularGames).toBe(100);
    // Scores and links do not depend on rating groups: reused where the snapshot has them.
    const nf6 = view.position.moves.find((m) => m.san === 'Nf6')!;
    expect(nf6.eval).toEqual({ type: 'cp', value: 15 });
    expect(nf6.next).toBe('somewhere');
    expect(view.position.moves.find((m) => m.san === 'Bc5')?.eval).toBeUndefined();
    expect(view.position.eval).toEqual({ type: 'cp', value: 15 });
  });

  it('falls back to the bundled data, with a note, for other groups when no token is set', () => {
    const { source, calls } = setup({ settings: { ratings: [1600] } });
    const view = source.view(PONZIANI);
    expect(view).toMatchObject({ status: 'ready', origin: 'snapshot' });
    if (view.status === 'ready') {
      expect(view.note).toMatch(/no Lichess token is set\. Showing the bundled data instead \(Lichess games rated 1000-1399\)/);
      expect(view.position.popularGames).toBe(1000);
    }
    expect(calls).toEqual([]);
  });

  it('falls back to the bundled data, with the reason, when the live lookup fails', async () => {
    const { source, settle } = setup({ settings: { token: 'lip_bad', ratings: [1600] }, masters: { status: 'unauthorized' } });
    source.view(PONZIANI);
    await settle();
    const view = source.view(PONZIANI);
    expect(view).toMatchObject({ status: 'ready', origin: 'snapshot' });
    if (view.status === 'ready') expect(view.note).toMatch(/rejected the token.*Showing the bundled data instead/);
  });

  it('says why when a live lookup fails and there is no bundled data to fall back on', async () => {
    const { source, settle, calls } = setup({
      settings: { token: 'lip_x' },
      lichess: { status: 'rate-limited', retryAt: Date.now() + 60_000 },
    });
    source.view(ELSEWHERE);
    await settle();
    const view = source.view(ELSEWHERE);
    expect(view.status).toBe('unavailable');
    if (view.status === 'unavailable') expect(view.reason).toMatch(/too many requests/);
    expect(calls).toHaveLength(2);
  });

  it('does not ask Lichess for the second source when the first already failed', async () => {
    const { source, settle, calls } = setup({ settings: { token: 'lip_x' }, masters: { status: 'unauthorized' } });
    source.view(ELSEWHERE);
    await settle();
    expect(calls).toEqual([`masters ${ELSEWHERE}`]);
  });

  it('retries a failed lookup only after a pause', async () => {
    const { source, settle, calls } = setup({ settings: { token: 'lip_x' }, masters: { status: 'network-error', message: 'offline' } });
    const start = Date.now();
    source.view(ELSEWHERE, start);
    await settle();
    source.view(ELSEWHERE, start + 5_000);
    await settle();
    expect(calls).toHaveLength(1);
    source.view(ELSEWHERE, Date.now() + 20_000);
    await settle();
    expect(calls).toHaveLength(2);
  });

  it('waits a moment before asking Lichess, and asks only about the position still wanted', async () => {
    const OTHER = 'rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1';
    const { source, settle, calls } = setup({ settings: { token: 'lip_x' }, liveDelayMs: 40 });

    // Clicking quickly through two positions: neither has been asked about yet.
    expect(source.view(ELSEWHERE)).toEqual({ status: 'loading' });
    expect(source.view(OTHER)).toEqual({ status: 'loading' });
    await settle(10);
    expect(calls).toEqual([]);

    // After the pause only the position that is still wanted is looked up.
    await settle(60);
    expect(calls).toEqual([`masters ${OTHER}`, `lichess ${OTHER} 1000,1200 blitz,rapid,classical`]);
    expect(source.view(OTHER)).toMatchObject({ status: 'ready', origin: 'live' });

    // Coming back to the first one starts its own (delayed) lookup.
    expect(source.view(ELSEWHERE)).toEqual({ status: 'loading' });
    await settle(60);
    expect(calls).toHaveLength(4);
  });

  it('works without any bundled data at all (it failed to load)', async () => {
    const { source, settle } = setup({ snapshot: null, settings: { token: 'lip_x' } });
    expect(source.view(PONZIANI)).toEqual({ status: 'loading' });
    await settle();
    expect(source.view(PONZIANI)).toMatchObject({ status: 'ready', origin: 'live' });

    const noToken = setup({ snapshot: null });
    expect(noToken.source.view(PONZIANI).status).toBe('unavailable');
  });
});
