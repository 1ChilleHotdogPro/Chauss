import { judgeMove, sideToMove, winPercent, type Score, type Verdict } from '../analysis/eval';
import type { Side } from '../game/game';
import { sumCounts, type Snapshot, type SnapshotNode } from '../snapshot/format';

/**
 * A "trap" here is not a line from a book. It is a move that people at the snapshot's level really
 * play in this opening and that Stockfish says loses at least a mistake's worth — found in the
 * data by rule, then re-checked with a deeper search before it is listed.
 */
export interface Trap {
  /** Stable name: the position's key and the move. */
  id: string;
  /** Moves from the start position to the position where the bad move is played. */
  line: string[];
  /** That position. */
  fen: string;
  /** Who plays the bad move. */
  victim: Side;
  /** exploit = the opponent (Black) errs and White can punish; avoid = White is the one who errs. */
  kind: 'exploit' | 'avoid';
  move: { uci: string; san: string };
  opening?: string;
  /** How often the move is played at the snapshot's level, and by masters. */
  popular: { games: number; share: number };
  book: { games: number; share: number };
  /** Stockfish (deeper search), White's point of view: before the move with best play, and after it. */
  scoreBefore: Score;
  scoreAfter: Score;
  /** Drop in the victim's winning chances, in percentage points. */
  drop: number;
  verdict: Extract<Verdict, 'mistake' | 'blunder'>;
  /** The punishment: Stockfish's best line after the bad move. */
  refutation: { uci: string[]; san: string[]; why: string };
}

export interface TrapFile {
  meta: {
    formatVersion: 1;
    createdAt: string;
    /** The snapshot the traps were selected from. */
    snapshotCreatedAt: string;
    engine: { name: string; depth: number };
    rule: TrapRule;
  };
  traps: Trap[];
}

export interface TrapRule {
  /** The bad move must be played in at least this share of the games at its position ... */
  minShare: number;
  /** ... and at least this many games. */
  minGames: number;
  /** Minimum drop in winning chances by the snapshot's scores to be considered at all. */
  minDrop: number;
  /** How many candidates go on to the deeper check (the most often played first). */
  maxCandidates: number;
}

export interface TrapCandidate {
  key: string;
  node: SnapshotNode;
  line: string[];
  move: SnapshotNode['moves'][number];
  victim: Side;
  /** Drop by the snapshot's own scores. */
  drop: number;
  games: number;
  share: number;
}

/** The shortest sequence of moves from the start to every position of the snapshot. */
export function pathsFromRoot(snapshot: Snapshot): Map<string, string[]> {
  const paths = new Map<string, string[]>([[snapshot.rootKey, []]]);
  const queue = [snapshot.rootKey];
  while (queue.length > 0) {
    const key = queue.shift()!;
    const path = paths.get(key)!;
    for (const move of snapshot.nodes[key]?.moves ?? []) {
      if (move.next === undefined || paths.has(move.next)) continue;
      paths.set(move.next, [...path, move.san]);
      queue.push(move.next);
    }
  }
  return paths;
}

/**
 * Pick the candidates from the snapshot: inside the opening itself (not the moves leading to it),
 * moves that are popular enough and lose enough by the snapshot's scores. Ordered by how many
 * games they were played in, so the traps people actually meet come first.
 */
export function trapCandidates(snapshot: Snapshot, rule: TrapRule): TrapCandidate[] {
  const paths = pathsFromRoot(snapshot);
  const candidates: TrapCandidate[] = [];

  for (const [key, node] of Object.entries(snapshot.nodes)) {
    if (node.kind !== 'tree') continue;
    const line = paths.get(key);
    if (!line) continue;
    const victim = sideToMove(node.fen);
    const nodeGames = sumCounts(node.lichess);
    if (nodeGames === 0) continue;

    // The yardstick: the best that is known here (as in the Explore panel).
    const scores = [node.eval, ...node.moves.map((move) => move.eval)].filter((s): s is Score => s !== undefined);
    if (scores.length === 0) continue;
    const best = scores.reduce((a, b) => (winPercent(b, victim) > winPercent(a, victim) ? b : a));

    for (const move of node.moves) {
      if (!move.eval) continue;
      const games = sumCounts(move.lichess);
      const share = games / nodeGames;
      if (games < rule.minGames || share < rule.minShare) continue;
      const { drop } = judgeMove({ before: best, after: move.eval, mover: victim, playedBest: false });
      if (drop < rule.minDrop) continue;
      candidates.push({ key, node, line, move, victim, drop, games, share });
    }
  }

  return candidates.sort((a, b) => b.games - a.games || b.drop - a.drop).slice(0, rule.maxCandidates);
}

function isScore(value: unknown): value is Score {
  if (typeof value !== 'object' || value === null) return false;
  const score = value as Record<string, unknown>;
  return (
    (score.type === 'cp' && typeof score.value === 'number') ||
    (score.type === 'mate' && (score.winner === 'white' || score.winner === 'black') && typeof score.moves === 'number')
  );
}

/** Check the structure of a trap file. Returns a list of problems; empty means sound. */
export function validateTrapFile(value: unknown): string[] {
  if (typeof value !== 'object' || value === null) return ['not an object'];
  const file = value as Record<string, unknown>;
  const problems: string[] = [];
  const meta = file.meta as Record<string, unknown> | undefined;
  if (typeof meta !== 'object' || meta === null || meta.formatVersion !== 1) problems.push('meta is missing or has the wrong version');
  if (!Array.isArray(file.traps)) return [...problems, 'traps is missing'];

  const ids = new Set<string>();
  for (const raw of file.traps as unknown[]) {
    if (typeof raw !== 'object' || raw === null) {
      problems.push('a trap is not an object');
      continue;
    }
    const trap = raw as Record<string, unknown>;
    const where = `trap ${String(trap.id)}`;
    if (typeof trap.id !== 'string' || trap.id === '') problems.push('a trap has no id');
    else if (ids.has(trap.id)) problems.push(`${where}: listed twice`);
    else ids.add(trap.id);
    if (!Array.isArray(trap.line) || !trap.line.every((san) => typeof san === 'string')) problems.push(`${where}: bad line`);
    if (typeof trap.fen !== 'string') problems.push(`${where}: bad fen`);
    if (trap.victim !== 'white' && trap.victim !== 'black') problems.push(`${where}: bad victim`);
    if (trap.kind !== (trap.victim === 'white' ? 'avoid' : 'exploit')) problems.push(`${where}: kind does not match the victim`);
    if (trap.verdict !== 'mistake' && trap.verdict !== 'blunder') problems.push(`${where}: bad verdict`);
    if (!isScore(trap.scoreBefore) || !isScore(trap.scoreAfter)) problems.push(`${where}: bad scores`);
    if (typeof trap.drop !== 'number') problems.push(`${where}: bad drop`);
    const move = trap.move as Record<string, unknown> | undefined;
    if (typeof move?.uci !== 'string' || typeof move?.san !== 'string') problems.push(`${where}: bad move`);
    const refutation = trap.refutation as Record<string, unknown> | undefined;
    if (
      !Array.isArray(refutation?.uci) ||
      !Array.isArray(refutation?.san) ||
      refutation.san.length === 0 ||
      typeof refutation.why !== 'string' ||
      refutation.why === ''
    ) {
      problems.push(`${where}: bad refutation`);
    }
    for (const field of ['popular', 'book'] as const) {
      const stats = trap[field] as Record<string, unknown> | undefined;
      if (typeof stats?.games !== 'number' || typeof stats?.share !== 'number') problems.push(`${where}: bad ${field}`);
    }
  }
  return problems;
}
