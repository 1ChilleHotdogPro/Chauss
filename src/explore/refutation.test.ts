import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { describePieces, explainRefutation, lineFacts } from './refutation';

const cp = (value: number): Score => ({ type: 'cp', value });

// Small constructed positions: what matters here is the bookkeeping, not opening theory.
const QUEEN_TAKES_KNIGHT = '4k3/8/8/3n4/8/8/8/3QK3 w - - 0 1'; // Qxd5 wins a loose knight
const DEFENDED_KNIGHT = '4k3/8/3r4/3n4/8/8/8/3QK3 w - - 0 1'; // Qxd5 Rxd5 loses the queen
const BLACK_TAKES_ROOK = '4k3/8/8/8/8/8/q7/R3K3 b - - 0 1'; // ...Qxa1+ wins a loose rook
const AFTER_NF6_BLUNDER = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';

describe('lineFacts', () => {
  it('records the moves in normal notation and what each side captured', () => {
    const facts = lineFacts(DEFENDED_KNIGHT, ['d1d5', 'd6d5']);
    expect(facts.sans).toEqual(['Qxd5', 'Rxd5']);
    expect(facts.capturedBy).toEqual({ white: ['n'], black: ['q'] });
    expect(facts.promotedBy).toEqual({ white: [], black: [] });
    expect(facts.endsInMate).toBe(false);
  });

  it('records promotions', () => {
    const facts = lineFacts('8/P6k/8/8/8/8/8/K7 w - - 0 1', ['a7a8q']);
    expect(facts.sans).toEqual(['a8=Q']);
    expect(facts.promotedBy.white).toEqual(['q']);
  });

  it('notices a line that ends in checkmate', () => {
    const facts = lineFacts(AFTER_NF6_BLUNDER, ['h5f7']);
    expect(facts.sans).toEqual(['Qxf7#']);
    expect(facts.capturedBy.white).toEqual(['p']);
    expect(facts.endsInMate).toBe(true);
  });

  it('counts an en passant capture as a pawn', () => {
    const facts = lineFacts('rnbqkbnr/1pp1pppp/p7/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3', ['e5d6']);
    expect(facts.sans).toEqual(['exd6']);
    expect(facts.capturedBy.white).toEqual(['p']);
  });

  it('stops at the first illegal move and copes with nonsense', () => {
    expect(lineFacts(QUEEN_TAKES_KNIGHT, ['d1d5', 'a1a2', 'e8e7']).sans).toEqual(['Qxd5']);
    expect(lineFacts(QUEEN_TAKES_KNIGHT, []).sans).toEqual([]);
    expect(lineFacts('not a fen', ['e2e4']).sans).toEqual([]);
  });
});

describe('describePieces', () => {
  it('names pieces, biggest first, with counts', () => {
    expect(describePieces(['n'])).toBe('a knight');
    expect(describePieces(['p', 'p'])).toBe('two pawns');
    expect(describePieces(['p', 'q'])).toBe('a queen and a pawn');
    expect(describePieces(['p', 'r', 'n', 'p'])).toBe('a rook, a knight and two pawns');
    expect(describePieces([])).toBe('');
  });
});

