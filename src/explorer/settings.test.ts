import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from './cache';
import {
  defaultSettings,
  describeRatings,
  loadSettings,
  sanitizeSettings,
  saveSettings,
  SETTINGS_STORAGE_KEY,
} from './settings';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

describe('defaults', () => {
  it('has no token, ratings 1000-1399 and the slower speeds', () => {
    expect(defaultSettings()).toEqual({
      version: 1,
      token: '',
      ratings: [1000, 1200],
      speeds: ['blitz', 'rapid', 'classical'],
    });
  });
});

describe('save and load', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const settings = { version: 1 as const, token: 'lip_abc', ratings: [1400 as const], speeds: ['rapid' as const] };
    expect(saveSettings(storage, settings)).toBe(true);
    expect(loadSettings(storage)).toEqual(settings);
    expect(storage.items.has(SETTINGS_STORAGE_KEY)).toBe(true);
  });

  it('returns defaults when nothing is stored, or storage is missing', () => {
    expect(loadSettings(memoryStorage())).toEqual(defaultSettings());
    expect(loadSettings(undefined)).toEqual(defaultSettings());
    expect(saveSettings(undefined, defaultSettings())).toBe(false);
  });

  it('returns defaults when the stored data is corrupt', () => {
    expect(loadSettings(memoryStorage({ [SETTINGS_STORAGE_KEY]: '{not json' }))).toEqual(defaultSettings());
    expect(loadSettings(memoryStorage({ [SETTINGS_STORAGE_KEY]: '42' }))).toEqual(defaultSettings());
  });

  it('copes with storage that throws', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('denied');
      },
      removeItem: () => {},
    };
    expect(loadSettings(broken)).toEqual(defaultSettings());
    expect(saveSettings(broken, defaultSettings())).toBe(false);
  });
});

describe('sanitizeSettings', () => {
  it('ignores data from an unknown version', () => {
    expect(sanitizeSettings({ version: 2, token: 'x', ratings: [2500] })).toEqual(defaultSettings());
  });

  it('drops unknown rating bands and speeds, keeping the valid ones in standard order', () => {
    const result = sanitizeSettings({
      version: 1,
      token: '  lip_abc  ',
      ratings: [1600, 1234, 0, 'x'],
      speeds: ['rapid', 'hyperbullet', 'blitz'],
    });
    expect(result.token).toBe('lip_abc');
    expect(result.ratings).toEqual([0, 1600]);
    expect(result.speeds).toEqual(['blitz', 'rapid']);
  });

  it('falls back to the defaults when a list would be empty', () => {
    const result = sanitizeSettings({ version: 1, token: '', ratings: [], speeds: ['nope'] });
    expect(result.ratings).toEqual([1000, 1200]);
    expect(result.speeds).toEqual(['blitz', 'rapid', 'classical']);
  });

  it('ignores a token that is not text', () => {
    expect(sanitizeSettings({ version: 1, token: 12345 }).token).toBe('');
  });
});

describe('describeRatings', () => {
  it('joins neighbouring bands into one range', () => {
    expect(describeRatings([1000, 1200])).toBe('1000-1399');
    expect(describeRatings([1200, 1000])).toBe('1000-1399');
    expect(describeRatings([0])).toBe('0-999');
    expect(describeRatings([1000, 1200, 1400])).toBe('1000-1599');
  });

  it('lists separate ranges', () => {
    expect(describeRatings([0, 1600])).toBe('0-999 and 1600-1799');
    expect(describeRatings([0, 1400, 2000])).toBe('0-999, 1400-1599 and 2000-2199');
  });

  it('handles the open-ended top band', () => {
    expect(describeRatings([2500])).toBe('2500+');
    expect(describeRatings([2200, 2500])).toBe('2200+');
  });

  it('says "all ratings" for nothing chosen', () => {
    expect(describeRatings([])).toBe('all ratings');
  });
});
