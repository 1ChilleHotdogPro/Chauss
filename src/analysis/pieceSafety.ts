/*
 * Piece safety, trapped pieces and "danger levels": the board checks behind the brilliant and
 * great move classifications.
 *
 * Adapted from WintrChess by WintrCat (https://github.com/WintrCat/wintrchess),
 * shared/src/lib/reporter/utils/{attackers,defenders,pieceSafety,pieceTrapped,dangerLevels}.ts,
 * licensed GPL-3.0 — the same licence as Chauss. Rewritten without lodash, with Chauss naming.
 */
import { Chess, type Color, type Move, type PieceSymbol, type Square } from 'chess.js';
import { PIECE_VALUES as MATERIAL_VALUES } from '../game/material';

export interface BoardPiece {
  square: Square;
  type: PieceSymbol;
  color: Color;
}

/** A move reduced to what identifies it. */
interface RawMove {
  piece: PieceSymbol;
  color: Color;
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

/** The usual piece values, with the king priceless (it can never be given up). */
const PIECE_VALUES: Record<PieceSymbol, number> = { ...MATERIAL_VALUES, k: Infinity };

export const flip = (color: Color): Color => (color === 'w' ? 'b' : 'w');
const moveKey = (move: RawMove): string => `${move.color}${move.piece}${move.from}${move.to}${move.promotion ?? ''}`;

function toRawMove(move: Move): RawMove {
  return { piece: move.piece, color: move.color, from: move.from, to: move.to, promotion: move.promotion };
}

function toBoardPiece(move: RawMove): BoardPiece {
  return { type: move.piece, color: move.color, square: move.from };
}

/** The same position with `color` to move (en passant cleared when the turn changes). */
export function withTurn(fen: string, color: Color): string {
  const parts = fen.split(' ');
  if (parts[1] !== color) parts[3] = '-';
  parts[1] = color;
  return parts.join(' ');
}

/** The square of the captured piece (differs from `to` for en passant). */
export function captureSquare(move: Move): Square {
  return move.isEnPassant() ? (`${move.to[0]}${move.from[1]}` as Square) : move.to;
}

/** A board for a FEN, or null when chess.js will not accept it (e.g. a side-flipped position). */
function boardFor(fen: string): Chess | null {
  try {
    return new Chess(fen);
  } catch {
    return null;
  }
}

function allPieces(board: Chess): BoardPiece[] {
  return board.board().flat().filter((piece): piece is BoardPiece => piece !== null);
}

/** Moves that capture `piece` right now, by the other side (including a king capturing into danger). */
function directAttackingMoves(board: Chess, piece: BoardPiece): RawMove[] {
  const attackerBoard = boardFor(withTurn(board.fen(), flip(piece.color)));
  if (!attackerBoard) return [];
  const attacks = attackerBoard
    .moves({ verbose: true })
    .filter((move) => captureSquare(move) === piece.square)
    .map(toRawMove);

  const kingSquare = attackerBoard
    .attackers(piece.square)
    .find((square) => attackerBoard.get(square)?.type === 'k');
  if (kingSquare && !attacks.some((attack) => attack.piece === 'k')) {
    attacks.push({ piece: 'k', color: flip(piece.color), from: kingSquare, to: piece.square });
  }
  return attacks;
}

/** Attacking moves on `piece`; with `transitive`, also pieces lined up behind them (batteries). */
export function attackingMoves(board: Chess, piece: BoardPiece, transitive = true): RawMove[] {
  const attacks = directAttackingMoves(board, piece);
  if (!transitive) return attacks;

  const frontier = attacks.map((attack) => ({ fen: board.fen(), square: attack.from, type: attack.piece }));
  while (frontier.length > 0) {
    const front = frontier.pop()!;
    if (front.type === 'k') continue; // a king cannot lead a battery
    const behind = boardFor(front.fen);
    if (!behind) continue;
    const before = directAttackingMoves(behind, piece).filter((attack) => attack.from !== front.square);
    behind.remove(front.square);
    const after = directAttackingMoves(behind, piece);

    // Revealed attackers: in one list but not the other.
    const beforeKeys = new Set(before.map(moveKey));
    const afterKeys = new Set(after.map(moveKey));
    const revealed = [
      ...before.filter((attack) => !afterKeys.has(moveKey(attack))),
      ...after.filter((attack) => !beforeKeys.has(moveKey(attack))),
    ];
    attacks.push(...revealed);
    frontier.push(...revealed.map((attack) => ({ fen: behind.fen(), square: attack.from, type: attack.piece })));
  }
  return attacks;
}

/** The pieces that could recapture on `piece`'s square (the smallest set over all captures). */
export function defendingMoves(board: Chess, piece: BoardPiece, transitive = true): RawMove[] {
  let smallest: RawMove[] | undefined;
  for (const attack of attackingMoves(board, piece, false)) {
    const captureBoard = boardFor(withTurn(board.fen(), flip(piece.color)));
    if (!captureBoard) continue;
    try {
      captureBoard.move(attack);
    } catch {
      continue;
    }
    const recaptures = attackingMoves(
      captureBoard,
      { type: attack.piece, color: attack.color, square: attack.to },
      transitive,
    );
    if (!smallest || recaptures.length < smallest.length) smallest = recaptures;
  }
  if (smallest) return smallest;

  // Nothing attacks it: count who would "attack" the same piece if it changed colour.
  const flippedBoard = boardFor(board.fen());
  if (!flippedBoard) return [];
  const flipped: BoardPiece = { ...piece, color: flip(piece.color) };
  flippedBoard.put({ type: flipped.type, color: flipped.color }, piece.square);
  return attackingMoves(flippedBoard, flipped, transitive);
}

export function isPieceSafe(board: Chess, piece: BoardPiece, playedMove?: Move): boolean {
  const direct = attackingMoves(board, piece, false).map(toBoardPiece);
  const attackers = attackingMoves(board, piece).map(toBoardPiece);
  const defenders = defendingMoves(board, piece).map(toBoardPiece);
  const value = (p: { type: PieceSymbol }) => PIECE_VALUES[p.type];

  // A rook given for a minor piece plus more (the exchange "sacrifice" that wins material) is safe.
  if (
    playedMove?.captured &&
    piece.type === 'r' &&
    PIECE_VALUES[playedMove.captured] === PIECE_VALUES.n &&
    attackers.length === 1 &&
    defenders.length > 0 &&
    value(attackers[0]!) === PIECE_VALUES.n
  ) {
    return true;
  }

  // Attacked by something cheaper: not safe.
  if (direct.some((attacker) => value(attacker) < value(piece))) return false;
  // At least as many defenders as attackers: safe.
  if (attackers.length <= defenders.length) return true;

  const lowest = direct.reduce<BoardPiece | undefined>(
    (low, attacker) => (!low || value(attacker) < value(low) ? attacker : low),
    undefined,
  );
  if (!lowest) return true;
  if (value(piece) < value(lowest) && defenders.some((defender) => value(defender) < value(lowest))) return true;
  // Defended by a pawn: safe.
  return defenders.some((defender) => defender.type === 'p');
}

/** `color`'s pieces (not pawns or the king) that can be taken for profit. */
export function unsafePieces(board: Chess, color: Color, playedMove?: Move): BoardPiece[] {
  const capturedValue = playedMove?.captured ? PIECE_VALUES[playedMove.captured] : 0;
  return allPieces(board).filter(
    (piece) =>
      piece.color === color &&
      piece.type !== 'p' &&
      piece.type !== 'k' &&
      PIECE_VALUES[piece.type] > capturedValue &&
      !isPieceSafe(board, piece, playedMove),
  );
}

/** Attacks on `color`'s unsafe pieces worth at least as much as `threatened` (other than it). */
function relativeUnsafePieceAttacks(board: Chess, threatened: BoardPiece, color: Color, playedMove?: Move): RawMove[] {
  return unsafePieces(board, color, playedMove)
    .filter((piece) => piece.square !== threatened.square && PIECE_VALUES[piece.type] >= PIECE_VALUES[threatened.type])
    .flatMap((piece) => attackingMoves(board, piece, false));
}

function anyMateInOne(board: Chess): boolean {
  return board.moves().some((san) => san.includes('#'));
}

/**
 * Playing `acting` (e.g. capturing the threatened piece) creates a new attack on something worth at
 * least as much, or allows mate in one when the threatened piece is less than a queen.
 */
function moveCreatesGreaterThreat(board: Chess, threatened: BoardPiece, acting: RawMove): boolean {
  const actionBoard = boardFor(board.fen());
  if (!actionBoard) return false;
  const before = new Set(relativeUnsafePieceAttacks(actionBoard, threatened, acting.color).map(moveKey));
  let played: Move;
  try {
    played = actionBoard.move(acting);
  } catch {
    return false;
  }
  const after = relativeUnsafePieceAttacks(actionBoard, threatened, acting.color, played);
  if (after.some((attack) => !before.has(moveKey(attack)))) return true;
  return PIECE_VALUES[threatened.type] < PIECE_VALUES.q && anyMateInOne(actionBoard);
}

/** Like moveCreatesGreaterThreat, but any such threat left after the move counts. */
function moveLeavesGreaterThreat(board: Chess, threatened: BoardPiece, acting: RawMove): boolean {
  const actionBoard = boardFor(board.fen());
  if (!actionBoard) return false;
  try {
    actionBoard.move(acting);
  } catch {
    return false;
  }
  if (relativeUnsafePieceAttacks(actionBoard, threatened, acting.color).length > 0) return true;
  return PIECE_VALUES[threatened.type] < PIECE_VALUES.q && anyMateInOne(actionBoard);
}

/** True when every one of `acting` (ways to take the piece) would cost the taker as much or more. */
export function hasDangerLevels(board: Chess, threatened: BoardPiece, acting: RawMove[]): boolean {
  return acting.every((move) => moveLeavesGreaterThreat(board, threatened, move));
}

/** Unsafe where it stands, and unsafe (or worse off) on every square it can go to. */
export function isPieceTrapped(board: Chess, piece: BoardPiece): boolean {
  const calibrated = boardFor(withTurn(board.fen(), piece.color));
  if (!calibrated) return false;
  if (isPieceSafe(calibrated, piece)) return false;
  return calibrated.moves({ square: piece.square, verbose: true }).every((move) => {
    if (move.captured === 'k') return false;
    const escape = boardFor(calibrated.fen());
    if (!escape) return true;
    if (moveCreatesGreaterThreat(escape, piece, toRawMove(move))) return true;
    const escaped = escape.move(move);
    return !isPieceSafe(escape, { ...piece, square: escaped.to }, escaped);
  });
}
