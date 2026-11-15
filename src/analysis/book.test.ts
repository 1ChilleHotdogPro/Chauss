import { describe, expect, it } from 'vitest';
import type { Snapshot, SnapshotMove } from '../snapshot/format';
import { NO_BOOK, snapshotBook } from './book';

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const KEY = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq -';

function move(uci: string, masters: number): SnapshotMove {
  return { uci, san: uci, masters: [masters, 0, 0], lichess: [10, 0, 0] };
}

// Only the fields the lookup reads; the rest of a snapshot does not matter here.
const snapshot = {
  rootKey: KEY,
  nodes: {
    [KEY]: { fen: START, ply: 0, kind: 'prelude', masters: [1, 0, 0], lichess: [1, 0, 0], moves: [move('e2e4', 5), move('g2g4', 0)] },
  },
} as unknown as Snapshot;

describe('snapshotBook', () => {
  it('counts a move as book when masters played it there', () => {
    const book = snapshotBook([snapshot]);
    expect(book.isBook(START, 'e2e4')).toBe(true);
    // Same position, other move counters: still found.
    expect(book.isBook(START.replace(' 0 1', ' 3 9'), 'e2e4')).toBe(true);
  });

  it('does not count moves only club players play, unknown moves or unknown positions', () => {
    const book = snapshotBook([snapshot]);
    expect(book.isBook(START, 'g2g4')).toBe(false);
    expect(book.isBook(START, 'd2d4')).toBe(false);
    expect(book.isBook('8/8/8/8/8/8/8/k6K w - - 0 1', 'h1g1')).toBe(false);
    expect(NO_BOOK.isBook(START, 'e2e4')).toBe(false);
  });
});
