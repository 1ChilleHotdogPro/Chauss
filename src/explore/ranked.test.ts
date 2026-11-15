import { describe, expect, it } from 'vitest';
import type { PositionData } from './position';
import { buildExplorePosition } from './position';
import { needsScores, withRanking } from './ranked';
import type { RankedMove } from './ranking';

const AFTER_E4_E5_NC3 = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/2N5/PPPP1PPP/R1BQKBNR b KQkq - 1 2';
const counts = (n: number): [number, number, number] => [n, 0, 0];

const data: PositionData = {
  fen: AFTER_E4_E5_NC3,
  masters: counts(0),
  lichess: counts(100),
  moves: [
    { uci: 'g8f6', san: 'Nf6', masters: counts(0), lichess: counts(60) },
    { uci: 'd8h4', san: 'Qh4', masters: counts(0), lichess: counts(10) },
  ],
};

const row = (uci: string, san: string, flag: RankedMove['flag']): RankedMove => ({
  uci,
  san,
  score: { type: 'cp', value: flag === 'none' ? 20 : 400 },
  judgement: { verdict: flag === 'none' ? 'best' : flag, winBefore: 50, winAfter: 20, drop: flag === 'none' ? 0 : 30 },
  flag,
});

describe('withRanking', () => {
  it('flags listed moves from a ranking of every legal move', () => {
    const position = buildExplorePosition(data);
    expect(needsScores(position)).toBe(true);
    expect(position.popularMoves.every((move) => move.flag === 'none')).toBe(true);

    const ranked = withRanking(position, [row('g8f6', 'Nf6', 'none'), row('d8h4', 'Qh4', 'mistake'), row('a7a6', 'a6', 'none')]);
    expect(ranked.popularMoves.map((move) => [move.san, move.flag])).toEqual([
      ['Nf6', 'none'],
      ['Qh4', 'mistake'],
    ]);
    expect(ranked.popularMoves[1]?.eval).toEqual({ type: 'cp', value: 400 });
    expect(ranked.moves.find((move) => move.san === 'Qh4')?.flag).toBe('mistake');
    expect(needsScores(ranked)).toBe(false);
  });

  it('keeps scores a move already has, and leaves moves the ranking lacks alone', () => {
    const position = buildExplorePosition({
      ...data,
      moves: [{ ...data.moves[0]!, eval: { type: 'cp', value: 10 } }, data.moves[1]!],
    });
    const ranked = withRanking(position, [row('g8f6', 'Nf6', 'blunder')]);
    expect(ranked.popularMoves[0]?.flag).toBe('none');
    expect(ranked.popularMoves[1]?.eval).toBeUndefined();
  });
});
