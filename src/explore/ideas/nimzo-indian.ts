import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Nimzo-Indian Defence. Each one is backed by checks against the
 * bundled data (see ideas.ts): every number and claim in a text has a check, and a remark whose
 * checks fail is not shown. Percentages are checked to the whole percent shown; scores to one
 * decimal, from White's point of view.
 *
 * Drafted by scripts/draft-ideas.ts from the snapshot of 24 Nov 2026 (Lichess 1000-1399,
 * blitz/rapid/classical; Stockfish 19 Lite WASM, depth 18) and read
 * through by hand — not written from memory.
 */
export const IDEAS: readonly Idea[] = [
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 4.Bd2 (31%) and 4.Nf3 (16%); masters mostly play 4.e3 (41%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], san: 'Bd2' },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], san: 'Bd2', min: 0.305, max: 0.315 },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], san: 'Nf3', min: 0.155, max: 0.165 },
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], san: 'e3' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'], san: 'e3', min: 0.405, max: 0.415 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Nf3'],
    text:
      'Against 4.Nf3, masters play 4...b6 in 36% of their games; Stockfish scores it +0.2 for White.',
    checks: [
      { kind: 'book-top', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Nf3'], san: 'b6' },
      { kind: 'book-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Nf3'], san: 'b6', min: 0.355, max: 0.365 },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Nf3'], san: 'b6', min: 0.15, max: 0.25 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'Nc6'],
    text:
      'After 4.Qc2 Nc6, 5.Bg5? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.8 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'Nc6'], san: 'Bg5', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'Nc6'], san: 'Bg5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'Nc6'], san: 'Bg5', min: -1.85, max: -1.75 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'b6', 'Bd3', 'Bb7'],
    text:
      'After 4.e3 b6 5.Bd3 Bb7, 6.Bd2?? is played in 24% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +4.6 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'b6', 'Bd3', 'Bb7'], san: 'Bd2', min: 0.235, max: 0.245 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'b6', 'Bd3', 'Bb7'], san: 'Bd2', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'e3', 'b6', 'Bd3', 'Bb7'], san: 'Bd2', min: -4.65, max: -4.55 },
    ],
  },
  {
    line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3', 'b6', 'Bg5', 'Bb7', 'e3', 'd6'],
    text:
      'After 4.Qc2 O-O 5.a3 Bxc3+ 6.Qxc3 b6 7.Bg5 Bb7 8.e3 d6, 9.Bd3?? is played in 14% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +4.3 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3', 'b6', 'Bg5', 'Bb7', 'e3', 'd6'], san: 'Bd3', min: 0.135, max: 0.145 },
      { kind: 'flagged', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3', 'b6', 'Bg5', 'Bb7', 'e3', 'd6'], san: 'Bd3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4', 'Qc2', 'O-O', 'a3', 'Bxc3+', 'Qxc3', 'b6', 'Bg5', 'Bb7', 'e3', 'd6'], san: 'Bd3', min: -4.35, max: -4.25 },
    ],
  },
];
