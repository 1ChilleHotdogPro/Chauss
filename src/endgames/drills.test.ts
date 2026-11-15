import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { ENDGAME_DRILLS, getEndgameDrill, userSide } from './drills';

/** "KQvK" from a position: the side to move's pieces first, each side strongest first. */
function materialOf(fen: string): string {
  const order = 'kqrbnp';
  const board = fen.split(' ')[0]!;
  const pieces = (upper: boolean) =>
    [...board]
      .filter((char) => /[a-z]/i.test(char) && (char === char.toUpperCase()) === upper)
      .map((char) => char.toLowerCase())
      .sort((a, b) => order.indexOf(a) - order.indexOf(b))
      .join('')
      .toUpperCase();
  const white = pieces(true);
  const black = pieces(false);
  return userSide(fen) === 'white' ? `${white}v${black}` : `${black}v${white}`;
}

describe('endgame drill data', () => {
  it('has unique drill ids and unique position ids inside each drill', () => {
    const ids = ENDGAME_DRILLS.map((drill) => drill.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const drill of ENDGAME_DRILLS) {
      const positionIds = drill.positions.map((position) => position.id);
      expect(new Set(positionIds).size, drill.id).toBe(positionIds.length);
      expect(drill.positions.length, drill.id).toBeGreaterThan(0);
      expect(getEndgameDrill(drill.id)).toBe(drill);
    }
  });

  for (const drill of ENDGAME_DRILLS) {
    describe(drill.title, () => {
      for (const position of drill.positions) {
        it(`${position.id} is a legal position with the drill's material`, () => {
          const chess = new Chess(position.fen); // throws on an invalid FEN
          expect(chess.fen()).toBe(position.fen);
          // The game is not over before it starts.
          expect(chess.isGameOver()).toBe(false);
          // The side NOT to move must not be in check (that would mean the last move was illegal);
          // this also catches kings standing next to each other.
          const parts = position.fen.split(' ');
          parts[1] = parts[1] === 'w' ? 'b' : 'w';
          parts[3] = '-';
          expect(new Chess(parts.join(' ')).inCheck()).toBe(false);
          expect(materialOf(position.fen)).toBe(drill.material);
          // Every position of a drill is played from the same side.
          expect(userSide(position.fen)).toBe(userSide(drill.positions[0]!.fen));
          expect(position.par).toBeGreaterThan(0);
        });
      }
      it('lists its positions from easy to hard (par never goes down)', () => {
        const pars = drill.positions.map((position) => position.par);
        expect(pars).toEqual([...pars].sort((a, b) => a - b));
      });
    });
  }
});
