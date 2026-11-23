import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Petrov Defence. Each one is backed by checks against the
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
    line: ['e4', 'e5', 'Nf3', 'Nf6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 3.Nc3 (33%) and 3.Nxe5 (32%); masters mostly play 3.Nxe5 (68%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'e5', 'Nf3', 'Nf6'], san: 'Nc3' },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nf6'], san: 'Nc3', min: 0.325, max: 0.335 },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nf6'], san: 'Nxe5', min: 0.315, max: 0.325 },
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nf6'], san: 'Nxe5' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nf6'], san: 'Nxe5', min: 0.675, max: 0.685 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3'],
    text:
      'Against 3.Nc3, masters play 3...Nc6 in 75% of their games; Stockfish scores it +0.1 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3'], san: 'Nc6' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3'], san: 'Nc6', min: 0.745, max: 0.755 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3'], san: 'Nc6', min: 0.05, max: 0.15 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5'],
    text:
      'Against 3.Nxe5, masters play 3...d6 in 98% of their games; Stockfish scores it +0.5 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5'], san: 'd6' },
      { kind: 'book-share', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5'], san: 'd6', min: 0.975, max: 0.985 },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nxe5'], san: 'd6', min: 0.45, max: 0.55 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3', 'Bb4', 'Nxe5', 'O-O'],
    text:
      'After 3.Nc3 Bb4 4.Nxe5 O-O, 5.Nd5?? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +3.8 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3', 'Bb4', 'Nxe5', 'O-O'], san: 'Nd5', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3', 'Bb4', 'Nxe5', 'O-O'], san: 'Nd5', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nf6', 'Nc3', 'Bb4', 'Nxe5', 'O-O'], san: 'Nd5', min: -3.85, max: -3.75 },
    ],
  },
  {
    line: ['e4', 'e5', 'Nf3', 'Nf6', 'd4', 'Nxe4', 'dxe5', 'd5'],
    text:
      'After 3.d4 Nxe4 4.dxe5 d5, 5.Bg5?? is played in 4% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +6.6 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'e5', 'Nf3', 'Nf6', 'd4', 'Nxe4', 'dxe5', 'd5'], san: 'Bg5', min: 0.035, max: 0.045 },
      { kind: 'flagged', line: ['e4', 'e5', 'Nf3', 'Nf6', 'd4', 'Nxe4', 'dxe5', 'd5'], san: 'Bg5', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'e5', 'Nf3', 'Nf6', 'd4', 'Nxe4', 'dxe5', 'd5'], san: 'Bg5', min: -6.65, max: -6.55 },
    ],
  },
];
