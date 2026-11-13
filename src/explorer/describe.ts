import { totalGames, type ExplorerResult } from './types';

export interface ResultDescription {
  ok: boolean;
  text: string;
}

/** Explain the outcome of an explorer request in plain words (used by "Test connection"). */
export function describeResult(result: ExplorerResult, now: number = Date.now()): ResultDescription {
  switch (result.status) {
    case 'ok': {
      const games = totalGames(result.data);
      const top = result.data.moves[0];
      if (games === 0 || !top) {
        return { ok: true, text: 'Connected. Lichess has no games for this position with these filters.' };
      }
      return {
        ok: true,
        text: `Connected. ${games.toLocaleString('en-US')} games in this position; most played move: ${top.san}.`,
      };
    }
    case 'no-token':
      return { ok: false, text: 'No token set. Paste your Lichess token above first.' };
    case 'unauthorized':
      return {
        ok: false,
        text: 'Lichess rejected the token (error 401). Check that it was copied completely, or create a new one.',
      };
    case 'rate-limited': {
      const seconds = Math.max(1, Math.ceil((result.retryAt - now) / 1000));
      return {
        ok: false,
        text: `Lichess says: too many requests (error 429). Wait about ${seconds} seconds before trying again.`,
      };
    }
    case 'network-error':
      return {
        ok: false,
        text: `Could not reach Lichess. Check your internet connection. (${result.message})`,
      };
    case 'bad-response':
      return { ok: false, text: `Lichess sent an unexpected answer. (${result.message})` };
  }
}
