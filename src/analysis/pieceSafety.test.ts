import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { isPieceSafe, isPieceTrapped, unsafePieces, withTurn } from './pieceSafety';

describe('piece safety', () => {
  it('a knight attacked by a pawn is unsafe', () => {
    const board = new Chess('4k3/8/4p3/3N4/8/8/8/4K3 b - - 1 1');
    expect(isPieceSafe(board, { square: 'd5', type: 'n', color: 'w' })).toBe(false);
    expect(unsafePieces(board, 'w').map((piece) => piece.square)).toEqual(['d5']);
  });

  it('a defended knight attacked by a rook is safe', () => {
    const board = new Chess('3rk3/8/8/3N4/4P3/8/8/4K3 w - - 0 1');
    expect(isPieceSafe(board, { square: 'd5', type: 'n', color: 'w' })).toBe(true);
  });

  it('an undefended knight attacked by a rook is unsafe', () => {
    const board = new Chess('3rk3/8/8/3N4/8/8/8/4K3 w - - 0 1');
    expect(isPieceSafe(board, { square: 'd5', type: 'n', color: 'w' })).toBe(false);
  });

  it('a bishop on a7 shut in by the b6 pawn is trapped once the king attacks it', () => {
    // Not attacked yet: not trapped.
    const quiet = new Chess('4k3/B7/1p6/8/8/8/8/4K3 w - - 0 1');
    expect(isPieceTrapped(quiet, { square: 'a7', type: 'b', color: 'w' })).toBe(false);
    // Kb7 attacks it; b8 is covered by the king and Bxb6 is met by Kxb6.
    const attacked = new Chess('8/Bk6/1p6/8/8/8/8/4K3 w - - 0 1');
    expect(isPieceTrapped(attacked, { square: 'a7', type: 'b', color: 'w' })).toBe(true);
  });

  it('withTurn changes the side to move and clears en passant', () => {
    expect(withTurn('8/8/8/8/4P3/8/8/k6K b - e3 0 1', 'w')).toBe('8/8/8/8/4P3/8/8/k6K w - - 0 1');
  });
});
