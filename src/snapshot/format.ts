import type { Score } from '../analysis/eval';

/** Games won by White, drawn, won by Black. */
export type Counts = [white: number, draws: number, black: number];

/**
 * - prelude: the fixed moves on the way to the Ponziani (1.e4 e5 2.Nf3 Nc6 3.c3)
 * - sideline: Black left that path at move 1 or 2 (Sicilian, Petrov, ...) — covered lightly:
 *   the data for the position and one recommended reply, nothing deeper
 * - tree: inside the Ponziani, followed as deep as the data supports
 */
export type NodeKind = 'prelude' | 'sideline' | 'tree';

export interface SnapshotMove {
  /** Engine spelling, with castling as a two-square king move ("e1g1"). */
  uci: string;
  san: string;
  /** The book: master games in which this move was played. */
  masters: Counts;
  /** Lichess games in the snapshot's rating groups and speeds. */
  lichess: Counts;
  /** The opening this move leads to, when Lichess gives it a name of its own. */
  opening?: string;
  /** Stockfish's score of the position after the move, from White's point of view. */
  eval?: Score;
  /** Key of the position this move leads to, when that position is in the snapshot too. */
  next?: string;
}

export interface SnapshotNode {
  fen: string;
  /** Half-moves played from the start position (the first time this position was reached). */
  ply: number;
  kind: NodeKind;
  opening?: { eco: string; name: string };
  masters: Counts;
  lichess: Counts;
  /** Stockfish's score of this position, from White's point of view. */
  eval?: Score;
  /** Most played first (by Lichess games, then master games). */
  moves: SnapshotMove[];
  /** Sidelines only: the one reply recommended for White (a `uci` from `moves`). */
  recommended?: string;
}

export interface SnapshotMeta {
  formatVersion: 1;
  /** ISO date-time the snapshot was built. */
  createdAt: string;
  explorerHost: string;
  /** The Lichess games that were counted. */
  lichess: { ratings: number[]; speeds: string[] };
  /** The moves that lead to the opening, in normal notation. */
  rootLine: string[];
  thresholds: {
    /** A move is followed if it has at least this share of the games at its position ... */
    minShare: number;
    /** ... and at least this many games, in the Lichess data or in the masters data. */
    minGamesLichess: number;
    minGamesMasters: number;
    /** A move is listed (without being followed) from this share. */
    listShare: number;
    maxListedMoves: number;
    maxPly: number;
    maxPositions: number;
  };
  engine: { name: string; depth: number };
  counts: { positions: number; moves: number; explorerRequests: number; evaluations: number };
}

export interface Snapshot {
  meta: SnapshotMeta;
  /** Key of the start position. */
  rootKey: string;
  /** Positions by key (see `positionKey`). */
  nodes: Record<string, SnapshotNode>;
}

/**
 * Identifies a position regardless of how it was reached: the FEN without its two move counters.
 * Two move orders that give the same position share one entry.
 */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function sumCounts(counts: Counts): number {
  return counts[0] + counts[1] + counts[2];
}

function isCounts(value: unknown): value is Counts {
  return (
    Array.isArray(value) &&
    value.length === 3 &&
    value.every((n) => typeof n === 'number' && Number.isInteger(n) && n >= 0)
  );
}

function isScore(value: unknown): value is Score {
  if (typeof value !== 'object' || value === null) return false;
  const score = value as Record<string, unknown>;
  if (score.type === 'cp') return typeof score.value === 'number' && Number.isFinite(score.value);
  if (score.type === 'mate') {
    return (
      (score.winner === 'white' || score.winner === 'black') &&
      typeof score.moves === 'number' &&
      Number.isInteger(score.moves) &&
      score.moves >= 0
    );
  }
  return false;
}

/**
 * Check the structure of a snapshot. Returns a list of problems; an empty list means it is sound.
 * (Whether the moves are legal chess is checked separately, in the tests of the generated file.)
 */
export function validateSnapshot(value: unknown): string[] {
  const problems: string[] = [];
  if (typeof value !== 'object' || value === null) return ['not an object'];
  const snapshot = value as Record<string, unknown>;

  const meta = snapshot.meta as Record<string, unknown> | undefined;
  if (typeof meta !== 'object' || meta === null) problems.push('meta is missing');
  else {
    if (meta.formatVersion !== 1) problems.push('meta.formatVersion is not 1');
    if (typeof meta.createdAt !== 'string' || Number.isNaN(Date.parse(meta.createdAt))) {
      problems.push('meta.createdAt is not a date');
    }
    for (const field of ['lichess', 'thresholds', 'engine', 'counts']) {
      if (typeof meta[field] !== 'object' || meta[field] === null) problems.push(`meta.${field} is missing`);
    }
    if (!Array.isArray(meta.rootLine)) problems.push('meta.rootLine is missing');
  }

  const nodes = snapshot.nodes as Record<string, unknown> | undefined;
  if (typeof nodes !== 'object' || nodes === null) return [...problems, 'nodes is missing'];
  if (typeof snapshot.rootKey !== 'string' || !(snapshot.rootKey in nodes)) {
    problems.push('rootKey does not name a position');
  }

  for (const [key, rawNode] of Object.entries(nodes)) {
    const where = `node "${key}"`;
    if (typeof rawNode !== 'object' || rawNode === null) {
      problems.push(`${where} is not an object`);
      continue;
    }
    const node = rawNode as Record<string, unknown>;
    if (typeof node.fen !== 'string' || positionKey(node.fen) !== key) problems.push(`${where}: fen does not match its key`);
    if (typeof node.ply !== 'number' || !Number.isInteger(node.ply) || node.ply < 0) problems.push(`${where}: bad ply`);
    if (node.kind !== 'prelude' && node.kind !== 'sideline' && node.kind !== 'tree') problems.push(`${where}: bad kind`);
    if (!isCounts(node.masters)) problems.push(`${where}: bad masters counts`);
    if (!isCounts(node.lichess)) problems.push(`${where}: bad lichess counts`);
    if (node.eval !== undefined && !isScore(node.eval)) problems.push(`${where}: bad eval`);
    if (!Array.isArray(node.moves)) {
      problems.push(`${where}: moves is missing`);
      continue;
    }

    const seen = new Set<string>();
    for (const rawMove of node.moves) {
      if (typeof rawMove !== 'object' || rawMove === null) {
        problems.push(`${where}: a move is not an object`);
        continue;
      }
      const move = rawMove as Record<string, unknown>;
      const label = `${where} move ${String(move.san)}`;
      if (typeof move.uci !== 'string' || !/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move.uci)) problems.push(`${label}: bad uci`);
      else if (seen.has(move.uci)) problems.push(`${label}: listed twice`);
      else seen.add(move.uci);
      if (typeof move.san !== 'string' || move.san === '') problems.push(`${label}: bad san`);
      if (!isCounts(move.masters)) problems.push(`${label}: bad masters counts`);
      if (!isCounts(move.lichess)) problems.push(`${label}: bad lichess counts`);
      if (move.eval !== undefined && !isScore(move.eval)) problems.push(`${label}: bad eval`);
      if (move.opening !== undefined && typeof move.opening !== 'string') problems.push(`${label}: bad opening`);
      if (move.next !== undefined && (typeof move.next !== 'string' || !(move.next in nodes))) {
        problems.push(`${label}: next points to a position that is not in the snapshot`);
      }
    }
    if (node.recommended !== undefined && (typeof node.recommended !== 'string' || !seen.has(node.recommended))) {
      problems.push(`${where}: recommended move is not one of its moves`);
    }
  }
  return problems;
}
