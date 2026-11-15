import { describe, expect, it } from 'vitest';
import { Game } from './game';
import { materialFromFen } from './material';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function after(sans: string[]) {
  const game = new Game();
  expect(game.loadLine(sans)).toBe(true);
  return materialFromFen(game.fen());
}

describe('materialFromFen', () => {
  it('is level with nothing lost at the start', () => {
    expect(materialFromFen(START)).toEqual({ lost: { white: [], black: [] }, balance: 0 });
  });

  it('shows a pawn won and the side that is ahead', () => {
    const material = after(['e4', 'd5', 'exd5']);
    expect(material.lost).toEqual({ white: [], black: ['p'] });
    expect(material.balance).toBe(1);
  });

  it('lists what each side lost after a trade of queens', () => {
    const material = after(['e4', 'd5', 'exd5', 'Qxd5', 'Nc3', 'Qxd2+', 'Bxd2']);
    expect(material.lost).toEqual({ white: ['p', 'p'], black: ['q', 'p'] });
    expect(material.balance).toBe(8);
  });

  it('lists lost pieces most valuable first', () => {
    const material = materialFromFen('r3k3/8/8/8/8/8/PPPPPPP1/1B2K2R w - - 0 1');
    expect(material.lost.white).toEqual(['q', 'r', 'b', 'n', 'n', 'p']);
    expect(material.lost.black).toEqual(['q', 'r', 'b', 'b', 'n', 'n', ...Array(8).fill('p')]);
  });

  it('counts balance by piece values', () => {
    // White: queen. Black: rook and bishop. 9 against 8.
    expect(materialFromFen('4k3/8/8/8/8/8/8/Q3K3 w - - 0 1').balance).toBe(9);
    expect(materialFromFen('4k1r1/8/8/8/8/8/8/Q3K3 w - - 0 1').balance).toBe(4);
  });

  it('does not count a promoted pawn as lost, nor its new queen as extra', () => {
    // Two queens (one from a promotion) and seven pawns: the eighth pawn became the queen, it was not captured.
    const material = materialFromFen('4k3/8/8/8/8/8/PPPPPPP1/QQ2K3 w - - 0 1');
    expect(material.lost.white).toEqual(['r', 'r', 'b', 'b', 'n', 'n']);
  });
});
