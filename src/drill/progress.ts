import type { KeyValueStorage } from '../explorer/cache';
import { newCardState, type CardState } from './srs';

/**
 * What the app remembers about your training in ONE opening, per card (a card = a position where
 * you must find the repertoire move). `version` is the shape of this object, not of the stored file.
 */
export interface Progress {
  version: 1;
  /** Card states by position key. */
  cards: Record<string, CardState>;
}

/**
 * Everything stored in this browser: the progress of every opening, by opening id. Kept in
 * localStorage; can be exported and imported as a file.
 */
export interface ProgressStore {
  version: 2;
  openings: Record<string, { cards: Record<string, CardState> }>;
}

/** Version 1 held the Ponziani only; it is read once to start version 2, and never changed. */
export const PROGRESS_STORAGE_KEY_V1 = 'chauss.progress.v1';
export const PROGRESS_STORAGE_KEY = 'chauss.progress.v2';
/** The opening that version-1 data (stored or in a backup file) belongs to. */
export const LEGACY_OPENING_ID = 'ponziani';

export function emptyStore(): ProgressStore {
  return { version: 2, openings: {} };
}

export function emptyProgress(): Progress {
  return { version: 1, cards: {} };
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0;

function sanitizeCard(value: unknown): CardState | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  const fresh = newCardState();
  if (!isCount(raw.attempts) || !isCount(raw.errors) || raw.errors > raw.attempts) return null;
  return {
    streak: isCount(raw.streak) ? Math.floor(raw.streak) : fresh.streak,
    intervalDays: isCount(raw.intervalDays) ? raw.intervalDays : fresh.intervalDays,
    ease: isCount(raw.ease) ? Math.min(2.8, Math.max(1.3, raw.ease)) : fresh.ease,
    due: isCount(raw.due) ? raw.due : fresh.due,
    attempts: Math.floor(raw.attempts),
    errors: Math.floor(raw.errors),
    lastSeen: isCount(raw.lastSeen) ? raw.lastSeen : null,
  };
}

/** Turn anything (older versions, hand-edited or damaged data) into valid progress; null if hopeless. */
export function sanitizeProgress(value: unknown): Progress | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.cards !== 'object' || raw.cards === null || Array.isArray(raw.cards)) return null;
  const progress = emptyProgress();
  for (const [key, card] of Object.entries(raw.cards as Record<string, unknown>)) {
    const clean = sanitizeCard(card);
    if (clean) progress.cards[key] = clean;
  }
  return progress;
}

/** One opening's progress, from a store (empty if the opening has none yet). */
export function progressOf(store: ProgressStore, openingId: string): Progress {
  const entry = store.openings[openingId];
  return entry ? { version: 1, cards: entry.cards } : emptyProgress();
}

/** The store with one opening's progress replaced (the others are kept). */
export function withProgress(store: ProgressStore, openingId: string, progress: Progress): ProgressStore {
  return { version: 2, openings: { ...store.openings, [openingId]: { cards: progress.cards } } };
}

/** Turn anything into a valid store; null if hopeless. Version-1 progress becomes the Ponziani's. */
export function sanitizeStore(value: unknown): ProgressStore | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (raw.version === 1) {
    const legacy = sanitizeProgress(value);
    return legacy ? withProgress(emptyStore(), LEGACY_OPENING_ID, legacy) : null;
  }
  if (raw.version !== 2 || typeof raw.openings !== 'object' || raw.openings === null || Array.isArray(raw.openings)) {
    return null;
  }
  const store = emptyStore();
  for (const [id, entry] of Object.entries(raw.openings as Record<string, unknown>)) {
    const clean = sanitizeProgress({ version: 1, cards: (entry as Record<string, unknown> | null)?.cards });
    if (clean) store.openings[id] = { cards: clean.cards };
  }
  return store;
}

function readJson(storage: KeyValueStorage | undefined, key: string): unknown {
  try {
    const text = storage?.getItem(key);
    return text ? (JSON.parse(text) as unknown) : null;
  } catch {
    return null;
  }
}

/**
 * The stored progress of every opening. If the version-2 data is missing but version-1 data
 * exists, that becomes the Ponziani's progress and version 2 is written; version 1 stays as it
 * is, so an older copy of the app still finds its data.
 */
export function loadStore(storage: KeyValueStorage | undefined): ProgressStore {
  const current = sanitizeStore(readJson(storage, PROGRESS_STORAGE_KEY));
  if (current) return current;
  const migrated = sanitizeStore(readJson(storage, PROGRESS_STORAGE_KEY_V1));
  if (!migrated) return emptyStore();
  saveStore(storage, migrated);
  return migrated;
}

/** Returns false when the browser refused to store it (private window, storage full). */
export function saveStore(storage: KeyValueStorage | undefined, store: ProgressStore): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(store));
    return true;
  } catch {
    return false;
  }
}

export function loadProgress(storage: KeyValueStorage | undefined, openingId: string): Progress {
  return progressOf(loadStore(storage), openingId);
}

/** Store one opening's progress, keeping the others. Returns false if the browser refused. */
export function saveProgress(storage: KeyValueStorage | undefined, openingId: string, progress: Progress): boolean {
  return saveStore(storage, withProgress(loadStore(storage), openingId, progress));
}

/** The text of a backup file (the progress of every opening). */
export function exportProgress(store: ProgressStore, now: number = Date.now()): string {
  return JSON.stringify({ app: 'chauss', exportedAt: new Date(now).toISOString(), progress: store }, null, 1);
}

/** Read a backup file made by exportProgress, or an older one (version 1: the Ponziani only). */
export function importProgress(text: string): { ok: true; store: ProgressStore } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This is not a Chauss backup file (it is not valid JSON).' };
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as Record<string, unknown>).app !== 'chauss') {
    return { ok: false, error: 'This is not a Chauss backup file.' };
  }
  const store = sanitizeStore((parsed as Record<string, unknown>).progress);
  if (!store) {
    return { ok: false, error: 'The backup file is from a version of Chauss this one cannot read.' };
  }
  return { ok: true, store };
}

/** Number of positions with progress, over all openings of a store. */
export function countPositions(store: ProgressStore): number {
  return Object.values(store.openings).reduce((sum, entry) => sum + Object.keys(entry.cards).length, 0);
}
