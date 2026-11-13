import { Chess, DEFAULT_POSITION, type Square } from 'chess.js';

export type { Square };
export type Side = 'white' | 'black';
export type PromotionPiece = 'q' | 'r' | 'b' | 'n';
export type GameStatus = 'playing' | 'checkmate' | 'stalemate' | 'draw';

/** One half-move ("ply") that has been played. */
export interface MoveRecord {
  /** 1 = White's first move, 2 = Black's first move, ... */
  ply: number;
  /** Standard notation, e.g. "Nf3" or "exd5". */
  san: string;
  from: Square;
  to: Square;
  promotion?: PromotionPiece;
  color: Side;
  /** Position (FEN) after this move. */
  fenAfter: string;
}

/**
 * The single source of truth for the game on screen.
 *
 * Holds one line of moves plus a cursor saying which position is being looked
 * at. All rules come from chess.js; nothing here touches the page.
 */
export class Game {
  readonly startFen: string;
  private moves: MoveRecord[] = [];
  /** How many moves have been played to reach the position being shown. */
  private cursor = 0;
  private chess: Chess;

  constructor(startFen: string = DEFAULT_POSITION) {
    this.startFen = startFen;
    this.chess = new Chess(startFen);
  }

  fen(): string {
    return this.chess.fen();
  }

  turn(): Side {
    return this.chess.turn() === 'w' ? 'white' : 'black';
  }

  inCheck(): boolean {
    return this.chess.inCheck();
  }

  status(): GameStatus {
    if (this.chess.isCheckmate()) return 'checkmate';
    if (this.chess.isStalemate()) return 'stalemate';
    if (this.chess.isDraw()) return 'draw';
    return 'playing';
  }

  /** Legal moves as "from square -> list of target squares". Empty when there are none. */
  dests(): Map<Square, Square[]> {
    const dests = new Map<Square, Square[]>();
    for (const move of this.chess.moves({ verbose: true })) {
      const targets = dests.get(move.from);
      if (!targets) dests.set(move.from, [move.to]);
      else if (!targets.includes(move.to)) targets.push(move.to); // promotions list a square 4 times
    }
    return dests;
  }

  /** True when moving from -> to is a pawn reaching the last rank, so a piece must be chosen. */
  needsPromotion(from: string, to: string): boolean {
    return this.chess
      .moves({ verbose: true })
      .some((move) => move.from === from && move.to === to && move.promotion !== undefined);
  }

  /**
   * Play a move from the position being shown. Returns the move, or null if it
   * is not legal (or a promotion piece is needed but missing).
   * Playing from an earlier position drops the moves that came after it.
   */
  play(from: string, to: string, promotion?: PromotionPiece): MoveRecord | null {
    const isPromotion = this.needsPromotion(from, to);
    if (isPromotion && !promotion) return null;

    let move;
    try {
      // chess.js throws on an illegal move.
      move = this.chess.move(isPromotion ? { from, to, promotion } : { from, to });
    } catch {
      return null;
    }

    const record: MoveRecord = {
      ply: this.cursor + 1,
      san: move.san,
      from: move.from,
      to: move.to,
      color: move.color === 'w' ? 'white' : 'black',
      fenAfter: move.after,
    };
    if (isPromotion && promotion) record.promotion = promotion;

    this.moves = this.moves.slice(0, this.cursor);
    this.moves.push(record);
    this.cursor = this.moves.length;
    return record;
  }

  /** All moves of the line, including any after the position being shown. */
  history(): readonly MoveRecord[] {
    return this.moves;
  }

  /** Number of moves played to reach the position being shown (0 = start). */
  currentPly(): number {
    return this.cursor;
  }

  /** The move that led to the position being shown, if any. */
  lastMove(): MoveRecord | undefined {
    return this.cursor > 0 ? this.moves[this.cursor - 1] : undefined;
  }

  /** Show the position after `ply` moves (clamped to the valid range). */
  goTo(ply: number): void {
    const target = Math.max(0, Math.min(this.moves.length, Math.trunc(ply)));
    if (target === this.cursor) return;
    this.cursor = target;
    this.rebuild();
  }

  back(): void {
    this.goTo(this.cursor - 1);
  }

  forward(): void {
    this.goTo(this.cursor + 1);
  }

  /** Take back the last move of the line and show the position before it. */
  undo(): MoveRecord | null {
    const removed = this.moves.pop();
    if (!removed) return null;
    this.cursor = this.moves.length;
    this.rebuild();
    return removed;
  }

  reset(): void {
    this.moves = [];
    this.cursor = 0;
    this.rebuild();
  }

  /** Replay from the start so chess.js also knows the history (needed for repetition draws). */
  private rebuild(): void {
    const chess = new Chess(this.startFen);
    for (const move of this.moves.slice(0, this.cursor)) {
      chess.move(
        move.promotion
          ? { from: move.from, to: move.to, promotion: move.promotion }
          : { from: move.from, to: move.to },
      );
    }
    this.chess = chess;
  }
}
