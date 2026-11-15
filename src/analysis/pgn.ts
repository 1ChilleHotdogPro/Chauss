import { Chess, DEFAULT_POSITION } from 'chess.js';
import { moveNumber } from './pv';

export type PgnImport =
  | { ok: true; headers: Record<string, string>; startFen: string; sans: string[] }
  | { ok: false; error: string };

/** The first game of a text that may hold several (each starting with its own header block). */
function firstGame(text: string): string {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  let seenMoves = false;
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]!.trim();
    if (line.startsWith('[')) {
      if (seenMoves) return lines.slice(0, index).join('\n');
    } else if (line !== '') {
      seenMoves = true;
    }
  }
  return lines.join('\n');
}

/** The move tokens of a movetext, without comments, variations, move numbers, NAGs or the result. */
function moveTokens(movetext: string): string[] {
  let depth = 0;
  let flat = '';
  const text = movetext.replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ');
  for (const char of text) {
    if (char === '(') depth++;
    else if (char === ')') depth = Math.max(0, depth - 1);
    else if (depth === 0) flat += char;
  }
  return flat
    .split(/\s+/)
    .map((token) => token.replace(/^\d+\.+/, ''))
    .filter((token) => token !== '' && !/^\$\d+$/.test(token) && !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(token));
}

/** "move 12" (White) or "move 12..." (Black) for the n-th half-move (0-based) after `startFen`. */
function describePly(index: number, startFen: string): string {
  const blackFirst = startFen.split(' ')[1] === 'b';
  const blackMove = (index % 2 === 1) !== blackFirst;
  return `move ${moveNumber(startFen, index + 1)}${blackMove ? '...' : ''}`;
}

/**
 * Read a game in PGN — as exported by Lichess or chess.com, or typed by hand ("1.e4 e5 2.Nf3").
 * Comments, clock times, variations and annotation marks are ignored; with several games the first
 * one is used. Only standard chess.
 */
export function importPgn(text: string): PgnImport {
  const game = firstGame(text).trim();
  if (game === '') return { ok: false, error: 'Paste a game first.' };

  const chess = new Chess();
  try {
    chess.loadPgn(game);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const illegal = /Invalid move in PGN: (\S+)/.exec(message);
    if (illegal) {
      const headerFen = /\[FEN\s+"([^"]+)"\]/.exec(game)?.[1] ?? DEFAULT_POSITION;
      const movetext = game.replace(/^\s*\[[^\]]*\]\s*$/gm, '');
      // Replay the moves to find the one that fails (the same move may have been legal earlier).
      const replay = new Chess(headerFen);
      const index = moveTokens(movetext).findIndex((token) => {
        try {
          replay.move(token);
          return false;
        } catch {
          return true;
        }
      });
      const where = index >= 0 ? ` (${describePly(index, headerFen)})` : '';
      return { ok: false, error: `"${illegal[1]}" is not a legal move${where}.` };
    }
    return { ok: false, error: 'This does not look like a PGN game.' };
  }

  const headers = Object.fromEntries(
    Object.entries(chess.getHeaders()).filter((entry): entry is [string, string] => typeof entry[1] === 'string'),
  );
  const variant = headers.Variant?.toLowerCase();
  if (variant && variant !== 'standard' && variant !== 'from position') {
    return { ok: false, error: `Only standard chess can be analysed (this game is ${headers.Variant}).` };
  }
  const sans = chess.history();
  if (sans.length === 0) return { ok: false, error: 'The game has no moves.' };
  return { ok: true, headers, startFen: headers.FEN ?? DEFAULT_POSITION, sans };
}
