import type { KeyValueStorage } from '../explorer/cache';
import { newCardState, type CardState } from './srs';

/**
 * What the app remembers about your training, per card (a card = a position where you must find
 * the repertoire move). Kept in this browser's localStorage; can be exported and imported as a file.
 */
export interface Progress {
  version: 1;
  /** Card states by position key. */
  cards: Record<string, CardState>;
}

export const PROGRESS_STORAGE_KEY = 'chauss.progress.v1';

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

export function loadProgress(storage: KeyValueStorage | undefined): Progress {
  try {
    const text = storage?.getItem(PROGRESS_STORAGE_KEY);
    return (text ? sanitizeProgress(JSON.parse(text)) : null) ?? emptyProgress();
  } catch {
    return emptyProgress();
  }
}

/** Returns false when the browser refused to store it (private window, storage full). */
export function saveProgress(storage: KeyValueStorage | undefined, progress: Progress): boolean {
  if (!storage) return false;
  try {
    storage.setItem(PROGRESS_STORAGE_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** The text of a backup file. */
export function exportProgress(progress: Progress, now: number = Date.now()): string {
  return JSON.stringify({ app: 'chauss', exportedAt: new Date(now).toISOString(), progress }, null, 1);
}

/** Read a backup file made by exportProgress. */
export function importProgress(text: string): { ok: true; progress: Progress } | { ok: false; error: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This is not a Chauss backup file (it is not valid JSON).' };
  }
  if (typeof parsed !== 'object' || parsed === null || (parsed as Record<string, unknown>).app !== 'chauss') {
    return { ok: false, error: 'This is not a Chauss backup file.' };
  }
  const progress = sanitizeProgress((parsed as Record<string, unknown>).progress);
  if (!progress) {
    return { ok: false, error: 'The backup file is from a version of Chauss this one cannot read.' };
  }
  return { ok: true, progress };
}
