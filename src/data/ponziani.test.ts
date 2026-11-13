// Checks on the generated snapshot itself (src/data/ponziani.json), so a bad crawl cannot slip in.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { meetsThreshold } from '../snapshot/crawl';
import { positionKey, sumCounts, validateSnapshot, type Snapshot, type SnapshotNode } from '../snapshot/format';

const file = fileURLToPath(new URL('./ponziani.json', import.meta.url));
const text = readFileSync(file, 'utf8');
const snapshot = JSON.parse(text) as Snapshot;
const nodes = Object.entries(snapshot.nodes);

/** Follow moves (normal notation) from the start position through the snapshot's links. */
function walk(sans: readonly string[]): SnapshotNode | undefined {
  let node = snapshot.nodes[snapshot.rootKey];
  for (const san of sans) {
    const next = node?.moves.find((move) => move.san === san)?.next;
    node = next === undefined ? undefined : snapshot.nodes[next];
  }
  return node;
}

describe('ponziani.json', () => {
  it('passes the structural validation', () => {
    expect(validateSnapshot(snapshot)).toEqual([]);
  });

  it('records when and how it was made', () => {
    const { meta } = snapshot;
    expect(Date.parse(meta.createdAt)).toBeGreaterThan(Date.parse('2026-01-01'));
    expect(meta.explorerHost).toBe('https://explorer.lichess.org');
    expect(meta.lichess.ratings.length).toBeGreaterThan(0);
    expect(meta.lichess.speeds.length).toBeGreaterThan(0);
    expect(meta.rootLine).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3']);
    expect(meta.engine.name).toMatch(/^Stockfish/);
    expect(meta.engine.depth).toBeGreaterThanOrEqual(12);
    expect(meta.counts.positions).toBe(nodes.length);
    expect(meta.counts.moves).toBe(nodes.reduce((sum, [, node]) => sum + node.moves.length, 0));
  });

  it('starts at the start position and contains the line 1.e4 e5 2.Nf3 Nc6 3.c3', () => {
    expect(snapshot.nodes[snapshot.rootKey]?.fen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    const line = snapshot.meta.rootLine;
    for (let length = 0; length < line.length; length++) {
      expect(walk(line.slice(0, length))?.kind, `after ${line.slice(0, length).join(' ') || 'no moves'}`).toBe('prelude');
    }
    const ponziani = walk(line);
    expect(ponziani?.kind).toBe('tree');
    expect(ponziani?.fen).toBe('r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3');
    expect(ponziani?.opening?.name).toMatch(/Ponziani/);
    expect(ponziani?.opening?.eco).toBe('C44');
    // It is a real opening with real data behind it.
    expect(sumCounts(ponziani!.lichess)).toBeGreaterThan(10_000);
    expect(sumCounts(ponziani!.masters)).toBeGreaterThan(100);
    expect(ponziani!.moves.filter((move) => move.next).length).toBeGreaterThanOrEqual(3);
  });

  it('contains only legal moves, spelled correctly, leading where they say they lead', () => {
    let checked = 0;
    for (const [key, node] of nodes) {
      for (const move of node.moves) {
        const chess = new Chess(node.fen);
        const played = chess.move(move.san); // throws if the move is not legal here
        expect(`${played.from}${played.to}${played.promotion ?? ''}`, `${key} ${move.san}`).toBe(move.uci);
        expect(played.san).toBe(move.san);
        if (move.next !== undefined) expect(positionKey(played.after), `${key} ${move.san}`).toBe(move.next);
        checked += 1;
      }
    }
    expect(checked).toBe(snapshot.meta.counts.moves);
  });

  it('follows exactly the moves its own thresholds allow', () => {
    const { thresholds, rootLine } = snapshot.meta;
    for (const [key, node] of nodes) {
      const followed = node.moves.filter((move) => move.next !== undefined);
      if (node.kind === 'sideline') {
        expect(followed, `sideline ${key}`).toEqual([]);
      } else if (node.kind === 'prelude') {
        expect(followed.some((move) => move.san === rootLine[node.ply]), `prelude ${key}`).toBe(true);
        if (node.fen.split(' ')[1] === 'w') expect(followed).toHaveLength(1); // only our own move
        for (const move of followed.filter((m) => m.san !== rootLine[node.ply])) {
          expect(meetsThreshold(move, node, thresholds), `${key} ${move.san}`).toBe(true);
          expect(snapshot.nodes[move.next!]?.kind).toBe('sideline');
        }
      } else {
        for (const move of followed) {
          expect(meetsThreshold(move, node, thresholds), `${key} ${move.san}`).toBe(true);
          expect(snapshot.nodes[move.next!]?.kind).toBe('tree');
        }
        expect(node.ply).toBeLessThanOrEqual(thresholds.maxPly);
      }
      expect(node.moves.length, key).toBeLessThanOrEqual(
        Math.max(thresholds.maxListedMoves, node.moves.filter((move) => move.next).length),
      );
    }
    expect(nodes.length).toBeLessThanOrEqual(thresholds.maxPositions + 30); // + prelude and sidelines
  });

  it('can reach every position from the start position', () => {
    const seen = new Set<string>();
    const stack = [snapshot.rootKey];
    while (stack.length > 0) {
      const key = stack.pop()!;
      if (seen.has(key)) continue;
      seen.add(key);
      for (const move of snapshot.nodes[key]?.moves ?? []) if (move.next !== undefined) stack.push(move.next);
    }
    expect(seen.size).toBe(nodes.length);
  });

  it('has consistent game counts', () => {
    for (const [key, node] of nodes) {
      // The listed moves are a subset of all the games at the position.
      for (const source of ['lichess', 'masters'] as const) {
        const listed = node.moves.reduce((sum, move) => sum + sumCounts(move[source]), 0);
        expect(listed, `${key} ${source}`).toBeLessThanOrEqual(sumCounts(node[source]));
      }
    }
  });

  it('has a Stockfish score for every position and every listed move', () => {
    for (const [key, node] of nodes) {
      expect(node.eval, key).toBeDefined();
      for (const move of node.moves) expect(move.eval, `${key} ${move.san}`).toBeDefined();
    }
    // A followed move's score is the score of the position it leads to.
    for (const [, node] of nodes) {
      for (const move of node.moves) {
        if (move.next !== undefined) expect(move.eval).toEqual(snapshot.nodes[move.next]?.eval);
      }
    }
    // Sanity: the start position is roughly equal.
    const start = snapshot.nodes[snapshot.rootKey]!.eval!;
    expect(start.type).toBe('cp');
    if (start.type === 'cp') expect(Math.abs(start.value)).toBeLessThan(100);
  });

  it("covers Black's early alternatives lightly, each with one recommended reply", () => {
    const sidelines = nodes.filter(([, node]) => node.kind === 'sideline');
    expect(sidelines.length).toBeGreaterThanOrEqual(4);
    for (const [key, node] of sidelines) {
      expect(node.fen.split(' ')[1], key).toBe('w'); // White to reply
      expect(node.ply === 2 || node.ply === 4, key).toBe(true);
      expect(node.recommended, key).toBeDefined();
      const reply = node.moves.find((move) => move.uci === node.recommended);
      expect(reply, key).toBeDefined();
      expect(sumCounts(reply!.masters), `${key}: the recommended move is one masters play`).toBeGreaterThan(0);
    }
    // Only sidelines carry a recommendation.
    expect(nodes.filter(([, node]) => node.kind !== 'sideline' && node.recommended !== undefined)).toEqual([]);
  });

  it('contains no token and is small enough to ship', () => {
    expect(text).not.toMatch(/lip_[A-Za-z0-9]{8,}/);
    expect(text).not.toMatch(/Bearer|Authorization/i);
    const envFile = fileURLToPath(new URL('../../.env.local', import.meta.url));
    if (existsSync(envFile)) {
      const token = /LICHESS_TOKEN\s*=\s*["']?([^"'\s]+)/.exec(readFileSync(envFile, 'utf8'))?.[1];
      if (token) expect(text.includes(token)).toBe(false);
    }
    expect(statSync(file).size).toBeLessThan(1_500_000);
  });
});
