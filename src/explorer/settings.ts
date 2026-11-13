import type { KeyValueStorage } from './cache';
import { RATING_BANDS, SPEEDS, type RatingBand, type Speed } from './types';

/**
 * What the user chose for the live explorer. Kept in this browser's localStorage only:
 * the token is never sent anywhere except to Lichess, in the Authorization header.
 */
export interface ExplorerSettings {
  version: 1;
  /** Personal Lichess API token; empty = none. */
  token: string;
  ratings: RatingBand[];
  speeds: Speed[];
}

export const SETTINGS_STORAGE_KEY = 'chauss.settings.v1';

/** 1000 + 1200 together cover ratings 1000-1399. */
export const DEFAULT_RATINGS: readonly RatingBand[] = [1000, 1200];
export const DEFAULT_SPEEDS: readonly Speed[] = ['blitz', 'rapid', 'classical'];

export function defaultSettings(): ExplorerSettings {
  return { version: 1, token: '', ratings: [...DEFAULT_RATINGS], speeds: [...DEFAULT_SPEEDS] };
}

/** Turn anything (old versions, hand-edited or corrupt data) into valid settings. */
export function sanitizeSettings(value: unknown): ExplorerSettings {
  const settings = defaultSettings();
  if (typeof value !== 'object' || value === null) return settings;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return settings;

  if (typeof raw.token === 'string') settings.token = raw.token.trim();

  if (Array.isArray(raw.ratings)) {
    const ratings = RATING_BANDS.filter((band) => (raw.ratings as unknown[]).includes(band));
    if (ratings.length > 0) settings.ratings = ratings;
  }
  if (Array.isArray(raw.speeds)) {
    const speeds = SPEEDS.filter((speed) => (raw.speeds as unknown[]).includes(speed));
    if (speeds.length > 0) settings.speeds = speeds;
  }
  return settings;
}

export function loadSettings(storage: KeyValueStorage | undefined): ExplorerSettings {
  try {
    const text = storage?.getItem(SETTINGS_STORAGE_KEY);
    return sanitizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return defaultSettings();
  }
}

/** Returns false when the browser refused to store them (private window, storage full). */
export function saveSettings(storage: KeyValueStorage | undefined, settings: ExplorerSettings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(sanitizeSettings(settings)));
    return true;
  } catch {
    return false;
  }
}

/** "1000-1399", "0-999 and 1600-1799", "2500+": the chosen rating groups in plain words. */
export function describeRatings(ratings: readonly RatingBand[]): string {
  const chosen = RATING_BANDS.filter((band) => ratings.includes(band));
  if (chosen.length === 0) return 'all ratings';

  const ranges: string[] = [];
  let start: RatingBand | null = null;
  RATING_BANDS.forEach((band, index) => {
    const selected = chosen.includes(band);
    if (selected && start === null) start = band;
    const next = RATING_BANDS[index + 1];
    const nextSelected = next !== undefined && chosen.includes(next);
    if (selected && !nextSelected && start !== null) {
      ranges.push(next === undefined ? `${start}+` : `${start}-${next - 1}`);
      start = null;
    }
  });
  if (ranges.length === 1) return ranges[0]!;
  return `${ranges.slice(0, -1).join(', ')} and ${ranges.at(-1)}`;
}
