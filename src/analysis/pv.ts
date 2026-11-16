import { Chess } from 'chess.js';
import type { PromotionPiece } from '../game/game';

export interface UciMove {
  from: string;
  to: string;
  promotion?: PromotionPiece;
}

/** Split an engine move like "g1f3" or "a7a8q" into its parts. Returns null if it is malformed. */
export function parseUciMove(uci: string): UciMove | null {
  const match = /^([a-h][1-8])([a-h][1-8])([qrbn])?$/.exec(uci);
  if (!match) return null;
  const move: UciMove = { from: match[1]!, to: match[2]! };
  if (match[3]) move.promotion = match[3] as PromotionPiece;
  return move;
}

/** The engine's spelling of a move: from-square, to-square, promotion piece. */
export function toUci(move: UciMove): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

/**
 * Turn the engine's moves ("g1f3", "e7e5") into normal notation ("Nf3", "e5"), starting from
 * `fen`. Stops quietly at the first move that is not legal, returning what it has so far.
 */
export function pvToSan(fen: string, pv: readonly string[], maxPlies = Infinity): string[] {
  const sans: string[] = [];
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return sans;
  }
  for (const uci of pv) {
    if (sans.length >= maxPlies) break;
    const move = parseUciMove(uci);
    if (!move) break;
    try {
      sans.push(chess.move(move).san);
    } catch {
      break;
    }
  }
  return sans;
}

/** The move number of half-move `ply` (1 = the first move played from `startFen`). */
export function moveNumber(startFen: string, ply: number): number {
  const fields = startFen.split(' ');
  const offset = fields[1] === 'b' ? 1 : 0;
  return (Number(fields[5]) || 1) + Math.floor((ply - 1 + offset) / 2);
}

/**
 * Add move numbers to a list of moves that starts from `fen`:
 * "3. Bc4 Nf6 4. Qxf7#", or "3... Nf6 4. Qxf7#" when Black moves first.
 */
export function numberedLine(fen: string, sans: readonly string[]): string {
  const fields = fen.split(' ');
  let white = fields[1] !== 'b';
  let number = Number(fields[5]) || 1;
  const parts: string[] = [];
  sans.forEach((san, index) => {
    if (white) parts.push(`${number}. ${san}`);
    else {
      parts.push(index === 0 ? `${number}... ${san}` : san);
      number += 1;
    }
    white = !white;
  });
  return parts.join(' ');
}

/**
 * Split a numbered line into the pieces that must stay on one line when it wraps: each move, with its
 * move number when it has one. "3... Nf6 4. O-O-O d5" -> ["3... Nf6", "4. O-O-O", "d5"].
 * Joining the pieces with spaces gives the line back.
 */
export function sanGroups(line: string): string[] {
  const tokens = line.split(' ').filter((token) => token !== '');
  const groups: string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    const next = tokens[i + 1];
    if (/^\d+\.+$/.test(token) && next !== undefined) {
      groups.push(`${token} ${next}`);
      i += 1;
    } else {
      groups.push(token);
    }
  }
  return groups;
}
