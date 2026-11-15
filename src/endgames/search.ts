import type { Engine } from '../engine/engine';
import type { SearchResult } from './judge';

/** Ask Stockfish about one position. */
export type Search = (fen: string, depth: number) => Promise<SearchResult>;

/**
 * One position at a time on the given engine (best line only). A search that is replaced by a newer
 * one never settles, so callers must not depend on every promise resolving.
 */
export function engineSearch(engine: Engine): Search {
  return (fen, depth) =>
    new Promise((resolve, reject) => {
      if (engine.state() === 'failed') {
        reject(new Error(engine.error() || 'Stockfish could not be started'));
        return;
      }
      let last: SearchResult = { score: null, pv: [] };
      engine.analyse({
        fen,
        depth,
        multiPv: 1,
        onInfo: (info) => {
          if (info.multipv === 1 && !info.bound) last = { score: info.score, pv: info.pv };
        },
        onDone: (bestMove) => {
          if (bestMove === null) resolve({ score: null, pv: [] });
          else resolve(last.pv[0] === bestMove ? last : { score: last.score, pv: [bestMove] });
        },
      });
    });
}
