import { describe, expect, it } from 'vitest';
import { createMemoryCache } from './cache';
import { buildExplorerUrl, ExplorerClient, EXPLORER_HOST, type FetchLike } from './client';
import { parseExplorerPosition, totalGames } from './types';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const TOKEN = 'lip_testTokenNotReal123';

/** Shaped like the examples in the official API spec. */
const ANSWER = {
  white: 5061745,
  draws: 492487,
  black: 4458129,
  moves: [
    { uci: 'e2e4', san: 'e4', averageRating: 1806, white: 4517660, draws: 450366, black: 4016728, game: null, opening: null },
    {
      uci: 'd2d4',
      san: 'd4',
      averageRating: 1662,
      white: 236785,
      draws: 17561,
      black: 170379,
      game: null,
      opening: { eco: 'A40', name: "Queen's Pawn Game" },
    },
  ],
  topGames: [{ uci: 'e2e4', id: 'abcdefgh' }],
  recentGames: [],
  opening: null,
};

interface Call {
  url: string;
  headers: Record<string, string>;
}

type Reply = { status: number; body?: unknown; retryAfter?: string; invalidJson?: boolean } | { throws: string };

function fakeFetch(replies: Reply[]) {
  const calls: Call[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, headers: init.headers });
    const reply = replies.shift() ?? { status: 200, body: ANSWER };
    if ('throws' in reply) throw new Error(reply.throws);
    return {
      status: reply.status,
      ok: reply.status >= 200 && reply.status < 300,
      headers: { get: (name) => (name.toLowerCase() === 'retry-after' ? (reply.retryAfter ?? null) : null) },
      json: async () => {
        if (reply.invalidJson) throw new SyntaxError('Unexpected token');
        return reply.body;
      },
    };
  };
  return { fetch, calls };
}

function setup(replies: Reply[] = [], options: { token?: string | null; minIntervalMs?: number } = {}) {
  const { fetch, calls } = fakeFetch(replies);
  let time = 1_000_000;
  const sleeps: number[] = [];
  const state = { token: options.token === undefined ? TOKEN : options.token };
  const client = new ExplorerClient({
    fetch,
    getToken: () => state.token,
    cache: createMemoryCache(),
    now: () => time,
    minIntervalMs: options.minIntervalMs ?? 0,
    sleep: async (ms) => {
      sleeps.push(ms);
      time += ms;
    },
  });
  return {
    client,
    calls,
    sleeps,
    state,
    advance: (ms: number) => {
      time += ms;
    },
    now: () => time,
  };
}

describe('buildExplorerUrl', () => {
  it('builds a masters request', () => {
    const url = new URL(buildExplorerUrl(EXPLORER_HOST, 'masters', START));
    expect(url.origin + url.pathname).toBe('https://explorer.lichess.org/masters');
    expect(url.searchParams.get('fen')).toBe(START);
    expect(url.searchParams.get('topGames')).toBe('0');
    expect(url.searchParams.has('ratings')).toBe(false);
    expect(url.searchParams.has('speeds')).toBe(false);
  });

  it('builds a Lichess request with rating bands and speeds', () => {
    const url = new URL(
      buildExplorerUrl(EXPLORER_HOST, 'lichess', AFTER_E4, { ratings: [1200, 1000], speeds: ['rapid', 'blitz'] }),
    );
    expect(url.pathname).toBe('/lichess');
    expect(url.searchParams.get('variant')).toBe('standard');
    expect(url.searchParams.get('ratings')).toBe('1000,1200');
    expect(url.searchParams.get('speeds')).toBe('blitz,rapid');
    expect(url.searchParams.get('fen')).toBe(AFTER_E4);
    expect(url.searchParams.get('recentGames')).toBe('0');
  });

  it('gives the same address whatever order the choices are in', () => {
    const a = buildExplorerUrl(EXPLORER_HOST, 'lichess', START, { ratings: [1000, 1200], speeds: ['blitz', 'rapid'] });
    const b = buildExplorerUrl(EXPLORER_HOST, 'lichess', START, { ratings: [1200, 1000], speeds: ['rapid', 'blitz'] });
    expect(a).toBe(b);
  });

  it('encodes the FEN so spaces and slashes survive', () => {
    const url = buildExplorerUrl(EXPLORER_HOST, 'masters', START);
    expect(url).not.toContain(' ');
    expect(new URL(url).searchParams.get('fen')).toBe(START);
  });
});

