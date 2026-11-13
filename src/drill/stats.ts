import type { Card, Repertoire } from '../repertoire/repertoire';
import { dueText } from './feedback';
import type { Progress } from './progress';
import { accuracy, isDue, type CardState } from './srs';

export interface StatsRow {
  key: string;
  /** The moves that lead to the card, after the opening's own moves: "3... Nf6 4. d4 Nxe4". */
  line: string;
  /** The move to play there. */
  move: string;
  attempts: number;
  errors: number;
  /** Share of right answers, 0-100, or null before the first try. */
  rightPercent: number | null;
  /** "now", "tomorrow", "in 6 days", "new". */
  next: string;
  due: boolean;
}

export interface StatsSummary {
  cards: number;
  seen: number;
  due: number;
  attempts: number;
  errors: number;
}

/** A line with move numbers, leaving out the first `skip` moves: "3... Nf6 4. d4 Nxe4". */
export function lineAfter(line: readonly string[], skip: number): string {
  const parts: string[] = [];
  line.forEach((san, index) => {
    if (index < skip) return;
    const number = Math.floor(index / 2) + 1;
    if (index % 2 === 0) parts.push(`${number}. ${san}`);
    else parts.push(index === skip ? `${number}... ${san}` : san);
  });
  return parts.join(' ');
}

/**
 * One row per card for the statistics table: the weakest cards first (most wrong answers by
 * share), then the ones never tried, the most common first.
 */
export function statsRows(repertoire: Repertoire, progress: Progress, now: number): StatsRow[] {
  const skip = repertoire.startLine.length;
  const rows = [...repertoire.cards.values()].map((card: Card) => {
    const state: CardState | undefined = progress.cards[card.key];
    const right = accuracy(state);
    return {
      card,
      row: {
        key: card.key,
        line: lineAfter(card.line, skip),
        move: card.move.san,
        attempts: state?.attempts ?? 0,
        errors: state?.errors ?? 0,
        rightPercent: right === null ? null : Math.round(right * 100),
        next: dueText(state, now),
        due: isDue(state, now),
      } satisfies StatsRow,
    };
  });

  rows.sort((a, b) => {
    const seenA = a.row.attempts > 0;
    const seenB = b.row.attempts > 0;
    if (seenA !== seenB) return seenA ? -1 : 1;
    if (seenA && seenB) {
      return (
        (a.row.rightPercent ?? 0) - (b.row.rightPercent ?? 0) || b.row.errors - a.row.errors || b.card.reach - a.card.reach
      );
    }
    return b.card.reach - a.card.reach || a.card.line.length - b.card.line.length;
  });
  return rows.map(({ row }) => row);
}

export function statsSummary(rows: readonly StatsRow[]): StatsSummary {
  return {
    cards: rows.length,
    seen: rows.filter((row) => row.attempts > 0).length,
    due: rows.filter((row) => row.due).length,
    attempts: rows.reduce((sum, row) => sum + row.attempts, 0),
    errors: rows.reduce((sum, row) => sum + row.errors, 0),
  };
}
