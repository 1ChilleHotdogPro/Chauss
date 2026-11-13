import { sideToMove, winPercent, type Score } from '../analysis/eval';
import { sumCounts, type Snapshot, type SnapshotMove, type SnapshotNode } from '../snapshot/format';

export interface RepertoireOptions {
  /**
   * How many percentage points of winning chances the book move may give away, compared with the
   * best-scoring listed move, and still be the repertoire move.
   */
  tolerance: number;
  /** A move needs at least this many master games to count as "the book move". */
  minBookGames: number;
}

export const DEFAULT_REPERTOIRE_OPTIONS: RepertoireOptions = { tolerance: 5, minBookGames: 5 };

/** One thing to learn: in this position, play this move. */
export interface Card {
  /** The position's key in the snapshot. */
  key: string;
  fen: string;
  /** The moves from the start position that reach it (the first way found). */
  line: string[];
  /** The repertoire move. */
  move: { uci: string; san: string };
  /** Why this move, in a few data-backed words (see `chooseMove`). */
  reason: MoveReason;
  /**
   * How likely this position is to come up when Black picks moves the way players at the
   * snapshot's level do, starting from the drill's start position (0-1).
   */
  reach: number;
}

export type MoveReason =
  /** One of the fixed moves that define the opening. */
  | { kind: 'opening-move' }
  /** The move masters play most, and Stockfish is content with it. */
  | { kind: 'book'; games: number; share: number }
  /** Masters prefer another move, but Stockfish scores this one clearly better. */
  | { kind: 'engine-over-book'; bookMove: string }
  /** No (or hardly any) master games here: Stockfish's best among the listed moves. */
  | { kind: 'engine' };

export interface Repertoire {
  /** Where drills start (the first position of the opening itself). */
  startKey: string;
  /** The moves that lead to `startKey`. */
  startLine: string[];
  /** Cards by position key. */
  cards: Map<string, Card>;
}

const whiteWin = (score: Score): number => winPercent(score, 'white');

/**
 * Pick White's move in a position, by rule from the data:
 *   1. the move masters play most (with enough games to mean something), unless Stockfish says it
 *      gives away more than the tolerance compared with the best listed move;
 *   2. otherwise the best-scoring move that masters do play;
 *   3. with no master games to go on, the best-scoring listed move.
 */
export function chooseMove(
  node: Pick<SnapshotNode, 'moves' | 'masters'>,
  options: RepertoireOptions = DEFAULT_REPERTOIRE_OPTIONS,
): { move: SnapshotMove; reason: MoveReason } | undefined {
  const scored = node.moves.filter((move): move is SnapshotMove & { eval: Score } => move.eval !== undefined);
  if (scored.length === 0) return undefined;
  const best = Math.max(...scored.map((move) => whiteWin(move.eval)));
  const byScore = (a: SnapshotMove & { eval: Score }, b: SnapshotMove & { eval: Score }): number =>
    whiteWin(b.eval) - whiteWin(a.eval);

  const book = scored
    .filter((move) => sumCounts(move.masters) >= options.minBookGames)
    .sort((a, b) => sumCounts(b.masters) - sumCounts(a.masters));
  const favourite = book[0];
  if (!favourite) return { move: [...scored].sort(byScore)[0]!, reason: { kind: 'engine' } };

  if (whiteWin(favourite.eval) >= best - options.tolerance) {
    const positionGames = sumCounts(node.masters);
    const games = sumCounts(favourite.masters);
    return { move: favourite, reason: { kind: 'book', games, share: positionGames > 0 ? games / positionGames : 0 } };
  }
  const better = [...book].sort(byScore)[0]!;
  if (better === favourite) return { move: favourite, reason: { kind: 'book', games: sumCounts(favourite.masters), share: 0 } };
  return { move: better, reason: { kind: 'engine-over-book', bookMove: favourite.san } };
}

/** The Black moves the drill can play in a position (those the snapshot continues after), with their weights. */
export function blackReplies(node: SnapshotNode): { move: SnapshotMove; weight: number }[] {
  return node.moves
    .filter((move) => move.next !== undefined)
    .map((move) => ({ move, weight: sumCounts(move.lichess) }))
    .filter((reply) => reply.weight > 0);
}

/**
 * Build the repertoire from the snapshot: starting at the opening position, follow White's chosen
 * move at every White position and every Black reply the snapshot continues after. Each White
 * position reached becomes a card.
 */
export function buildRepertoire(
  snapshot: Snapshot,
  options: RepertoireOptions = DEFAULT_REPERTOIRE_OPTIONS,
): Repertoire {
  // Walk the fixed moves to the opening.
  const startLine: string[] = [];
  let key = snapshot.rootKey;
  for (const san of snapshot.meta.rootLine) {
    const next = snapshot.nodes[key]?.moves.find((move) => move.san === san)?.next;
    if (next === undefined) break;
    startLine.push(san);
    key = next;
  }
  const startKey = key;

  const cards = new Map<string, Card>();
  const reachOf = new Map<string, number>([[startKey, 1]]);
  const lineOf = new Map<string, string[]>([[startKey, startLine]]);
  // Shallowest first, so each position's reach is complete before it is passed on.
  const queue = [startKey];
  const queued = new Set(queue);

  const pass = (toKey: string, amount: number, line: string[]): void => {
    reachOf.set(toKey, (reachOf.get(toKey) ?? 0) + amount);
    if (!lineOf.has(toKey)) lineOf.set(toKey, line);
    if (!queued.has(toKey)) {
      queued.add(toKey);
      queue.push(toKey);
    }
  };

  while (queue.length > 0) {
    // Positions are processed in order of depth: take the shallowest waiting one.
    queue.sort((a, b) => (snapshot.nodes[a]?.ply ?? 0) - (snapshot.nodes[b]?.ply ?? 0));
    const current = queue.shift()!;
    const node = snapshot.nodes[current];
    if (!node) continue;
    const reach = reachOf.get(current) ?? 0;
    const line = lineOf.get(current) ?? [];

    if (sideToMove(node.fen) === 'white') {
      const chosen = chooseMove(node, options);
      if (!chosen) continue;
      cards.set(current, {
        key: current,
        fen: node.fen,
        line,
        move: { uci: chosen.move.uci, san: chosen.move.san },
        reason: chosen.reason,
        reach,
      });
      if (chosen.move.next !== undefined) pass(chosen.move.next, reach, [...line, chosen.move.san]);
    } else {
      const replies = blackReplies(node);
      const total = replies.reduce((sum, reply) => sum + reply.weight, 0);
      for (const reply of replies) {
        pass(reply.move.next!, reach * (reply.weight / total), [...line, reply.move.san]);
      }
    }
  }

  return { startKey, startLine, cards };
}

/** "After 3...Nf6": a short name for a card, from the last Black move of its line. */
export function cardLabel(card: Pick<Card, 'line'>): string {
  const last = card.line.at(-1);
  if (!last) return 'First move';
  const ply = card.line.length; // 1-based index of the last move
  const number = Math.ceil(ply / 2);
  return ply % 2 === 0 ? `After ${number}...${last}` : `After ${number}.${last}`;
}
