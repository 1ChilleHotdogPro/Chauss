import type { KeyValueStorage } from '../explorer/cache';
import { findOpening } from './registry';

/** Where the chosen opening is remembered (the id from the registry). */
export const OPENING_STORAGE_KEY = 'chauss.opening.v1';

/**
 * The remembered opening, or null when none is stored, the storage fails, the id is unknown, or the
 * opening cannot be used yet (`isAvailable`, e.g. its data files have not been built).
 */
export function loadChosenOpening(
  storage: KeyValueStorage | undefined,
  isAvailable: (id: string) => boolean = () => true,
): string | null {
  try {
    const id = storage?.getItem(OPENING_STORAGE_KEY);
    return id && findOpening(id) && isAvailable(id) ? id : null;
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
