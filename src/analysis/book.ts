import { positionKey, sumCounts, type Snapshot } from '../snapshot/format';

/** Answers "is this move opening theory?" — from the bundled data now, an opening registry later. */
export interface BookLookup {
  isBook(fenBefore: string, uci: string): boolean;
}

/** Book = a move the snapshot lists at that position with at least one master game. */
export function snapshotBook(snapshots: readonly Snapshot[]): BookLookup {
  return {
    isBook(fenBefore, uci) {
      const key = positionKey(fenBefore);
      return snapshots.some((snapshot) => {
        const move = snapshot.nodes[key]?.moves.find((candidate) => candidate.uci === uci);
        return move !== undefined && sumCounts(move.masters) > 0;
      });
    },
  };
}

export const NO_BOOK: BookLookup = { isBook: () => false };
