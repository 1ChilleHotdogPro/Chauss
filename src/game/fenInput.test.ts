import { describe, expect, it } from 'vitest';
import { parseFenInput } from './fenInput';

describe('parseFenInput', () => {
  it('accepts a full FEN as it is', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';
    expect(parseFenInput(`  ${fen} `)).toEqual({ ok: true, fen });
  });

  it('fills in the missing parts when only the pieces are given', () => {
    expect(parseFenInput('4k3/8/8/8/8/8/8/4K2R')).toEqual({ ok: true, fen: '4k3/8/8/8/8/8/8/4K2R w - - 0 1' });
  });

  it('drops castling rights the pieces cannot have', () => {
    const result = parseFenInput('4k3/8/8/8/8/8/8/4K2R w KQkq - 0 1');
    expect(result).toEqual({ ok: true, fen: '4k3/8/8/8/8/8/8/4K2R w K - 0 1' });
  });

  it('refuses nonsense, missing kings and impossible checks with a short reason', () => {
    expect(parseFenInput('')).toMatchObject({ ok: false });
    expect(parseFenInput('hello')).toMatchObject({ ok: false });
    expect(parseFenInput('8/8/8/8/8/8/8/4K3 w - - 0 1')).toMatchObject({ ok: false, error: expect.stringContaining('king') });
    // Black's king is attacked by the rook, yet it is White's move.
    expect(parseFenInput('4k3/8/8/8/8/8/8/4R1K1 w - - 0 1')).toMatchObject({
      ok: false,
      error: expect.stringContaining('Black is in check'),
    });
    expect(parseFenInput('a b c d e f g')).toMatchObject({ ok: false });
  });
});
