import { Chess } from 'chess.js';
import type { ExplorerPosition } from '../explorer/types';
import { positionKey, sumCounts, type Counts, type NodeKind } from './format';

/** Where the crawl gets its data. Each call either returns an answer or throws (crawl aborts). */
export interface CrawlSource {
  masters(fen: string): Promise<ExplorerPosition>;
  lichess(fen: string): Promise<ExplorerPosition>;
}

export interface CrawlThresholds {
  /** A move is followed if it has at least this share of the games at its position ... */
  minShare: number;
  /** ... and at least this many games, in the Lichess data or in the masters data. */
  minGamesLichess: number;
  minGamesMasters: number;
  /** Deepest position, in half-moves from the start. */
  maxPly: number;
  /** Stop adding positions inside the opening tree beyond this many positions in total. */
  maxPositions: number;
}

/** A move with the numbers from both sources side by side (zeros where a source lacks it). */
export interface CrawlMove {
  uci: string;
  san: string;
  masters: Counts;
  lichess: Counts;
  opening?: string;
  fenAfter: string;
  /** Kind of the position the crawl decided to visit after this move, if any. */
  follow?: NodeKind;
}

export interface CrawlNode {
  key: string;
  fen: string;
  ply: number;
  kind: NodeKind;
  opening?: { eco: string; name: string };
  masters: Counts;
  lichess: Counts;
  /** Every move either source knows, most played first. */
  moves: CrawlMove[];
}

export interface CrawlResult {
  rootKey: string;
  nodes: Map<string, CrawlNode>;
  /** True when the position limit cut the tree short. */
  truncated: boolean;
}

const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function counts(value: { white: number; draws: number; black: number } | undefined): Counts {
  return value ? [value.white, value.draws, value.black] : [0, 0, 0];
}

/**
 * Put the two sources side by side for one position.
 * Moves are matched by their normal notation and re-checked with chess.js, which also gives the
 * resulting position and a uniform spelling (Lichess may write castling as king-takes-rook).
 * Anything that is not a legal move in the position is dropped.
 */
export function mergeMoves(fen: string, masters: ExplorerPosition, lichess: ExplorerPosition): CrawlMove[] {
  const sans = [...new Set([...lichess.moves, ...masters.moves].map((move) => move.san))];
  const merged: CrawlMove[] = [];
  for (const san of sans) {
    const fromMasters = masters.moves.find((move) => move.san === san);
    const fromLichess = lichess.moves.find((move) => move.san === san);
    let played;
    try {
      played = new Chess(fen).move(san);
    } catch {
      continue;
    }
    const move: CrawlMove = {
      uci: `${played.from}${played.to}${played.promotion ?? ''}`,
      san: played.san,
      masters: counts(fromMasters),
      lichess: counts(fromLichess),
      fenAfter: played.after,
    };
    const opening = fromLichess?.opening?.name ?? fromMasters?.opening?.name;
    if (opening) move.opening = opening;
    merged.push(move);
  }
  return merged.sort(
    (a, b) => sumCounts(b.lichess) - sumCounts(a.lichess) || sumCounts(b.masters) - sumCounts(a.masters),
  );
}

/**
 * The rule for following a move: enough of the games at this position (share) AND enough games in
 * absolute terms — in the Lichess data or in the masters data.
 */
export function meetsThreshold(
  move: Pick<CrawlMove, 'masters' | 'lichess'>,
  node: Pick<CrawlNode, 'masters' | 'lichess'>,
  thresholds: Pick<CrawlThresholds, 'minShare' | 'minGamesLichess' | 'minGamesMasters'>,
): boolean {
  const check = (moveGames: number, nodeGames: number, minGames: number): boolean =>
    nodeGames > 0 && moveGames >= minGames && moveGames / nodeGames >= thresholds.minShare;
  return (
    check(sumCounts(move.lichess), sumCounts(node.lichess), thresholds.minGamesLichess) ||
    check(sumCounts(move.masters), sumCounts(node.masters), thresholds.minGamesMasters)
  );
}

/**
 * Which moves of a position lead further, and to what kind of position.
 * @param rootLine the fixed moves leading to the opening, e.g. ["e4","e5","Nf3","Nc6","c3"]
 */
