import type { KeyValueStorage } from '../explorer/cache';
import type { PositionResult } from './controller';

/** What the app remembers about one endgame position. */
export interface EndgamePositionRecord {
  attempts: number;
  solved: number;
  /** The best result so far, 0–3 stars. */
  bestStars: number;
  lastSeen: number | null;
}

/** Endgame progress, by drill id, then position id. Kept apart from the opening progress. */
export interface EndgameProgress {
  version: 1;
  drills: Record<string, Record<string, EndgamePositionRecord>>;
}

export const ENDGAME_PROGRESS_KEY = 'chauss.endgames.v1';

export function emptyEndgameProgress(): EndgameProgress {
  return { version: 1, drills: {} };
}

const isCount = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0;

function sanitizeRecord(value: unknown): EndgamePositionRecord | null {
  if (typeof value !== 'object' || value === null) return null;
  const raw = value as Record<string, unknown>;
  if (!isCount(raw.attempts) || !isCount(raw.solved) || raw.solved > raw.attempts) return null;
  return {
    attempts: Math.floor(raw.attempts),
    solved: Math.floor(raw.solved),
    bestStars: isCount(raw.bestStars) ? Math.min(3, Math.floor(raw.bestStars)) : 0,
    lastSeen: isCount(raw.lastSeen) ? raw.lastSeen : null,
  };
}

/** Turn anything (damaged or hand-edited data) into valid progress, dropping what cannot be read. */
export function sanitizeEndgameProgress(value: unknown): EndgameProgress {
  const progress = emptyEndgameProgress();
  if (typeof value !== 'object' || value === null) return progress;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1 || typeof raw.drills !== 'object' || raw.drills === null) return progress;
  for (const [drillId, positions] of Object.entries(raw.drills as Record<string, unknown>)) {
    if (typeof positions !== 'object' || positions === null) continue;
    const kept: Record<string, EndgamePositionRecord> = {};
    for (const [positionId, record] of Object.entries(positions as Record<string, unknown>)) {
      const clean = sanitizeRecord(record);
      if (clean) kept[positionId] = clean;
    }
    progress.drills[drillId] = kept;
  }
  return progress;
}

export function loadEndgameProgress(storage: KeyValueStorage | undefined): EndgameProgress {
  try {
    const text = storage?.getItem(ENDGAME_PROGRESS_KEY);
    return text ? sanitizeEndgameProgress(JSON.parse(text)) : emptyEndgameProgress();
  } catch {
    return emptyEndgameProgress();
  }
}

export function saveEndgameProgress(storage: KeyValueStorage | undefined, progress: EndgameProgress): boolean {
  try {
    if (!storage) return false;
    storage.setItem(ENDGAME_PROGRESS_KEY, JSON.stringify(progress));
    return true;
  } catch {
    return false;
  }
}

/** Progress with one more finished attempt at a position. */
export function recordResult(
  progress: EndgameProgress,
  drillId: string,
  positionId: string,
  result: PositionResult,
  now: number,
): EndgameProgress {
  const positions = progress.drills[drillId] ?? {};
  const old = positions[positionId] ?? { attempts: 0, solved: 0, bestStars: 0, lastSeen: null };
  return {
    version: 1,
    drills: {
      ...progress.drills,
      [drillId]: {
        ...positions,
        [positionId]: {
          attempts: old.attempts + 1,
          solved: old.solved + (result.solved ? 1 : 0),
          bestStars: Math.max(old.bestStars, result.stars),
          lastSeen: now,
        },
      },
    },
  };
}

/** "3 of 5 solved": how many positions of a drill have been solved at least once. */
export function solvedCount(progress: EndgameProgress, drillId: string): number {
  return Object.values(progress.drills[drillId] ?? {}).filter((record) => record.solved > 0).length;
}
