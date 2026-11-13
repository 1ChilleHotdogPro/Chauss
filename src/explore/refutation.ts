import { Chess } from 'chess.js';
import { formatScore, opposite, sideToMove, type Judgement, type Score } from '../analysis/eval';
import { parseUciMove } from '../analysis/pv';
import type { Side } from '../game/game';

/** What actually happens along an engine line — plain facts, read off the moves themselves. */
export interface LineFacts {
  /** The line in normal notation (as far as it is legal). */
  sans: string[];
  /** Pieces each side captured along the line, as letters: p, n, b, r, q. */
  capturedBy: Record<Side, string[]>;
  /** Pawns each side promoted along the line, as the letter of the new piece. */
  promotedBy: Record<Side, string[]>;
  /** True if the last move of the line is checkmate. */
  endsInMate: boolean;
}

const VALUE: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9 };
const NAME: Record<string, string> = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen' };
const PLURAL: Record<string, string> = { p: 'pawns', n: 'knights', b: 'bishops', r: 'rooks', q: 'queens' };
const NUMBER_WORDS = ['no', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];

/** Play an engine line (moves like "g1f3") from a position and record what is captured and promoted. */
export function lineFacts(fen: string, pv: readonly string[]): LineFacts {
  const facts: LineFacts = {
    sans: [],
    capturedBy: { white: [], black: [] },
    promotedBy: { white: [], black: [] },
    endsInMate: false,
  };
  let chess: Chess;
  try {
    chess = new Chess(fen);
  } catch {
    return facts;
  }
  for (const uci of pv) {
    const parsed = parseUciMove(uci);
    if (!parsed) break;
    let move;
    try {
      move = chess.move(parsed);
    } catch {
      break;
    }
    const side: Side = move.color === 'w' ? 'white' : 'black';
    facts.sans.push(move.san);
    if (move.captured) facts.capturedBy[side].push(move.captured);
    if (move.promotion) facts.promotedBy[side].push(move.promotion);
  }
  facts.endsInMate = facts.sans.length > 0 && chess.isCheckmate();
  return facts;
}

/** "a knight", "two pawns", "a queen and a rook" — biggest pieces first. */
export function describePieces(pieces: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const piece of pieces) counts.set(piece, (counts.get(piece) ?? 0) + 1);
  const parts = ['q', 'r', 'b', 'n', 'p']
    .filter((piece) => counts.has(piece))
    .map((piece) => {
      const count = counts.get(piece)!;
      return count === 1 ? `a ${NAME[piece]}` : `${NUMBER_WORDS[count] ?? count} ${PLURAL[piece]}`;
    });
  if (parts.length <= 1) return parts[0] ?? '';
  return `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}`;
}

/** Remove pieces both sides lost alike (a knight for a knight is just a trade). */
function cancelTrades(mine: readonly string[], theirs: readonly string[]): [string[], string[]] {
  const a = [...mine];
  const b = [...theirs];
  for (let i = a.length - 1; i >= 0; i--) {
    const j = b.indexOf(a[i]!);
    if (j >= 0) {
      a.splice(i, 1);
      b.splice(j, 1);
    }
  }
  return [a, b];
}

const total = (pieces: readonly string[]): number => pieces.reduce((sum, piece) => sum + (VALUE[piece] ?? 0), 0);

/**
 * One plain sentence on why a bad move is bad, built only from facts: the engine's score and
 * what happens along its best line. In order of preference:
 *   1. a forced checkmate;
 *   2. material won along the line — but only when the engine's score agrees that much is really
 *      won (a line can stop in the middle of an exchange);
 *   3. otherwise the score and the change in winning chances.
 *
 * @param fen   the position after the bad move (the punisher is to move)
 * @param pv    the engine's best line from there, in engine spelling
 * @param score the engine's score of that position, from White's point of view
 */
export function explainRefutation(input: {
  fen: string;
  pv: readonly string[];
  score: Score;
  /** The verdict on the bad move, if known: used for the winning-chances numbers. */
  judgement?: Pick<Judgement, 'winBefore' | 'winAfter'> | undefined;
}): string {
  const { fen, pv, score, judgement } = input;
  const punisher = sideToMove(fen);
  const victim = opposite(punisher);
  const who = punisher === 'white' ? 'White' : 'Black';

  if (score.type === 'mate' && score.winner === punisher) {
    if (score.moves <= 1) return `${who} gives checkmate at once.`;
    return `${who} has a forced checkmate in ${score.moves} moves.`;
  }

  const facts = lineFacts(fen, pv);
  // A promotion turns a pawn into a piece: count the gain, and the pawn that is no longer a pawn.
  const promotionGain = (side: Side): number =>
    facts.promotedBy[side].reduce((sum, piece) => sum + (VALUE[piece] ?? 0) - 1, 0);
  const net =
    total(facts.capturedBy[punisher]) + promotionGain(punisher) - total(facts.capturedBy[victim]) - promotionGain(victim);

  if (score.type === 'cp') {
    const pawnsAhead = (punisher === 'white' ? score.value : -score.value) / 100;
    // Trust the material story only if the score backs it: within a pawn and a half of what was won.
    if (net >= 1 && pawnsAhead >= net - 1.5) {
      const [won, lost] = cancelTrades(facts.capturedBy[punisher], facts.capturedBy[victim]);
      const promoted = facts.promotedBy[punisher];
      // When the score is worth far more than the material in the line, say so: the line shown
      // is only the start of the trouble.
      const more = pawnsAhead - net >= 2 ? ` Stockfish rates the position ${formatScore(score)}.` : '';
      if (won.length > 0) {
        const forWhat = lost.length > 0 ? ` for ${describePieces(lost)}` : '';
        const andPromotes = promoted.length > 0 ? ' and promotes a pawn' : '';
        return `${who} wins ${describePieces(won)}${forWhat}${andPromotes}.${more}`;
      }
      if (promoted.length > 0) return `${who} promotes a pawn.${more}`;
    }
  }

  const chances =
    judgement !== undefined
      ? ` ${punisher === 'white' ? 'Black' : 'White'}'s winning chances fall from ${Math.round(judgement.winBefore)}% to ${Math.round(judgement.winAfter)}%.`
      : '';
  return `No immediate material win, but Stockfish rates the position ${formatScore(score)}.${chances}`;
}