export function movesToFollow(
  node: Pick<CrawlNode, 'ply' | 'kind' | 'masters' | 'lichess' | 'fen'> & { moves: readonly CrawlMove[] },
  rootLine: readonly string[],
  thresholds: CrawlThresholds,
): Map<string, NodeKind> {
  const follow = new Map<string, NodeKind>();
  if (node.kind === 'sideline') return follow; // light coverage: nothing deeper

  if (node.kind === 'prelude') {
    const mainMove = rootLine[node.ply];
    const blackToMove = node.fen.split(' ')[1] === 'b';
    for (const move of node.moves) {
      if (move.san === mainMove) follow.set(move.uci, node.ply + 1 < rootLine.length ? 'prelude' : 'tree');
      // Black leaving the path early is recorded as a sideline; White's other first moves are not ours.
      else if (blackToMove && meetsThreshold(move, node, thresholds)) follow.set(move.uci, 'sideline');
    }
    return follow;
  }

  if (node.ply + 1 > thresholds.maxPly) return follow;
  for (const move of node.moves) {
    if (meetsThreshold(move, node, thresholds)) follow.set(move.uci, 'tree');
  }
  return follow;
}

/**
 * Which positions inside the opening are visited first. Book lines (moves that qualify through the
 * masters data) come before everything else — there are few of them and they are the theory —
 * then the rest by number of Lichess games. So if the position limit cuts the tree, it cuts the
 * least-played non-book positions.
 */
function treePriority(move: CrawlMove, node: CrawlNode, thresholds: CrawlThresholds): number {
  const book = meetsThreshold({ masters: move.masters, lichess: [0, 0, 0] }, node, thresholds);
  return book ? 1e12 + sumCounts(move.masters) : sumCounts(move.lichess);
}

interface Pending {
  fen: string;
  ply: number;
  kind: NodeKind;
  /** More-played positions are visited first, so a position limit cuts the least important ones. */
  priority: number;
  inheritedOpening?: { eco: string; name: string } | undefined;
}

/**
 * Walk the opening from the start position: along the fixed moves to the opening, noting Black's
 * early alternatives as sidelines, then through the opening itself following every move that meets
 * the thresholds.
 */
export async function crawl(
  source: CrawlSource,
  options: { rootLine: readonly string[]; thresholds: CrawlThresholds },
  onProgress?: (visited: number, waiting: number, node: CrawlNode) => void,
): Promise<CrawlResult> {
  const { rootLine, thresholds } = options;
  const nodes = new Map<string, CrawlNode>();
  const queue: Pending[] = [{ fen: START_FEN, ply: 0, kind: 'prelude', priority: Infinity }];
  let truncated = false;

  while (queue.length > 0) {
    queue.sort((a, b) => b.priority - a.priority);
    const item = queue.shift()!;
    const key = positionKey(item.fen);
    if (nodes.has(key)) continue;
    if (item.kind === 'tree' && nodes.size >= thresholds.maxPositions) {
      truncated = true;
      continue;
    }

    const masters = await source.masters(item.fen);
    const lichess = await source.lichess(item.fen);
    const node: CrawlNode = {
      key,
      fen: item.fen,
      ply: item.ply,
      kind: item.kind,
      masters: counts(masters),
      lichess: counts(lichess),
      moves: mergeMoves(item.fen, masters, lichess),
    };
    // A position without a name of its own keeps the name of the line it came from.
    const opening = lichess.opening ?? masters.opening ?? item.inheritedOpening;
    if (opening) node.opening = opening;
    nodes.set(key, node);

    const follow = movesToFollow(node, rootLine, thresholds);
    for (const move of node.moves) {
      const kind = follow.get(move.uci);
      if (!kind) continue;
      move.follow = kind;
      queue.push({
        fen: move.fenAfter,
        ply: node.ply + 1,
        kind,
        priority: kind === 'tree' ? treePriority(move, node, thresholds) : Infinity,
        inheritedOpening: node.opening,
      });
    }
    onProgress?.(nodes.size, queue.length, node);
  }

  return { rootKey: positionKey(START_FEN), nodes, truncated };
}

/**
 * How many positions a (stricter) set of thresholds would keep, worked out from a finished crawl
 * without asking Lichess again. Used to choose thresholds that give a snapshot of sensible size.
 */
export function countReachable(
  result: CrawlResult,
  rootLine: readonly string[],
  thresholds: CrawlThresholds,
): number {
  const seen = new Set<string>();
  const stack = [{ key: result.rootKey, kind: 'prelude' as NodeKind }];
  while (stack.length > 0) {
    const { key, kind } = stack.pop()!;
    const node = result.nodes.get(key);
    if (!node || seen.has(key)) continue;
    seen.add(key);
    for (const [uci, childKind] of movesToFollow({ ...node, kind }, rootLine, thresholds)) {
      const move = node.moves.find((candidate) => candidate.uci === uci);
      if (move) stack.push({ key: positionKey(move.fenAfter), kind: childKind });
    }
  }
  return seen.size;
}
