import { describe, expect, it } from 'vitest';
import {
  formatScore,
  judgeMove,
  sideToMove,
  toWhiteScore,
  winPercent,
  winPercentFromCp,
  type Score,
} from './eval';

const cp = (value: number): Score => ({ type: 'cp', value });
const mate = (winner: 'white' | 'black', moves: number): Score => ({ type: 'mate', winner, moves });

/** The centipawn value at which White's winning chances are exactly `percent`. */
function cpForWinPercent(percent: number): number {
  const y = (percent - 50) / 50; // -1..1
  return -Math.log(2 / (y + 1) - 1) / 0.00368208;
}

describe('winPercentFromCp (Lichess formula)', () => {
  it('is 50 for an equal position', () => {
    expect(winPercentFromCp(0)).toBe(50);
  });

  it('matches values worked out by hand from the formula', () => {
    // 50 + 50 * (2 / (1 + e^(-0.00368208 * cp)) - 1)
    expect(winPercentFromCp(100)).toBeCloseTo(59.1, 1);
    expect(winPercentFromCp(300)).toBeCloseTo(75.1, 1);
    expect(winPercentFromCp(1000)).toBeCloseTo(97.5, 1);
    expect(winPercentFromCp(-100)).toBeCloseTo(40.9, 1);
  });

  it('is symmetric and always between 0 and 100', () => {
    for (const value of [1, 37, 250, 900, 5000]) {
      expect(winPercentFromCp(value) + winPercentFromCp(-value)).toBeCloseTo(100, 10);
      expect(winPercentFromCp(value)).toBeGreaterThan(50);
      expect(winPercentFromCp(value)).toBeLessThanOrEqual(100);
    }
  });
});

describe('winPercent', () => {
  it('flips for Black', () => {
    expect(winPercent(cp(100), 'white')).toBeCloseTo(59.1, 1);
    expect(winPercent(cp(100), 'black')).toBeCloseTo(40.9, 1);
  });

  it('treats a forced mate as 100 or 0', () => {
    expect(winPercent(mate('white', 3), 'white')).toBe(100);
    expect(winPercent(mate('white', 3), 'black')).toBe(0);
    expect(winPercent(mate('black', 0), 'white')).toBe(0);
  });
});

describe('toWhiteScore', () => {
  it('keeps centipawns for White to move and negates them for Black to move', () => {
    expect(toWhiteScore({ type: 'cp', value: 31 }, 'white')).toEqual(cp(31));
    expect(toWhiteScore({ type: 'cp', value: 31 }, 'black')).toEqual(cp(-31));
    expect(toWhiteScore({ type: 'cp', value: -180 }, 'black')).toEqual(cp(180));
    expect(toWhiteScore({ type: 'cp', value: 0 }, 'black')).toEqual(cp(0));
  });

  it('works out who is mating', () => {
    expect(toWhiteScore({ type: 'mate', value: 1 }, 'white')).toEqual(mate('white', 1));
    expect(toWhiteScore({ type: 'mate', value: 2 }, 'black')).toEqual(mate('black', 2));
    expect(toWhiteScore({ type: 'mate', value: -3 }, 'white')).toEqual(mate('black', 3));
    expect(toWhiteScore({ type: 'mate', value: -3 }, 'black')).toEqual(mate('white', 3));
  });

  it('treats "mate 0" as: the side to move has been checkmated', () => {
    expect(toWhiteScore({ type: 'mate', value: 0 }, 'black')).toEqual(mate('white', 0));
    expect(toWhiteScore({ type: 'mate', value: 0 }, 'white')).toEqual(mate('black', 0));
  });
});

describe('formatScore', () => {
  it('shows pawns with a sign', () => {
    expect(formatScore(cp(31))).toBe('+0.3');
    expect(formatScore(cp(-120))).toBe('-1.2');
    expect(formatScore(cp(0))).toBe('0.0');
    expect(formatScore(cp(4))).toBe('0.0');
    expect(formatScore(cp(-4))).toBe('0.0');
    expect(formatScore(cp(1234))).toBe('+12.3');
  });

  it('shows mates with #', () => {
    expect(formatScore(mate('white', 3))).toBe('#3');
    expect(formatScore(mate('black', 2))).toBe('#-2');
    expect(formatScore(mate('white', 0))).toBe('#');
  });
});

describe('sideToMove', () => {
  it('reads the side from a FEN', () => {
    expect(sideToMove('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')).toBe('white');
    expect(sideToMove('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1')).toBe('black');
  });
});