describe('ExplorerClient', () => {
  it('returns the parsed answer and sends the token in the header only', async () => {
    const { client, calls } = setup();
    const result = await client.masters(START);

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.fromCache).toBe(false);
    expect(totalGames(result.data)).toBe(5061745 + 492487 + 4458129);
    expect(result.data.moves.map((m) => m.san)).toEqual(['e4', 'd4']);
    expect(result.data.moves[1]?.opening).toEqual({ eco: 'A40', name: "Queen's Pawn Game" });
    // Game lists are not kept.
    expect(result.data).not.toHaveProperty('topGames');

    expect(calls).toHaveLength(1);
    expect(calls[0]?.headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]?.url).not.toContain(TOKEN);
    expect(calls[0]?.url).not.toContain('lip_');
  });

  it('keeps masters and Lichess as separate requests', async () => {
    const { client, calls } = setup();
    await client.masters(START);
    await client.lichess(START, { ratings: [1000, 1200], speeds: ['blitz'] });
    expect(calls.map((c) => new URL(c.url).pathname)).toEqual(['/masters', '/lichess']);
  });

  it('answers a repeated question from the cache', async () => {
    const { client, calls } = setup();
    await client.masters(START);
    const again = await client.masters(START);
    expect(again.status).toBe('ok');
    if (again.status === 'ok') expect(again.fromCache).toBe(true);
    expect(calls).toHaveLength(1);
    expect(client.requestsSent()).toBe(1);
  });

  it('does not send anything without a token', async () => {
    const { client, calls } = setup([], { token: null });
    expect(await client.masters(START)).toEqual({ status: 'no-token' });
    const blank = setup([], { token: '   ' });
    expect(await blank.client.masters(START)).toEqual({ status: 'no-token' });
    expect(calls).toHaveLength(0);
    expect(blank.calls).toHaveLength(0);
  });

  it('picks up a token that is set later', async () => {
    const { client, calls, state } = setup([], { token: null });
    await client.masters(START);
    state.token = TOKEN;
    expect((await client.masters(START)).status).toBe('ok');
    expect(calls).toHaveLength(1);
  });

  it('reports a rejected token (401) and does not cache it', async () => {
    const { client, calls } = setup([{ status: 401 }]);
    expect(await client.masters(START)).toEqual({ status: 'unauthorized' });
    expect((await client.masters(START)).status).toBe('ok');
    expect(calls).toHaveLength(2);
  });

  it('after "too many requests" (429) sends nothing for at least a minute', async () => {
    const { client, calls, advance, now } = setup([{ status: 429 }]);
    const limited = await client.masters(START);
    expect(limited).toEqual({ status: 'rate-limited', retryAt: now() + 60_000 });

    // Any request, even a different one, is refused locally while waiting.
    advance(59_000);
    expect((await client.lichess(AFTER_E4, { ratings: [1000], speeds: ['blitz'] })).status).toBe('rate-limited');
    expect(calls).toHaveLength(1);

    advance(1_000);
    expect((await client.masters(START)).status).toBe('ok');
    expect(calls).toHaveLength(2);
  });

  it('waits longer when Lichess asks for more than a minute', async () => {
    const { client, now } = setup([{ status: 429, retryAfter: '300' }]);
    expect(await client.masters(START)).toEqual({ status: 'rate-limited', retryAt: now() + 300_000 });
  });

  it('never waits less than a minute, whatever the Retry-After header says', async () => {
    const { client, now } = setup([{ status: 429, retryAfter: '5' }]);
    expect(await client.masters(START)).toEqual({ status: 'rate-limited', retryAt: now() + 60_000 });
  });

  it('reports network failures without throwing', async () => {
    const { client } = setup([{ throws: 'Failed to fetch' }]);
    expect(await client.masters(START)).toEqual({ status: 'network-error', message: 'Failed to fetch' });
  });

  it('reports other HTTP errors and malformed answers', async () => {
    const server = setup([{ status: 503 }]);
    expect(await server.client.masters(START)).toEqual({ status: 'bad-response', message: 'HTTP 503' });

    const notJson = setup([{ status: 200, invalidJson: true }]);
    expect((await notJson.client.masters(START)).status).toBe('bad-response');

    const wrongShape = setup([{ status: 200, body: { hello: 'world' } }]);
    expect((await wrongShape.client.masters(START)).status).toBe('bad-response');
  });

  it('sends one request at a time, in order', async () => {
    const order: string[] = [];
    let active = 0;
    let maxActive = 0;
    const fetch: FetchLike = async (url) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      order.push(new URL(url).searchParams.get('fen') ?? '');
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return { status: 200, ok: true, headers: { get: () => null }, json: async () => ANSWER };
    };
    const client = new ExplorerClient({ fetch, getToken: () => TOKEN });

    await Promise.all([client.masters(START), client.masters(AFTER_E4), client.masters('8/8/8/8/8/8/8/K6k w - - 0 1')]);
    expect(maxActive).toBe(1);
    expect(order).toEqual([START, AFTER_E4, '8/8/8/8/8/8/8/K6k w - - 0 1']);
  });

  it('pauses between requests when asked to, but not for cache hits', async () => {
    const { client, sleeps } = setup([], { minIntervalMs: 1000 });
    await client.masters(START);
    await client.masters(AFTER_E4);
    await client.masters(START); // cached
    expect(sleeps).toEqual([1000]);
  });
});

describe('parseExplorerPosition', () => {
  it('rejects things that are not explorer answers', () => {
    expect(parseExplorerPosition(null)).toBeNull();
    expect(parseExplorerPosition('text')).toBeNull();
    expect(parseExplorerPosition({ white: 1, draws: 1, black: 1 })).toBeNull();
    expect(parseExplorerPosition({ white: 1, draws: 1, black: 1, moves: [{ san: 'e4' }] })).toBeNull();
    expect(parseExplorerPosition({ white: -1, draws: 1, black: 1, moves: [] })).toBeNull();
  });

  it('accepts a position with no moves and no opening name', () => {
    expect(parseExplorerPosition({ white: 0, draws: 0, black: 0, moves: [], opening: null })).toEqual({
      white: 0,
      draws: 0,
      black: 0,
      moves: [],
      opening: null,
    });
  });
});
