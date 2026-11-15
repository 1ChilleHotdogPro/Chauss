import { DRILL_CATEGORIES, type DrillCategory } from '../drill/hub';

export interface DrillHubOptions {
  /** The full-page container (hidden while a drill or another tab is shown). */
  root: HTMLElement;
  /** The opening open now, or null before the first choice. */
  currentOpening: string | null;
  /** The user picked an entry (one opening, ...) of a category. */
  onChoose(categoryId: string, entryId: string): void;
}

export interface DrillHub {
  /** Show the hub, back at the first choice. */
  open(): void;
  close(): void;
  isOpen(): boolean;
}

/** A choice button: a bold title and quieter lines under it. */
function choiceButton(className: string, title: string, ...lines: string[]): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = className;
  const strong = document.createElement('strong');
  strong.textContent = title;
  element.append(strong);
  for (const text of lines) {
    const line = document.createElement('span');
    line.textContent = text;
    element.append(line);
  }
  return element;
}

/** The Drill hub: choose a category, then an entry in it. */
export function createDrillHub(options: DrillHubOptions): DrillHub {
  const { root, currentOpening, onChoose } = options;
  let category: DrillCategory | null = null;

  function renderCategories(): void {
    const title = document.createElement('h2');
    title.textContent = 'What do you want to drill?';
    const list = document.createElement('div');
    list.className = 'hub-list';
    for (const item of DRILL_CATEGORIES) {
      const choice = choiceButton('hub-choice', item.title, item.description);
      choice.dataset.category = item.id;
      choice.addEventListener('click', () => {
        category = item;
        render();
      });
      list.append(choice);
    }
    root.replaceChildren(title, list);
  }

  function renderEntries(current: DrillCategory): void {
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'hub-back';
    back.textContent = '← All drills';
    back.addEventListener('click', () => {
      category = null;
      render();
    });
    const title = document.createElement('h2');
    title.textContent = current.title;
    const list = document.createElement('div');
    list.className = 'hub-list';
    const entries = current.entries(currentOpening);
    for (const entry of entries) {
      const choice = choiceButton('hub-choice', entry.title, ...(entry.detail ? [entry.detail] : []));
      choice.dataset.entry = entry.id;
      choice.setAttribute('aria-current', String(entry.current === true));
      const extra = entry.unavailable ?? entry.note;
      if (extra) {
        const note = document.createElement('span');
        note.className = 'hint';
        note.textContent = extra;
        choice.append(note);
      }
      if (entry.unavailable) choice.disabled = true;
      else choice.addEventListener('click', () => onChoose(current.id, entry.id));
      list.append(choice);
    }
    root.replaceChildren(back, title, list);
    if (entries.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint hub-empty';
      empty.textContent = current.emptyText ?? 'Nothing here yet.';
      root.append(empty);
    }
  }

  function render(): void {
    if (category) renderEntries(category);
    else renderCategories();
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
