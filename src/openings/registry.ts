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

/**
 * The settings of the openings added in November 2026: the position limit does the cutting (the most
 * played positions and all book lines first), so each snapshot stays a few hundred KB and the 30
 * crawls fit in one night at the explorer's rate limit.
 */
const NEW_OPENING_CRAWL: CrawlSettings = { minShare: 0.03, minGames: 2000, minGamesMasters: 10, maxPly: 24, maxPositions: 150, depth: 18 };

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
    // As the explorer names the position after 1.e4 c6 (seen in the first crawl).
    family: 'Caro-Kann Defense',
    // 1.e4 c6 is far more played than the Ponziani, so the position limit does the cutting: the
    // most played positions (and all book lines) come first. About an hour of crawling.
    crawl: { minShare: 0.03, minGames: 10000, minGamesMasters: 20, maxPly: 24, maxPositions: 400, depth: 18 },
  },
  {
    id: 'italian',
    name: 'Italian Game',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'ruy-lopez',
    name: 'Ruy Lopez',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'scotch',
    name: 'Scotch Game',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'd4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'vienna',
    name: 'Vienna Game',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nc3'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'kings-gambit',
    name: "King's Gambit",
    side: 'white',
    rootLine: ['e4', 'e5', 'f4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'evans-gambit',
    name: 'Evans Gambit',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'b4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'danish-gambit',
    name: 'Danish Gambit',
    side: 'white',
    rootLine: ['e4', 'e5', 'd4', 'exd4', 'c3'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'bishops-opening',
    name: "Bishop's Opening",
    side: 'white',
    rootLine: ['e4', 'e5', 'Bc4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'fried-liver',
    name: 'Fried Liver Attack',
    side: 'white',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'Ng5'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'london',
    name: 'London System',
    side: 'white',
    rootLine: ['d4', 'd5', 'Bf4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'english',
    name: 'English Opening',
    side: 'white',
    rootLine: ['c4'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'smith-morra',
    name: 'Smith-Morra Gambit',
    side: 'white',
    rootLine: ['e4', 'c5', 'd4', 'cxd4', 'c3'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'alapin',
    name: 'Alapin Sicilian',
    side: 'white',
    rootLine: ['e4', 'c5', 'c3'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'catalan',
    name: 'Catalan',
    side: 'white',
    rootLine: ['d4', 'Nf6', 'c4', 'e6', 'g3'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'sicilian',
    name: 'Sicilian Defence',
    side: 'black',
    rootLine: ['e4', 'c5'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'french',
    name: 'French Defence',
    side: 'black',
    rootLine: ['e4', 'e6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'scandinavian',
    name: 'Scandinavian Defence',
    side: 'black',
    rootLine: ['e4', 'd5'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'pirc',
    name: 'Pirc Defence',
    side: 'black',
    rootLine: ['e4', 'd6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'alekhine',
    name: "Alekhine's Defence",
    side: 'black',
    rootLine: ['e4', 'Nf6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'modern',
    name: 'Modern Defence',
    side: 'black',
    rootLine: ['e4', 'g6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'two-knights',
    name: 'Two Knights Defence',
    side: 'black',
    rootLine: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'petrov',
    name: 'Petrov Defence',
    side: 'black',
    rootLine: ['e4', 'e5', 'Nf3', 'Nf6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'philidor',
    name: 'Philidor Defence',
    side: 'black',
    rootLine: ['e4', 'e5', 'Nf3', 'd6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'qgd',
    name: "Queen's Gambit Declined",
    side: 'black',
    rootLine: ['d4', 'd5', 'c4', 'e6'],
    crawl: NEW_OPENING_CRAWL,
  },
  {
    id: 'slav',
    name: 'Slav Defence',
    side: 'black',
    rootLine: ['d4', 'd5', 'c4', 'c6'],
    crawl: NEW_OPENING_CRAWL,
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
