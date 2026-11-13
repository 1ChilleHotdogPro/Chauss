import type { ExplorerCache } from './cache';
import {
  parseExplorerPosition,
  type ExplorerResult,
  type ExplorerSource,
  type LichessFilter,
} from './types';

export const EXPLORER_HOST = 'https://explorer.lichess.org';

/** Lichess asks to wait a minute after "too many requests" (HTTP 429). */
const MIN_RATE_LIMIT_WAIT_MS = 60_000;

/** How many moves to ask for per position. */
const MOVES_PER_POSITION = 20;

/** The part of the Fetch API that is used; lets tests pass a stand-in. */
export type FetchLike = (
  url: string,
  init: { headers: Record<string, string> },
) => Promise<{
  status: number;
  ok: boolean;
  headers: { get(name: string): string | null };
  json(): Promise<unknown>;
}>;

export interface ExplorerClientOptions {
  fetch: FetchLike;
  /** Returns the personal Lichess token, or null/empty when none is set. Asked before every request. */
  getToken: () => string | null;
  cache?: ExplorerCache;
  host?: string;
  now?: () => number;
  /** Minimum pause between two requests that really go out (0 = none). */
  minIntervalMs?: number;
  /** Waits; only replaced in tests. */
  sleep?: (ms: number) => Promise<void>;
}

export interface RequestOptions {
  /** Ask Lichess even if the answer is remembered (the fresh answer is still stored). */
  skipCache?: boolean;
}

/**
 * The address for one question to the explorer. The token is NOT part of it — it travels in a
 * header — so addresses are safe to log and to use as cache keys.
 */
export function buildExplorerUrl(
  host: string,
  source: ExplorerSource,
  fen: string,
  filter?: LichessFilter,
): string {
  const params = new URLSearchParams();
  if (source === 'lichess') {
    params.set('variant', 'standard');
    // Sorted, so the same choice always gives the same address (and cache entry).
    if (filter && filter.speeds.length > 0) params.set('speeds', [...filter.speeds].sort().join(','));
    if (filter && filter.ratings.length > 0) {
      params.set('ratings', [...filter.ratings].sort((a, b) => a - b).join(','));
    }
    params.set('recentGames', '0');
  }
  params.set('fen', fen);
  params.set('moves', String(MOVES_PER_POSITION));
  params.set('topGames', '0');
  return `${host}/${source}?${params.toString()}`;
}

/**
 * Asks the Lichess opening explorer, politely:
 * one request at a time, answers remembered, and after a "too many requests" reply nothing is
 * sent again until the waiting time is over.
 */
export class ExplorerClient {
  private readonly fetch: FetchLike;
  private readonly getToken: () => string | null;
  private readonly cache: ExplorerCache | undefined;
  private readonly host: string;
  private readonly now: () => number;
  private readonly minIntervalMs: number;
  private readonly sleep: (ms: number) => Promise<void>;

  /** Requests run one after another along this chain. */
  private queue: Promise<unknown> = Promise.resolve();
  private retryAt = 0;
  private lastRequestAt = Number.NEGATIVE_INFINITY;
  private sent = 0;

  constructor(options: ExplorerClientOptions) {
    this.fetch = options.fetch;
    this.getToken = options.getToken;
    this.cache = options.cache;
    this.host = options.host ?? EXPLORER_HOST;
    this.now = options.now ?? Date.now;
    this.minIntervalMs = options.minIntervalMs ?? 0;
    this.sleep = options.sleep ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  }

  /** The book: master games. */
  masters(fen: string, options: RequestOptions = {}): Promise<ExplorerResult> {
    return this.request(buildExplorerUrl(this.host, 'masters', fen), options);
  }

  /** Games played on Lichess in the given rating bands and speeds. */
  lichess(fen: string, filter: LichessFilter, options: RequestOptions = {}): Promise<ExplorerResult> {
    return this.request(buildExplorerUrl(this.host, 'lichess', fen, filter), options);
  }

  /** How many requests have really been sent to Lichess (cache hits do not count). */
  requestsSent(): number {
    return this.sent;
  }

  private request(url: string, options: RequestOptions): Promise<ExplorerResult> {
    const run = this.queue.then(() => this.perform(url, options));
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async perform(url: string, options: RequestOptions): Promise<ExplorerResult> {
    const cached = options.skipCache ? undefined : this.cache?.get(url);
    if (cached) return { status: 'ok', data: cached, fromCache: true };

    const token = this.getToken()?.trim();
    if (!token) return { status: 'no-token' };

    if (this.now() < this.retryAt) return { status: 'rate-limited', retryAt: this.retryAt };

    const wait = this.lastRequestAt + this.minIntervalMs - this.now();
    if (wait > 0) await this.sleep(wait);

    let response: Awaited<ReturnType<FetchLike>>;
    this.lastRequestAt = this.now();
    this.sent += 1;
    try {
      response = await this.fetch(url, {
        headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      });
    } catch (error) {
      return { status: 'network-error', message: error instanceof Error ? error.message : String(error) };
    }

    if (response.status === 401) return { status: 'unauthorized' };
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'));
      const asked = Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 0;
      this.retryAt = this.now() + Math.max(MIN_RATE_LIMIT_WAIT_MS, asked);
      return { status: 'rate-limited', retryAt: this.retryAt };
    }
    if (!response.ok) return { status: 'bad-response', message: `HTTP ${response.status}` };

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { status: 'bad-response', message: 'The answer was not valid JSON.' };
    }
    const data = parseExplorerPosition(body);
    if (!data) return { status: 'bad-response', message: 'The answer did not have the expected fields.' };

    this.cache?.set(url, data);
    return { status: 'ok', data, fromCache: false };
  }
}
