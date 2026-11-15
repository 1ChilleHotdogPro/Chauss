import { describeRatings } from '../explorer/settings';
import type { RatingBand } from '../explorer/types';
import { assetsFor } from '../openings/assets';
import { DEFAULT_OPENING_ID } from '../openings/registry';
import { validateSnapshot, type Snapshot, type SnapshotMeta } from './format';

const loading = new Map<string, Promise<Snapshot>>();

/**
 * The bundled data of one opening (downloaded once per opening, then reused). Vite turns each data
 * file into a separate file of the built site, so only the chosen opening is downloaded.
 * Rejects if it is missing or damaged.
 */
export function loadSnapshot(openingId: string = DEFAULT_OPENING_ID): Promise<Snapshot> {
  const cached = loading.get(openingId);
  if (cached) return cached;
  // Inside the promise, so an opening without data files rejects (shown as "could not be loaded")
  // instead of throwing and stopping the page.
  const request = Promise.resolve()
    .then(() => fetch(assetsFor(openingId).snapshotUrl))
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data: unknown = await response.json();
      const problems = validateSnapshot(data);
      if (problems.length > 0) throw new Error(`the data file is damaged (${problems[0]})`);
      return data as Snapshot;
    });
  loading.set(openingId, request);
  return request;
}

/** One plain sentence about where the bundled data comes from. */
export function describeSnapshot(meta: SnapshotMeta): string {
  const date = new Date(meta.createdAt).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  const ratings = describeRatings(meta.lichess.ratings as RatingBand[]);
  return (
    `${meta.counts.positions.toLocaleString('en-US')} positions, built on ${date} from master games and ` +
    `Lichess games rated ${ratings} (${meta.lichess.speeds.join(', ')}). ` +
    `Scores by ${meta.engine.name} at depth ${meta.engine.depth}.`
  );
}
