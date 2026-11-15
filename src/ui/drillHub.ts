import { DRILL_CATEGORIES, type DrillCategory, type DrillEntry } from '../drill/hub';
import type { ProgressStore } from '../drill/progress';
import { ENDGAME_DRILLS, getEndgameDrill, userSide } from '../endgames/drills';
import type { EndgameProgress } from '../endgames/progress';
import { findOpening, OPENINGS } from '../openings/registry';
import {
  drillCard,
  endgameProgressText,
  openingBoard,
  openingSummary,
  PROGRESS_TITLE,
  progressText,
  sideBadge,
} from './drillCard';
import { miniBoard } from './miniBoard';

export interface DrillHubOptions {
  /** The full-page container (hidden while a drill or another tab is shown). */
  root: HTMLElement;
  /** The opening open now, or null before the first choice. */
  currentOpening: string | null;
  /** The user picked an entry (one opening, ...) of a category. */
  onChoose(categoryId: string, entryId: string): void;
  /** The stored drill progress of every opening, for "3 due now · 12 learned". */
  openingProgress?: () => ProgressStore;
  /** The positions of an opening's drill when its data is loaded (only the open opening's is), else null. */
  positionKeys?: (openingId: string) => Iterable<string> | null;
  /** The stored endgame results. */
  endgameProgress?: () => EndgameProgress;
}

export interface DrillHub {
  /** Show the hub, back at the first choice. */
  open(): void;
  close(): void;
  isOpen(): boolean;
}

const BACK_ICON = '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M15 5l-7 7 7 7"/></svg>';

function heading(title: string, lead: string): HTMLElement {
  const head = document.createElement('header');
  head.className = 'hub-head';
  const h2 = document.createElement('h2');
  h2.className = 'hub-title';
  h2.textContent = title;
  const p = document.createElement('p');
  p.className = 'hub-lead';
  p.textContent = lead;
  head.append(h2, p);
  return head;
}

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

/** The Drill hub: choose a category, then an entry in it. */
export function createDrillHub(options: DrillHubOptions): DrillHub {
  const { root, currentOpening, onChoose } = options;
  let category: DrillCategory | null = null;

  const store = (): ProgressStore => options.openingProgress?.() ?? { version: 2, openings: {} };

  /** The quiet facts line of a category card ("2 openings · 3 due now"). */
  function categoryFacts(item: DrillCategory): string {
    const entries = item.entries(currentOpening);
    if (item.id === 'openings') {
      const now = Date.now();
      const progress = store();
      const due = OPENINGS.reduce(
        (sum, opening) => sum + openingSummary(progress, opening.id, now, options.positionKeys?.(opening.id)).due,
        0,
      );
      return `${plural(entries.length, 'opening')}${due > 0 ? ` · ${due} due now` : ''}`;
    }
    if (item.id === 'endgames') {
      const positions = ENDGAME_DRILLS.reduce((sum, drill) => sum + drill.positions.length, 0);
      return `${plural(entries.length, 'drill')} · ${plural(positions, 'position')}`;
    }
    return entries.length > 0 ? plural(entries.length, 'drill') : '';
  }

  /** The picture on a category card: the open opening, or the first endgame position. */
  function categoryBoard(item: DrillCategory): SVGSVGElement | null {
    if (item.id === 'openings') {
      const opening = findOpening(currentOpening ?? '') ?? OPENINGS[0];
      return opening ? openingBoard(opening) : null;
    }
    if (item.id === 'endgames') {
      const fen = ENDGAME_DRILLS[0]?.positions[0]?.fen;
      return fen ? miniBoard({ fen, orientation: userSide(fen) }) : null;
    }
    return null;
  }

  function renderCategories(): void {
    const list = document.createElement('div');
    list.className = 'hub-list hub-categories';
    for (const item of DRILL_CATEGORIES) {
      const facts = categoryFacts(item);
      const choice = drillCard({
        className: 'hub-choice',
        size: 'large',
        title: item.title,
        board: categoryBoard(item),
        lines: [
          { text: item.description, className: 'card-desc' },
          ...(facts ? [{ text: facts, className: 'card-facts' }] : []),
        ],
        chevron: true,
      });
      choice.dataset.category = item.id;
      choice.addEventListener('click', () => {
        category = item;
        render();
      });
      list.append(choice);
    }
    root.replaceChildren(
      heading('What do you want to drill?', 'Pick a drill. The app plays the other side and shows you the right move when you slip.'),
      list,
    );
  }

  /** One entry's card: a board and progress where the entry is an opening or an endgame drill. */
  function entryCard(current: DrillCategory, entry: DrillEntry): HTMLButtonElement {
    const opening = current.id === 'openings' ? findOpening(entry.id) : undefined;
    const endgame = current.id === 'endgames' ? getEndgameDrill(entry.id) : undefined;
    const lines: { text: string; className: string; title?: string }[] = [];
    let board: SVGSVGElement | null = null;
    let badge: HTMLElement | undefined;

    if (opening) {
      board = openingBoard(opening);
      badge = sideBadge(opening.side, entry.detail);
      if (entry.note) lines.push({ text: entry.note, className: 'card-line' });
      if (!entry.unavailable) {
        const summary = openingSummary(store(), opening.id, Date.now(), options.positionKeys?.(opening.id));
        lines.push({ text: progressText(summary), className: 'card-progress', title: PROGRESS_TITLE });
      }
    } else if (endgame) {
      const fen = endgame.positions[0]?.fen;
      if (fen) {
        const side = userSide(fen);
        board = miniBoard({ fen, orientation: side });
        badge = sideBadge(side, entry.detail);
      }
      if (entry.note) lines.push({ text: entry.note, className: 'card-line' });
      const records = options.endgameProgress?.().drills[endgame.id] ?? {};
      lines.push({ text: endgameProgressText(records, endgame.positions.map((position) => position.id)), className: 'card-progress' });
    } else {
      if (entry.detail) lines.push({ text: entry.detail, className: 'card-desc' });
      if (entry.note) lines.push({ text: entry.note, className: 'card-line' });
    }
    if (entry.unavailable) lines.push({ text: entry.unavailable, className: 'card-note' });

    const choice = drillCard({
      className: 'hub-choice',
      title: entry.title,
      board,
      badge,
      tag: entry.current ? 'Open now' : undefined,
      lines,
      chevron: !entry.unavailable,
    });
    choice.dataset.entry = entry.id;
    choice.setAttribute('aria-current', String(entry.current === true));
    if (entry.unavailable) choice.disabled = true;
    else choice.addEventListener('click', () => onChoose(current.id, entry.id));
    return choice;
  }

  function renderEntries(current: DrillCategory): void {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'hub-back btn-ghost btn-icon';
    back.innerHTML = BACK_ICON;
    back.append(document.createTextNode('All drills'));
    back.addEventListener('click', () => {
      category = null;
      render();
    });
    const list = document.createElement('div');
    list.className = 'hub-list hub-entries';
    const entries = current.entries(currentOpening);
    list.append(...entries.map((entry) => entryCard(current, entry)));
    root.replaceChildren(back, heading(current.title, current.description), list);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint hub-empty';
      empty.textContent = current.emptyText ?? 'Nothing here yet.';
      root.append(empty);
    }
  }

  function render(): void {
    // The page itself is the frame; its content sits in one centred column.
    if (category) renderEntries(category);
    else renderCategories();
    root.scrollTop = 0;
  }

  return {
    open: () => {
      category = null;
      render();
      root.hidden = false;
    },
    close: () => {
      root.hidden = true;
    },
    isOpen: () => !root.hidden,
  };
}
