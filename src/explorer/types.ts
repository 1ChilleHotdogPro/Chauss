/**
 * The Lichess opening explorer: what can be asked and what comes back.
 * Field names follow the official API spec (github.com/lichess-org/api).
 */

/** Each value starts a rating group that runs up to the next one: 1000 means 1000-1199. */
export const RATING_BANDS = [0, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2500] as const;
export type RatingBand = (typeof RATING_BANDS)[number];

export const SPEEDS = ['ultraBullet', 'bullet', 'blitz', 'rapid', 'classical', 'correspondence'] as const;
export type Speed = (typeof SPEEDS)[number];

/** "masters" = the book (over-the-board master games). "lichess" = games played on Lichess. */
export type ExplorerSource = 'masters' | 'lichess';

/** Which Lichess games to count. Not used for the masters database. */
export interface LichessFilter {
  ratings: readonly RatingBand[];
  speeds: readonly Speed[];
}

export interface ExplorerOpening {
  eco: string;
  name: string;
}

export interface ExplorerMove {
  /** As sent by Lichess. Castling may be written king-takes-rook ("e1h1"), so prefer `san`. */
  uci: string;
  san: string;
  /** Games won by White, drawn, and won by Black after this move. */
  white: number;
  draws: number;
  black: number;
  averageRating: number;
  /** The opening this move leads to, when it has a name of its own. */
  opening: ExplorerOpening | null;
}

export interface ExplorerPosition {
  white: number;
  draws: number;
  black: number;
  moves: ExplorerMove[];
  opening: ExplorerOpening | null;
}

/** Every way a request can end. Nothing is thrown. */
export type ExplorerResult =
  | { status: 'ok'; data: ExplorerPosition; fromCache: boolean }
  | { status: 'no-token' }
  /** HTTP 401: the token is missing, mistyped or revoked. */
  | { status: 'unauthorized' }
  /** HTTP 429: too many requests. Nothing is sent again before `retryAt` (milliseconds since 1970). */
  | { status: 'rate-limited'; retryAt: number }
  | { status: 'network-error'; message: string }
  | { status: 'bad-response'; message: string };

export function totalGames(counts: { white: number; draws: number; black: number }): number {
  return counts.white + counts.draws + counts.black;
}

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function parseOpening(value: unknown): ExplorerOpening | null {
  if (typeof value !== 'object' || value === null) return null;
  const { eco, name } = value as Record<string, unknown>;
  return typeof eco === 'string' && typeof name === 'string' ? { eco, name } : null;
}

/**
 * Check an answer from Lichess and keep only the fields we use (game lists are dropped).
 * Returns null if it does not look like an explorer answer.
 */
export function parseExplorerPosition(json: unknown): ExplorerPosition | null {
  if (typeof json !== 'object' || json === null) return null;
  const raw = json as Record<string, unknown>;
  if (!isCount(raw.white) || !isCount(raw.draws) || !isCount(raw.black) || !Array.isArray(raw.moves)) {
    return null;
  }

  const moves: ExplorerMove[] = [];
  for (const item of raw.moves) {
    if (typeof item !== 'object' || item === null) return null;
    const move = item as Record<string, unknown>;
    if (
      typeof move.uci !== 'string' ||
      typeof move.san !== 'string' ||
      !isCount(move.white) ||
      !isCount(move.draws) ||
      !isCount(move.black)
    ) {
      return null;
    }
    moves.push({
      uci: move.uci,
      san: move.san,
      white: move.white,
      draws: move.draws,
      black: move.black,
      averageRating: isCount(move.averageRating) ? move.averageRating : 0,
      opening: parseOpening(move.opening),
    });
  }

  return {
    white: raw.white,
    draws: raw.draws,
    black: raw.black,
    moves,
    opening: parseOpening(raw.opening),
  };
}
