import type { Key, Piece, Pieces } from '@lichess-org/chessground/types';

/**
 * Several premoves in a row: each queued move is shown on the board at once (the piece stands on its new
 * square and can be premoved again from there), and they are played one per turn, in order.
 * Pure board bookkeeping; whether a queued move is legal is only known when its turn comes.
 */
export interface QueuedMove {
  from: string;
  to: string;
}

/**
 * The move as it will be played. A king premoved onto its own rook castles (chessground offers that
 * square), which is the king's two-square move in the game's move list.
 */
export function normalisePremove(pieces: Pieces, from: string, to: string): QueuedMove {
  const piece = pieces.get(from as Key);
  const target = pieces.get(to as Key);
  if (
    piece?.role === 'king' &&
    target?.role === 'rook' &&
    target.color === piece.color &&
    from[1] === to[1] &&
    from[0] === 'e'
  ) {
    return { from, to: `${to < from ? 'c' : 'g'}${from[1]}` };
  }
  return { from, to };
}

/** The pieces after the queued moves, as the board shows them while the opponent is to move. */
export function applyPremoves(pieces: Pieces, queue: readonly QueuedMove[]): Pieces {
  const result: Pieces = new Map(pieces);
  for (const move of queue) {
    const piece = result.get(move.from as Key);
    if (!piece) continue;
    let moved: Piece = piece;
    // Castling: the rook jumps over the king.
    if (piece.role === 'king' && move.from[0] === 'e' && (move.to[0] === 'g' || move.to[0] === 'c')) {
      const rank = move.from[1];
      const [rookFrom, rookTo] = move.to[0] === 'g' ? [`h${rank}`, `f${rank}`] : [`a${rank}`, `d${rank}`];
      const rook = result.get(rookFrom as Key);
      if (rook?.role === 'rook' && rook.color === piece.color) {
        result.delete(rookFrom as Key);
        result.set(rookTo as Key, rook);
      }
    }
    // A pawn premoved to the last rank becomes a queen (as a premove cannot ask which piece).
    if (piece.role === 'pawn' && (move.to[1] === '8' || move.to[1] === '1')) moved = { ...piece, role: 'queen' };
    result.delete(move.from as Key);
    result.set(move.to as Key, moved);
  }
  return result;
}

/** The squares to mark on the board: every queued move's start and end. */
export function queuedSquares(queue: readonly QueuedMove[]): Map<Key, string> {
  const squares = new Map<Key, string>();
  for (const move of queue) {
    squares.set(move.from as Key, 'current-premove');
    squares.set(move.to as Key, 'current-premove');
  }
  return squares;
}
