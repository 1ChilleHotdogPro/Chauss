import { describe, expect, it } from 'vitest';
import { newCardState, review, DAY_MS, type CardState } from '../drill/srs';
import { endgameProgressText, progressText, summarizeProgress } from './drillCard';
import { boardSquares, rootPosition } from './miniBoard';

const NOW = 1_700_000_000_000;

describe('summarizeProgress', () => {
  const right = review(newCardState(), true, NOW - 2 * DAY_MS); // due again after 1 day: due now
  const wrong = review(newCardState(), false, NOW - 1000); // back in 10 minutes: not due yet
  const fresh = review(newCardState(), true, NOW); // due tomorrow
  const cards: Record<string, CardState> = { a: right, b: wrong, c: fresh, d: newCardState() };

  it('counts stored cards when the drill positions are not known', () => {
    expect(summarizeProgress(cards, NOW)).toEqual({ due: 1, learned: 2, seen: 3, total: null });
  });

  it('counts only the drill positions when they are known, and gives the total', () => {
    expect(summarizeProgress(cards, NOW, ['a', 'b', 'x', 'y'])).toEqual({ due: 1, learned: 1, seen: 2, total: 4 });
  });

  it('says plainly what is known', () => {
    expect(progressText({ due: 0, learned: 0, seen: 0, total: null })).toBe('Not started yet');
    expect(progressText({ due: 0, learned: 0, seen: 0, total: 71 })).toBe('Not started yet · 71 to learn');
    expect(progressText({ due: 3, learned: 12, seen: 14, total: null })).toBe('3 due now · 12 learned');
    expect(progressText({ due: 0, learned: 12, seen: 14, total: 71 })).toBe('Nothing due now · 12 of 71 learned');
  });
});

describe('endgameProgressText', () => {
  it('sums solved positions and best stars', () => {
    const records = {
      p1: { attempts: 2, solved: 1, bestStars: 3, lastSeen: NOW },
      p2: { attempts: 1, solved: 0, bestStars: 1, lastSeen: NOW },
    };
    expect(endgameProgressText({}, ['p1', 'p2', 'p3'])).toBe('Not tried yet');
    expect(endgameProgressText(records, ['p1', 'p2', 'p3'])).toBe('1 of 3 solved · 4 of 9 stars');
  });
});

describe('mini board', () => {
  it("reads the placement from White's side, a1 dark", () => {
    const squares = boardSquares('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    expect(squares).toHaveLength(64);
    expect(squares[0]).toEqual({ square: 'a8', piece: 'bR', dark: false });
    expect(squares[56]).toEqual({ square: 'a1', piece: 'wR', dark: true });
    expect(squares[60]).toEqual({ square: 'e1', piece: 'wK', dark: true });
    expect(squares[63]).toEqual({ square: 'h1', piece: 'wR', dark: false });
  });

  it('turns round for Black', () => {
    const squares = boardSquares('7k/8/8/6K1/8/8/8/5Q2 w - - 0 1', 'black');
    expect(squares[0]).toEqual({ square: 'h1', piece: null, dark: false });
    expect(squares[63]).toEqual({ square: 'a8', piece: null, dark: false });
    expect(squares.find((cell) => cell.piece === 'bK')?.square).toBe('h8');
    expect(squares.findIndex((cell) => cell.piece === 'bK')).toBe(56);
  });

  it("plays an opening's root moves and marks the last one", () => {
    const { fen, lastMove } = rootPosition({ rootLine: ['e4', 'c6'] });
    expect(fen).toBe('rnbqkbnr/pp1ppppp/2p5/8/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(lastMove).toEqual(['c7', 'c6']);
  });
});
