import { describe, expect, it } from 'vitest';
import { Game } from './game';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const PONZIANI = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';

/** Play moves written as "e2e4" (optionally "a7a8q" for a promotion). */
function playAll(game: Game, moves: string[]): void {
  for (const m of moves) {
    const promotion = m.length > 4 ? (m[4] as 'q' | 'r' | 'b' | 'n') : undefined;
    const played = game.play(m.slice(0, 2), m.slice(2, 4), promotion);
    if (!played) throw new Error(`test setup: ${m} was rejected`);
  }
}

const sans = (game: Game) => game.history().map((m) => m.san);

describe('start position', () => {
  it('is White to move with 20 legal moves', () => {
    const game = new Game();
    expect(game.fen()).toBe(START);
    expect(game.turn()).toBe('white');
    expect(game.status()).toBe('playing');
    expect(game.inCheck()).toBe(false);

    const dests = game.dests();
    const total = [...dests.values()].reduce((n, targets) => n + targets.length, 0);
    expect(total).toBe(20);
    expect(dests.get('e2')).toEqual(['e3', 'e4']);
    expect(dests.get('g1')?.slice().sort()).toEqual(['f3', 'h3']);
    expect(dests.has('e1')).toBe(false); // the king has no moves yet
    expect(dests.has('e7')).toBe(false); // not Black's turn
  });

  it('has no last move and an empty history', () => {
    const game = new Game();
    expect(game.lastMove()).toBeUndefined();
    expect(game.history()).toEqual([]);
    expect(game.currentPly()).toBe(0);
  });
});