describe('judgeMove', () => {
  /** A move by White that takes White's chances from 60% down by `drop` points. */
  function whiteDrops(drop: number) {
    return judgeMove({
      before: cp(cpForWinPercent(60)),
      after: cp(cpForWinPercent(60 - drop)),
      mover: 'white',
      playedBest: false,
    });
  }

  it('uses the 10 / 20 / 30 point thresholds', () => {
    expect(whiteDrops(0).verdict).toBe('good');
    expect(whiteDrops(9.9).verdict).toBe('good');
    expect(whiteDrops(10.1).verdict).toBe('inaccuracy');
    expect(whiteDrops(19.9).verdict).toBe('inaccuracy');
    expect(whiteDrops(20.1).verdict).toBe('mistake');
    expect(whiteDrops(29.9).verdict).toBe('mistake');
    expect(whiteDrops(30.1).verdict).toBe('blunder');
    expect(whiteDrops(55).verdict).toBe('blunder');
  });

  it('reports the chances before and after and the drop', () => {
    const judgement = whiteDrops(25);
    expect(judgement.winBefore).toBeCloseTo(60, 6);
    expect(judgement.winAfter).toBeCloseTo(35, 6);
    expect(judgement.drop).toBeCloseTo(25, 6);
  });

  it("measures from the mover's side when Black moves", () => {
    // Equal before; after Black's move White is +300, so Black went from 50% to about 25%.
    const judgement = judgeMove({ before: cp(0), after: cp(300), mover: 'black', playedBest: false });
    expect(judgement.winBefore).toBe(50);
    expect(judgement.winAfter).toBeCloseTo(24.9, 1);
    expect(judgement.verdict).toBe('mistake');

    // The same scores are great news if White was the one who moved.
    expect(judgeMove({ before: cp(0), after: cp(300), mover: 'white', playedBest: false }).verdict).toBe('good');
  });

  it('never has a negative drop when the position got better', () => {
    const judgement = judgeMove({ before: cp(-50), after: cp(80), mover: 'white', playedBest: false });
    expect(judgement.drop).toBe(0);
    expect(judgement.verdict).toBe('good');
  });

  it("calls the engine's first choice the best move, whatever the numbers say", () => {
    const judgement = judgeMove({ before: cp(50), after: cp(-200), mover: 'white', playedBest: true });
    expect(judgement.verdict).toBe('best');
    expect(judgement.note).toBeUndefined();
  });

  it('flags a move that allows a forced mate', () => {
    const judgement = judgeMove({ before: cp(-30), after: mate('white', 1), mover: 'black', playedBest: false });
    expect(judgement.verdict).toBe('blunder');
    expect(judgement.winAfter).toBe(0);
    expect(judgement.note).toEqual({ kind: 'allows-mate', moves: 1 });
  });

  it('does not say "allows mate" when the mate was already unavoidable', () => {
    const judgement = judgeMove({
      before: mate('white', 3),
      after: mate('white', 2),
      mover: 'black',
      playedBest: false,
    });
    expect(judgement.verdict).toBe('good');
    expect(judgement.note).toBeUndefined();
  });

  it('flags a missed mate as a blunder when the win is thrown away', () => {
    const judgement = judgeMove({ before: mate('white', 2), after: cp(0), mover: 'white', playedBest: false });
    expect(judgement.verdict).toBe('blunder');
    expect(judgement.note).toEqual({ kind: 'missed-mate', moves: 2 });
  });

  it('flags a missed mate as at least an inaccuracy even when still winning', () => {
    const judgement = judgeMove({ before: mate('white', 2), after: cp(900), mover: 'white', playedBest: false });
    expect(judgement.drop).toBeLessThan(10);
    expect(judgement.verdict).toBe('inaccuracy');
    expect(judgement.note).toEqual({ kind: 'missed-mate', moves: 2 });
  });

  it('is happy with a slower mate that is still a mate', () => {
    const judgement = judgeMove({
      before: mate('white', 2),
      after: mate('white', 4),
      mover: 'white',
      playedBest: false,
    });
    expect(judgement.verdict).toBe('good');
    expect(judgement.note).toBeUndefined();
  });

  it('treats delivering checkmate as a full win', () => {
    const judgement = judgeMove({ before: mate('white', 1), after: mate('white', 0), mover: 'white', playedBest: true });
    expect(judgement.verdict).toBe('best');
    expect(judgement.winAfter).toBe(100);
  });
});
