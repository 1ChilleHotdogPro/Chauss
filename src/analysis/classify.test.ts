import { describe, expect, it } from 'vitest';
import type { PositionEval } from './analysis';
import { classifyMove, type ClassifyInput } from './classify';
import type { Score } from './eval';

// The scores below are made up for the tests: they say nothing about the real positions.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const AFTER_E4 = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const AFTER_D4 = 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1';

const cp = (value: number): Score => ({ type: 'cp', value });
const mate = (winner: 'white' | 'black', moves: number): Score => ({ type: 'mate', winner, moves });

function pos(fen: string, lines: { score: Score; pv: string[] }[]): PositionEval {
  return { fen, depth: 12, lines, terminal: lines.length === 0 };
}

/** White played 1.d4 where the engine preferred 1.e4 (+0.30); `after` is the score after 1.d4. */
function d4(after: Score, extra: Partial<ClassifyInput> = {}) {
  return classifyMove({
    before: pos(START, [{ score: cp(30), pv: ['e2e4'] }]),
    after: pos(AFTER_D4, [{ score: after, pv: ['d7d5'] }]),
    uci: 'd2d4',
    isBook: false,
    ...extra,
  });
}

describe('classification by how much the move lost', () => {
  it.each([
    [25, 'best'],
    [0, 'excellent'],
    [-30, 'good'],
    [-100, 'inaccuracy'],
    [-250, 'mistake'],
    [-500, 'blunder'],
  ])('after %i cp: %s', (after, expected) => {
    expect(d4(cp(after))?.classification).toBe(expected);
  });

  it('reports the engine move and the win-% numbers', () => {
    const result = d4(cp(-500))!;
    expect(result.bestMove).toBe('e2e4');
    expect(result.winBefore).toBeGreaterThan(result.winAfter);
    expect(result.drop).toBeCloseTo(result.winBefore - result.winAfter);
  });

  it('calls the engine move best even when the search later sees it lose a little', () => {
    const result = classifyMove({
      before: pos(START, [{ score: cp(30), pv: ['e2e4'] }]),
      after: pos(AFTER_E4, [{ score: cp(-200), pv: ['e7e5'] }]),
      uci: 'e2e4',
      isBook: false,
    });
    expect(result?.classification).toBe('best');
  });
});

describe('mate scores', () => {
  it('losing a forced mate but staying far ahead is excellent', () => {
    expect(
      classifyMove({
        before: pos(START, [{ score: mate('white', 3), pv: ['e2e4'] }]),
        after: pos(AFTER_D4, [{ score: cp(900), pv: ['d7d5'] }]),
        uci: 'd2d4',
        isBook: false,
      })?.classification,
    ).toBe('excellent');
  });

  it('allowing a mate in one from a level position is a blunder', () => {
    expect(d4(mate('black', 1))?.classification).toBe('blunder');
  });

  it('allowing a long mate is "only" an inaccuracy (WintrChess table)', () => {
    expect(d4(mate('black', 8))?.classification).toBe('inaccuracy');
  });

  it('a slower mate is still fine, a much slower one less so', () => {
    const slower = (moves: number) =>
      classifyMove({
        before: pos(START, [{ score: mate('white', 3), pv: ['e2e4'] }]),
        after: pos(AFTER_D4, [{ score: mate('white', moves), pv: ['d7d5'] }]),
        uci: 'd2d4',
        isBook: false,
      })?.classification;
    expect(slower(2)).toBe('best');
    expect(slower(4)).toBe('excellent');
    expect(slower(7)).toBe('good');
    expect(slower(12)).toBe('inaccuracy');
  });

  it('delivering checkmate is best', () => {
    const before = 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2';
    const after = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const result = classifyMove({
      before: pos(before, [{ score: mate('black', 1), pv: ['d8h4'] }]),
      after: pos(after, [{ score: mate('black', 0), pv: [] }]),
      uci: 'd8h4',
      isBook: false,
    });
    expect(result?.classification).toBe('best');
  });
});