describe('playing moves', () => {
  it('rejects an illegal move and changes nothing', () => {
    const game = new Game();
    expect(game.play('e2', 'e5')).toBeNull();
    expect(game.play('e7', 'e5')).toBeNull(); // Black piece on White's turn
    expect(game.play('e3', 'e4')).toBeNull(); // empty square
    expect(game.play('zz', 'e4')).toBeNull(); // nonsense input
    expect(game.fen()).toBe(START);
    expect(game.history()).toEqual([]);
  });

  it('plays the Ponziani move order', () => {
    const game = new Game();
    playAll(game, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3']);
    expect(sans(game)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3']);
    expect(game.fen()).toBe(PONZIANI);
    expect(game.turn()).toBe('black');
    expect(game.currentPly()).toBe(5);
  });

  it('records each move with its ply, colour, squares and resulting position', () => {
    const game = new Game();
    const first = game.play('e2', 'e4');
    expect(first).toEqual({
      ply: 1,
      san: 'e4',
      from: 'e2',
      to: 'e4',
      color: 'white',
      fenAfter: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
    });
    const second = game.play('e7', 'e5');
    expect(second?.ply).toBe(2);
    expect(second?.color).toBe('black');
    expect(game.lastMove()).toBe(second);
  });
});

describe('special moves', () => {
  it('castles kingside: the rook jumps too', () => {
    const game = new Game();
    playAll(game, ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5']);
    expect(game.dests().get('e1')?.slice().sort()).toEqual(['e2', 'f1', 'g1']);
    const castle = game.play('e1', 'g1');
    expect(castle?.san).toBe('O-O');
    expect(game.fen()).toBe('r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1 b kq - 5 4');
  });

  it('captures en passant: the captured pawn disappears', () => {
    const game = new Game();
    playAll(game, ['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    const capture = game.play('e5', 'd6');
    expect(capture?.san).toBe('exd6');
    expect(game.fen()).toBe('rnbqkbnr/1pp1pppp/p2P4/8/8/8/PPPP1PPP/RNBQKBNR b KQkq - 0 3');
  });

  it('needs a piece choice for a promotion, and only for a promotion', () => {
    const game = new Game('8/P6k/8/8/8/8/8/K7 w - - 0 1');
    expect(game.needsPromotion('a7', 'a8')).toBe(true);
    expect(game.needsPromotion('a1', 'a2')).toBe(false);
    expect(game.dests().get('a7')).toEqual(['a8']); // listed once, not once per piece

    expect(game.play('a7', 'a8')).toBeNull(); // no piece chosen
    expect(game.history()).toEqual([]);

    const promo = game.play('a7', 'a8', 'n');
    expect(promo?.san).toBe('a8=N');
    expect(promo?.promotion).toBe('n');
    expect(game.fen()).toBe('N7/7k/8/8/8/8/8/K7 b - - 0 1');
  });

  it('ignores a promotion piece on a normal move', () => {
    const game = new Game();
    const move = game.play('e2', 'e4', 'q');
    expect(move?.san).toBe('e4');
    expect(move?.promotion).toBeUndefined();
  });

  it('promotes with a capture from the normal start position', () => {
    const game = new Game();
    playAll(game, ['h2h4', 'g7g5', 'h4g5', 'g8f6', 'g5g6', 'b8a6', 'g6g7', 'a6b8']);
    expect(game.needsPromotion('g7', 'h8')).toBe(true);
    const promo = game.play('g7', 'h8', 'q');
    expect(promo?.san).toBe('gxh8=Q');
    expect(game.fen().startsWith('rnbqkb1Q/')).toBe(true);
  });
});

describe('check, mate and draws', () => {
  it('detects check', () => {
    const game = new Game();
    playAll(game, ['e2e4', 'e7e5', 'd1h5', 'b8c6', 'h5f7']);
    expect(game.lastMove()?.san).toBe('Qxf7+');
    expect(game.inCheck()).toBe(true);
    expect(game.status()).toBe('playing');
    // The only way out is to take the queen with the king.
    expect([...game.dests().entries()]).toEqual([['e8', ['f7']]]);
  });

  it("detects checkmate (Fool's mate) and leaves no legal moves", () => {
    const game = new Game();
    playAll(game, ['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    expect(game.lastMove()?.san).toBe('Qh4#');
    expect(game.status()).toBe('checkmate');
    expect(game.inCheck()).toBe(true);
    expect(game.turn()).toBe('white');
    expect(game.dests().size).toBe(0);
    expect(game.play('e2', 'e4')).toBeNull();
  });

  it('detects stalemate', () => {
    const game = new Game('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1');
    expect(game.status()).toBe('stalemate');
    expect(game.inCheck()).toBe(false);
    expect(game.dests().size).toBe(0);
  });

  it('detects a draw by insufficient material', () => {
    expect(new Game('k7/8/8/8/8/8/8/K7 w - - 0 1').status()).toBe('draw');
  });

  it('detects threefold repetition, also after stepping back and forth', () => {
    const game = new Game();
    const shuffle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
    playAll(game, [...shuffle, ...shuffle]);
    expect(game.status()).toBe('draw');

    game.goTo(4);
    expect(game.status()).toBe('playing');
    game.goTo(8);
    expect(game.status()).toBe('draw');
  });
});

describe('moving through the game', () => {
  const line = ['e2e4', 'e7e5', 'g1f3', 'b8c6', 'c2c3'];

  it('goTo shows an earlier position without losing later moves', () => {
    const game = new Game();
    playAll(game, line);
    game.goTo(2);
    expect(game.currentPly()).toBe(2);
    expect(game.fen()).toBe('rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2');
    expect(game.lastMove()?.san).toBe('e5');
    expect(game.turn()).toBe('white');
    expect(game.history()).toHaveLength(5);
  });

  it('goTo clamps out-of-range values', () => {
    const game = new Game();
    playAll(game, line);
    game.goTo(-5);
    expect(game.currentPly()).toBe(0);
    expect(game.fen()).toBe(START);
    game.goTo(99);
    expect(game.currentPly()).toBe(5);
    expect(game.fen()).toBe(PONZIANI);
  });

  it('back and forward step one move at a time', () => {
    const game = new Game();
    playAll(game, line);
    game.back();
    expect(game.lastMove()?.san).toBe('Nc6');
    game.back();
    expect(game.lastMove()?.san).toBe('Nf3');
    game.forward();
    game.forward();
    game.forward(); // already at the end
    expect(game.fen()).toBe(PONZIANI);
  });

  it('a new move from an earlier position drops the later moves', () => {
    const game = new Game();
    playAll(game, line);
    game.goTo(2);
    const move = game.play('f1', 'c4');
    expect(move?.ply).toBe(3);
    expect(sans(game)).toEqual(['e4', 'e5', 'Bc4']);
    expect(game.currentPly()).toBe(3);
  });

  it('undo takes back the last move', () => {
    const game = new Game();
    playAll(game, line);
    expect(game.undo()?.san).toBe('c3');
    expect(sans(game)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(game.currentPly()).toBe(4);
    expect(game.turn()).toBe('white');
    expect(game.dests().get('c2')).toEqual(['c3', 'c4']);
  });

  it('undo while looking at an earlier position removes the last move and shows the end', () => {
    const game = new Game();
    playAll(game, line);
    game.goTo(1);
    game.undo();
    expect(sans(game)).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
    expect(game.currentPly()).toBe(4);
  });

  it('undo with no moves does nothing', () => {
    const game = new Game();
    expect(game.undo()).toBeNull();
    expect(game.fen()).toBe(START);
  });

  it('reset returns to the start position', () => {
    const game = new Game();
    playAll(game, line);
    game.reset();
    expect(game.fen()).toBe(START);
    expect(game.history()).toEqual([]);
    expect(game.currentPly()).toBe(0);
    expect(game.dests().get('e2')).toEqual(['e3', 'e4']);
  });
});
