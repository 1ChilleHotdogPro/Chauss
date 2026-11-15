import type { Side } from '../game/game';

/**
 * Endgame drills: pure data. A new drill is one more entry in ENDGAME_DRILLS; the judging and the
 * drill screen work from its `goal`, so no code changes are needed as long as an existing goal fits.
 *
 * Every `par` is measured with the bundled Stockfish (`npm run endgames`), never written from memory.
 */

/**
 * What the user must achieve:
 *  - 'mate': deliver checkmate (e.g. King + Queen vs King). A move is right while a forced mate stays on.
 *  - 'win':  keep a winning position until Stockfish sees a forced mate (e.g. King + Pawn vs King).
 *  - 'draw': hold a worse position for `moves` moves without letting it become lost.
 */
export type EndgameGoal = 'mate' | 'win' | 'draw';

export interface EndgamePosition {
  /** Unique inside its drill; progress is stored under it. */
  id: string;
  /** The start position. The side to move is the side the user plays. */
  fen: string;
  /**
   * 'mate': the shortest forced mate in moves of the user's side, as Stockfish measured it.
   * 'win' / 'draw': how many of the user's moves the position is played for.
   */
  par: number;
  /** One short sentence shown with the position. */
  hint?: string;
}

export interface EndgameJudging {
  /**
   * 'mate' only: how many moves slower than the best move a move may be and still count as right
   * (beginners do not need the shortest mate, just a steady plan).
   */
  slack: number;
  /** The position is failed once the user has made `par + extraMoves` moves without reaching the goal. */
  extraMoves: number;
  /** Stockfish's search depth for judging and for the defending side's moves. */
  depth: number;
}

export interface EndgameDrill {
  id: string;
  title: string;
  /** The aspect of the endgame this drill trains, e.g. "Mating technique". */
  skill: string;
  /** One or two sentences: what to do and the plan. */
  description: string;
  /** The pieces, e.g. "KQvK" (the user's side first). Checked against every position by the tests. */
  material: string;
  goal: EndgameGoal;
  judging: EndgameJudging;
  positions: readonly EndgamePosition[];
}

export const ENDGAME_DRILLS: readonly EndgameDrill[] = [
  {
    id: 'kq-vs-k',
    title: 'King and Queen vs King',
    skill: 'Mating technique',
    description:
      'Checkmate the lone king. Use the queen to shrink the box the king can move in, bring your own king closer, and never leave the other king without a move unless it is mate.',
    material: 'KQvK',
    goal: 'mate',
    judging: { slack: 2, extraMoves: 6, depth: 22 },
    positions: [
      {
        id: 'edge-1',
        fen: '7k/8/8/6K1/8/8/8/5Q2 w - - 0 1',
        par: 3,
        hint: 'The king is already in the corner. Careful: do not take away its last square without giving check.',
      },
      {
        id: 'side-1',
        fen: '8/8/8/8/8/2k5/8/K6Q w - - 0 1',
        par: 6,
        hint: 'Cut the king off with the queen, a knight’s jump away from it.',
      },
      {
        id: 'edge-2',
        fen: '2k5/8/8/8/8/8/8/4KQ2 w - - 0 1',
        par: 7,
        hint: 'The king is on the edge. Keep it there with the queen and walk your king up.',
      },
      {
        id: 'center-1',
        fen: '8/8/3k4/8/8/8/8/4K1Q1 w - - 0 1',
        par: 10,
        hint: 'Shrink the box step by step; checks alone will not do it.',
      },
      {
        id: 'center-2',
        fen: '8/8/8/4k3/8/8/8/1Q2K3 w - - 0 1',
        par: 10,
        hint: 'The king is in the middle: a long one. Box it in first, then bring your king.',
      },
    ],
  },
];

export function getEndgameDrill(id: string): EndgameDrill | undefined {
  return ENDGAME_DRILLS.find((drill) => drill.id === id);
}

/** The colour the user plays in a position: the side to move. */
export function userSide(fen: string): Side {
  return fen.split(' ')[1] === 'b' ? 'black' : 'white';
}
