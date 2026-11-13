import { positionKey, type Snapshot, type SnapshotNode } from '../snapshot/format';
import { buildExplorePosition, type ExploreMove, type ExplorePosition, type MoveFlag } from './position';

/**
 * A short remark shown at a key position. CLAUDE.md forbids writing opening ideas from memory, so
 * every remark comes with `checks`: statements about the bundled data that must hold for the
 * sentence to be true. A unit test runs all checks against the real snapshot, and the app only
 * shows a remark whose checks pass — a re-crawl that changes the facts silences the sentence
 * instead of leaving a wrong one on screen.
 */
export interface Idea {
  /** The moves from the start position that reach the position the remark is about. */
  line: string[];
  text: string;
  checks: IdeaCheck[];
}

const FLAG_RANK: Record<MoveFlag, number> = { none: 0, inaccuracy: 1, mistake: 2, blunder: 3 };

/** A statement about the bundled data. `line` is the position it is about (moves from the start). */
export type IdeaCheck =
  /** The move masters play most here is `san`, in at least `minShare` (0-1) of the games. */
  | { kind: 'book-top'; line: string[]; san: string; minShare?: number }
  /** The move played most at the snapshot's level is `san`, in at least `minShare` of the games. */
  | { kind: 'popular-top'; line: string[]; san: string; minShare?: number }
  /** `san` is played at the snapshot's level in a share of games between `min` and `max` (0-1). */
  | { kind: 'popular-share'; line: string[]; san: string; min?: number; max?: number }
  /** Masters have played `san` here in a share of games between `min` and `max` (0-1). */
  | { kind: 'book-share'; line: string[]; san: string; min?: number; max?: number }
  /** Stockfish flags `san` as at least this bad. */
  | { kind: 'flagged'; line: string[]; san: string; atLeast: Exclude<MoveFlag, 'none'> }
  /** Stockfish does not flag `san` at all. */
  | { kind: 'sound'; line: string[]; san: string }
  /** Stockfish's score of the position, in pawns from White's point of view, is in this range. */
  | { kind: 'score'; line: string[]; min?: number; max?: number };

/** Follow moves from the start position through the snapshot's links. */
export function nodeAfter(snapshot: Snapshot, line: readonly string[]): SnapshotNode | undefined {
  let node = snapshot.nodes[snapshot.rootKey];
  for (const san of line) {
    const next = node?.moves.find((move) => move.san === san)?.next;
    node = next === undefined ? undefined : snapshot.nodes[next];
  }
  return node;
}

const inRange = (value: number, min: number | undefined, max: number | undefined): boolean =>
  (min === undefined || value >= min) && (max === undefined || value <= max);

/** Why a check does not hold, or null if it does. */
export function failedCheck(snapshot: Snapshot, check: IdeaCheck): string | null {
  const where = check.line.join(' ') || 'the start position';
  const node = nodeAfter(snapshot, check.line);
  if (!node) return `the snapshot has no position after ${where}`;
  const position: ExplorePosition = buildExplorePosition(node);

  if (check.kind === 'score') {
    if (!position.eval || position.eval.type !== 'cp') return `no plain score after ${where}`;
    const pawns = position.eval.value / 100;
    return inRange(pawns, check.min, check.max) ? null : `score after ${where} is ${pawns.toFixed(2)}`;
  }

  if (check.kind === 'book-top' || check.kind === 'popular-top') {
    const list = check.kind === 'book-top' ? position.bookMoves : position.popularMoves;
    const top = list[0];
    const stats = check.kind === 'book-top' ? top?.book : top?.popular;
    if (!top || !stats) return `no moves after ${where}`;
    if (top.san !== check.san) return `after ${where} the top move is ${top.san}, not ${check.san}`;
    if (check.minShare !== undefined && stats.share < check.minShare) {
      return `after ${where}, ${check.san} has only ${(stats.share * 100).toFixed(1)}%`;
    }
    return null;
  }

  const move: ExploreMove | undefined = position.moves.find((candidate) => candidate.san === check.san);
  if (!move) return `after ${where} the move ${check.san} is not listed`;

  switch (check.kind) {
    case 'popular-share':
    case 'book-share': {
      const share = (check.kind === 'popular-share' ? move.popular?.share : move.book?.share) ?? 0;
      return inRange(share, check.min, check.max)
        ? null
        : `after ${where}, ${check.san} has ${(share * 100).toFixed(1)}%`;
    }
    case 'flagged':
      return FLAG_RANK[move.flag] >= FLAG_RANK[check.atLeast]
        ? null
        : `after ${where}, ${check.san} is flagged "${move.flag}", not at least "${check.atLeast}"`;
    case 'sound':
      return move.flag === 'none' ? null : `after ${where}, ${check.san} is flagged "${move.flag}"`;
  }
}

/** Every reason an idea's sentence is not backed by the data (empty = fully backed). */
export function failedChecks(snapshot: Snapshot, idea: Idea): string[] {
  const problems: string[] = [];
  if (!nodeAfter(snapshot, idea.line)) problems.push(`the snapshot has no position after ${idea.line.join(' ')}`);
  for (const check of idea.checks) {
    const problem = failedCheck(snapshot, check);
    if (problem) problems.push(problem);
  }
  return problems;
}

/** The remark for the position with this FEN, if there is one and the data backs it. */
export function ideaFor(snapshot: Snapshot, ideas: readonly Idea[], fen: string): string | null {
  const key = positionKey(fen);
  for (const idea of ideas) {
    const node = nodeAfter(snapshot, idea.line);
    if (node && positionKey(node.fen) === key) {
      return failedChecks(snapshot, idea).length === 0 ? idea.text : null;
    }
  }
  return null;
}
