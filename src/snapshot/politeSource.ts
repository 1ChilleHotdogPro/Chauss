import type { ExplorerClient } from '../explorer/client';
import type { ExplorerPosition, ExplorerResult, LichessFilter } from '../explorer/types';
import type { CrawlSource } from './crawl';

/** A problem the crawl cannot recover from; the message is safe to show (it never holds the token). */
export class CrawlAbort extends Error {}

export interface PoliteOptions {
  now: () => number;
  sleep: (ms: number) => Promise<void>;
  log?: (message: string) => void;
  /** How often one request may be told "too many requests" before giving up. */
  maxRateLimitRetries?: number;
  /** How often one request may fail for other reasons (network, odd answer) before giving up. */
  maxOtherRetries?: number;
  /** Pause before retrying after a network problem or odd answer. */
  retryPauseMs?: number;
}

/**
 * Wraps the explorer client for an unattended crawl:
 * - "too many requests": wait until the client allows it again, then longer each time it repeats
 *   (1, 2, 4, ... extra minutes), and give up after a few rounds
 * - missing or rejected token: stop at once — retrying cannot help
 * - network trouble or an odd answer: a few retries with a pause, then stop
 */
export function createPoliteSource(
  client: Pick<ExplorerClient, 'masters' | 'lichess'>,
  filter: LichessFilter,
  options: PoliteOptions,
): CrawlSource {
  const maxRateLimitRetries = options.maxRateLimitRetries ?? 5;
  const maxOtherRetries = options.maxOtherRetries ?? 3;
  const retryPauseMs = options.retryPauseMs ?? 5_000;
  const log = options.log ?? (() => {});

  async function ask(what: string, request: () => Promise<ExplorerResult>): Promise<ExplorerPosition> {
    let rateLimited = 0;
    let otherFailures = 0;
    for (;;) {
      const result = await request();
      switch (result.status) {
        case 'ok':
          return result.data;
        case 'no-token':
          throw new CrawlAbort('No Lichess token found. Put LICHESS_TOKEN=... in .env.local (see README).');
        case 'unauthorized':
          throw new CrawlAbort('Lichess rejected the token (HTTP 401). Check .env.local or create a new token.');
        case 'rate-limited': {
          rateLimited += 1;
          if (rateLimited > maxRateLimitRetries) {
            throw new CrawlAbort(`Lichess kept answering "too many requests" for ${what}; stopping. Run again later — finished work is kept.`);
          }
          // Wait out the client's own minute, plus a growing extra: 0, 1, 2, 4 ... minutes.
          const extra = rateLimited === 1 ? 0 : 60_000 * 2 ** (rateLimited - 2);
          const wait = Math.max(0, result.retryAt - options.now()) + extra;
          log(`Too many requests (HTTP 429). Waiting ${Math.round(wait / 1000)} s before continuing.`);
          await options.sleep(wait);
          break;
        }
        case 'network-error':
        case 'bad-response': {
          otherFailures += 1;
          if (otherFailures > maxOtherRetries) {
            throw new CrawlAbort(`Giving up on ${what}: ${result.message}. Run again later — finished work is kept.`);
          }
          log(`Problem with ${what} (${result.message}); retry ${otherFailures} of ${maxOtherRetries}.`);
          await options.sleep(retryPauseMs);
          break;
        }
      }
    }
  }

  return {
    masters: (fen) => ask('a masters request', () => client.masters(fen)),
    lichess: (fen) => ask('a Lichess request', () => client.lichess(fen, filter)),
  };
}
