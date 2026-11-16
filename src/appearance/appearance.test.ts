import { describe, expect, it } from 'vitest';
import {
  APPEARANCE_KEY,
  BOARD_STYLES,
  DEFAULT_APPEARANCE,
  MAX_EXPLOSION_VOLUME,
  PIECE_STYLES,
  SITE_THEMES,
  isCursed,
  loadAppearance,
  parseAppearance,
  saveAppearance,
} from './appearance';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('appearance', () => {
  it('offers eleven boards and ten piece sets, one cursed each', () => {
    expect(BOARD_STYLES).toHaveLength(11);
    expect(PIECE_STYLES).toHaveLength(10);
    expect(BOARD_STYLES.filter((style) => 'cursed' in style)).toHaveLength(1);
    expect(PIECE_STYLES.filter((style) => 'cursed' in style)).toHaveLength(1);
  });

  it('offers five site designs, Dark Academia by default, and repairs unknown ones', () => {
    expect(SITE_THEMES.map((theme) => theme.id)).toEqual(['academia', 'parchment', 'midnight', 'tournament', 'terminal']);
    expect(DEFAULT_APPEARANCE.theme).toBe('academia');
    expect(parseAppearance({ theme: 'midnight' }).theme).toBe('midnight');
    expect(parseAppearance({ theme: 'vaporwave' }).theme).toBe('academia');
  });

  it('is cursed when either the cursed board or the cursed pieces are equipped', () => {
    expect(isCursed(DEFAULT_APPEARANCE)).toBe(false);
    expect(isCursed({ board: 'cursed', pieces: 'classic' })).toBe(true);
    expect(isCursed({ board: 'brown', pieces: 'cursed' })).toBe(true);
  });

  it('repairs unknown values field by field and clamps the volume', () => {
    expect(parseAppearance({ board: 'nope', pieces: 'merida', explosionVolume: 99 })).toEqual({
      theme: 'academia',
      board: 'walnut',
      pieces: 'merida',
      explosionVolume: MAX_EXPLOSION_VOLUME,
    });
    expect(parseAppearance('junk')).toEqual(DEFAULT_APPEARANCE);
    expect(parseAppearance({ explosionVolume: -4 }).explosionVolume).toBe(0);
  });

  it('saves and loads, and survives bad stored text', () => {
    const storage = memoryStorage();
    const saved = { theme: 'terminal', board: 'neon', pieces: 'pixel', explosionVolume: 2 } as const;
    expect(saveAppearance(storage, saved)).toBe(true);
    expect(loadAppearance(storage)).toEqual(saved);
    expect(loadAppearance(memoryStorage({ [APPEARANCE_KEY]: '{oops' }))).toEqual(DEFAULT_APPEARANCE);
    expect(saveAppearance(undefined, DEFAULT_APPEARANCE)).toBe(false);
  });
});
