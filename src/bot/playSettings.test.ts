import { describe, expect, it } from 'vitest';
import { loadPlaySettings, PLAY_SETTINGS_KEY, sanitizePlaySettings, savePlaySettings } from './playSettings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe('play settings', () => {
  it('default to the realistic bot and the easiest Stockfish', () => {
    expect(loadPlaySettings(undefined)).toEqual({ version: 1, style: 'realistic', strength: 'easy' });
    expect(loadPlaySettings(memoryStorage())).toEqual({ version: 1, style: 'realistic', strength: 'easy' });
  });

  it('survive a save and a load', () => {
    const storage = memoryStorage();
    expect(savePlaySettings(storage, { version: 1, style: 'punish', strength: 'hard' })).toBe(true);
    expect(loadPlaySettings(storage)).toEqual({ version: 1, style: 'punish', strength: 'hard' });
  });

  it('repair bad data instead of failing', () => {
    expect(sanitizePlaySettings({ version: 1, style: 'evil', strength: 'godlike' })).toEqual({
      version: 1,
      style: 'realistic',
      strength: 'easy',
    });
    expect(sanitizePlaySettings({ version: 2, style: 'punish' }).style).toBe('realistic');
    expect(loadPlaySettings(memoryStorage({ [PLAY_SETTINGS_KEY]: '{not json' })).style).toBe('realistic');
  });

  it('report a browser that refuses to store', () => {
    const refusing = { getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    expect(savePlaySettings(refusing, { version: 1, style: 'punish', strength: 'easy' })).toBe(false);
    expect(savePlaySettings(undefined, { version: 1, style: 'punish', strength: 'easy' })).toBe(false);
  });
});
