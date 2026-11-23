import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the Alekhine's Defence. Each one is backed by checks against the
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
    line: ['e4', 'Nf6'],
    text:
      'In Lichess games rated 1000–1399, the usual replies here are 2.Nc3 (41%) and 2.e5 (27%); masters mostly play 2.e5 (85%).',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-top', line: ['e4', 'Nf6'], san: 'Nc3' },
      { kind: 'popular-share', line: ['e4', 'Nf6'], san: 'Nc3', min: 0.405, max: 0.415 },
      { kind: 'popular-share', line: ['e4', 'Nf6'], san: 'e5', min: 0.265, max: 0.275 },
      { kind: 'book-top', line: ['e4', 'Nf6'], san: 'e5' },
      { kind: 'book-share', line: ['e4', 'Nf6'], san: 'e5', min: 0.845, max: 0.855 },
    ],
  },
  {
    line: ['e4', 'Nf6', 'Nc3'],
    text:
      'Against 2.Nc3, masters play 2...d5 in 67% of their games; Stockfish scores it +0.3 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'Nf6', 'Nc3'], san: 'd5' },
      { kind: 'book-share', line: ['e4', 'Nf6', 'Nc3'], san: 'd5', min: 0.665, max: 0.675 },
      { kind: 'move-score', line: ['e4', 'Nf6', 'Nc3'], san: 'd5', min: 0.25, max: 0.35 },
    ],
  },
  {
    line: ['e4', 'Nf6', 'e5'],
    text:
      'Against 2.e5, masters play 2...Nd5 in 99% of their games; Stockfish scores it +0.7 for White.',
    checks: [
      { kind: 'book-top', line: ['e4', 'Nf6', 'e5'], san: 'Nd5' },
      { kind: 'book-share', line: ['e4', 'Nf6', 'e5'], san: 'Nd5', min: 0.985, max: 0.995 },
      { kind: 'move-score', line: ['e4', 'Nf6', 'e5'], san: 'Nd5', min: 0.65, max: 0.75 },
    ],
  },
  {
    line: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'Nc6', 'c4', 'Nb6'],
    text:
      'After 2.e5 Nd5 3.d4 d6 4.Nf3 Nc6 5.c4 Nb6, 6.c5? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a mistake: +1.1 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'Nc6', 'c4', 'Nb6'], san: 'c5', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'Nc6', 'c4', 'Nb6'], san: 'c5', atLeast: 'mistake' },
      { kind: 'move-score', line: ['e4', 'Nf6', 'e5', 'Nd5', 'd4', 'd6', 'Nf3', 'Nc6', 'c4', 'Nb6'], san: 'c5', min: -1.15, max: -1.05 },
    ],
  },
  {
    line: ['e4', 'Nf6', 'Nc3', 'd5', 'exd5', 'Nxd5', 'Bc4', 'Nb6'],
    text:
      'After 2.Nc3 d5 3.exd5 Nxd5 4.Bc4 Nb6, 5.Qf3?? is played in 8% of Lichess games rated 1000–1399, and Stockfish calls it a blunder: +5.6 for Black.',
    checks: [
      { kind: 'ratings', line: [], ratings: [1000, 1200] },
      { kind: 'popular-share', line: ['e4', 'Nf6', 'Nc3', 'd5', 'exd5', 'Nxd5', 'Bc4', 'Nb6'], san: 'Qf3', min: 0.075, max: 0.085 },
      { kind: 'flagged', line: ['e4', 'Nf6', 'Nc3', 'd5', 'exd5', 'Nxd5', 'Bc4', 'Nb6'], san: 'Qf3', atLeast: 'blunder' },
      { kind: 'move-score', line: ['e4', 'Nf6', 'Nc3', 'd5', 'exd5', 'Nxd5', 'Bc4', 'Nb6'], san: 'Qf3', min: -5.65, max: -5.55 },
    ],
  },
];
