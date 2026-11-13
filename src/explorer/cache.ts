import { parseExplorerPosition, type ExplorerPosition } from './types';

/** Remembers explorer answers so the same question is not asked twice. Keys are request URLs. */
export interface ExplorerCache {
  get(key: string): ExplorerPosition | undefined;
  set(key: string, value: ExplorerPosition): void;
  clear(): void;
}

/** Forgets everything when the page is closed. Oldest entries are dropped beyond `maxEntries`. */
export function createMemoryCache(maxEntries = 500): ExplorerCache {
  const entries = new Map<string, ExplorerPosition>();
  return {
    get(key) {
      const value = entries.get(key);
      if (value !== undefined) {
        // Move to the end: recently used entries are dropped last.
        entries.delete(key);
        entries.set(key, value);
      }
      return value;
    },
    set(key, value) {
      entries.delete(key);
      entries.set(key, value);
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
    clear: () => entries.clear(),
  };
}

/** The part of localStorage that is used; lets tests pass a stand-in. */
export interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface StoredEntry {
  /** When it was saved (milliseconds since 1970). */
  t: number;
  d: ExplorerPosition;
}

export interface StorageCacheOptions {
  storageKey?: string;
  maxEntries?: number;
  /** Entries older than this are ignored; opening statistics change slowly. */
  maxAgeMs?: number;
  now?: () => number;
}

const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;

/**
 * Survives page reloads by keeping one JSON document in localStorage.
 * Storage can be unavailable, full or hold garbage (private windows, other versions of the app):
 * every access is guarded, and the worst case is simply "not cached".
 */
export function createStorageCache(
  storage: KeyValueStorage | undefined,
  options: StorageCacheOptions = {},
): ExplorerCache {
  const storageKey = options.storageKey ?? 'chauss.explorer-cache.v1';
  const maxEntries = options.maxEntries ?? 300;
  const maxAgeMs = options.maxAgeMs ?? THIRTY_DAYS;
  const now = options.now ?? Date.now;

  let entries: Map<string, StoredEntry> | null = null;

  function load(): Map<string, StoredEntry> {
    if (entries) return entries;
    entries = new Map();
    try {
      const text = storage?.getItem(storageKey);
      const parsed: unknown = text ? JSON.parse(text) : null;
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
          if (typeof value !== 'object' || value === null) continue;
          const { t, d } = value as Record<string, unknown>;
          const data = parseExplorerPosition(d);
          if (typeof t === 'number' && data) entries.set(key, { t, d: data });
        }
      }
    } catch {
      entries = new Map(); // unreadable: start empty
    }
    return entries;
  }

  function save(): void {
    if (!storage || !entries) return;
    // If the browser says the storage is full, drop the older half and try once more.
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        storage.setItem(storageKey, JSON.stringify(Object.fromEntries(entries)));
        return;
      } catch {
        const keep = [...entries.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, Math.floor(entries.size / 2));
        entries = new Map(keep);
      }
    }
  }

  return {
    get(key) {
      const entry = load().get(key);
      if (!entry) return undefined;
      if (now() - entry.t > maxAgeMs) return undefined;
      return entry.d;
    },
    set(key, value) {
      const all = load();
      all.set(key, { t: now(), d: value });
      if (all.size > maxEntries) {
        const newest = [...all.entries()].sort((a, b) => b[1].t - a[1].t).slice(0, maxEntries);
        entries = new Map(newest);
      }
      save();
    },
    clear() {
      entries = new Map();
      try {
        storage?.removeItem(storageKey);
      } catch {
        // nothing to do
      }
    },
  };
}

/** Look in the fast cache first, then the lasting one; write to both. */
export function layerCaches(fast: ExplorerCache, lasting: ExplorerCache): ExplorerCache {
  return {
    get(key) {
      const quick = fast.get(key);
      if (quick) return quick;
      const stored = lasting.get(key);
      if (stored) fast.set(key, stored);
      return stored;
    },
    set(key, value) {
      fast.set(key, value);
      lasting.set(key, value);
    },
    clear() {
      fast.clear();
      lasting.clear();
    },
  };
}
