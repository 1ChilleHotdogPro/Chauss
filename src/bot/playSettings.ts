import type { KeyValueStorage } from '../explorer/cache';
import type { BotStyle } from './choose';
import { strengthById, type StrengthId } from './outOfBook';

/** The Play tab's choices, remembered in this browser. */
export interface PlaySettings {
  version: 1;
  style: BotStyle;
  strength: StrengthId;
}

export const PLAY_SETTINGS_KEY = 'chauss.play.v1';

export function defaultPlaySettings(): PlaySettings {
  return { version: 1, style: 'realistic', strength: 'easy' };
}

/** Turn anything (missing, hand-edited or corrupt data) into valid settings. */
export function sanitizePlaySettings(value: unknown): PlaySettings {
  const settings = defaultPlaySettings();
  if (typeof value !== 'object' || value === null) return settings;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return settings;
  if (raw.style === 'realistic' || raw.style === 'punish') settings.style = raw.style;
  if (typeof raw.strength === 'string') settings.strength = strengthById(raw.strength).id;
  return settings;
}

export function loadPlaySettings(storage: KeyValueStorage | undefined): PlaySettings {
  try {
    const text = storage?.getItem(PLAY_SETTINGS_KEY);
    return sanitizePlaySettings(text ? JSON.parse(text) : null);
  } catch {
    return defaultPlaySettings();
  }
}

/** Returns false when the browser refused to store them. */
export function savePlaySettings(storage: KeyValueStorage | undefined, settings: PlaySettings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PLAY_SETTINGS_KEY, JSON.stringify(sanitizePlaySettings(settings)));
    return true;
  } catch {
    return false;
  }
}
