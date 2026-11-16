import { describe, expect, it } from 'vitest';
import { read, write } from '@lichess-org/chessground/fen';
import { applyPremoves, normalisePremove, queuedSquares } from './premoveQueue';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR';

describe('premove queue', () => {
  it('shows each queued move on the board, so a piece can be premoved again', () => {
    const after = applyPremoves(read(START), [
      { from: 'g1', to: 'f3' },
      { from: 'f3', to: 'g5' },
      { from: 'e2', to: 'e4' },
    ]);
    expect(write(after)).toBe('rnbqkbnr/pppppppp/8/6N1/4P3/8/PPPP1PPP/RNBQKB1R');
  });

  it('a capture replaces the piece on the target square', () => {
    const after = applyPremoves(read(START), [{ from: 'd1', to: 'd7' }]);
    expect(after.get('d7')).toEqual({ role: 'queen', color: 'white' });
    expect(after.has('d1')).toBe(false);
  });

  it('castling moves the rook too, also when the king was premoved onto the rook', () => {
    const pieces = read('r3k2r/8/8/8/8/8/8/R3K2R');
    const short = normalisePremove(pieces, 'e1', 'h1');
    expect(short).toEqual({ from: 'e1', to: 'g1' });
    expect(write(applyPremoves(pieces, [short]))).toBe('r3k2r/8/8/8/8/8/8/R4RK1');
    const long = normalisePremove(pieces, 'e8', 'a8');
    expect(long).toEqual({ from: 'e8', to: 'c8' });
    expect(write(applyPremoves(pieces, [long]))).toBe('2kr3r/8/8/8/8/8/8/R3K2R');
  });

  it('an ordinary move is left as it is', () => {
    expect(normalisePremove(read(START), 'e2', 'e4')).toEqual({ from: 'e2', to: 'e4' });
  });

  it('a pawn premoved to the last rank is shown as a queen', () => {
    const after = applyPremoves(read('8/P7/8/8/8/8/8/K6k'), [{ from: 'a7', to: 'a8' }]);
    expect(after.get('a8')).toEqual({ role: 'queen', color: 'white' });
  });

  it('marks the start and end square of every queued move', () => {
    expect([...queuedSquares([{ from: 'g1', to: 'f3' }, { from: 'f3', to: 'g5' }]).keys()]).toEqual(['g1', 'f3', 'g5']);
  });
});
