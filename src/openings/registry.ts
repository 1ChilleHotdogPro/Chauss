/**
 * The openings the app can teach. Pure data (no browser or Node APIs), so the app and the build
 * scripts read the same list.
 */

export type Side = 'white' | 'black';

export interface CrawlSettings {
  /** Follow a move with at least this share of the games at its position ... */
  minShare: number;
  /** ... and at least this many Lichess games, or at least `minGamesMasters` master games. */
  minGames: number;
  minGamesMasters: number;
  maxPly: number;
  maxPositions: number;
  /** Stockfish search depth for the snapshot. */
  depth: number;
}

export interface OpeningDef {
  /** Used in file names and in the browser's storage: lower case, no spaces. */
  id: string;
  name: string;
  /** The colour the user plays. */
  side: Side;
  /** The moves that define the opening, in normal notation. */
  rootLine: string[];
  /**
   * The opening as the Lichess explorer names the root position; the tree stays inside it.
   * Left out until the survey run has shown the explorer's own name.
   */
  family?: string;
  crawl: CrawlSettings;
}

export const OPENINGS: readonly OpeningDef[] = [
  {
    id: 'ponziani',
    name: 'Ponziani',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'c3'],
    family: 'Ponziani Opening',
    // As recorded in the meta of src/data/openings/ponziani.json.
    crawl: { minShare: 0.03, minGames: 51384, minGamesMasters: 20, maxPly: 24, maxPositions: 1000, depth: 18 },
  },
  {
    id: 'caro-kann',
    name: 'Caro-Kann',
    side: 'black',
    rootLine: ['e4', 'c6'],
    // Same settings as the Ponziani to start with; the survey run decides the real ones.
    crawl: { minShare: 0.03, minGames: 51384, minGamesMasters: 20, maxPly: 24, maxPositions: 1000, depth: 18 },
  },
];

/** The opening used until a choice is made, and by data that does not name one. */
export const DEFAULT_OPENING_ID = 'ponziani';

export function findOpening(id: string): OpeningDef | undefined {
  return OPENINGS.find((opening) => opening.id === id);
}

export function getOpening(id: string): OpeningDef {
  const opening = findOpening(id);
  if (!opening) throw new Error(`unknown opening "${id}"`);
  return opening;
}
