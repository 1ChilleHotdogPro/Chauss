import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { moveSoundFor } from './moveSound';

function soundsOf(sans: string[]) {
  const game = new Game();
  expect(game.loadLine(sans)).toBe(true);
  return game.history().map(moveSoundFor);
}

describe('moveSoundFor', () => {
  it('uses the plain sound for a quiet move, a check and castling, and the capture sound over check', () => {
    expect(soundsOf(['e4', 'd5', 'Bb5+', 'c6', 'Bxc6+'])[4]).toBe('capture'); // capture wins over check
    expect(soundsOf(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Bxc6', 'dxc6', 'O-O'])[8]).toBe('move');
    expect(soundsOf(['e4', 'f5', 'Qh5+'])[2]).toBe('move');
    expect(soundsOf(['e4', 'd5', 'Bb5+'])[2]).toBe('move');
  });

  it('uses the capture sound for captures, en passant included', () => {
    expect(soundsOf(['e4', 'd5', 'exd5'])[2]).toBe('capture');
    expect(soundsOf(['e4', 'a6', 'e5', 'd5', 'exd6'])[4]).toBe('capture');
  });

  it('uses the checkmate sound for mate, even when the mating move captures', () => {
    expect(soundsOf(['f3', 'e5', 'g4', 'Qh4#']).at(-1)).toBe('checkmate');
    expect(soundsOf(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#']).at(-1)).toBe('checkmate');
  });
});
