import { blackReplies, type Card, type Repertoire } from '../repertoire/repertoire';
import type { Snapshot, SnapshotMove } from '../snapshot/format';

/** Why a drill line stopped. */
export type FinishReason =
  /** The bundled data does not continue after White's move. */
  | 'end-of-data'
  /** The repertoire has no move for the position reached. */
  | 'no-card';

export interface DrillStep {
  /** The card that was asked. */
  card: Card;
  /** True if the right move was found at the first try. */
  firstTry: boolean;
}

export type AnswerResult =
  | { result: 'correct'; card: Card; firstTry: boolean }
  /** Not the repertoire move. The position stays; the user tries again. */
  | { result: 'wrong'; card: Card; played: SnapshotMove | undefined }
  /** Nothing is being asked right now (the line is over). */
  | { result: 'ignored' };

/**
 * One drill line: the app plays Black, the user must find the repertoire move as White at each
 * turn. Black's moves follow the path to the `target` card while there is one, and after that are
 * drawn at random, weighted by how often they are played at the snapshot's level.
 *
 * Pure logic: no board, no timers. `random` returns a number from 0 (inclusive) to 1 (exclusive).
 */
export class DrillSession {
  /** The moves played so far, from the start position, in normal notation. */
  private readonly path: string[];
  private key: string;
  private wrongHere = false;
  private finishedValue: FinishReason | null = null;
  private readonly stepsValue: DrillStep[] = [];
  /** Black's replies played by the app, newest last (so the caller can animate them). */
  private readonly blackMoves: SnapshotMove[] = [];

  constructor(
    private readonly snapshot: Snapshot,
    private readonly repertoire: Repertoire,
    private readonly target: Card | null,
    private readonly random: () => number = Math.random,
  ) {
    this.path = [...repertoire.startLine];
    this.key = repertoire.startKey;
    // The drill starts at the opening position, where it is Black's turn.
    this.playBlackUntilCard();
  }

  /** Moves from the start position to the position on the board. */
  line(): readonly string[] {
    return this.path;
  }

  fen(): string {
    return this.snapshot.nodes[this.key]?.fen ?? '';
  }

  /** The card being asked, or null when the line is over. */
  card(): Card | null {
    return this.finishedValue ? null : (this.repertoire.cards.get(this.key) ?? null);
  }

  finished(): FinishReason | null {
    return this.finishedValue;
  }

  /** Every card asked so far, with whether it was answered right at the first try. */
  steps(): readonly DrillStep[] {
    return this.stepsValue;
  }

  /** True once a wrong move was tried in the current position. */
  missedHere(): boolean {
    return this.wrongHere;
  }

  /** The user's move, in engine spelling. */
  answer(uci: string): AnswerResult {
    const card = this.card();
    if (!card) return { result: 'ignored' };
    const node = this.snapshot.nodes[this.key]!;

    if (uci !== card.move.uci) {
      this.wrongHere = true;
      return { result: 'wrong', card, played: node.moves.find((move) => move.uci === uci) };
    }

    const firstTry = !this.wrongHere;
    this.stepsValue.push({ card, firstTry });
    this.wrongHere = false;

    const move = node.moves.find((candidate) => candidate.uci === uci)!;
    this.path.push(move.san);
    if (move.next === undefined) {
      this.finishedValue = 'end-of-data';
    } else {
      this.key = move.next;
      this.playBlackUntilCard();
    }
    return { result: 'correct', card, firstTry };
  }

  /** Black's most recent reply (after the last correct answer), if the line went on. */
  lastBlackMove(): SnapshotMove | undefined {
    return this.blackMoves.at(-1);
  }

  /** From a Black-to-move position: play Black's reply and stop at the next card (or the end). */
  private playBlackUntilCard(): void {
    const node = this.snapshot.nodes[this.key];
    if (!node) {
      this.finishedValue = 'end-of-data';
      return;
    }
    if (node.fen.split(' ')[1] !== 'b') {
      if (!this.repertoire.cards.has(this.key)) this.finishedValue = 'no-card';
      return;
    }

    const replies = blackReplies(node);
    if (replies.length === 0) {
      this.finishedValue = 'end-of-data';
      return;
    }

    // While on the way to the target card, play the move that leads there.
    const wanted = this.target && this.onTargetPath() ? this.target.line[this.path.length] : undefined;
    let chosen = replies.find((reply) => reply.move.san === wanted);
    if (!chosen) {
      const total = replies.reduce((sum, reply) => sum + reply.weight, 0);
      let ticket = this.random() * total;
      chosen = replies.at(-1)!;
      for (const reply of replies) {
        ticket -= reply.weight;
        if (ticket < 0) {
          chosen = reply;
          break;
        }
      }
    }

    this.blackMoves.push(chosen.move);
    this.path.push(chosen.move.san);
    this.key = chosen.move.next!;
    if (!this.repertoire.cards.has(this.key)) this.finishedValue = 'no-card';
  }

  /** True while the moves played so far are the beginning of the target card's line. */
  private onTargetPath(): boolean {
    const line = this.target?.line;
    if (!line || this.path.length >= line.length) return false;
    return this.path.every((san, index) => line[index] === san);
  }
}