describe('explainRefutation', () => {
  it('reports checkmate at once', () => {
    expect(
      explainRefutation({ fen: AFTER_NF6_BLUNDER, pv: ['h5f7'], score: { type: 'mate', winner: 'white', moves: 1 } }),
    ).toBe('White gives checkmate at once.');
  });

  it('reports a longer forced mate', () => {
    expect(
      explainRefutation({ fen: AFTER_NF6_BLUNDER, pv: ['h5f7'], score: { type: 'mate', winner: 'white', moves: 3 } }),
    ).toBe('White has a forced checkmate in 3 moves.');
  });

  it('reports material won when the score agrees', () => {
    expect(explainRefutation({ fen: QUEEN_TAKES_KNIGHT, pv: ['d1d5'], score: cp(350) })).toBe('White wins a knight.');
    expect(explainRefutation({ fen: QUEEN_TAKES_KNIGHT, pv: ['d1d5'], score: cp(480) })).toBe('White wins a knight.');
  });

  it('adds the score when it is worth far more than the material in the line', () => {
    // A knight is 3; a score of +9 means the line shown is only the start of the trouble.
    expect(explainRefutation({ fen: QUEEN_TAKES_KNIGHT, pv: ['d1d5'], score: cp(900) })).toBe(
      'White wins a knight. Stockfish rates the position +9.0.',
    );
  });

  it('describes an uneven exchange: what is won, and for what', () => {
    // Black to move wins a queen for a rook: ...Rxd1+ Kxd1.
    const fen = '3rk3/8/8/8/8/8/8/3QK3 b - - 0 1';
    expect(explainRefutation({ fen, pv: ['d8d1', 'e1d1'], score: cp(-350) })).toBe('Black wins a queen for a rook.');
  });

  it('leaves equal trades out of the story', () => {
    // White takes a knight, Black recaptures a knight, White takes a pawn: net one pawn.
    const fen = '4k3/8/8/3n4/2p5/2N5/8/3QK3 w - - 0 1';
    const pv = ['c3d5', 'e8d7', 'd5b6', 'd7c6', 'b6c4'];
    const facts = lineFacts(fen, pv);
    expect(facts.capturedBy.white).toEqual(['n', 'p']);
    expect(explainRefutation({ fen, pv, score: cp(450) })).toBe('White wins a knight and a pawn.');

    // A pure trade (knight for knight) is not "winning a knight".
    const trade = '4k3/8/4p3/3n4/8/2N5/8/4K3 w - - 0 1';
    expect(explainRefutation({ fen: trade, pv: ['c3d5', 'e6d5'], score: cp(150) })).toBe(
      'No immediate material win, but Stockfish rates the position +1.5.',
    );
  });

  it('does not claim material the score does not back up (a line cut off mid-exchange)', () => {
    // The line shows White taking a knight, but the score says it is about equal:
    // the recapture is simply beyond the end of the line.
    expect(explainRefutation({ fen: DEFENDED_KNIGHT, pv: ['d1d5'], score: cp(20) })).toBe(
      'No immediate material win, but Stockfish rates the position +0.2.',
    );
  });

  it('does not claim a win for the side that comes off worse', () => {
    expect(explainRefutation({ fen: DEFENDED_KNIGHT, pv: ['d1d5', 'd6d5'], score: cp(-600) })).toBe(
      'No immediate material win, but Stockfish rates the position -6.0.',
    );
  });

  it('mentions a promotion', () => {
    const fen = '8/P6k/8/8/8/8/8/K7 w - - 0 1';
    expect(explainRefutation({ fen, pv: ['a7a8q'], score: cp(900) })).toBe('White promotes a pawn.');
  });

  it('falls back to the score and the change in winning chances', () => {
    const text = explainRefutation({
      fen: QUEEN_TAKES_KNIGHT.replace('3n4', '8'),
      pv: ['d1d4'],
      score: cp(230),
      judgement: { winBefore: 52.4, winAfter: 30.1 },
    });
    expect(text).toBe(
      "No immediate material win, but Stockfish rates the position +2.3. Black's winning chances fall from 52% to 30%.",
    );
  });

  it("speaks from Black's side when Black is the one punishing", () => {
    expect(explainRefutation({ fen: BLACK_TAKES_ROOK, pv: ['a2a1'], score: cp(-550) })).toBe('Black wins a rook.');
    expect(
      explainRefutation({ fen: BLACK_TAKES_ROOK, pv: [], score: { type: 'mate', winner: 'black', moves: 2 } }),
    ).toBe('Black has a forced checkmate in 2 moves.');
  });

  it('does not call it a mate for the punisher when the mate is against them', () => {
    // White to move, but it is Black who mates: nothing for White to celebrate.
    const text = explainRefutation({ fen: QUEEN_TAKES_KNIGHT, pv: [], score: { type: 'mate', winner: 'black', moves: 4 } });
    expect(text).toBe('No immediate material win, but Stockfish rates the position #-4.');
  });
});
