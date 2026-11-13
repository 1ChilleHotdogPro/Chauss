import { sideToMove, winPercent, type Score } from '../analysis/eval';
import type { Side } from '../game/game';
import type { CrawlMove, CrawlNode, CrawlResult } from './crawl';
import {
  positionKey,
  sumCounts,
  type Counts,
  type Snapshot,
  type SnapshotMeta,
  type SnapshotMove,
  type SnapshotNode,
} from './format';

export interface ListingOptions {
  /** A move that is not followed is still listed from this share of the games (in either source). */
  listShare: number;
  maxListedMoves: number;
}

/**
 * The moves of a position worth keeping: every move the tree follows, plus the other reasonably
 * common ones, so the app can show (and flag) popular moves even where the tree stops.
 */
export function listedMoves(node: CrawlNode, options: ListingOptions): CrawlMove[] {
  const nodeLichess = sumCounts(node.lichess);
  const nodeMasters = sumCounts(node.masters);
  const common = (move: CrawlMove): boolean =>
    (nodeLichess > 0 && sumCounts(move.lichess) / nodeLichess >= options.listShare) ||
    (nodeMasters > 0 && sumCounts(move.masters) / nodeMasters >= options.listShare);

  const followed = node.moves.filter((move) => move.follow !== undefined);
  const others = node.moves.filter((move) => move.follow === undefined && common(move));
  const room = Math.max(0, options.maxListedMoves - followed.length);
  const kept = new Set([...followed, ...others.slice(0, room)]);
  return node.moves.filter((move) => kept.has(move)); // original order: most played first
}

/** Every position that needs a Stockfish score: each stored position and each listed move's result. */
export function positionsToEvaluate(result: CrawlResult, options: ListingOptions): Map<string, string> {
  const positions = new Map<string, string>();
  for (const node of result.nodes.values()) {
    positions.set(node.key, node.fen);
    for (const move of listedMoves(node, options)) {
      const key = positionKey(move.fenAfter);
      if (!positions.has(key)) positions.set(key, move.fenAfter);
    }
  }
  return positions;
}

/**
 * The one reply to recommend in a lightly covered sideline, chosen by rule from the data:
 * the move masters play most — unless Stockfish thinks it gives away more than `tolerance`
 * percentage points of winning chances compared with the best listed move, in which case the
 * best-scoring move that masters do play.
 */
export function recommendReply(
  moves: readonly { uci: string; masters: Counts; eval?: Score | undefined }[],
  mover: Side,
  tolerance = 5,
): string | undefined {
  const scored = moves.filter((move) => move.eval !== undefined);
  if (scored.length === 0) return undefined;
  const win = (move: (typeof scored)[number]): number => winPercent(move.eval!, mover);
  const best = Math.max(...scored.map(win));

  const byMasters = scored
    .filter((move) => sumCounts(move.masters) > 0)
    .sort((a, b) => sumCounts(b.masters) - sumCounts(a.masters));
  const mostPlayed = byMasters[0];
  if (!mostPlayed) return [...scored].sort((a, b) => win(b) - win(a))[0]?.uci;
  if (win(mostPlayed) >= best - tolerance) return mostPlayed.uci;
  return [...byMasters].sort((a, b) => win(b) - win(a))[0]?.uci;
}

/** Combine the crawled data and the engine scores into the snapshot that gets written to disk. */
export function assembleSnapshot(
  result: CrawlResult,
  evals: ReadonlyMap<string, Score>,
  meta: Omit<SnapshotMeta, 'counts'> & { counts: Pick<SnapshotMeta['counts'], 'explorerRequests' | 'evaluations'> },
): Snapshot {
  const listing: ListingOptions = {
    listShare: meta.thresholds.listShare,
    maxListedMoves: meta.thresholds.maxListedMoves,
  };
  const nodes: Record<string, SnapshotNode> = {};
  let moveCount = 0;

  // Shallowest first, then most played: a stable, readable order in the file.
  const ordered = [...result.nodes.values()].sort(
    (a, b) => a.ply - b.ply || sumCounts(b.lichess) - sumCounts(a.lichess) || a.key.localeCompare(b.key),
  );

  for (const node of ordered) {
    const moves: SnapshotMove[] = listedMoves(node, listing).map((move) => {
      const out: SnapshotMove = { uci: move.uci, san: move.san, masters: move.masters, lichess: move.lichess };
      if (move.opening) out.opening = move.opening;
      const after = positionKey(move.fenAfter);
      const score = evals.get(after);
      if (score) out.eval = score;
      if (move.follow !== undefined && result.nodes.has(after)) out.next = after;
      return out;
    });
    moveCount += moves.length;

    const out: SnapshotNode = {
      fen: node.fen,
      ply: node.ply,
      kind: node.kind,
      masters: node.masters,
      lichess: node.lichess,
      moves,
    };
    if (node.opening) out.opening = node.opening;
    const score = evals.get(node.key);
    if (score) out.eval = score;
    if (node.kind === 'sideline') {
      const recommended = recommendReply(moves, sideToMove(node.fen));
      if (recommended) out.recommended = recommended;
    }
    nodes[node.key] = out;
  }

  return {
    meta: { ...meta, counts: { ...meta.counts, positions: ordered.length, moves: moveCount } },
    rootKey: result.rootKey,
    nodes,
  };
}

/**
 * JSON with one position per line: small enough to ship, and a re-crawl shows up in Git as
 * changed lines rather than one giant line.
 */
export function stringifySnapshot(snapshot: Snapshot): string {
  const lines = Object.entries(snapshot.nodes).map(
    ([key, node]) => `${JSON.stringify(key)}:${JSON.stringify(node)}`,
  );
  return `{"meta":${JSON.stringify(snapshot.meta)},\n"rootKey":${JSON.stringify(snapshot.rootKey)},\n"nodes":{\n${lines.join(',\n')}\n}}\n`;
}
