// Checks on every opening's generated data (src/data/openings/<id>.json and <id>.traps.json), so a
// bad crawl cannot slip in. The Ponziani and the Caro-Kann also have their own, more detailed tests.
import { existsSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { judgeMove, sideToMove } from '../../analysis/eval';
import { failedChecks, ideaFor, nodeAfter, type Idea } from '../../explore/ideas';
import { validateTrapFile, type TrapFile } from '../../explore/traps';
import { OPENINGS } from '../../openings/registry';
import { meetsThreshold } from '../../snapshot/crawl';
import { positionKey, sumCounts, validateSnapshot, type Snapshot, type SnapshotNode } from '../../snapshot/format';

const IDEA_MODULES = import.meta.glob<{ IDEAS: readonly Idea[] }>(['../../explore/ideas/*.ts', '!../../explore/ideas/*.test.ts'], {
  eager: true,
});
const ideasOf = (id: string): readonly Idea[] | undefined => IDEA_MODULES[`../../explore/ideas/${id}.ts`]?.IDEAS;

const path = (name: string): string => fileURLToPath(new URL(`./${name}`, import.meta.url));
const assetsSource = readFileSync(fileURLToPath(new URL('../../openings/assets.ts', import.meta.url)), 'utf8');
const envFile = fileURLToPath(new URL('../../../.env.local', import.meta.url));
const token = existsSync(envFile) ? /LICHESS_TOKEN\s*=\s*["']?([^"'\s]+)/.exec(readFileSync(envFile, 'utf8'))?.[1] : undefined;

describe('the opening registry', () => {
  it('has unique ids and root lines of legal moves that end with a move of the user’s side', () => {
    const ids = OPENINGS.map((opening) => opening.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const opening of OPENINGS) {
      expect(opening.id).toMatch(/^[a-z0-9-]+$/);
      const chess = new Chess();
      for (const san of opening.rootLine) expect(chess.move(san).san, opening.id).toBe(san);
      // White's openings end on a White move (odd length), Black's on a Black move.
      expect(opening.rootLine.length % 2, opening.id).toBe(opening.side === 'white' ? 1 : 0);
    }
  });

  it('ships the data files of every opening', () => {
    for (const opening of OPENINGS) {
      expect(existsSync(path(`${opening.id}.json`)), opening.id).toBe(true);
      expect(existsSync(path(`${opening.id}.traps.json`)), opening.id).toBe(true);
      expect(existsSync(fileURLToPath(new URL(`../../explore/ideas/${opening.id}.ts`, import.meta.url))), opening.id).toBe(true);
      expect(assetsSource.includes(`'../data/openings/${opening.id}.json'`), `${opening.id} in assets.ts`).toBe(true);
      expect(assetsSource.includes(`'../explore/ideas/${opening.id}'`), `${opening.id} ideas in assets.ts`).toBe(true);
    }
  });
});

for (const opening of OPENINGS) {
  if (!existsSync(path(`${opening.id}.json`))) continue;

  describe(`${opening.id}.json`, () => {
    const file = path(`${opening.id}.json`);
    const text = readFileSync(file, 'utf8');
    const snapshot = JSON.parse(text) as Snapshot;
    const nodes = Object.entries(snapshot.nodes);
    const userTurn = opening.side === 'white' ? 'w' : 'b';

    const walk = (sans: readonly string[]): SnapshotNode | undefined => {
      let node = snapshot.nodes[snapshot.rootKey];
      for (const san of sans) {
        const next = node?.moves.find((move) => move.san === san)?.next;
        node = next === undefined ? undefined : snapshot.nodes[next];
      }
      return node;
    };

    it('passes the structural validation and records how it was made', () => {
      expect(validateSnapshot(snapshot)).toEqual([]);
      const { meta } = snapshot;
      expect(meta.openingId ?? 'ponziani').toBe(opening.id);
      expect(meta.side ?? 'white').toBe(opening.side);
      expect(meta.rootLine).toEqual(opening.rootLine);
      if (opening.family) expect(meta.family).toBe(opening.family);
      expect(meta.explorerHost).toBe('https://explorer.lichess.org');
      expect(meta.engine.name).toMatch(/^Stockfish/);
      expect(meta.engine.depth).toBeGreaterThanOrEqual(12);
      expect(meta.counts.positions).toBe(nodes.length);
    });

    it('contains the root line, and the opening itself is a real one with data behind it', () => {
      const line = opening.rootLine;
      for (let length = 0; length < line.length; length++) {
        expect(walk(line.slice(0, length))?.kind, `after ${line.slice(0, length).join(' ') || 'no moves'}`).toBe('prelude');
      }
      const root = walk(line);
      expect(root?.kind).toBe('tree');
      expect(root?.opening?.name).toBeTruthy();
      expect(sumCounts(root!.lichess)).toBeGreaterThan(1000);
      expect(sumCounts(root!.masters)).toBeGreaterThan(10);
      expect(root!.moves.filter((move) => move.next).length).toBeGreaterThanOrEqual(1);
    });

    it('contains only legal moves, leading where they say they lead, within its own thresholds', () => {
      const { thresholds, rootLine } = snapshot.meta;
      for (const [key, node] of nodes) {
        for (const move of node.moves) {
          const played = new Chess(node.fen).move(move.san);
          expect(`${played.from}${played.to}${played.promotion ?? ''}`, `${key} ${move.san}`).toBe(move.uci);
          if (move.next !== undefined) expect(positionKey(played.after), `${key} ${move.san}`).toBe(move.next);
          expect(move.eval, `${key} ${move.san}`).toBeDefined();
        }
        expect(node.eval, key).toBeDefined();
        const followed = node.moves.filter((move) => move.next !== undefined);
        if (node.kind === 'sideline') {
          expect(followed, key).toEqual([]);
          // The opponent left the root line: one recommended reply for the user's side.
          expect(node.fen.split(' ')[1], key).toBe(userTurn);
          expect(node.moves.some((move) => move.uci === node.recommended), key).toBe(true);
        } else if (node.kind === 'prelude') {
          expect(followed.some((move) => move.san === rootLine[node.ply]), key).toBe(true);
        } else {
          for (const move of followed) expect(meetsThreshold(move, node, thresholds), `${key} ${move.san}`).toBe(true);
          expect(node.ply).toBeLessThanOrEqual(thresholds.maxPly);
        }
      }
      expect(nodes.filter(([, node]) => node.kind === 'tree').length).toBeLessThanOrEqual(thresholds.maxPositions);
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

    it('contains no token and is small enough to ship', () => {
      expect(text).not.toMatch(/lip_[A-Za-z0-9]{8,}/);
      expect(text).not.toMatch(/Bearer|Authorization/i);
      if (token) expect(text.includes(token)).toBe(false);
      expect(statSync(file).size).toBeLessThan(1_500_000);
    });

    const ideas = ideasOf(opening.id);
    if (ideas) {
      it('has remarks that are all backed by the data, short, and one per position', () => {
        const problems = ideas.flatMap((idea) => failedChecks(snapshot, idea).map((problem) => `${idea.line.join(' ')}: ${problem}`));
        expect(problems).toEqual([]);
        const keys = new Set<string>();
        for (const idea of ideas) {
          expect(idea.checks.length, idea.text).toBeGreaterThan(0);
          expect(idea.text.split(/(?<=[.!?])s+(?=[A-Z])/).filter(Boolean).length, idea.text).toBeLessThanOrEqual(2);
          expect(idea.text.length, idea.text).toBeLessThanOrEqual(260);
          const node = nodeAfter(snapshot, idea.line)!;
          expect(keys.has(positionKey(node.fen)), idea.line.join(' ')).toBe(false);
          keys.add(positionKey(node.fen));
          expect(ideaFor(snapshot, ideas, node.fen)).toBe(idea.text);
        }
      });
    }

    if (!existsSync(path(`${opening.id}.traps.json`))) return;
    const traps = JSON.parse(readFileSync(path(`${opening.id}.traps.json`), 'utf8')) as TrapFile;

    it('has a trap list made from this snapshot, with legal lines and verdicts that follow from its scores', () => {
      expect(validateTrapFile(traps)).toEqual([]);
      expect(traps.meta.snapshotCreatedAt).toBe(snapshot.meta.createdAt);
      expect(traps.meta.side ?? 'white').toBe(opening.side); // the Ponziani's list predates the field
      const games = traps.traps.map((trap) => trap.popular.games);
      expect(games).toEqual([...games].sort((a, b) => b - a));
      for (const trap of traps.traps) {
        const chess = new Chess();
        for (const san of trap.line) chess.move(san);
        // Same position; the move counters can differ when the tree reached it by another move order.
        expect(positionKey(chess.fen()), trap.id).toBe(positionKey(trap.fen));
        expect(sideToMove(trap.fen), trap.id).toBe(trap.victim);
        const bad = chess.move(trap.move.san);
        expect(`${bad.from}${bad.to}${bad.promotion ?? ''}`, trap.id).toBe(trap.move.uci);
        trap.refutation.san.forEach((san, index) => {
          const played = chess.move(san);
          expect(`${played.from}${played.to}${played.promotion ?? ''}`, trap.id).toBe(trap.refutation.uci[index]);
        });
        const node = snapshot.nodes[positionKey(trap.fen)];
        expect(node?.kind, trap.id).toBe('tree');
        expect(node!.moves.some((move) => move.uci === trap.move.uci), trap.id).toBe(true);
        const judgement = judgeMove({ before: trap.scoreBefore, after: trap.scoreAfter, mover: trap.victim, playedBest: false });
        expect(judgement.verdict, trap.id).toBe(trap.verdict);
        expect(trap.drop, trap.id).toBeGreaterThanOrEqual(20);
      }
    });
  });
}
