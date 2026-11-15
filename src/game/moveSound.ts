import type { MoveRecord } from './game';

/** Which sound a move makes. */
export type MoveSound = 'move' | 'capture' | 'checkmate';

/** Checkmate beats capture, which beats an ordinary move. */
export function moveSoundFor(move: Pick<MoveRecord, 'san' | 'captured'>): MoveSound {
  if (move.san.endsWith('#')) return 'checkmate';
  if (move.captured) return 'capture';
  return 'move';
}
