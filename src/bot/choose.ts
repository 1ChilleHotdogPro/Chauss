import { Chess } from 'chess.js';
import type { ExploreMove, ExplorePosition } from '../explore/position';
import type { Trap } from '../explore/traps';
import { positionKey } from '../snapshot/format';

/**
 * How the bot picks Black's moves while the opening data lasts:
 *  - realistic: like players at the chosen level — each move as often as they play it;
 *  - punish: prefers the moves that give something away, so you practise punishing them.
 */
export type BotStyle = 'realistic' | 'punish';

/** Why the bot played its move (for the message under the board). */
export type BotReason =
  /** Picked by how often it is played (realistic style, or nothing better to aim for). */
  | 'popular'
  /** A move Stockfish calls a mistake or a blunder, which people at this level do play. */
  | 'mistake'
  /** On the way to a position where a common mistake happens (a trap from the traps list). */
  | 'trap-route'
  /** Only a small slip (an inaccuracy) was available. */
  | 'inaccuracy';

export interface BotChoice {
  move: ExploreMove;
  reason: BotReason;
}

/** Position key -> Black moves (engine spelling) that head for a known trap from there. */
export type TrapRoutes = ReadonlyMap<string, ReadonlySet<string>>;

/**
 * For every trap in which Black is the one who errs, the Black moves along its line, and the bad
 * move itself. Positions are keyed by position (not by move order), so a transposition counts too.
 */
export function trapRoutes(traps: readonly Trap[]): TrapRoutes {
  const routes = new Map<string, Set<string>>();
  const add = (fen: string, uci: string): void => {
    const key = positionKey(fen);
    let set = routes.get(key);
    if (!set) routes.set(key, (set = new Set()));
    set.add(uci);
  };

  for (const trap of traps) {
    if (trap.kind !== 'exploit') continue;
    const chess = new Chess();
    let complete = true;
    for (const san of trap.line) {
      const before = chess.fen();
      let move;
      try {
        move = chess.move(san);
      } catch {
        complete = false;
        break;
      }
      if (move.color === 'b') add(before, move.from + move.to + (move.promotion ?? ''));
    }
    if (complete) add(trap.fen, trap.move.uci);
  }
  return routes;
}

export interface PickOptions {
  /** In the punish style, a move must be played in at least this share of games (0-1) to be preferred. */
  minShare?: number;
}

/** Draw one move, each with a chance in proportion to its number of games. */
function weighted(moves: readonly ExploreMove[], random: () => number): ExploreMove {
  const total = moves.reduce((sum, move) => sum + (move.popular?.games ?? 0), 0);
  let ticket = random() * total;
  for (const move of moves) {
    ticket -= move.popular?.games ?? 0;
    if (ticket < 0) return move;
  }
  return moves.at(-1)!;
}

/**
 * Black's move in a position of the opening data, or null when the data has no move that people
 * at the chosen level play here (the game has left the known tree).
 *
 * Only moves that really are played at the chosen level are considered (the "Popular at your
 * level" list). The punish style goes through these groups and takes the first that is not empty:
 * mistakes and blunders, then moves towards a known trap, then inaccuracies, then any move. Within
 * a group, more popular moves are more likely. `random` returns a number in [0, 1).
 */
export function pickBlackMove(
  position: ExplorePosition,
  style: BotStyle,
  routes: TrapRoutes,
  random: () => number = Math.random,
  options: PickOptions = {},
): BotChoice | null {
  if (position.mover !== 'black') return null;
  const played = position.popularMoves.filter((move) => (move.popular?.games ?? 0) > 0);
  if (played.length === 0) return null;

  if (style === 'punish') {
    const minShare = options.minShare ?? 0.01;
    const common = played.filter((move) => (move.popular?.share ?? 0) >= minShare);
    const route = routes.get(positionKey(position.fen));
    const groups: [BotReason, ExploreMove[]][] = [
      ['mistake', common.filter((move) => move.flag === 'mistake' || move.flag === 'blunder')],
      ['trap-route', common.filter((move) => route?.has(move.uci) ?? false)],
      ['inaccuracy', common.filter((move) => move.flag === 'inaccuracy')],
    ];
    for (const [reason, group] of groups) {
      if (group.length > 0) return { move: weighted(group, random), reason };
    }
  }
  return { move: weighted(played, random), reason: 'popular' };
}
