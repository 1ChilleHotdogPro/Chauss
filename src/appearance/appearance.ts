import type { KeyValueStorage } from '../explorer/cache';

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

export type BoardStyleId = (typeof BOARD_STYLES)[number]['id'];
export type PieceStyleId = (typeof PIECE_STYLES)[number]['id'];

export interface Appearance {
  board: BoardStyleId;
  pieces: PieceStyleId;
  /** How loud the cursed explosions are: 0 (silent) to MAX_EXPLOSION_VOLUME. */
  explosionVolume: number;
}

export const APPEARANCE_KEY = 'chauss.appearance.v1';
export const MAX_EXPLOSION_VOLUME = 3;
export const DEFAULT_APPEARANCE: Appearance = { board: 'walnut', pieces: 'classic', explosionVolume: 1.5 };

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
    board: pick(BOARD_STYLES, value.board, DEFAULT_APPEARANCE.board) as BoardStyleId,
    pieces: pick(PIECE_STYLES, value.pieces, DEFAULT_APPEARANCE.pieces) as PieceStyleId,
    explosionVolume: Math.min(MAX_EXPLOSION_VOLUME, Math.max(0, volume)),
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
