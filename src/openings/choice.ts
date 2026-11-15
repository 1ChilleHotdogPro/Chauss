import type { KeyValueStorage } from '../explorer/cache';
import { findOpening } from './registry';

/** Where the chosen opening is remembered (the id from the registry). */
export const OPENING_STORAGE_KEY = 'chauss.opening.v1';

/** The remembered opening, or null when none is stored, the storage fails, or the id is unknown. */
export function loadChosenOpening(storage: KeyValueStorage | undefined): string | null {
  try {
    const id = storage?.getItem(OPENING_STORAGE_KEY);
    return id && findOpening(id) ? id : null;
  } catch {
    return null;
  }
}

/** Returns false when the browser refused to store it. */
export function saveChosenOpening(storage: KeyValueStorage | undefined, id: string): boolean {
  if (!storage || !findOpening(id)) return false;
  try {
    storage.setItem(OPENING_STORAGE_KEY, id);
    return true;
  } catch {
    return false;
  }
}
