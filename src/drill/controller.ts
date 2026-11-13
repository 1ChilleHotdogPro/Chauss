import { buildExplorePosition } from '../explore/position';
import type { Card, Repertoire } from '../repertoire/repertoire';
import type { Snapshot } from '../snapshot/format';
import { wrongMoveText } from './feedback';
import type { Progress } from './progress';
import { countCards, pickTarget, type DrillCounts, type TargetReason } from './select';
import { DrillSession, type FinishReason } from './session';
import { isDue, isNew, newCardState, review } from './srs';

export type DrillFeedback =
  | { kind: 'none' }
  | { kind: 'correct'; text: string }
  /** `hint` is the repertoire move to show on the board (engine spelling). */
  | { kind: 'wrong'; text: string; hint: string };

export interface DrillView {
  /** Moves from the start position to the position to show. */
  line: readonly string[];
  /** The card being asked, or null when the line is over. */
  card: Card | null;
  feedback: DrillFeedback;
  finished: FinishReason | null;
  /** Why this line was chosen. */
  targetReason: TargetReason | null;
  counts: DrillCounts;
  /** Cards of this line: right at the first try / asked. */
  lineScore: { right: number; asked: number };
  /** This sitting (since the page was opened): right at the first try / asked. */
  sittingScore: { right: number; asked: number };
}

export interface DrillControllerOptions {
  snapshot: Snapshot;
  repertoire: Repertoire;
  progress: Progress;
  /** Called after every change to the progress, so it can be stored. */
  onProgress: (progress: Progress) => void;
  now?: () => number;
  random?: () => number;
}

/**
 * Runs drills: chooses the next line (due cards first), checks the user's moves, keeps the
 * spaced-repetition record. No board and no page here — see DrillView for what there is to show.
 */
export class DrillController {
  private session: DrillSession | null = null;
  private targetReason: TargetReason | null = null;
  private feedback: DrillFeedback = { kind: 'none' };
  /** Cards drilled in this sitting, so the next line aims at something else. */
  private readonly drilled = new Set<string>();
  private readonly sitting = { right: 0, asked: 0 };
  /** Cards already marked wrong in the current line (a second wrong try is not counted again). */
  private readonly missed = new Set<string>();
  private progress: Progress;
  private readonly now: () => number;
  private readonly random: () => number;

  constructor(private readonly options: DrillControllerOptions) {
    this.progress = options.progress;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
  }

  /** Replace the progress (after an import or a reset). */
  setProgress(progress: Progress): void {
    this.progress = progress;
  }

  currentProgress(): Progress {
    return this.progress;
  }

  /** Start the next line. */
  next(): void {
    const cards = this.options.repertoire.cards;
    const picked = pickTarget(cards.values(), this.progress, this.now(), this.drilled);
    this.targetReason = picked?.reason ?? null;
    this.session = new DrillSession(this.options.snapshot, this.options.repertoire, picked?.card ?? null, this.random);
    this.feedback = { kind: 'none' };
    this.missed.clear();
  }

  /** The user's move (engine spelling) with its normal notation, e.g. ("d2d4", "d4"). */
  answer(uci: string, san: string): 'correct' | 'wrong' | 'ignored' {
    const session = this.session;
    if (!session) return 'ignored';
    const result = session.answer(uci);
    if (result.result === 'ignored') return 'ignored';

    const { card } = result;
    this.drilled.add(card.key);

    if (result.result === 'wrong') {
      if (!this.missed.has(card.key)) {
        this.missed.add(card.key);
        this.sitting.asked += 1;
        this.record(card, false);
      }
      const node = this.options.snapshot.nodes[card.key];
      const played = node ? buildExplorePosition(node).moves.find((move) => move.uci === uci) : undefined;
      this.feedback = { kind: 'wrong', text: wrongMoveText(card, san, played), hint: card.move.uci };
      return 'wrong';
    }

    if (result.firstTry) {
      this.sitting.asked += 1;
      this.sitting.right += 1;
      this.record(card, true);
    }
    this.feedback = {
      kind: 'correct',
      text: result.firstTry ? `${card.move.san} — correct.` : `${card.move.san} — that is the one.`,
    };
    return 'correct';
  }

  view(): DrillView {
    const session = this.session;
    const steps = session?.steps() ?? [];
    return {
      line: session?.line() ?? this.options.repertoire.startLine,
      card: session?.card() ?? null,
      feedback: this.feedback,
      finished: session?.finished() ?? null,
      targetReason: this.targetReason,
      counts: countCards(this.options.repertoire.cards.values(), this.progress, this.now()),
      lineScore: { right: steps.filter((step) => step.firstTry).length, asked: steps.length },
      sittingScore: { ...this.sitting },
    };
  }

  private record(card: Card, correct: boolean): void {
    const now = this.now();
    const state = this.progress.cards[card.key] ?? newCardState();
    // A card that is not due yet is often passed on the way to a deeper one. Getting it right
    // then is counted, but must not push its next review further away: that would let cards
    // drift out of sight without ever being tested at the right time.
    const early = correct && !isNew(state) && !isDue(state, now);
    const next = early ? { ...state, attempts: state.attempts + 1, lastSeen: now } : review(state, correct, now);
    this.progress = { ...this.progress, cards: { ...this.progress.cards, [card.key]: next } };
    this.options.onProgress(this.progress);
  }
}
