import { describe, expect, it } from 'vitest';
import type { ExplorerPosition, ExplorerResult, LichessFilter } from '../explorer/types';
import { CrawlAbort, createPoliteSource } from './politeSource';

const FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FILTER: LichessFilter = { ratings: [1000, 1200], speeds: ['blitz'] };
const DATA: ExplorerPosition = { white: 1, draws: 2, black: 3, moves: [], opening: null };
const OK: ExplorerResult = { status: 'ok', data: DATA, fromCache: false };

/** A client that gives the scripted answers in order, with a clock that only moves when "sleeping". */
function setup(answers: ExplorerResult[]) {
  let time = 0;
  const sleeps: number[] = [];
  const logs: string[] = [];
  const calls: string[] = [];
  const next = (): ExplorerResult => {
    const answer = answers.shift() ?? OK;
    // The real client computes retryAt from its own clock; mimic "one minute from now".
    return answer.status === 'rate-limited' ? { status: 'rate-limited', retryAt: time + 60_000 } : answer;
  };
  const source = createPoliteSource(
    {
      masters: async (fen) => {
        calls.push(`masters ${fen}`);
        return next();
      },
      lichess: async (fen, filter) => {
        calls.push(`lichess ${fen} ${filter.ratings.join(',')} ${filter.speeds.join(',')}`);
        return next();
      },
    },
    FILTER,
    {
      now: () => time,
      sleep: async (ms) => {
        sleeps.push(ms);
        time += ms;
      },
      log: (message) => logs.push(message),
    },
  );
  return { source, sleeps, logs, calls };
}

const LIMITED: ExplorerResult = { status: 'rate-limited', retryAt: 0 };

describe('createPoliteSource', () => {
  it('returns the data and passes the chosen filter to Lichess requests', async () => {
    const { source, calls, sleeps } = setup([]);
    expect(await source.masters(FEN)).toBe(DATA);
    expect(await source.lichess(FEN)).toBe(DATA);
    expect(calls).toEqual([`masters ${FEN}`, `lichess ${FEN} 1000,1200 blitz`]);
    expect(sleeps).toEqual([]);
  });

  it('waits a minute after "too many requests", then carries on', async () => {
    const { source, sleeps, logs, calls } = setup([LIMITED, OK]);
    expect(await source.masters(FEN)).toBe(DATA);
    expect(sleeps).toEqual([60_000]);
    expect(calls).toHaveLength(2);
    expect(logs[0]).toMatch(/Too many requests \(HTTP 429\)\. Waiting 60 s/);
  });

  it('waits longer each time the limit repeats: 1, 2, 3, 5, 9 minutes', async () => {
    const { source, sleeps } = setup([LIMITED, LIMITED, LIMITED, LIMITED, LIMITED, OK]);
    expect(await source.masters(FEN)).toBe(DATA);
    expect(sleeps).toEqual([60_000, 120_000, 180_000, 300_000, 540_000]);
    expect(sleeps.every((ms) => ms >= 60_000)).toBe(true);
  });

  it('gives up cleanly when the limit never lifts', async () => {
    const { source, calls } = setup(Array.from({ length: 10 }, () => LIMITED));
    await expect(source.masters(FEN)).rejects.toThrow(CrawlAbort);
    expect(calls).toHaveLength(6); // the first try plus five retries
  });

  it('stops at once on a missing or rejected token', async () => {
    const missing = setup([{ status: 'no-token' }]);
    await expect(missing.source.masters(FEN)).rejects.toThrow(/No Lichess token found/);
    expect(missing.calls).toHaveLength(1);
    expect(missing.sleeps).toEqual([]);

    const rejected = setup([{ status: 'unauthorized' }]);
    await expect(rejected.source.lichess(FEN)).rejects.toThrow(/rejected the token \(HTTP 401\)/);
    expect(rejected.calls).toHaveLength(1);
  });

  it('retries network trouble a few times with a pause, then gives up', async () => {
    const flaky = setup([{ status: 'network-error', message: 'ECONNRESET' }, { status: 'bad-response', message: 'HTTP 502' }, OK]);
    expect(await flaky.source.masters(FEN)).toBe(DATA);
    expect(flaky.sleeps).toEqual([5_000, 5_000]);

    const dead = setup(Array.from({ length: 10 }, () => ({ status: 'network-error', message: 'offline' }) as const));
    await expect(dead.source.masters(FEN)).rejects.toThrow(/Giving up on a masters request: offline/);
    expect(dead.calls).toHaveLength(4); // the first try plus three retries
  });

  it('counts retries per request, not for the whole crawl', async () => {
    const { source } = setup([LIMITED, OK, LIMITED, OK, LIMITED, OK, LIMITED, OK, LIMITED, OK, LIMITED, OK, LIMITED, OK]);
    for (let i = 0; i < 7; i++) expect(await source.masters(FEN)).toBe(DATA);
  });
});
