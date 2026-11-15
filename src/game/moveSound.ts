import type { MoveRecord } from './game';

/** Which sound a move makes. */
export type MoveSound = 'move' | 'capture' | 'check' | 'castle' | 'checkmate';

/** Checkmate beats capture, which beats check, castling and an ordinary move. */
export function moveSoundFor(move: Pick<MoveRecord, 'san' | 'captured'>): MoveSound {
  if (move.san.endsWith('#')) return 'checkmate';
  if (move.captured) return 'capture';
  if (move.san.endsWith('+')) return 'check';
  if (move.san.startsWith('O-O')) return 'castle';
  return 'move';
}