describe('forced and book', () => {
  it('the only legal move is forced', () => {
    const before = '7k/8/8/8/8/8/6q1/7K w - - 0 1';
    const after = '7k/8/8/8/8/8/6K1/8 b - - 0 1';
    const result = classifyMove({
      before: pos(before, [{ score: cp(0), pv: ['h1g2'] }]),
      after: pos(after, [{ score: cp(0), pv: ['h8g7'] }]),
      uci: 'h1g2',
      isBook: false,
    });
    expect(result?.classification).toBe('forced');
  });

  it('a book move is book, whatever the engine says', () => {
    expect(d4(cp(-500), { isBook: true })?.classification).toBe('book');
  });
});

describe('great: the only good move', () => {
  const great = (second: Score, after: Score = cp(40)) =>
    classifyMove({
      before: pos(START, [
        { score: cp(40), pv: ['e2e4'] },
        { score: second, pv: ['d2d4'] },
      ]),
      after: pos(AFTER_E4, [{ score: after, pv: ['e7e5'] }]),
      uci: 'e2e4',
      isBook: false,
    })?.classification;

  it('is great when the second-best move is much worse', () => {
    expect(great(cp(-200))).toBe('great');
  });

  it('is just best when the second-best move is nearly as good', () => {
    expect(great(cp(20))).toBe('best');
  });

  it('is just best when even the second-best move keeps a won position', () => {
    expect(great(cp(800), cp(1500))).toBe('best');
  });

  it('is just best in a losing position', () => {
    expect(great(cp(-900), cp(-300))).toBe('best');
  });
});

describe('brilliant: a good sacrifice', () => {
  // Kings, a black pawn on e6 and a white knight on e3. Nd5 puts the knight where the pawn takes it.
  const before = '4k3/8/4p3/8/8/4N3/8/4K3 w - - 0 1';
  const sac = (uci: string, fenAfter: string) =>
    classifyMove({
      before: pos(before, [{ score: cp(50), pv: [uci] }]),
      after: pos(fenAfter, [{ score: cp(50), pv: ['e8d7'] }]),
      uci,
      isBook: false,
    })?.classification;

  it('leaving a piece to be taken, when the engine likes it, is brilliant', () => {
    expect(sac('e3d5', '4k3/8/4p3/3N4/8/8/8/4K3 b - - 1 1')).toBe('brilliant');
  });

  it('a quiet, safe move is not', () => {
    expect(sac('e3c4', '4k3/8/4p3/8/2N5/8/8/4K3 b - - 1 1')).toBe('best');
  });
});

describe('miss', () => {
  // White was +4 after Black's blunder (Black's winning chances were 50% before it).
  const afterBlunder = (after: Score) =>
    classifyMove({
      before: pos(START, [{ score: cp(400), pv: ['e2e4'] }]),
      after: pos(AFTER_D4, [{ score: after, pv: ['d7d5'] }]),
      uci: 'd2d4',
      isBook: false,
      previous: { classification: 'blunder', winBefore: 50 },
    })?.classification;

  it('giving the advantage straight back is a miss', () => {
    expect(afterBlunder(cp(0))).toBe('miss');
  });

  it('keeping most of it is not a miss', () => {
    expect(afterBlunder(cp(250))).toBe('good');
  });

  it('going far below where you were is a plain blunder', () => {
    expect(afterBlunder(cp(-600))).toBe('blunder');
  });

  it('needs an opponent mistake first', () => {
    expect(
      classifyMove({
        before: pos(START, [{ score: cp(400), pv: ['e2e4'] }]),
        after: pos(AFTER_D4, [{ score: cp(0), pv: ['d7d5'] }]),
        uci: 'd2d4',
        isBook: false,
        previous: { classification: 'good', winBefore: 50 },
      })?.classification,
    ).toBe('blunder');
  });
});

it('returns undefined without engine lines or for an illegal move', () => {
  expect(d4(cp(0), { before: pos(START, []) })).toBeUndefined();
  expect(d4(cp(0), { uci: 'e2e5' })).toBeUndefined();
});
