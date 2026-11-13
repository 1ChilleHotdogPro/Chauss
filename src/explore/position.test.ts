import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import type { Counts, SnapshotMove } from '../snapshot/format';
import { buildExplorePosition, popularMistakes, type PositionData } from './position';

const cp = (value: number): Score => ({ type: 'cp', value });
const WHITE_TO_MOVE = 'r1bqkb1r/pppp1ppp/2n2n2/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R w KQkq - 1 4';
const BLACK_TO_MOVE = 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/2P2N2/PP1P1PPP/RNBQKB1R b KQkq - 0 3';

function move(san: string, uci: string, lichess: Counts, masters: Counts, score?: Score, extra: Partial<SnapshotMove> = {}): SnapshotMove {
  const out: SnapshotMove = { uci, san, lichess, masters, ...extra };
  if (score) out.eval = score;
  return out;
}

/** Made-up numbers: 1000 Lichess games and 100 master games at the position. Pass null for "no score". */
function data(fen: string, moves: SnapshotMove[], score: Score | null = cp(20)): PositionData {
  const out: PositionData = { fen, lichess: [500, 100, 400], masters: [40, 40, 20], moves };
  if (score) out.eval = score;
  return out;
}

describe('buildExplorePosition', () => {
  it('works out shares and results for each source separately', () => {
    const position = buildExplorePosition(
      data(WHITE_TO_MOVE, [move('d4', 'd2d4', [300, 60, 240], [45, 30, 15], cp(25))]),
    );
    expect(position.mover).toBe('white');
    expect(position.popularGames).toBe(1000);
    expect(position.bookGames).toBe(100);

    const d4 = position.moves[0]!;
    expect(d4.popular).toEqual({ games: 600, share: 0.6, whitePercent: 50, drawPercent: 10, blackPercent: 40 });
    expect(d4.book).toEqual({ games: 90, share: 0.9, whitePercent: 50, drawPercent: 33, blackPercent: 17 });
  });

  it('makes the three result percentages add up to 100 despite rounding', () => {
    const position = buildExplorePosition(data(WHITE_TO_MOVE, [move('d4', 'd2d4', [1, 1, 1], [0, 0, 0], cp(0))]));
    const s = position.moves[0]!.popular!;
    expect(s.whitePercent + s.drawPercent + s.blackPercent).toBe(100);
  });

  it('keeps Book and Popular as two lists, each sorted by its own games', () => {
    const position = buildExplorePosition(
      data(WHITE_TO_MOVE, [
        move('d3', 'd2d3', [400, 0, 300], [2, 2, 1], cp(0)), // popular with amateurs, rare in the book
        move('d4', 'd2d4', [100, 0, 100], [50, 30, 10], cp(25)), // the book move
        move('h3', 'h2h3', [50, 0, 50], [0, 0, 0], cp(-10)), // no master has played it
      ]),
    );
    expect(position.popularMoves.map((m) => m.san)).toEqual(['d3', 'd4', 'h3']);
    expect(position.bookMoves.map((m) => m.san)).toEqual(['d4', 'd3']);
    expect(position.moves.find((m) => m.san === 'h3')?.book).toBeNull();
  });

  it('flags moves by how much they give away, measured against the best known move', () => {
    // White to move. Best known: d4 at +0.25. Scores are from White's point of view.
    const position = buildExplorePosition(
      data(WHITE_TO_MOVE, [
        move('d4', 'd2d4', [300, 0, 300], [0, 0, 0], cp(25)),
        move('Bd3', 'f1d3', [100, 0, 100], [0, 0, 0], cp(-20)), // about 4 points: fine
        move('Bc4', 'f1c4', [50, 0, 50], [0, 0, 0], cp(-110)), // about 12 points: inaccuracy
        move('Qa4', 'd1a4', [30, 0, 30], [0, 0, 0], cp(-230)), // about 22 points: mistake
        move('Ng5', 'f3g5', [20, 0, 20], [0, 0, 0], cp(-450)), // about 36 points: blunder
      ]),
    );
    expect(position.moves.map((m) => [m.san, m.flag])).toEqual([
      ['d4', 'none'],
      ['Bd3', 'none'],
      ['Bc4', 'inaccuracy'],
      ['Qa4', 'mistake'],
      ['Ng5', 'blunder'],
    ]);
    expect(position.moves[4]!.judgement?.drop).toBeGreaterThan(30);
    expect(position.moves[0]!.judgement?.drop).toBe(0);
  });

  it("judges from Black's side when Black is to move", () => {
    // Black to move: a HIGHER score (better for White) is the worse move.
    const position = buildExplorePosition(
      data(
        BLACK_TO_MOVE,
        [
          move('Nf6', 'g8f6', [300, 0, 300], [0, 0, 0], cp(15)),
          move('f6', 'f7f6', [50, 0, 50], [0, 0, 0], cp(260)), // about 23 points worse for Black
        ],
        cp(15),
      ),
    );
    expect(position.mover).toBe('black');
    expect(position.moves.map((m) => m.flag)).toEqual(['none', 'mistake']);
  });

  it("uses the position's own score as the yardstick when it is better than any listed move", () => {
    // The best move is not among the listed ones: the position is +1.5, the listed move gives +0.0.
    const position = buildExplorePosition(
      data(WHITE_TO_MOVE, [move('h3', 'h2h3', [100, 0, 100], [0, 0, 0], cp(0))], cp(150)),
    );
    expect(position.moves[0]!.flag).toBe('inaccuracy');
  });

  it('does not let a slightly low position score make the best move look bad', () => {
    // Search noise: the position says +0.10 but the best move scores +0.30. Nothing is flagged.
    const position = buildExplorePosition(
      data(WHITE_TO_MOVE, [move('d4', 'd2d4', [100, 0, 100], [0, 0, 0], cp(30))], cp(10)),
    );
    expect(position.moves[0]!.flag).toBe('none');
    expect(position.moves[0]!.judgement?.drop).toBe(0);
  });

  it('flags a move that allows mate as a blunder', () => {
    const position = buildExplorePosition(
      data(BLACK_TO_MOVE, [
        move('Nf6', 'g8f6', [300, 0, 300], [0, 0, 0], cp(15)),
        move('g5', 'g7g5', [10, 0, 10], [0, 0, 0], { type: 'mate', winner: 'white', moves: 3 }),
      ]),
    );
    expect(position.moves[1]!.flag).toBe('blunder');
    expect(position.moves[1]!.judgement?.note).toEqual({ kind: 'allows-mate', moves: 3 });
  });

  it('leaves moves without a score unflagged (live data before the engine has looked)', () => {
    const position = buildExplorePosition(
      data(WHITE_TO_MOVE, [move('d4', 'd2d4', [300, 0, 300], [0, 0, 0])], null),
    );
    expect(position.moves[0]!.flag).toBe('none');
    expect(position.moves[0]!.judgement).toBeUndefined();
    expect(position.eval).toBeUndefined();
  });

  it('carries over the opening names, the link to the next position and the recommendation', () => {
    const input = data(WHITE_TO_MOVE, [
      move('d4', 'd2d4', [300, 0, 300], [0, 0, 0], cp(25), { opening: 'Ponziani Opening: Jaenisch Counterattack', next: 'some key' }),
    ]);
    input.opening = { eco: 'C44', name: 'Ponziani Opening' };
    input.recommended = 'd2d4';
    const position = buildExplorePosition(input);
    expect(position.opening?.name).toBe('Ponziani Opening');
    expect(position.recommended).toBe('d2d4');
    expect(position.moves[0]).toMatchObject({ opening: 'Ponziani Opening: Jaenisch Counterattack', next: 'some key' });
  });

  it('copes with a position nobody has played', () => {
    const position = buildExplorePosition({ fen: WHITE_TO_MOVE, lichess: [0, 0, 0], masters: [0, 0, 0], moves: [] });
    expect(position.moves).toEqual([]);
    expect(position.popularGames).toBe(0);
  });
});

describe('popularMistakes', () => {
  const position = buildExplorePosition(
    data(BLACK_TO_MOVE, [
      move('Nf6', 'g8f6', [300, 0, 300], [0, 0, 0], cp(15)),
      move('Bc5', 'f8c5', [120, 0, 80], [0, 0, 0], cp(140)), // about 11 points: only an inaccuracy
      move('f6', 'f7f6', [60, 0, 40], [0, 0, 0], cp(260)), // mistake, 10% of games
      move('Qh4', 'd8h4', [30, 0, 10], [0, 0, 0], cp(600)), // blunder, 4% of games
      move('g5', 'g7g5', [8, 0, 2], [0, 0, 0], cp(700)), // blunder, but only 1% of games
    ]),
  );

  it('lists mistakes and blunders that are really played, worst first', () => {
    expect(popularMistakes(position).map((m) => m.san)).toEqual(['Qh4', 'f6']);
  });

  it('lets the share threshold be changed', () => {
    expect(popularMistakes(position, 0.005).map((m) => m.san)).toEqual(['g5', 'Qh4', 'f6']);
    expect(popularMistakes(position, 0.05).map((m) => m.san)).toEqual(['f6']);
  });
});
