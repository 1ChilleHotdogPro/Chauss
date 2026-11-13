import { describeRatings } from '../explorer/settings';
import type { RatingBand } from '../explorer/types';
import { validateSnapshot, type Snapshot, type SnapshotMeta } from './format';

/**
 * Address of the bundled opening data. Vite turns this into a separate file of the built site, so
 * it is downloaded on its own instead of bloating the main script.
 */
const SNAPSHOT_URL = new URL('../data/ponziani.json', import.meta.url).href;

let loading: Promise<Snapshot> | null = null;

/** The bundled opening data (downloaded once, then reused). Rejects if it is missing or damaged. */
export function loadSnapshot(): Promise<Snapshot> {
  loading ??= fetch(SNAPSHOT_URL).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    const problems = validateSnapshot(data);
    if (problems.length > 0) throw new Error(`the data file is damaged (${problems[0]})`);
    return data as Snapshot;
  });
  return loading;
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
