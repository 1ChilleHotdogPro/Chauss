import type { KeyValueStorage } from '../explorer/cache';

/** Whole-site looks: colours, type and surfaces. Dark Academia is the base in src/theme.css; the others are
    overrides in src/site-themes.css, keyed by these ids. `swatch` is page, panel, heading and accent, for the
    Settings tile (and index.html's early script reads the stored id, so keep the ids stable). */
export const SITE_THEMES = [
  { id: 'academia', name: 'Dark Academia', blurb: 'Candlelit study, walnut and gold', swatch: ['#1a1511', '#2a2119', '#e6c27a', '#93b97a'] },
  { id: 'parchment', name: 'Parchment', blurb: 'A light page from an old chess book', swatch: ['#efe5cf', '#fbf6ea', '#7a2e22', '#2f6b3a'] },
  { id: 'midnight', name: 'Midnight', blurb: 'Calm navy, clean modern type', swatch: ['#0e1320', '#172033', '#9cc0ff', '#4fd1b5'] },
  { id: 'tournament', name: 'Tournament', blurb: 'Bright, flat and tidy, like a club hall', swatch: ['#eef1f4', '#ffffff', '#1f2933', '#2e7d4a'] },
  { id: 'terminal', name: 'Terminal', blurb: 'Green phosphor on a black screen', swatch: ['#050805', '#0b120c', '#ffcf5a', '#6dff8e'] },
] as const;

/** Board looks. Colours live in CSS variables (src/appearance.css), keyed by these ids. */
export const BOARD_STYLES = [
  { id: 'walnut', name: 'Walnut' },
  { id: 'brown', name: 'Classic brown' },
  { id: 'green', name: 'Tournament green' },
  { id: 'blue', name: 'Ocean blue' },
  { id: 'slate', name: 'Slate grey' },
  { id: 'purple', name: 'Amethyst' },
  { id: 'rose', name: 'Rosewood' },
  { id: 'ice', name: 'Ice' },
  { id: 'newspaper', name: 'Newspaper' },
  { id: 'neon', name: 'Neon night' },
  { id: 'cursed', name: 'CURSED DISCO', cursed: true },
] as const;

/** Piece looks. The images live in public/pieces (see CREDITS.md); the rest are CSS-only. */
export const PIECE_STYLES = [
  { id: 'classic', name: 'Classic' },
  { id: 'merida', name: 'Merida' },
  { id: 'chessnut', name: 'Chessnut' },
  { id: 'fantasy', name: 'Fantasy' },
  { id: 'rhosgfx', name: 'RhosGFX' },
  { id: 'pixel', name: 'Pixel' },
  { id: 'neon', name: 'Neon glow' },
  { id: 'ember', name: 'Ember' },
  { id: 'frost', name: 'Frost' },
  { id: 'cursed', name: 'CURSED CIRCUS', cursed: true },
] as const;

/** Move-sound sets. The first four are recordings of real chess pieces (see CREDITS.md). */
export const SOUND_SETS = [
  { id: 'closeup', name: 'Close-up', blurb: 'Wooden pieces, recorded up close' },
  { id: 'wooden', name: 'Wooden board', blurb: 'A crisp click on a wooden board' },
  { id: 'room', name: 'Club room', blurb: 'Pieces with a little room echo' },
  { id: 'soft', name: 'Soft', blurb: 'Quiet, gentle taps' },
  { id: 'sfx', name: 'Original', blurb: 'The sounds Chauss had before' },
  { id: 'off', name: 'Off', blurb: 'No move sounds' },
] as const;

export type SoundSetId = (typeof SOUND_SETS)[number]['id'];
export type SiteThemeId = (typeof SITE_THEMES)[number]['id'];
export type BoardStyleId = (typeof BOARD_STYLES)[number]['id'];
export type PieceStyleId = (typeof PIECE_STYLES)[number]['id'];

export interface Appearance {
  /** The look of the whole site. */
  theme: SiteThemeId;
  board: BoardStyleId;
  pieces: PieceStyleId;
  /** How loud the cursed explosions are: 0 (silent) to MAX_EXPLOSION_VOLUME. */
  explosionVolume: number;
  /** Which move sounds play (the cursed explosions are separate). */
  sounds: SoundSetId;
}

export const APPEARANCE_KEY = 'chauss.appearance.v1';
export const MAX_EXPLOSION_VOLUME = 3;
export const DEFAULT_APPEARANCE: Appearance = { theme: 'academia', board: 'walnut', pieces: 'classic', explosionVolume: 1.5, sounds: 'closeup' };

/** The cursed board or the cursed pieces switch the capture sound to explosions. */
export function isCursed(appearance: Pick<Appearance, 'board' | 'pieces'>): boolean {
  return appearance.board === 'cursed' || appearance.pieces === 'cursed';
}

function pick<T extends { id: string }>(styles: readonly T[], value: unknown, fallback: T['id']): T['id'] {
  return styles.find((style) => style.id === value)?.id ?? fallback;
}

/** Anything unknown or broken falls back to the defaults, field by field. */
export function parseAppearance(raw: unknown): Appearance {
  const value = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const volume = typeof value.explosionVolume === 'number' && Number.isFinite(value.explosionVolume) ? value.explosionVolume : DEFAULT_APPEARANCE.explosionVolume;
  return {
    theme: pick(SITE_THEMES, value.theme, DEFAULT_APPEARANCE.theme) as SiteThemeId,
    board: pick(BOARD_STYLES, value.board, DEFAULT_APPEARANCE.board) as BoardStyleId,
    pieces: pick(PIECE_STYLES, value.pieces, DEFAULT_APPEARANCE.pieces) as PieceStyleId,
    explosionVolume: Math.min(MAX_EXPLOSION_VOLUME, Math.max(0, volume)),
    sounds: pick(SOUND_SETS, value.sounds, DEFAULT_APPEARANCE.sounds) as SoundSetId,
  };
}

export function loadAppearance(storage: KeyValueStorage | undefined): Appearance {
  try {
    const text = storage?.getItem(APPEARANCE_KEY);
    return parseAppearance(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

/** Returns false when the browser refused to store it. */
export function saveAppearance(storage: KeyValueStorage | undefined, appearance: Appearance): boolean {
  if (!storage) return false;
  try {
    storage.setItem(APPEARANCE_KEY, JSON.stringify(appearance));
    return true;
  } catch {
    return false;
  }
}
