import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../explorer/cache';
import {
  emptyProgress,
  exportProgress,
  importProgress,
  loadProgress,
  PROGRESS_STORAGE_KEY,
  sanitizeProgress,
  saveProgress,
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
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const progress = someProgress();
    expect(saveProgress(storage, progress)).toBe(true);
    expect(loadProgress(storage)).toEqual(progress);
    expect(storage.items.has(PROGRESS_STORAGE_KEY)).toBe(true);
  });

  it('starts empty when nothing is stored, storage is missing, or the data is damaged', () => {
    expect(loadProgress(memoryStorage())).toEqual(emptyProgress());
    expect(loadProgress(undefined)).toEqual(emptyProgress());
    expect(saveProgress(undefined, emptyProgress())).toBe(false);
    for (const garbage of ['{broken', '42', '[]', '{"version":2,"cards":{}}', '{"version":1,"cards":[]}']) {
      expect(loadProgress(memoryStorage({ [PROGRESS_STORAGE_KEY]: garbage }))).toEqual(emptyProgress());
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
    expect(loadProgress(broken)).toEqual(emptyProgress());
    expect(saveProgress(broken, someProgress())).toBe(false);
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

describe('export and import', () => {
  it('a backup can be read back exactly', () => {
    const progress = someProgress();
    const text = exportProgress(progress, NOW);
    expect(JSON.parse(text)).toMatchObject({ app: 'chauss', exportedAt: '2026-11-13T12:00:00.000Z' });
    expect(importProgress(text)).toEqual({ ok: true, progress });
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
    if (result.ok) expect(Object.keys(result.progress.cards)).toEqual(['ok']);
  });
});
