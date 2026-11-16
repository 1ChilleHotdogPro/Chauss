import type { NodeKind, Snapshot } from '../snapshot/format';

/** How much a position's entry says: an opening's own tree beats the moves on the way to it, which beat a sideline. */
const DEPTH: Record<NodeKind, number> = { tree: 2, prelude: 1, sideline: 0 };

export interface CombinedSnapshot {
  /** Every position of every opening; the meta is the first snapshot's. */
  snapshot: Snapshot;
  /** Which of the given snapshots each position's entry came from (its index). */
  owner: Record<string, number>;
}

/**
 * Explore is not tied to one opening: it looks a position up in the data of all of them. Where two
 * openings know the same position (the start, 1.e4, or 1.e4 c6, a sideline of the Ponziani but the
 * root of the Caro-Kann), the fuller entry is kept; on a tie, the earlier snapshot's.
 */
export function combineSnapshots(snapshots: readonly Snapshot[]): CombinedSnapshot {
  const first = snapshots[0];
  if (!first) throw new Error('combineSnapshots needs at least one snapshot');
  const nodes: Snapshot['nodes'] = {};
  const owner: Record<string, number> = {};
  snapshots.forEach((snapshot, index) => {
    for (const [key, node] of Object.entries(snapshot.nodes)) {
      const kept = nodes[key];
      if (kept && DEPTH[kept.kind] >= DEPTH[node.kind]) continue;
      nodes[key] = node;
      owner[key] = index;
    }
  });
  return { snapshot: { meta: first.meta, rootKey: first.rootKey, nodes }, owner };
}
