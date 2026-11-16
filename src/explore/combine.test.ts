import { describe, expect, it } from 'vitest';
import type { NodeKind, Snapshot, SnapshotNode } from '../snapshot/format';
import { combineSnapshots } from './combine';

function node(fen: string, kind: NodeKind): SnapshotNode {
  return { fen, ply: 0, kind, masters: [0, 0, 0], lichess: [0, 0, 0], moves: [] };
}

function snapshot(openingId: string, nodes: Record<string, NodeKind>): Snapshot {
  return {
    meta: { openingId } as Snapshot['meta'],
    rootKey: 'start',
    nodes: Object.fromEntries(Object.entries(nodes).map(([key, kind]) => [key, node(`${openingId}:${key}`, kind)])),
  };
}

describe('combineSnapshots', () => {
  const ponziani = snapshot('ponziani', { start: 'prelude', e4: 'prelude', e4c6: 'sideline', e4e5: 'prelude', deep: 'tree' });
  const caro = snapshot('caro-kann', { start: 'prelude', e4: 'prelude', e4c6: 'tree', e4c6d4: 'tree' });

  it('keeps every position of every opening', () => {
    const { snapshot: combined } = combineSnapshots([ponziani, caro]);
    expect(Object.keys(combined.nodes).sort()).toEqual(['deep', 'e4', 'e4c6', 'e4c6d4', 'e4e5', 'start']);
  });

  it("prefers an opening's own tree over another opening's sideline", () => {
    const { snapshot: combined, owner } = combineSnapshots([ponziani, caro]);
    expect(combined.nodes.e4c6?.fen).toBe('caro-kann:e4c6');
    expect(owner.e4c6).toBe(1);
  });

  it('keeps the first snapshot on a tie, and its meta', () => {
    const { snapshot: combined, owner } = combineSnapshots([ponziani, caro]);
    expect(combined.nodes.start?.fen).toBe('ponziani:start');
    expect(owner.start).toBe(0);
    expect(combined.meta.openingId).toBe('ponziani');
    expect(combineSnapshots([caro, ponziani]).snapshot.nodes.start?.fen).toBe('caro-kann:start');
  });
});
