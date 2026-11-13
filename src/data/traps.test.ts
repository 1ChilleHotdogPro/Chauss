// Checks on the generated trap list itself (src/data/traps.json).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { judgeMove, sideToMove } from '../analysis/eval';
import { validateTrapFile, type TrapFile } from '../explore/traps';
import { positionKey, type Snapshot } from '../snapshot/format';

const read = <T>(name: string): T =>
  JSON.parse(readFileSync(fileURLToPath(new URL(`./${name}`, import.meta.url)), 'utf8')) as T;
const file = read<TrapFile>('traps.json');
const snapshot = read<Snapshot>('ponziani.json');

describe('traps.json', () => {
  it('passes the structural validation', () => {
    expect(validateTrapFile(file)).toEqual([]);
  });

  it('was made from the snapshot that is bundled with it', () => {
    // If this fails, the snapshot was rebuilt without rebuilding the traps: run "npm run traps".
    expect(file.meta.snapshotCreatedAt).toBe(snapshot.meta.createdAt);
    expect(file.meta.engine.depth).toBeGreaterThan(snapshot.meta.engine.depth);
  });

  it('lists the most often played first', () => {
    const games = file.traps.map((trap) => trap.popular.games);
    expect(games).toEqual([...games].sort((a, b) => b - a));
  });

  it('has only legal moves: the line, the bad move and the punishment', () => {
    for (const trap of file.traps) {
      const chess = new Chess();
      for (const san of trap.line) chess.move(san); // throws if not legal
      expect(chess.fen(), trap.id).toBe(trap.fen);
      expect(sideToMove(trap.fen), trap.id).toBe(trap.victim);

      const bad = chess.move(trap.move.san);
      expect(`${bad.from}${bad.to}${bad.promotion ?? ''}`, trap.id).toBe(trap.move.uci);

      expect(trap.refutation.san.length, trap.id).toBe(trap.refutation.uci.length);
      trap.refutation.san.forEach((san, index) => {
        const played = chess.move(san);
        expect(`${played.from}${played.to}${played.promotion ?? ''}`, `${trap.id} reply ${index + 1}`).toBe(
          trap.refutation.uci[index],
        );
      });
    }
  });

  it('points at positions and moves that are in the snapshot, with the same game counts', () => {
    for (const trap of file.traps) {
      const node = snapshot.nodes[positionKey(trap.fen)];
      expect(node, trap.id).toBeDefined();
      expect(node!.kind, trap.id).toBe('tree');
      const move = node!.moves.find((candidate) => candidate.uci === trap.move.uci);
      expect(move, trap.id).toBeDefined();
      expect(move!.lichess[0] + move!.lichess[1] + move!.lichess[2], trap.id).toBe(trap.popular.games);
    }
  });

  it('keeps to its own rule, and every verdict follows from the recorded scores', () => {
    const { rule } = file.meta;
    for (const trap of file.traps) {
      expect(trap.popular.share, trap.id).toBeGreaterThanOrEqual(rule.minShare);
      expect(trap.popular.games, trap.id).toBeGreaterThanOrEqual(rule.minGames);

      const judgement = judgeMove({
        before: trap.scoreBefore,
        after: trap.scoreAfter,
        mover: trap.victim,
        playedBest: false,
      });
      expect(judgement.verdict, trap.id).toBe(trap.verdict);
      expect(judgement.drop, trap.id).toBeCloseTo(trap.drop, 0);
      expect(trap.drop, trap.id).toBeGreaterThanOrEqual(20);
    }
  });

  it('explains every trap in a sentence', () => {
    for (const trap of file.traps) {
      expect(trap.refutation.why, trap.id).toMatch(/^(White|Black|No immediate material win)/);
      expect(trap.refutation.why.endsWith('.'), trap.id).toBe(true);
    }
  });
});
