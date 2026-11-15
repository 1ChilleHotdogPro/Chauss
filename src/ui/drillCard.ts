import type { ProgressStore } from '../drill/progress';
import { isDue, isNew, type CardState } from '../drill/srs';
import type { EndgamePositionRecord } from '../endgames/progress';
import type { OpeningDef, Side } from '../openings/registry';
import { miniBoard, rootPosition } from './miniBoard';

/**
 * The big choice cards of the Drill hub and the opening picker: a small board on the left, then a
 * title, a "You play White" badge, quieter lines and a progress line.
 */

/** What is known about the drilling of one opening, from the stored progress (never estimated). */
export interface OpeningProgressSummary {
  /** Asked before and due again now. */
  due: number;
  /** Answered right the last time they were asked. */
  learned: number;
  /** Asked at least once. */
  seen: number;
  /** Positions in the opening's drill, when its data is loaded (the open opening only); else null. */
  total: number | null;
}

/**
 * Count one opening's cards. With `keys` (the drill's positions, known once its data is loaded) only
 * those count, exactly as the drill panel counts them; without, every stored card counts.
 */
export function summarizeProgress(
  cards: Readonly<Record<string, CardState>>,
  now: number,
  keys?: Iterable<string> | null,
): OpeningProgressSummary {
  const summary: OpeningProgressSummary = { due: 0, learned: 0, seen: 0, total: null };
  const list = keys ? [...keys] : Object.keys(cards);
  if (keys) summary.total = list.length;
  for (const key of list) {
    const state = cards[key];
    if (!state || isNew(state)) continue;
    summary.seen += 1;
    if (isDue(state, now)) summary.due += 1;
    if (state.streak >= 1) summary.learned += 1;
  }
  return summary;
}

/** "3 due now · 12 of 71 learned", or "Not started yet". */
export function progressText(summary: OpeningProgressSummary): string {
  if (summary.seen === 0) {
    return summary.total !== null ? `Not started yet · ${summary.total} to learn` : 'Not started yet';
  }
  const due = summary.due > 0 ? `${summary.due} due now` : 'Nothing due now';
  const learned = summary.total !== null ? `${summary.learned} of ${summary.total} learned` : `${summary.learned} learned`;
  return `${due} · ${learned}`;
}

/** An opening's summary from the store of every opening. */
export function openingSummary(
  store: ProgressStore,
  openingId: string,
  now: number,
  keys?: Iterable<string> | null,
): OpeningProgressSummary {
  return summarizeProgress(store.openings[openingId]?.cards ?? {}, now, keys);
}

/** "3 of 5 solved · 7 of 15 stars", or "Not tried yet", from an endgame drill's stored results. */
export function endgameProgressText(
  records: Readonly<Record<string, EndgamePositionRecord>>,
  positionIds: readonly string[],
): string {
  const tried = positionIds.filter((id) => (records[id]?.attempts ?? 0) > 0);
  if (tried.length === 0) return 'Not tried yet';
  const solved = positionIds.filter((id) => (records[id]?.solved ?? 0) > 0).length;
  const stars = positionIds.reduce((sum, id) => sum + (records[id]?.bestStars ?? 0), 0);
  return `${solved} of ${positionIds.length} solved · ${stars} of ${positionIds.length * 3} stars`;
}

export const PROGRESS_TITLE =
  'Learned: you got it right the last time it was asked. Due: time to see it again, so it sticks.';

function span(className: string, text: string): HTMLSpanElement {
  const element = document.createElement('span');
  element.className = className;
  element.textContent = text;
  return element;
}

/** "You play White", with a small disc in that colour. */
export function sideBadge(side: Side, text = `You play ${side === 'white' ? 'White' : 'Black'}`): HTMLSpanElement {
  const badge = span('side-badge', text);
  badge.dataset.side = side;
  return badge;
}

export interface DrillCardParts {
  /** Extra classes, e.g. "opening-choice" (kept for the tests and main.ts). */
  className: string;
  title: string;
  board?: SVGSVGElement | null;
  /** A small tag beside the title, e.g. "Open now". */
  tag?: string;
  badge?: HTMLElement;
  /** Quieter lines under the title, each with its own class. */
  lines?: readonly { text: string; className: string; title?: string }[];
  /** Show a "go on" chevron at the right (for cards that lead somewhere). */
  chevron?: boolean;
  /** Bigger board and title (the hub's first page). */
  size?: 'large' | 'normal';
}

const CHEVRON = '<svg class="icon card-chevron" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M9 5l7 7-7 7"/></svg>';

/** A card as a button. Lines are plain spans, so the button's text stays readable for tests and screen readers. */
export function drillCard(parts: DrillCardParts): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `drill-card ${parts.className}`;
  if (parts.size === 'large') button.classList.add('drill-card-large');

  if (parts.board) {
    const frame = span('card-board', '');
    frame.append(parts.board);
    button.append(frame);
  }

  const text = span('card-text', '');
  const head = span('card-head', '');
  head.append(span('card-title', parts.title));
  if (parts.tag) head.append(span('card-tag', parts.tag));
  text.append(head);
  if (parts.badge) text.append(parts.badge);
  for (const line of parts.lines ?? []) {
    const element = span(line.className, line.text);
    if (line.title) element.title = line.title;
    text.append(element);
  }
  button.append(text);

  if (parts.chevron) button.insertAdjacentHTML('beforeend', CHEVRON);
  return button;
}

/** The mini board of an opening: its root position, from the side the user plays, last move marked. */
export function openingBoard(opening: OpeningDef): SVGSVGElement {
  const { fen, lastMove } = rootPosition(opening);
  return miniBoard({ fen, orientation: opening.side, highlight: lastMove });
}
