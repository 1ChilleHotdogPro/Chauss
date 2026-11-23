import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Sicilian Defence. Each one is backed by checks against the
 * bundled data (see ideas.ts): every number and claim in a text has a check, and a remark whose
 * checks fail is not shown. Percentages are checked to the whole percent shown; scores to one
 * decimal, from White's point of view.
 *
 * Drafted by scripts/draft-ideas.ts from the snapshot of 23 Nov 2026 (Lichess 1000-1399,
 * blitz/rapid/classical; Stockfish 19 Lite WASM, depth 18) and read
 * through by hand — not written from memory.
 */
export const IDEAS: readonly Idea[] = [
  {
    line: ['e4', 'c5'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.Nf3 (44%) and 2.Bc4 (17%); it is also the masters’ choice (83%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'c5'], san: 'Nf3' },
      { kind: 'popular-share', line: ['e4', 'c5'], san: 'Nf3', min: 0.435, max: 0.445 },
      { kind: 'popular-share', line: ['e4', 'c5'], san: 'Bc4', min: 0.165, max: 0.175 },
      { kind: 'book-top', line: ['e4', 'c5'], san: 'Nf3' },
      { kind: 'book-share', line: ['e4', 'c5'], san: 'Nf3', min: 0.825, max: 0.835 },
    ],
  },
  {
    line: ['e4', 'c5', 'Nf3'],
    text:
      'Against 2.Nf3, masters play 2...d6 in 46% of their games; Stockfish scores it +0.4 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'c5', 'Nf3'], san: 'd6' },
      { kind: 'book-share', line: ['e4', 'c5', 'Nf3'], san: 'd6', min: 0.455, max: 0.465 },
      { kind: 'move-score', line: ['e4', 'c5', 'Nf3'], san: 'd6', min: 0.35, max: 0.45 },
    ],
  },
  {
    line: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5', 'Nd5', 'Be7'],
    text:
      'After 2.Nf3 Nc6 3.d4 cxd4 4.Nxd4 Nf6 5.Nc3 e5 6.Ndb5 d6 7.Bg5 a6 8.Na3 b5 9.Nd5 Be7, 10.c4? is played in 5% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +3.4 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5', 'Nd5', 'Be7'], san: 'c4', min: 0.045, max: 0.055 },
      { kind: 'flagged', line: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5', 'Nd5', 'Be7'], san: 'c4', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'c5', 'Nf3', 'Nc6', 'd4', 'cxd4', 'Nxd4', 'Nf6', 'Nc3', 'e5', 'Ndb5', 'd6', 'Bg5', 'a6', 'Na3', 'b5', 'Nd5', 'Be7'], san: 'c4', min: -3.45, max: -3.35 },
    ],
  },
];
