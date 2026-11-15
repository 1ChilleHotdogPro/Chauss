import { describe, expect, it } from 'vitest';
import type { PositionEval } from './analysis';
import { arrowOpacities, arrowOpacity } from './arrowFade';
import type { Score } from './eval';

const cp = (value: number): Score => ({ type: 'cp', value });
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const evaluation = (fen: string, scores: Score[]): PositionEval => ({
  fen,
  depth: 12,
  terminal: false,
  lines: scores.map((score) => ({ score, pv: ['a2a3'] })),
});

describe('arrowOpacity', () => {
  it('is solid for equal moves, faint for blunders, and in between otherwise', () => {
    expect(arrowOpacity(0)).toBe(0.9);
    expect(arrowOpacity(3)).toBe(0.9);
    expect(arrowOpacity(30)).toBe(0.2);
    expect(arrowOpacity(80)).toBe(0.2);
    const middle = arrowOpacity(15);
    expect(middle).toBeLessThan(0.9);
    expect(middle).toBeGreaterThan(0.2);
  });

  it('never gets more solid as the move gets worse', () => {
    let previous = 1;
    for (let drop = 0; drop <= 40; drop += 1) {
      const value = arrowOpacity(drop);
      expect(value).toBeLessThanOrEqual(previous);
      previous = value;
    }
  });
});

describe('arrowOpacities', () => {
  it('keeps two good moves solid and fades a blundering third', () => {
    const [first, second, third] = arrowOpacities(evaluation(START, [cp(30), cp(25), cp(-600)]));
    expect(first).toBe(0.9);
    expect(second).toBe(0.9);
    expect(third).toBe(0.2);
  });

  it("judges from Black's side (scores are White's)", () => {
    const [, second] = arrowOpacities(evaluation(AFTER_E4, [cp(25), cp(700)]));
    expect(second).toBe(0.2);
  });

  it('treats a move that allows mate as the faintest, and copes with no lines', () => {
    const rows = arrowOpacities(evaluation(START, [cp(30), { type: 'mate', winner: 'black', moves: 2 }]));
    expect(rows[1]).toBe(0.2);
    expect(arrowOpacities(evaluation(START, []))).toEqual([]);
  });
});
