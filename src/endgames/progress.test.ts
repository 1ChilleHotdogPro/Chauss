import { describe, expect, it } from 'vitest';
import {
  emptyEndgameProgress,
  ENDGAME_PROGRESS_KEY,
  loadEndgameProgress,
  recordResult,
  sanitizeEndgameProgress,
  saveEndgameProgress,
  solvedCount,
} from './progress';

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe('endgame progress', () => {
  it('records attempts and keeps the best stars', () => {
    let progress = emptyEndgameProgress();
    progress = recordResult(progress, 'kq-vs-k', 'edge-1', { solved: true, stars: 3, moves: 3, mistakes: 0 }, 100);
    progress = recordResult(progress, 'kq-vs-k', 'edge-1', { solved: false, stars: 0, moves: 9, mistakes: 1 }, 200);
    expect(progress.drills['kq-vs-k']?.['edge-1']).toEqual({ attempts: 2, solved: 1, bestStars: 3, lastSeen: 200 });
    expect(solvedCount(progress, 'kq-vs-k')).toBe(1);
    expect(solvedCount(progress, 'other')).toBe(0);
  });

  it('saves and loads under its own key, and survives damaged data', () => {
    const storage = memoryStorage();
    const progress = recordResult(emptyEndgameProgress(), 'd', 'p', { solved: true, stars: 2, moves: 4, mistakes: 0 }, 1);
    expect(saveEndgameProgress(storage, progress)).toBe(true);
    expect([...storage.data.keys()]).toEqual([ENDGAME_PROGRESS_KEY]);
    expect(loadEndgameProgress(storage)).toEqual(progress);

    storage.setItem(ENDGAME_PROGRESS_KEY, '{not json');
    expect(loadEndgameProgress(storage)).toEqual(emptyEndgameProgress());
    expect(loadEndgameProgress(undefined)).toEqual(emptyEndgameProgress());
    expect(
      sanitizeEndgameProgress({ version: 1, drills: { d: { good: { attempts: 1, solved: 1, bestStars: 9 }, bad: { attempts: 1, solved: 5 } } } }),
    ).toEqual({ version: 1, drills: { d: { good: { attempts: 1, solved: 1, bestStars: 3, lastSeen: null } } } });
  });

  it('reports a storage that refuses to save', () => {
    const broken = { getItem: () => null, setItem: () => { throw new Error('full'); }, removeItem: () => {} };
    expect(saveEndgameProgress(broken, emptyEndgameProgress())).toBe(false);
  });
});
