import { describe, expect, it } from 'vitest';
import { numberedLine, parseUciMove, pvToSan, toUci } from './pv';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

describe('parseUciMove / toUci', () => {
  it('splits a normal move and a promotion', () => {
    expect(parseUciMove('g1f3')).toEqual({ from: 'g1', to: 'f3' });
    expect(parseUciMove('a7a8q')).toEqual({ from: 'a7', to: 'a8', promotion: 'q' });
  });

  it('rejects nonsense', () => {
    expect(parseUciMove('(none)')).toBeNull();
    expect(parseUciMove('e2')).toBeNull();
    expect(parseUciMove('e2e9')).toBeNull();
    expect(parseUciMove('a7a8k')).toBeNull();
  });

  it('round-trips', () => {
    expect(toUci({ from: 'g1', to: 'f3' })).toBe('g1f3');
    expect(toUci({ from: 'a7', to: 'a8', promotion: 'n' })).toBe('a7a8n');
  });
});

describe('pvToSan', () => {
  it('converts an engine line to normal notation', () => {
    expect(pvToSan(START, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3'])).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3']);
  });

  it('handles captures, check and mate symbols', () => {
    const fen = 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4';
    expect(pvToSan(fen, ['h5f7'])).toEqual(['Qxf7#']);
  });

  it('handles castling (the engine writes it as a king move)', () => {
    const fen = 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';
    expect(pvToSan(fen, ['e1g1', 'g8f6'])).toEqual(['O-O', 'Nf6']);
  });

  it('handles promotion', () => {
    expect(pvToSan('8/P6k/8/8/8/8/8/K7 w - - 0 1', ['a7a8q'])).toEqual(['a8=Q']);
  });

  it('respects the maximum length', () => {
    expect(pvToSan(START, ['e2e4', 'e7e5', 'g1f3'], 2)).toEqual(['e4', 'e5']);
  });

  it('stops at the first illegal or malformed move', () => {
    expect(pvToSan(START, ['e2e4', 'e2e4', 'g1f3'])).toEqual(['e4']);
    expect(pvToSan(START, ['e2e4', 'xyz', 'g1f3'])).toEqual(['e4']);
    expect(pvToSan(START, [])).toEqual([]);
  });

  it('returns nothing for an invalid position', () => {
    expect(pvToSan('not a fen', ['e2e4'])).toEqual([]);
  });
});

describe('numberedLine', () => {
  it('numbers a line that starts with White', () => {
    expect(numberedLine(START, ['e4', 'e5', 'Nf3'])).toBe('1. e4 e5 2. Nf3');
  });

  it('numbers a line that starts with Black', () => {
    const fen = 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3';
    expect(numberedLine(fen, ['Nf6', 'Qxf7#'])).toBe('3... Nf6 4. Qxf7#');
  });

  it('returns an empty string for no moves', () => {
    expect(numberedLine(START, [])).toBe('');
  });
});
