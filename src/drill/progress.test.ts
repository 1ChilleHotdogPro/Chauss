import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../explorer/cache';
import {
  countPositions,
  emptyProgress,
  emptyStore,
  exportProgress,
  importProgress,
  loadProgress,
  loadStore,
  progressOf,
  PROGRESS_STORAGE_KEY,
  PROGRESS_STORAGE_KEY_V1,
  sanitizeProgress,
  sanitizeStore,
  saveProgress,
  withProgress,
  type Progress,
} from './progress';
import { newCardState, review } from './srs';

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

function someProgress(): Progress {
  return {
    version: 1,
    cards: {
      'position a': review(newCardState(), true, NOW),
      'position b': review(review(newCardState(), false, NOW), true, NOW + 1000),
    },
  };
}

describe('save and load', () => {
  it('round-trips through storage, per opening', () => {
    const storage = memoryStorage();
    const progress = someProgress();
    expect(saveProgress(storage, 'ponziani', progress)).toBe(true);
    expect(loadProgress(storage, 'ponziani')).toEqual(progress);
    expect(loadProgress(storage, 'caro-kann')).toEqual(emptyProgress());
    expect(storage.items.has(PROGRESS_STORAGE_KEY)).toBe(true);
    expect(JSON.parse(storage.items.get(PROGRESS_STORAGE_KEY)!)).toMatchObject({ version: 2, openings: { ponziani: { cards: {} } } });
  });

  it("saving one opening keeps the other's progress", () => {
    const storage = memoryStorage();
    const other: Progress = { version: 1, cards: { 'position c': review(newCardState(), true, NOW) } };
    saveProgress(storage, 'ponziani', someProgress());
    saveProgress(storage, 'caro-kann', other);
    expect(loadProgress(storage, 'ponziani')).toEqual(someProgress());
    expect(loadProgress(storage, 'caro-kann')).toEqual(other);
  });

  it('starts empty when nothing is stored, storage is missing, or the data is damaged', () => {
    expect(loadProgress(memoryStorage(), 'ponziani')).toEqual(emptyProgress());
    expect(loadProgress(undefined, 'ponziani')).toEqual(emptyProgress());
    expect(saveProgress(undefined, 'ponziani', emptyProgress())).toBe(false);
    for (const garbage of ['{broken', '42', '[]', '{"version":3,"openings":{}}', '{"version":2,"openings":[]}']) {
      expect(loadProgress(memoryStorage({ [PROGRESS_STORAGE_KEY]: garbage }), 'ponziani')).toEqual(emptyProgress());
    }
  });

  it('copes with storage that throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    };
    expect(loadProgress(broken, 'ponziani')).toEqual(emptyProgress());
    expect(saveProgress(broken, 'ponziani', someProgress())).toBe(false);
  });
});

describe('migration from version 1', () => {
  const v1 = JSON.stringify(someProgress());

  it("turns the stored v1 progress into the Ponziani's, writes v2 and leaves v1 untouched", () => {
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY_V1]: v1 });
    expect(loadProgress(storage, 'ponziani')).toEqual(someProgress());
    expect(loadProgress(storage, 'caro-kann')).toEqual(emptyProgress());
    expect(JSON.parse(storage.items.get(PROGRESS_STORAGE_KEY)!)).toEqual({
      version: 2,
      openings: { ponziani: { cards: someProgress().cards } },
    });
    expect(storage.items.get(PROGRESS_STORAGE_KEY_V1)).toBe(v1);
  });

  it('prefers v2 once it exists, and does not run again', () => {
    const storage = memoryStorage({ [PROGRESS_STORAGE_KEY_V1]: v1 });
    loadStore(storage);
    saveProgress(storage, 'ponziani', emptyProgress());
    expect(loadProgress(storage, 'ponziani')).toEqual(emptyProgress());
    expect(storage.items.get(PROGRESS_STORAGE_KEY_V1)).toBe(v1);
  });

  it('ignores damaged v1 data', () => {
    expect(loadStore(memoryStorage({ [PROGRESS_STORAGE_KEY_V1]: '{broken' }))).toEqual(emptyStore());
  });
});

