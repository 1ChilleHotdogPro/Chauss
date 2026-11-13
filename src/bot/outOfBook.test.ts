import { describe, expect, it } from 'vitest';
import { buildExplorePosition } from '../explore/position';
import { describeBalance, stopSummary, strengthById, STRENGTHS, treeStatus } from './outOfBook';

const AFTER_C3 = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';
const AFTER_NF6 = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq - 1 4';

const ready = (fen: string, moves: { uci: string; san: string; masters: [number, number, number]; lichess: [number, number, number] }[]) =>
  ({
    status: 'ready',
    origin: 'snapshot',
    position: buildExplorePosition({ fen, masters: [0, 0, 0], lichess: [0, 0, 0], moves }),
  }) as const;

describe('treeStatus', () => {
  it('waits while the data is loading, and is out where there is none', () => {
    expect(treeStatus({ status: 'loading' })).toBe('loading');
    expect(treeStatus({ status: 'unavailable', reason: 'x' })).toBe('out');
  });

  it("for Black, needs moves people at the level play; for White, any listed move", () => {
    const played = { uci: 'g8f6', san: 'Nf6', masters: [0, 0, 0] as [number, number, number], lichess: [3, 1, 2] as [number, number, number] };
    const mastersOnly = { ...played, masters: [3, 1, 2] as [number, number, number], lichess: [0, 0, 0] as [number, number, number] };
    expect(treeStatus(ready(AFTER_C3, [played]))).toBe('in');
    expect(treeStatus(ready(AFTER_C3, [mastersOnly]))).toBe('out');
    expect(treeStatus(ready(AFTER_C3, []))).toBe('out');
    expect(treeStatus(ready(AFTER_NF6, [{ ...mastersOnly, uci: 'd2d4', san: 'd4' }]))).toBe('in');
    expect(treeStatus(ready(AFTER_NF6, []))).toBe('out');
  });
});

describe('describeBalance', () => {
  it('puts the score into words, by winning chances', () => {
    expect(describeBalance({ type: 'cp', value: 0 })).toBe('The position is about equal (0.0).');
    expect(describeBalance({ type: 'cp', value: -40 })).toBe('The position is about equal (-0.4).');
    expect(describeBalance({ type: 'cp', value: 60 })).toBe('White is slightly better (+0.6).');
    expect(describeBalance({ type: 'cp', value: -150 })).toBe('Black is clearly better (-1.5).');
    expect(describeBalance({ type: 'cp', value: 500 })).toBe('White is winning (+5.0).');
  });

  it('names a forced mate', () => {
    expect(describeBalance({ type: 'mate', winner: 'black', moves: 1 })).toBe('Black can force checkmate in 1 move.');
    expect(describeBalance({ type: 'mate', winner: 'white', moves: 3 })).toBe('White can force checkmate in 3 moves.');
    expect(describeBalance({ type: 'mate', winner: 'white', moves: 0 })).toBe('Checkmate: White has won.');
  });
});

describe('strengths', () => {
  it('go from weak to strong and fall back to the easiest', () => {
    const skills = STRENGTHS.map((strength) => strength.skill);
    expect(skills).toEqual([...skills].sort((a, b) => a - b));
    expect(STRENGTHS.every((strength) => strength.skill >= 0 && strength.skill <= 20)).toBe(true);
    expect(strengthById('hard').id).toBe('hard');
    expect(strengthById('nonsense').id).toBe('easy');
    expect(strengthById(null).id).toBe('easy');
  });
});

describe('stopSummary', () => {
  it('waits for the engine', () => {
    expect(stopSummary(undefined)).toBeNull();
    expect(stopSummary({ fen: AFTER_C3, depth: 0, lines: [], terminal: false })).toBeNull();
  });

  it("gives the balance, the best move and the main line from the engine's result", () => {
    const summary = stopSummary({
      fen: AFTER_C3,
      depth: 18,
      lines: [{ score: { type: 'cp', value: 30 }, pv: ['g8f6', 'd2d4', 'e5d4'] }],
      terminal: false,
    });
    expect(summary).toEqual({
      balance: 'The position is about equal (+0.3).',
      best: '3...Nf6',
      line: '3... Nf6 4. d4 exd4',
      depth: 18,
    });
  });
});
