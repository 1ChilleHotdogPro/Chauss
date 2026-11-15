import { describe, expect, it } from 'vitest';
import type { PositionEval } from '../analysis/analysis';
import type { Score } from '../analysis/eval';
import { buildRanking } from './ranking';

const cp = (value: number): Score => ({ type: 'cp', value });
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';

const evaluation = (fen: string, lines: [string, Score][]): PositionEval => ({
  fen,
  depth: 12,
  terminal: false,
  lines: lines.map(([uci, score]) => ({ score, pv: [uci, 'a7a6'] })),
});

describe('buildRanking', () => {
  it('lists every move with notation, score and flag, best move first, worst last', () => {
    const rows = buildRanking(
      evaluation(START, [
        ['e2e4', cp(30)],
        ['g1f3', cp(20)],
        ['h2h4', cp(-90)], // about 11 points worse than e4: inaccuracy
        ['g2g4', cp(-250)], // about 25 points: mistake
        ['f2f3', cp(-500)], // about 41 points: blunder
      ]),
    );
    expect(rows.map((row) => [row.san, row.flag])).toEqual([
      ['e4', 'none'],
      ['Nf3', 'none'],
      ['h4', 'inaccuracy'],
      ['g4', 'mistake'],
      ['f3', 'blunder'],
    ]);
    expect(rows[0]?.judgement.verdict).toBe('best');
    expect(rows.at(-1)?.uci).toBe('f2f3');
    expect(rows.at(-1)?.score).toEqual(cp(-500));
  });

  it("judges from Black's side when Black is to move", () => {
    // Scores are from White's point of view: higher is worse for Black.
    const rows = buildRanking(
      evaluation(AFTER_E4, [
        ['e7e5', cp(25)],
        ['g7g5', cp(280)],
      ]),
    );
    expect(rows.map((row) => [row.san, row.flag])).toEqual([
      ['e5', 'none'],
      ['g5', 'mistake'],
    ]);
  });

  it('flags moves that allow mate', () => {
    const rows = buildRanking(
      evaluation(AFTER_E4, [
        ['e7e5', cp(25)],
        ['f7f6', { type: 'mate', winner: 'white', moves: 4 }],
      ]),
    );
    expect(rows.at(-1)).toMatchObject({ san: 'f6', flag: 'blunder' });
    expect(rows.at(-1)?.judgement.note).toEqual({ kind: 'allows-mate', moves: 4 });
  });

  it('skips lines that are empty or not legal, and copes with no lines', () => {
    const odd: PositionEval = {
      fen: START,
      depth: 12,
      terminal: false,
      lines: [
        { score: cp(30), pv: ['e2e4'] },
        { score: cp(0), pv: [] },
        { score: cp(0), pv: ['e7e5'] }, // not a White move
      ],
    };
    expect(buildRanking(odd).map((row) => row.san)).toEqual(['e4']);
    expect(buildRanking({ fen: START, depth: 0, terminal: true, lines: [] })).toEqual([]);
  });
});
