import { describe, expect, it } from 'vitest';
import { importPgn } from './pgn';

describe('importPgn', () => {
  it('reads a Lichess export with clocks, evals, annotations and a variation', () => {
    const result = importPgn(`[Event "Rated Blitz game"]
[White "alice"]
[Black "bob"]
[Result "1-0"]

1. e4 { [%eval 0.2] [%clk 0:03:00] } 1... e5 { [%clk 0:03:00] } 2. Nf3 $1 Nc6 (2... d6 3. d4) 3. c3?! Nf6 1-0`);
    expect(result).toMatchObject({ ok: true, sans: ['e4', 'e5', 'Nf3', 'Nc6', 'c3', 'Nf6'] });
    if (result.ok) {
      expect(result.headers.White).toBe('alice');
      expect(result.startFen).toBe('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
    }
  });

  it('reads bare moves, with or without numbers', () => {
    expect(importPgn('1.e4 e5 2.Nf3 *')).toMatchObject({ ok: true, sans: ['e4', 'e5', 'Nf3'] });
    expect(importPgn('e4 e5 Nf3')).toMatchObject({ ok: true, sans: ['e4', 'e5', 'Nf3'] });
  });

  it('starts from a FEN header', () => {
    const result = importPgn('[SetUp "1"]\n[FEN "4k3/8/8/8/8/8/4P3/4K3 w - - 0 1"]\n\n1. e3 Kd7 *');
    expect(result).toMatchObject({ ok: true, startFen: '4k3/8/8/8/8/8/4P3/4K3 w - - 0 1', sans: ['e3', 'Kd7'] });
  });

  it('takes the first of several games', () => {
    const result = importPgn('[Event "a"]\n\n1. e4 e5 1-0\n\n[Event "b"]\n\n1. d4 d5 0-1\n');
    expect(result).toMatchObject({ ok: true, sans: ['e4', 'e5'] });
  });

  it('names the illegal move and where it is', () => {
    expect(importPgn('1. e4 e5 2. Ke3 Nc6')).toEqual({ ok: false, error: '"Ke3" is not a legal move (move 2).' });
    expect(importPgn('1. e4 e5 2. Nf3 Ke7 3. Nc3 Kf9')).toMatchObject({ ok: false });
    // The same move was legal earlier: the later, illegal one is named.
    expect(importPgn('1. Nf3 Nf6 2. Ng1 Ng8 3. Nf3 Nf6 4. Nf3')).toEqual({
      ok: false,
      error: '"Nf3" is not a legal move (move 4).',
    });
  });

  it('rejects empty input, junk and other variants', () => {
    expect(importPgn('   ')).toEqual({ ok: false, error: 'Paste a game first.' });
    expect(importPgn('hello world')).toMatchObject({ ok: false });
    expect(importPgn('[Variant "Chess960"]\n[FEN "rkrnnqbb/pppppppp/8/8/8/8/PPPPPPPP/RKRNNQBB w KQkq - 0 1"]\n\n1. e4 *')).toMatchObject({
      ok: false,
    });
    expect(importPgn('[Event "x"]\n\n*')).toEqual({ ok: false, error: 'The game has no moves.' });
  });
});
