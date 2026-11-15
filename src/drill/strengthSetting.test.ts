import { describe, expect, it } from 'vitest';
import { loadStrength, saveStrength } from './strengthSetting';

const memory = () => {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
};

describe('strength setting', () => {
  it('defaults to easy and survives a round trip', () => {
    const storage = memory();
    expect(loadStrength(storage)).toBe('easy');
    expect(saveStrength(storage, 'hard')).toBe(true);
    expect(loadStrength(storage)).toBe('hard');
  });
  it('ignores junk and missing storage', () => {
    const storage = memory();
    storage.setItem('chauss.drill.strength.v1', 'nope');
    expect(loadStrength(storage)).toBe('easy');
    expect(loadStrength(undefined)).toBe('easy');
    expect(saveStrength(undefined, 'hard')).toBe(false);
  });
});
