import type { KeyValueStorage } from '../explorer/cache';
import { strengthById, type StrengthId } from './outOfBook';

/** How strong Stockfish plays when a drill leaves the opening data and the user plays on. */
export const STRENGTH_KEY = 'chauss.drill.strength.v1';

export function loadStrength(storage: KeyValueStorage | undefined): StrengthId {
  try {
    return strengthById(storage?.getItem(STRENGTH_KEY)).id;
  } catch {
    return strengthById(null).id;
  }
}

/** Returns false when the browser refused to store it. */
export function saveStrength(storage: KeyValueStorage | undefined, id: StrengthId): boolean {
  if (!storage) return false;
  try {
    storage.setItem(STRENGTH_KEY, id);
    return true;
  } catch {
    return false;
  }
}
