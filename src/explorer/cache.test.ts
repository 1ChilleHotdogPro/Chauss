import { describe, expect, it } from 'vitest';
import { createMemoryCache, createStorageCache, layerCaches, type KeyValueStorage } from './cache';
import type { ExplorerPosition } from './types';

const position = (white: number): ExplorerPosition => ({
  white,
  draws: 1,
  black: 2,
  moves: [{ uci: 'e2e4', san: 'e4', white, draws: 1, black: 2, averageRating: 1500, opening: null }],
  opening: { eco: 'C44', name: 'Ponziani Opening' },
});

class FakeStorage implements KeyValueStorage {
  items = new Map<string, string>();
  /** Refuse to store values longer than this, like a full browser storage. */
  limit = Infinity;
  broken = false;

  getItem(key: string): string | null {
    if (this.broken) throw new Error('storage unavailable');
    return this.items.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    if (this.broken) throw new Error('storage unavailable');
    if (value.length > this.limit) throw new Error('QuotaExceededError');
    this.items.set(key, value);
  }

  removeItem(key: string): void {
    if (this.broken) throw new Error('storage unavailable');
    this.items.delete(key);
  }
}

describe('memory cache', () => {
  it('stores and returns answers', () => {
    const cache = createMemoryCache();
    expect(cache.get('a')).toBeUndefined();
    cache.set('a', position(10));
    expect(cache.get('a')?.white).toBe(10);
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
  });

  it('drops the least recently used entry beyond its size', () => {
    const cache = createMemoryCache(2);
    cache.set('a', position(1));
    cache.set('b', position(2));
    cache.get('a'); // "a" was just used, so "b" is now the oldest
    cache.set('c', position(3));
    expect(cache.get('a')?.white).toBe(1);
    expect(cache.get('b')).toBeUndefined();
    expect(cache.get('c')?.white).toBe(3);
  });
});

describe('storage cache', () => {
  it('survives a "page reload" (a new cache on the same storage)', () => {
    const storage = new FakeStorage();
    createStorageCache(storage).set('a', position(10));
    expect(createStorageCache(storage).get('a')).toEqual(position(10));
  });

  it('ignores entries that are too old', () => {
    const storage = new FakeStorage();
    let time = 0;
    const cache = createStorageCache(storage, { maxAgeMs: 1000, now: () => time });
    cache.set('a', position(10));
    time = 1000;
    expect(cache.get('a')?.white).toBe(10);
    time = 1001;
    expect(cache.get('a')).toBeUndefined();
  });

  it('keeps only the newest entries beyond its size', () => {
    const storage = new FakeStorage();
    let time = 0;
    const cache = createStorageCache(storage, { maxEntries: 2, now: () => time });
    for (const key of ['a', 'b', 'c']) {
      time += 1;
      cache.set(key, position(time));
    }
    const reloaded = createStorageCache(storage, { maxEntries: 2, now: () => time });
    expect(reloaded.get('a')).toBeUndefined();
    expect(reloaded.get('b')?.white).toBe(2);
    expect(reloaded.get('c')?.white).toBe(3);
  });

  it('starts empty when the stored data is garbage', () => {
    for (const garbage of ['not json', '[1,2,3]', '"text"', '{"a":{"t":"x","d":{}}}', '{"a":null}']) {
      const storage = new FakeStorage();
      storage.items.set('chauss.explorer-cache.v1', garbage);
      const cache = createStorageCache(storage);
      expect(cache.get('a')).toBeUndefined();
      cache.set('b', position(5)); // and it still works afterwards
      expect(cache.get('b')?.white).toBe(5);
    }
  });

  it('works (without lasting) when storage is missing or broken', () => {
    const none = createStorageCache(undefined);
    none.set('a', position(1));
    expect(none.get('a')?.white).toBe(1);

    const storage = new FakeStorage();
    storage.broken = true;
    const broken = createStorageCache(storage);
    expect(() => broken.set('a', position(1))).not.toThrow();
    expect(() => broken.get('a')).not.toThrow();
    expect(() => broken.clear()).not.toThrow();
  });

  it('sheds old entries instead of failing when storage is full', () => {
    const storage = new FakeStorage();
    let time = 0;
    const cache = createStorageCache(storage, { now: () => time });
    for (const key of ['a', 'b', 'c', 'd']) {
      time += 1;
      cache.set(key, position(time));
    }
    const fullSize = storage.items.get('chauss.explorer-cache.v1')!.length;
    storage.limit = fullSize; // no room to grow

    time += 1;
    expect(() => cache.set('e', position(time))).not.toThrow();
    const reloaded = createStorageCache(storage, { now: () => time });
    expect(reloaded.get('e')?.white).toBe(5); // the newest survived
    expect(reloaded.get('a')).toBeUndefined(); // the oldest was shed
  });

  it('clear() removes the stored data', () => {
    const storage = new FakeStorage();
    const cache = createStorageCache(storage);
    cache.set('a', position(1));
    cache.clear();
    expect(storage.items.size).toBe(0);
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('layered cache', () => {
  it('reads through to the lasting cache and fills the fast one', () => {
    const fast = createMemoryCache();
    const lasting = createMemoryCache();
    lasting.set('a', position(7));
    const cache = layerCaches(fast, lasting);

    expect(cache.get('a')?.white).toBe(7);
    expect(fast.get('a')?.white).toBe(7);

    cache.set('b', position(8));
    expect(fast.get('b')?.white).toBe(8);
    expect(lasting.get('b')?.white).toBe(8);

    cache.clear();
    expect(fast.get('a')).toBeUndefined();
    expect(lasting.get('a')).toBeUndefined();
  });
});
