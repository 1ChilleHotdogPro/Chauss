import { describe, expect, it } from 'vitest';
import type { ExploreMove } from '../explore/position';
import type { Card } from '../repertoire/repertoire';
import { dueText, reasonText, wrongMoveText } from './feedback';
import { DAY_MS, newCardState, review } from './srs';

const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);

const card = (reason: Card['reason']): Card => ({
  key: 'k',
  fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq - 1 4',
  line: ['e4', 'e5', 'Nf3', 'Nc6', 'c3', 'Nf6'],
  move: { uci: 'd2d4', san: 'd4' },
  reason,
  reach: 0.5,
});

describe('reasonText', () => {
  it('explains each kind of choice from the data behind it', () => {
    expect(reasonText(card({ kind: 'book', games: 1234, share: 0.85 }))).toBe(
      'Masters play it in 85% of their games here (1,234 games), and Stockfish agrees.',
    );
    expect(reasonText(card({ kind: 'book', games: 12, share: 0 }))).toBe('It is the move masters play here (12 games).');
    expect(reasonText(card({ kind: 'engine-over-book', bookMove: 'd3' }))).toBe(
      'Masters more often play d3, but Stockfish scores this move clearly higher.',
    );
    expect(reasonText(card({ kind: 'engine' }))).toMatch(/hardly any master games here.*Stockfish's best/);
    expect(reasonText(card({ kind: 'opening-move' }))).toMatch(/define this opening/);
  });
});

describe('wrongMoveText', () => {
  const theCard = card({ kind: 'book', games: 900, share: 0.9 });
  const played = (flag: ExploreMove['flag'], winBefore = 55, winAfter = 30): ExploreMove => ({
    uci: 'f1c4',
    san: 'Bc4',
    book: null,
    popular: null,
    flag,
    judgement: { verdict: flag === 'none' ? 'good' : flag, winBefore, winAfter, drop: winBefore - winAfter },
  });

  it('names the mistake, the repertoire move and the reason', () => {
    expect(wrongMoveText(theCard, 'Bc4', played('mistake'))).toBe(
      'Bc4 is not the repertoire move, and Stockfish calls it a mistake: your winning chances drop from 55% to 30%. ' +
        'The repertoire move is d4. Masters play it in 90% of their games here (900 games), and Stockfish agrees. Play it to continue.',
    );
    expect(wrongMoveText(theCard, 'Bc4', played('inaccuracy', 55, 43))).toMatch(/calls it an inaccuracy: .* from 55% to 43%/);
    expect(wrongMoveText(theCard, 'Bc4', played('blunder', 55, 10))).toMatch(/calls it a blunder/);
  });

  it('is gentler about a move that is fine but not the repertoire', () => {
    expect(wrongMoveText(theCard, 'Bc4', played('none', 55, 53))).toMatch(
      /^Bc4 is playable, but it is not the repertoire move\. The repertoire move is d4\./,
    );
  });

  it('says less about a move the data does not know', () => {
    expect(wrongMoveText(theCard, 'h4', undefined)).toMatch(/^h4 is not the repertoire move\. The repertoire move is d4\./);
  });
});

describe('dueText', () => {
  it('describes when a card comes back', () => {
    expect(dueText(undefined, NOW)).toBe('new');
    expect(dueText(newCardState(), NOW)).toBe('new');

    const missed = review(newCardState(), false, NOW);
    expect(dueText(missed, NOW)).toBe('in 10 minutes');
    expect(dueText(missed, NOW + 9.6 * 60_000)).toBe('in 1 minute');
    expect(dueText(missed, NOW + 11 * 60_000)).toBe('now');

    const once = review(newCardState(), true, NOW);
    expect(dueText(once, NOW)).toBe('tomorrow');
    expect(dueText(once, NOW + 20 * 60 * 60 * 1000)).toBe('in 4 hours');
    expect(dueText(once, NOW + DAY_MS)).toBe('now');

    const twice = review(once, true, once.due);
    expect(dueText(twice, once.due)).toBe('in 6 days');
  });
});