describe('sanitizeProgress', () => {
  it('drops cards that make no sense and repairs odd values', () => {
    const cleaned = sanitizeProgress({
      version: 1,
      cards: {
        good: { streak: 2, intervalDays: 6, ease: 2.6, due: NOW, attempts: 3, errors: 1, lastSeen: NOW },
        'more errors than attempts': { attempts: 1, errors: 5 },
        'not an object': 'hello',
        'negative attempts': { attempts: -1, errors: 0 },
        'wild ease': { attempts: 2, errors: 0, ease: 99, streak: 1.7, due: 'tomorrow', lastSeen: 'never' },
      },
    });
    expect(Object.keys(cleaned!.cards).sort()).toEqual(['good', 'wild ease']);
    expect(cleaned!.cards.good).toEqual({ streak: 2, intervalDays: 6, ease: 2.6, due: NOW, attempts: 3, errors: 1, lastSeen: NOW });
    expect(cleaned!.cards['wild ease']).toMatchObject({ ease: 2.8, streak: 1, due: 0, lastSeen: null, attempts: 2 });
  });

  it('refuses unknown versions', () => {
    expect(sanitizeProgress({ version: 7, cards: {} })).toBeNull();
    expect(sanitizeProgress(null)).toBeNull();
  });
});

describe('sanitizeStore', () => {
  it('cleans every opening and refuses unknown versions', () => {
    const cleaned = sanitizeStore({
      version: 2,
      openings: { a: { cards: { ok: { attempts: 1, errors: 0 }, bad: { attempts: 1, errors: 9 } } }, b: 'nonsense' },
    });
    expect(Object.keys(cleaned!.openings)).toEqual(['a']);
    expect(Object.keys(cleaned!.openings.a!.cards)).toEqual(['ok']);
    expect(sanitizeStore({ version: 9, openings: {} })).toBeNull();
    expect(sanitizeStore(null)).toBeNull();
  });
});

describe('export and import', () => {
  const store = withProgress(withProgress(emptyStore(), 'ponziani', someProgress()), 'caro-kann', {
    version: 1,
    cards: { 'position c': review(newCardState(), true, NOW) },
  });

  it('a backup of every opening can be read back exactly', () => {
    const text = exportProgress(store, NOW);
    expect(JSON.parse(text)).toMatchObject({ app: 'chauss', exportedAt: '2026-11-13T12:00:00.000Z', progress: { version: 2 } });
    expect(importProgress(text)).toEqual({ ok: true, store });
    expect(countPositions(store)).toBe(3);
  });

  it("still reads a version 1 backup file, as the Ponziani's progress", () => {
    const text = JSON.stringify({ app: 'chauss', exportedAt: '2026-11-13T12:00:00.000Z', progress: someProgress() });
    const result = importProgress(text);
    expect(result).toEqual({ ok: true, store: withProgress(emptyStore(), 'ponziani', someProgress()) });
    if (result.ok) expect(progressOf(result.store, 'ponziani')).toEqual(someProgress());
  });

  it('explains what is wrong with a file it cannot use', () => {
    expect(importProgress('not json at all')).toEqual({
      ok: false,
      error: 'This is not a Chauss backup file (it is not valid JSON).',
    });
    expect(importProgress('{"some":"other file"}')).toEqual({ ok: false, error: 'This is not a Chauss backup file.' });
    expect(importProgress('[1,2,3]')).toEqual({ ok: false, error: 'This is not a Chauss backup file.' });
    expect(importProgress(JSON.stringify({ app: 'chauss', progress: { version: 9, cards: {} } }))).toEqual({
      ok: false,
      error: 'The backup file is from a version of Chauss this one cannot read.',
    });
  });

  it('cleans an imported file the same way as stored data', () => {
    const text = JSON.stringify({ app: 'chauss', progress: { version: 1, cards: { bad: { attempts: 1, errors: 9 }, ok: { attempts: 1, errors: 0 } } } });
    const result = importProgress(text);
    expect(result.ok).toBe(true);
    if (result.ok) expect(Object.keys(progressOf(result.store, 'ponziani').cards)).toEqual(['ok']);
  });
});
