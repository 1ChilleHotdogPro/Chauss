import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Score } from '../../src/analysis/eval';
import type { ExplorerCache } from '../../src/explorer/cache';
import { parseExplorerPosition } from '../../src/explorer/types';

/**
 * Explorer answers on disk, one small file per request, so a crawl that was stopped (or rate
 * limited) picks up where it left off. Keys are request addresses, which never contain the token.
 */
export function createDiskCache(directory: string): ExplorerCache & { hits(): number } {
  mkdirSync(directory, { recursive: true });
  let hits = 0;
  const fileFor = (key: string): string =>
    join(directory, `${createHash('sha1').update(key).digest('hex')}.json`);

  return {
    get(key) {
      const file = fileFor(key);
      if (!existsSync(file)) return undefined;
      try {
        const stored = JSON.parse(readFileSync(file, 'utf8')) as { url?: unknown; data?: unknown };
        if (stored.url !== key) return undefined;
        const data = parseExplorerPosition(stored.data);
        if (data) hits += 1;
        return data ?? undefined;
      } catch {
        return undefined;
      }
    },
    set(key, value) {
      writeFileSync(fileFor(key), JSON.stringify({ url: key, savedAt: new Date().toISOString(), data: value }));
    },
    clear() {
      // Deliberately not implemented: delete the folder by hand to start afresh.
    },
    hits: () => hits,
  };
}

/** Engine scores on disk (one JSON file), keyed by position. Saved every so often and at the end. */
export function createEvalStore(file: string): {
  get(key: string): Score | undefined;
  set(key: string, score: Score): void;
  save(): void;
  size(): number;
} {
  let scores: Record<string, Score> = {};
  if (existsSync(file)) {
    try {
      scores = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Score>;
    } catch {
      scores = {};
    }
  }
  let unsaved = 0;
  const save = (): void => {
    writeFileSync(file, JSON.stringify(scores));
    unsaved = 0;
  };
  return {
    get: (key) => scores[key],
    set(key, score) {
      scores[key] = score;
      unsaved += 1;
      if (unsaved >= 25) save();
    },
    save,
    size: () => Object.keys(scores).length,
  };
}
