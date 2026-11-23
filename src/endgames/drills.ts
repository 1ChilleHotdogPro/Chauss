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
  {
    id: 'kr-vs-k',
    title: 'King and Rook vs King',
    skill: 'Mating technique',
    description:
      'Checkmate with a rook. Cut the king off with the rook, bring your king up so the kings face each other, then check along the edge.',
    material: 'KRvK',
    goal: 'mate',
    judging: { slack: 3, extraMoves: 8, depth: 22 },
    positions: [
      {
        id: 'edge',
        fen: '4k3/8/3K4/8/8/8/8/7R w - - 0 1',
        par: 2,
        hint: 'The king is on the edge. A quiet rook move first, then mate.',
      },
      {
        id: 'corner',
        fen: '8/8/8/8/8/3R4/3K4/6k1 w - - 0 1',
        par: 5,
        hint: 'The king is stuck on the first two ranks. Bring your king closer.',
      },
      {
        id: 'box',
        fen: '8/8/8/8/7R/6k1/3K4/8 w - - 0 1',
        par: 8,
        hint: 'Keep the rook out of the king’s reach and walk your king up.',
      },
      {
        id: 'cut-off',
        fen: '8/8/8/2K5/8/8/2k5/3R4 w - - 0 1',
        par: 8,
        hint: 'The king attacks your rook. Move it away, but keep the king boxed in.',
      },
    ],
  },
  {
    id: 'krr-vs-k',
    title: 'Two Rooks vs King',
    skill: 'Mating technique',
    description:
      'The ladder mate: the rooks take turns checking, pushing the king back one rank at a time until it reaches the edge. Your king is not needed.',
    material: 'KRRvK',
    goal: 'mate',
    judging: { slack: 2, extraMoves: 6, depth: 22 },
    positions: [
      {
        id: 'edge',
        fen: '6k1/8/8/8/8/8/R7/1R2K3 w - - 0 1',
        par: 2,
        hint: 'One rook keeps the king on the back rank, the other gives mate.',
      },
      {
        id: 'ladder',
        fen: '8/8/1k6/8/8/3K4/8/R6R w - - 0 1',
        par: 4,
        hint: 'Check with one rook, then the other, and keep them away from the king.',
      },
      {
        id: 'middle',
        fen: '8/8/8/3k4/8/8/8/R3K2R w - - 0 1',
        par: 6,
        hint: 'If the king attacks a rook, move that rook to the far side of the board.',
      },
    ],
  },
  {
    id: 'kbb-vs-k',
    title: 'Two Bishops vs King',
    skill: 'Mating technique',
    description:
      'The bishops side by side make a wall the king cannot cross. Shrink its space step by step, drive it to a corner with your king’s help, and mate there.',
    material: 'KBBvK',
    goal: 'mate',
    judging: { slack: 2, extraMoves: 6, depth: 22 },
    positions: [
      {
        id: 'corner',
        fen: '7k/8/5K2/8/8/8/8/2B2B2 w - - 0 1',
        par: 3,
        hint: 'The king is in the corner already. Beware of stalemate.',
      },
      {
        id: 'edge',
        fen: '6k1/8/4K3/1B6/3B4/8/8/8 w - - 0 1',
        par: 6,
        hint: 'Bring your king next to the corner and use the bishops to take the last squares.',
      },
      {
        id: 'wall',
        fen: '8/8/8/8/2B5/8/3K1B2/1k6 w - - 0 1',
        par: 6,
        hint: 'Your bishops and king keep the king on the edge. Drive it into the corner.',
      },
    ],
  },
  {
    id: 'kbn-vs-k',
    title: 'Bishop and Knight vs King',
    skill: 'Mating technique',
    description:
      'The hardest basic mate: it only works in a corner of the same colour as your bishop. Keep the king on the edge and drive it to the right corner.',
    material: 'KBNvK',
    goal: 'mate',
    judging: { slack: 2, extraMoves: 6, depth: 24 },
    positions: [
      {
        id: 'right-corner',
        fen: 'k7/8/2K5/2N5/8/8/8/5B2 w - - 0 1',
        par: 4,
        hint: 'The king is in the corner your bishop controls. Close the net.',
      },
      {
        id: 'near-corner',
        fen: '1k6/8/1K6/8/3N4/5B2/8/8 w - - 0 1',
        par: 6,
        hint: 'Keep the king from running out along the edge.',
      },
      {
        id: 'on-the-edge',
        fen: '8/8/8/4N3/8/4KB2/8/5k2 w - - 0 1',
        par: 9,
        hint: 'Mate is in the light-squared corner h1. Herd the king towards it.',
      },
    ],
  },
  {
    id: 'kbp-vs-k',
    title: 'Bishop and Rook’s Pawn vs King',
    skill: 'Avoiding stalemate',
    description:
      'A rook’s pawn wins when your bishop controls the corner where it queens. The danger is stalemate: never leave the cornered king without a move unless it is mate.',
    material: 'KBPvK',
    goal: 'mate',
    judging: { slack: 2, extraMoves: 6, depth: 22 },
    positions: [
      {
        id: 'corner-1',
        fen: '7k/8/6KP/8/8/8/8/2B5 w - - 0 1',
        par: 3,
        hint: 'The king is shut in the corner: one careless pawn push is stalemate.',
      },
      {
        id: 'corner-2',
        fen: '6k1/8/6K1/7P/8/8/8/2B5 w - - 0 1',
        par: 4,
        hint: 'Queen the pawn, but leave the king a move until you can mate.',
      },
      {
        id: 'corner-3',
        fen: '7k/8/5K2/7P/8/8/8/4B3 w - - 0 1',
        par: 5,
        hint: 'Bring your king closer before you push.',
      },
    ],
  },
  {
    id: 'kp-vs-k',
    title: 'King and Pawn vs King',
    skill: 'The opposition',
    description:
      'Promote the pawn. Lead with your king, in front of the pawn, and push only when the other king cannot block it.',
    material: 'KPvK',
    goal: 'win',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'sixth-rank',
        fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
        par: 6,
        hint: 'Your king is on the sixth rank in front of the pawn: that wins, whoever is to move.',
      },
      {
        id: 'king-first',
        fen: '3k4/8/8/3K4/3P4/8/8/8 w - - 0 1',
        par: 8,
        hint: 'Get your king to the sixth rank, in front of the pawn, before you push.',
      },
      {
        id: 'far-back',
        fen: '8/8/3k4/8/8/2K5/3P4/8 w - - 0 1',
        par: 10,
        hint: 'The pawn can wait: bring the king up first.',
      },
    ],
  },
  {
    id: 'kq-vs-kp',
    title: 'Queen vs Pawn on the Seventh',
    skill: 'Stopping a pawn',
    description:
      'The pawn is one step from queening. Check or pin until the king has to stand in front of its own pawn, then use that moment to bring your king one step closer.',
    material: 'KQvKP',
    goal: 'win',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'king-near',
        fen: 'Q7/8/8/8/8/8/4p3/2K2k2 w - - 0 1',
        par: 6,
        hint: 'Your king is close: stop the pawn and walk in.',
      },
      {
        id: 'pin',
        fen: '7Q/8/8/8/8/8/K2kp3/8 w - - 0 1',
        par: 8,
        hint: 'Every move must check the king or pin the pawn.',
      },
      {
        id: 'king-far',
        fen: '8/8/8/8/8/8/3pk3/K6Q w - - 0 1',
        par: 10,
        hint: 'Your king is far away, so only checks will do for now.',
      },
    ],
  },
  {
    id: 'kr-vs-kp',
    title: 'Rook vs Pawn',
    skill: 'Rook against a pawn',
    description:
      'Win the pawn before it costs you the rook. The rook alone can only slow the pawn down; your king has to come and take it.',
    material: 'KRvKP',
    goal: 'win',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'blockade',
        fen: '8/8/8/8/8/k7/1p6/1R1K4 w - - 0 1',
        par: 6,
        hint: 'The rook already stops the pawn: bring your king to collect it.',
      },
      {
        id: 'corner',
        fen: '8/8/8/8/8/2k5/2p5/K6R w - - 0 1',
        par: 8,
        hint: 'The pawn is about to queen. Your king and rook must work together.',
      },
      {
        id: 'in-front',
        fen: '8/8/8/8/8/1k6/1p6/1K5R w - - 0 1',
        par: 10,
        hint: 'Your king blocks the pawn. Keep the rook safe and go after the king.',
      },
    ],
  },
  {
    id: 'lucena',
    title: 'Rook and Pawn vs Rook: Lucena',
    skill: 'Rook endgames',
    description:
      'Your pawn is on the seventh rank with your king in front of it. Get the king out, and use the rook to block the checks that follow.',
    material: 'KRPvKR',
    goal: 'win',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'cut-off',
        fen: '3K4/3P1k2/8/8/8/8/2r5/4R3 w - - 0 1',
        par: 8,
        hint: 'Keep the other king cut off while yours gets out from in front of the pawn.',
      },
      {
        id: 'king-far',
        fen: '1K6/1P2k3/8/8/8/8/r7/2R5 w - - 0 1',
        par: 10,
        hint: 'The other king is far away: get yours out and queen.',
      },
      {
        id: 'checks',
        fen: '4K3/4P1k1/8/8/8/8/5r2/3R4 w - - 0 1',
        par: 10,
        hint: 'Step out without walking into endless checks.',
      },
    ],
  },
  {
    id: 'outside-pawn',
    title: 'The Outside Passed Pawn',
    skill: 'Pawn endgames',
    description:
      'Use the pawn far away from the kings as a decoy: while the other king runs to stop it, your king takes the remaining pawns.',
    material: 'KPPvKP',
    goal: 'win',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'blocked',
        fen: '8/8/8/4k3/P3p3/4K3/4P3/8 w - - 0 1',
        par: 8,
        hint: 'Push the a-pawn to lure the king away.',
      },
      {
        id: 'g-pawns',
        fen: '8/8/6k1/6p1/P5P1/4K3/8/8 w - - 0 1',
        par: 10,
        hint: 'The a-pawn is your decoy.',
      },
      {
        id: 'f-pawns',
        fen: '8/8/5k2/5p2/P4P2/4K3/8/8 w - - 0 1',
        par: 10,
        hint: 'Run with the a-pawn, then go after the f-pawn.',
      },
    ],
  },
  {
    id: 'breakthrough',
    title: 'Pawn Breakthrough',
    skill: 'Pawn endgames',
    description:
      'Three pawns against three, with the kings far away: one pawn sacrifice breaks through, and another pawn queens.',
    material: 'KPPPvKPPP',
    goal: 'win',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'queenside',
        fen: '7k/ppp5/8/PPP5/8/8/8/7K w - - 0 1',
        par: 6,
        hint: 'Push the middle pawn first.',
      },
      {
        id: 'kingside',
        fen: 'k7/5ppp/8/5PPP/8/8/8/K7 w - - 0 1',
        par: 6,
        hint: 'The same idea on the other wing.',
      },
      {
        id: 'king-closer',
        fen: '6k1/ppp5/8/PPP5/8/8/8/6K1 w - - 0 1',
        par: 6,
        hint: 'The king is closer here. Only one move wins.',
      },
    ],
  },
  {
    id: 'kp-defend',
    title: 'Defending King vs King and Pawn',
    skill: 'The opposition',
    description:
      'Hold the draw. Stay in front of the pawn and take the opposition: the kings face each other with one square between them, and the other side has to give way.',
    material: 'KvKP',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'only-move',
        fen: '8/8/8/8/4k3/4p3/8/4K3 w - - 0 1',
        par: 6,
        hint: 'Only one move holds: stay directly in front of the pawn.',
      },
      {
        id: 'side-step',
        fen: '8/8/8/8/3kp3/8/8/4K3 w - - 0 1',
        par: 8,
        hint: 'Get in front of the pawn and answer the king with the opposition.',
      },
      {
        id: 'time',
        fen: '8/8/8/4k3/4p3/8/8/4K3 w - - 0 1',
        par: 10,
        hint: 'You have time: stay in front of the pawn and do not wander off.',
      },
    ],
  },
  {
    id: 'rook-pawn',
    title: 'The Rook’s Pawn Draw',
    skill: 'Drawing technique',
    description:
      'A lone pawn on the a- or h-file cannot win if your king reaches the corner in front of it.',
    material: 'KvKP',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'corner',
        fen: '8/8/8/8/8/6kp/8/7K w - - 0 1',
        par: 4,
        hint: 'Only one move keeps the draw. Do not get shut out of the corner.',
      },
      {
        id: 'a-pawn',
        fen: '8/8/8/8/k7/p7/8/2K5 w - - 0 1',
        par: 6,
        hint: 'Head for the corner square in front of the pawn.',
      },
      {
        id: 'walk',
        fen: '8/8/8/6k1/7p/8/8/5K2 w - - 0 1',
        par: 8,
        hint: 'Walk to the corner and stay there.',
      },
    ],
  },
  {
    id: 'square',
    title: 'The Rule of the Square',
    skill: 'Catching a pawn',
    description:
      'Catch the pawn. Picture a square from the pawn to the rank where it queens: if your king can step into that square, it catches the pawn.',
    material: 'KvKP',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'two-steps',
        fen: '8/8/7k/8/8/1p6/8/4K3 w - - 0 1',
        par: 4,
        hint: 'The pawn is two steps from queening: hurry towards it.',
      },
      {
        id: 'three-steps',
        fen: '8/8/8/8/1p6/8/7k/5K2 w - - 0 1',
        par: 5,
        hint: 'Step into the square of the pawn.',
      },
      {
        id: 'four-steps',
        fen: '7k/8/8/p7/8/8/5K2/8 w - - 0 1',
        par: 6,
        hint: 'Count the squares before you move.',
      },
    ],
  },
  {
    id: 'wrong-bishop',
    title: 'The Wrong Bishop',
    skill: 'Drawing technique',
    description:
      'A rook’s pawn with a bishop that cannot cover the corner where it queens is a draw, if your king gets into that corner.',
    material: 'KvKBP',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'run',
        fen: '8/8/8/8/3b1k2/8/7p/5K2 w - - 0 1',
        par: 4,
        hint: 'Get into the corner the bishop cannot reach. Only one move does it.',
      },
      {
        id: 'close',
        fen: '8/8/3b4/8/5k2/7p/8/6K1 w - - 0 1',
        par: 6,
        hint: 'The corner is the light square h1; the bishop runs on dark squares.',
      },
      {
        id: 'stay',
        fen: '8/8/8/2b5/8/6kp/8/6K1 w - - 0 1',
        par: 6,
        hint: 'Go into the corner and stay there.',
      },
    ],
  },
  {
    id: 'philidor',
    title: 'Rook and Pawn vs Rook: Philidor',
    skill: 'Rook endgames',
    description:
      'Hold the draw. Keep your rook on your third rank (the sixth, as Black) so the king cannot come forward. When the pawn steps onto that rank, go to the back rank and check from behind.',
    material: 'KRvKRP',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'set-up',
        fen: '4k3/R7/8/4KP2/8/8/8/1r6 b - - 0 1',
        par: 6,
        hint: 'Bring your rook to the sixth rank.',
      },
      {
        id: 'on-the-sixth',
        fen: '4k3/8/1r6/3KP3/8/8/8/7R b - - 0 1',
        par: 8,
        hint: 'Keep the rook on the sixth rank until the pawn moves up.',
      },
      {
        id: 'wait',
        fen: '4k3/8/r7/4P3/3K4/8/8/7R b - - 0 1',
        par: 10,
        hint: 'Your rook guards the sixth rank. Wait, and keep the king in front of the pawn.',
      },
    ],
  },
  {
    id: 'bishop-vs-rook',
    title: 'Bishop vs Rook',
    skill: 'Drawing technique',
    description:
      'A bishop alone can hold against a rook. Keep your king near the corner of the other colour from your bishop, and keep the bishop out of reach.',
    material: 'KBvKR',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'check',
        fen: '8/8/8/4k3/8/8/5B2/r5K1 w - - 0 1',
        par: 6,
        hint: 'You are in check. Step towards the light corner; blocking with the bishop loses.',
      },
      {
        id: 'safe-corner',
        fen: '8/8/8/8/8/2k5/7r/KB6 w - - 0 1',
        par: 8,
        hint: 'Your king is in the right corner. Keep the bishop where the rook cannot win it.',
      },
      {
        id: 'free-bishop',
        fen: '8/8/8/8/8/4k3/7r/K2B4 w - - 0 1',
        par: 8,
        hint: 'Watch out for rook moves that pin or trap your bishop.',
      },
    ],
  },
  {
    id: 'knight-vs-rook',
    title: 'Knight vs Rook',
    skill: 'Drawing technique',
    description:
      'A knight can hold against a rook if it stays close to its king. Do not let the two get separated, and keep the knight out of the corners.',
    material: 'KNvKR',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'attacked',
        fen: '8/8/8/8/8/2k5/4r3/2K1N3 w - - 0 1',
        par: 6,
        hint: 'Your knight is attacked. Only one move saves it.',
      },
      {
        id: 'together',
        fen: '8/8/8/8/4k3/8/r7/4NK2 w - - 0 1',
        par: 8,
        hint: 'Keep the knight next to your king.',
      },
      {
        id: 'cut-off',
        fen: '8/8/8/3k4/8/1N6/7r/2K5 w - - 0 1',
        par: 8,
        hint: 'The rook tries to cut your king off from the knight. Keep them close.',
      },
    ],
  },
  {
    id: 'opposite-bishops',
    title: 'Opposite-Coloured Bishops',
    skill: 'Drawing technique',
    description:
      'With bishops on opposite colours, two extra pawns are often not enough. Put your king in front of the pawns and stop them on the colour of your bishop.',
    material: 'KBvKBPP',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'split',
        fen: '8/8/8/3k4/3p1p2/8/3KB3/6b1 w - - 0 1',
        par: 6,
        hint: 'Blockade the pawns: your king and bishop stop them together.',
      },
      {
        id: 'b-and-d',
        fen: '8/8/8/2k5/1p1p4/8/2K5/3B2b1 w - - 0 1',
        par: 8,
        hint: 'Your king stops one pawn, your bishop the other.',
      },
      {
        id: 'f-and-g',
        fen: '8/8/4k3/8/5p2/b2K1Bp1/8/8 w - - 0 1',
        par: 8,
        hint: 'Keep the bishop on the long diagonal and the king close to the pawns.',
      },
    ],
  },
  {
    id: 'queen-vs-pawn-draw',
    title: 'Pawn vs Queen: the Stalemate Draw',
    skill: 'Drawing technique',
    description:
      'With a bishop’s pawn on the seventh rank and your king next to it, a lone queen cannot win: if your king hides in the corner, taking the pawn is stalemate.',
    material: 'KPvKQ',
    goal: 'draw',
    judging: { slack: 0, extraMoves: 0, depth: 20 },
    positions: [
      {
        id: 'next-to-it',
        fen: '2K5/2P5/8/8/8/8/2q5/7k w - - 0 1',
        par: 6,
        hint: 'Stay next to your pawn.',
      },
      {
        id: 'f-pawn',
        fen: '8/5PK1/8/8/8/8/8/k4q2 w - - 0 1',
        par: 8,
        hint: 'Protect the pawn, or go to the corner and let the queen take it with stalemate.',
      },
      {
        id: 'c-pawn',
        fen: '8/2PK4/8/8/8/8/8/6kq w - - 0 1',
        par: 8,
        hint: 'Keep your king next to the pawn.',
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
