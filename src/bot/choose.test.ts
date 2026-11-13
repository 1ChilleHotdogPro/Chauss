import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { buildExplorePosition, type PositionData } from '../explore/position';
import type { Trap } from '../explore/traps';
import { positionKey, type Counts } from '../snapshot/format';
import { pickBlackMove, trapRoutes, type TrapRoutes } from './choose';

// Made-up numbers for the logic only (not opening theory).
const AFTER_C3 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';
const NONE: TrapRoutes = new Map();

function move(uci: string, san: string, lichess: Counts, cp: number, masters: Counts = [0, 0, 0]) {
  return { uci, san, masters, lichess, eval: { type: 'cp' as const, value: cp } };
}

function position(moves: PositionData['moves'], fen = AFTER_C3) {
  const sum = (pick: (m: PositionData['moves'][number]) => Counts): Counts =>
    moves.reduce<Counts>((acc, m) => [acc[0] + pick(m)[0], acc[1] + pick(m)[1], acc[2] + pick(m)[2]], [0, 0, 0]);
  return buildExplorePosition({ fen, masters: sum((m) => m.masters), lichess: sum((m) => m.lichess), moves });
}

const NF6 = move('g8f6', 'Nf6', [50, 10, 40], 20); // 100 games, sound
const D5 = move('d7d5', 'd5', [30, 5, 25], 10); // 60 games, sound (the best)
const F5 = move('f7f5', 'f5', [10, 0, 5], 300); // 15 games, a mistake (drop ~24 points)
const BE7 = move('f8e7', 'Be7', [5, 0, 5], 130); // 10 games, an inaccuracy (drop ~11 points)
const NGE7 = move('g8e7', 'Nge7', [0, 0, 0], 40, [2, 0, 0]); // masters only

describe('pickBlackMove — realistic', () => {
  const full = position([NF6, D5, F5, BE7, NGE7]);

  it('draws moves in proportion to how often they are played', () => {
    // 185 games: Nf6 takes tickets 0-100, d5 100-160, f5 160-175, Be7 175-185.
    expect(pickBlackMove(full, 'realistic', NONE, () => 0)?.move.san).toBe('Nf6');
    expect(pickBlackMove(full, 'realistic', NONE, () => 0.6)?.move.san).toBe('d5');
    expect(pickBlackMove(full, 'realistic', NONE, () => 0.9)?.move.san).toBe('f5');
    expect(pickBlackMove(full, 'realistic', NONE, () => 0.999)?.move.san).toBe('Be7');
    expect(pickBlackMove(full, 'realistic', NONE, () => 0.5)?.reason).toBe('popular');
  });

  it('never plays a move nobody at the level plays', () => {
    for (let i = 0; i < 100; i++) {
      expect(pickBlackMove(full, 'realistic', NONE, () => i / 100)?.move.san).not.toBe('Nge7');
    }
  });

  it('has nothing to play when no one at the level has played here, or when it is White to move', () => {
    expect(pickBlackMove(position([NGE7]), 'realistic', NONE)).toBeNull();
    expect(pickBlackMove(position([]), 'realistic', NONE)).toBeNull();
    const white = position([move('d2d4', 'd4', [5, 0, 5], 30)], 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(pickBlackMove(white, 'realistic', NONE)).toBeNull();
  });
});

describe('pickBlackMove — punish me', () => {
  it('prefers a mistake that people play', () => {
    const choice = pickBlackMove(position([NF6, D5, F5, BE7]), 'punish', NONE, () => 0);
    expect(choice).toMatchObject({ move: { san: 'f5' }, reason: 'mistake' });
  });

  it('without a mistake, heads for a known trap', () => {
    const routes: TrapRoutes = new Map([[positionKey(AFTER_C3), new Set(['g8f6'])]]);
    const choice = pickBlackMove(position([NF6, D5, BE7]), 'punish', routes, () => 0.99);
    expect(choice).toMatchObject({ move: { san: 'Nf6' }, reason: 'trap-route' });
  });

  it('then settles for an inaccuracy, then for any move', () => {
    expect(pickBlackMove(position([NF6, D5, BE7]), 'punish', NONE, () => 0)).toMatchObject({
      move: { san: 'Be7' },
      reason: 'inaccuracy',
    });
    expect(pickBlackMove(position([NF6, D5]), 'punish', NONE, () => 0)).toMatchObject({
      move: { san: 'Nf6' },
      reason: 'popular',
    });
  });

  it('ignores a mistake almost nobody plays', () => {
    const rare = move('f7f5', 'f5', [1, 0, 0], 300); // 1 game of 161: under 1%
    const choice = pickBlackMove(position([NF6, D5, rare]), 'punish', NONE, () => 0);
    expect(choice?.reason).toBe('popular');
  });
});

describe('trapRoutes', () => {
  const base = (kind: Trap['kind']): Trap => ({
    id: 'x',
    line: ['e4', 'e5', 'Nf3', 'Nc6', 'c3'],
    fen: AFTER_C3,
    victim: kind === 'exploit' ? 'black' : 'white',
    kind,
    move: { uci: 'f7f5', san: 'f5' },
    popular: { games: 15, share: 0.1 },
    book: { games: 0, share: 0 },
    scoreBefore: { type: 'cp', value: 10 },
    scoreAfter: { type: 'cp', value: 300 },
    drop: 24,
    verdict: 'mistake',
    refutation: { uci: ['e4f5'], san: ['exf5'], why: 'test' },
  });

  it("collects Black's moves along a trap's line, and the bad move itself", () => {
    const routes = trapRoutes([base('exploit')]);
    const chess = new Chess();
    chess.move('e4');
    expect([...(routes.get(positionKey(chess.fen())) ?? [])]).toEqual(['e7e5']);
    chess.move('e5');
    chess.move('Nf3');
    expect([...(routes.get(positionKey(chess.fen())) ?? [])]).toEqual(['b8c6']);
    expect([...(routes.get(positionKey(AFTER_C3)) ?? [])]).toEqual(['f7f5']);
    expect(routes.size).toBe(3);
  });

  it("skips traps White must avoid, and lines that are not legal", () => {
    expect(trapRoutes([base('avoid')]).size).toBe(0);
    expect(trapRoutes([{ ...base('exploit'), line: ['e4', 'e4'] }]).size).toBe(0);
  });
});
