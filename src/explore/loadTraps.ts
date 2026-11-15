import { assetsFor } from '../openings/assets';
import { DEFAULT_OPENING_ID } from '../openings/registry';
import { validateTrapFile, type TrapFile } from './traps';

const loading = new Map<string, Promise<TrapFile>>();

/**
 * One opening's bundled trap list (a separate file of the built site, like the snapshot;
 * downloaded once per opening, then reused). Rejects if it is missing or damaged.
 */
export function loadTraps(openingId: string = DEFAULT_OPENING_ID): Promise<TrapFile> {
  const cached = loading.get(openingId);
  if (cached) return cached;
  // Inside the promise, so an opening without data files rejects instead of throwing.
  const request = Promise.resolve()
    .then(() => fetch(assetsFor(openingId).trapsUrl))
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      const problems = validateTrapFile(data);
      if (problems.length > 0) throw new Error(`the trap list is damaged (${problems[0]})`);
      return data as TrapFile;
    });
  loading.set(openingId, request);
  return request;
}
