/**
 * Reading the text an engine sends back over UCI (the standard chess-engine protocol).
 *
 * Example line:
 *   info depth 12 seldepth 20 multipv 1 score cp 31 nodes 74428 nps 865441 time 86 pv e2e4 e7e5
 */

/** A score from the point of view of the side to move. */
export type UciScore =
  | { type: 'cp'; value: number } // centipawns: 100 = one pawn ahead
  | { type: 'mate'; value: number }; // mate in N moves (negative: getting mated; 0: already mated)

export interface InfoLine {
  depth: number;
  /** Which line this is when the engine reports several: 1 = best. */
  multipv: number;
  score: UciScore;
  /** Set when the score is only a bound from an unfinished search, not an exact value. */
  bound?: 'lower' | 'upper';
  /** The expected moves, e.g. ["e2e4", "e7e5"]. Empty when the game is over. */
  pv: string[];
  nodes?: number;
  timeMs?: number;
}

export interface BestMove {
  /** e.g. "e2e4", or null when there is no legal move (mate or stalemate). */
  move: string | null;
}

function toInt(token: string | undefined): number | undefined {
  if (token === undefined || !/^-?\d+$/.test(token)) return undefined;
  return Number(token);
}

/** Parse an "info ..." line. Returns null for lines that carry no score (e.g. "info string ..."). */
export function parseInfo(line: string): InfoLine | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'info') return null;

  let depth: number | undefined;
  let multipv = 1;
  let score: UciScore | undefined;
  let bound: 'lower' | 'upper' | undefined;
  let nodes: number | undefined;
  let timeMs: number | undefined;
  let pv: string[] = [];

  for (let i = 1; i < tokens.length; i++) {
    switch (tokens[i]) {
      case 'string':
        return null; // free text for humans
      case 'depth':
        depth = toInt(tokens[++i]);
        break;
      case 'multipv':
        multipv = toInt(tokens[++i]) ?? 1;
        break;
      case 'nodes':
        nodes = toInt(tokens[++i]);
        break;
      case 'time':
        timeMs = toInt(tokens[++i]);
        break;
      case 'score': {
        const kind = tokens[++i];
        const value = toInt(tokens[++i]);
        if ((kind === 'cp' || kind === 'mate') && value !== undefined) score = { type: kind, value };
        if (tokens[i + 1] === 'lowerbound') {
          bound = 'lower';
          i++;
        } else if (tokens[i + 1] === 'upperbound') {
          bound = 'upper';
          i++;
        }
        break;
      }
      case 'pv':
        pv = tokens.slice(i + 1);
        i = tokens.length;
        break;
      default:
        break; // seldepth, nps, hashfull, ... : the value token is skipped harmlessly
    }
  }

  if (depth === undefined || score === undefined) return null;
  const info: InfoLine = { depth, multipv, score, pv };
  if (bound) info.bound = bound;
  if (nodes !== undefined) info.nodes = nodes;
  if (timeMs !== undefined) info.timeMs = timeMs;
  return info;
}

/** Parse a "bestmove ..." line, which ends every search. Returns null for other lines. */
export function parseBestMove(line: string): BestMove | null {
  const tokens = line.trim().split(/\s+/);
  if (tokens[0] !== 'bestmove') return null;
  const move = tokens[1];
  return { move: move && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(move) ? move : null };
}
