import { describe, expect, it } from 'vitest';
import { isSectionOpen, SECTIONS_STORAGE_KEY, setSectionOpen } from './sectionState';

function memoryStore(initial?: string) {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(SECTIONS_STORAGE_KEY, initial);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe('section state', () => {
  it('is open by default', () => {
    const store = memoryStore();
    expect(isSectionOpen('book', store)).toBe(true);
    expect(isSectionOpen('popular', store)).toBe(true);
  });

  it('remembers each section separately', () => {
    const store = memoryStore();
    setSectionOpen('book', false, store);
    expect(isSectionOpen('book', store)).toBe(false);
    expect(isSectionOpen('popular', store)).toBe(true);
    setSectionOpen('book', true, store);
    expect(isSectionOpen('book', store)).toBe(true);
  });

  it('copes with garbage, a missing store and a store that throws', () => {
    expect(isSectionOpen('book', memoryStore('not json'))).toBe(true);
    expect(isSectionOpen('book', memoryStore('{"book":"no"}'))).toBe(true);
    expect(isSectionOpen('book', undefined)).toBe(true);
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(isSectionOpen('book', broken)).toBe(true);
    expect(() => setSectionOpen('book', false, broken)).not.toThrow();
  });
});
