import { Chess, validateFen } from 'chess.js';

export type FenInputResult = { ok: true; fen: string } | { ok: false; error: string };

/** The squares a castling letter needs: the king and that rook on their starting squares. */
const CASTLING_NEEDS: Record<string, [string, string, string]> = {
  K: ['e1', 'h1', 'w'],
  Q: ['e1', 'a1', 'w'],
  k: ['e8', 'h8', 'b'],
  q: ['e8', 'a8', 'b'],
};

/**
 * Read a position code (FEN) typed or pasted by the user. Forgiving about the parts a beginner may leave
 * off: only the piece placement is needed (then White is to move, no castling, no en passant). Castling
 * rights the position cannot have are dropped. Refuses positions that cannot occur in a game, with one
 * short sentence saying why.
 */
export function parseFenInput(text: string): FenInputResult {
  const fields = text.trim().split(/\s+/).filter(Boolean);
  if (fields.length === 0) return { ok: false, error: 'Paste a position code (FEN) first.' };
  const defaults = ['w', '-', '-', '0', '1'];
  while (fields.length < 6) fields.push(defaults[fields.length - 1]!);
  if (fields.length > 6) return { ok: false, error: 'A FEN has at most six parts separated by spaces.' };

  const check = validateFen(fields.join(' '));
  if (!check.ok) return { ok: false, error: friendly(check.error ?? '') };

  let chess = new Chess(fields.join(' '));
  // Keep only the castling rights whose king and rook are still at home.
  const castling = [...fields[2]!]
    .filter((letter) => {
      const needs = CASTLING_NEEDS[letter];
      if (!needs) return false;
      const [kingSquare, rookSquare, color] = needs;
      const king = chess.get(kingSquare as never);
      const rook = chess.get(rookSquare as never);
      return king?.type === 'k' && king.color === color && rook?.type === 'r' && rook.color === color;
    })
    .join('');
  fields[2] = castling || '-';
  chess = new Chess(fields.join(' '));

  // The side that just moved cannot have left its own king in check.
  const flipped = [...fields];
  flipped[1] = fields[1] === 'w' ? 'b' : 'w';
  flipped[3] = '-';
  if (new Chess(flipped.join(' ')).inCheck()) {
    const waiting = fields[1] === 'w' ? 'Black' : 'White';
    return { ok: false, error: `${waiting} is in check but it is not ${waiting}'s move, so this position cannot happen.` };
  }
  return { ok: true, fen: chess.fen() };
}

/** chess.js's messages, said the way the rest of the app talks. */
function friendly(error: string): string {
  const reason = error.replace(/^Invalid FEN:\s*/, '');
  if (/king/.test(reason)) return `Each side needs exactly one king (${reason}).`;
  if (/edge rows/.test(reason)) return 'Pawns cannot stand on the first or last row.';
  if (/rows|squares in rank|piece data/.test(reason))
    return 'The pieces part should be 8 rows of 8 squares, separated by "/".';
  return `This is not a valid position code: ${reason}.`;
}
