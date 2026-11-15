import { describe, expect, it } from 'vitest';
import type { KeyValueStorage } from '../explorer/cache';
import { loadChosenOpening, OPENING_STORAGE_KEY, saveChosenOpening } from './choice';

function memoryStorage(initial: Record<string, string> = {}): KeyValueStorage & { items: Map<string, string> } {
  const items = new Map(Object.entries(initial));
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

describe('the chosen opening', () => {
  it('is remembered', () => {
    const storage = memoryStorage();
    expect(loadChosenOpening(storage)).toBeNull();
    expect(saveChosenOpening(storage, 'caro-kann')).toBe(true);
    expect(storage.items.get(OPENING_STORAGE_KEY)).toBe('caro-kann');
    expect(loadChosenOpening(storage)).toBe('caro-kann');
  });

  it('is null for an opening whose data is not available yet', () => {
    const storage = memoryStorage({ [OPENING_STORAGE_KEY]: 'caro-kann' });
    expect(loadChosenOpening(storage, (id) => id === 'ponziani')).toBeNull();
    expect(loadChosenOpening(storage, (id) => id === 'caro-kann')).toBe('caro-kann');
  });

  it('is null for an id the registry does not know, and refuses to store one', () => {
    expect(loadChosenOpening(memoryStorage({ [OPENING_STORAGE_KEY]: 'sicilian' }))).toBeNull();
    const storage = memoryStorage();
    expect(saveChosenOpening(storage, 'sicilian')).toBe(false);
    expect(storage.items.size).toBe(0);
  });

  it('copes with missing or failing storage', () => {
    const broken: KeyValueStorage = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {},
    };
    expect(loadChosenOpening(undefined)).toBeNull();
    expect(loadChosenOpening(broken)).toBeNull();
    expect(saveChosenOpening(undefined, 'ponziani')).toBe(false);
    expect(saveChosenOpening(broken, 'ponziani')).toBe(false);
  });
});
