import type { KeyValueStorage } from '../explorer/cache';

/** How far (in pixels) a press on the heading must travel to count as a swipe rather than a click. */
export const SWIPE_DISTANCE = 24;

/** What a finished press on the heading means: a swipe down folds, a swipe up unfolds, a short one toggles. */
export function gestureResult(folded: boolean, dy: number): boolean {
  if (dy >= SWIPE_DISTANCE) return true;
  if (dy <= -SWIPE_DISTANCE) return false;
  return !folded;
}

export interface FoldableOptions {
  /** The heading button: click (or Enter / Space) toggles, swiping down folds, swiping up unfolds. */
  toggle: HTMLButtonElement;
  storage: KeyValueStorage | undefined;
  storageKey: string;
  /** Called with the new state (and once at the start); the page shows or hides the section. */
  onChange(folded: boolean): void;
}

/** A section that folds away under its heading, remembered in this browser. */
export function createFoldable(options: FoldableOptions): void {
  const { toggle, storage, storageKey, onChange } = options;
  let folded = false;
  try {
    folded = storage?.getItem(storageKey) === 'folded';
  } catch {
    // no storage: start unfolded
  }

  function set(next: boolean): void {
    folded = next;
    toggle.setAttribute('aria-expanded', String(!next));
    try {
      if (next) storage?.setItem(storageKey, 'folded');
      else storage?.removeItem(storageKey);
    } catch {
      // not remembered; it still works for this visit
    }
    onChange(next);
  }

  // A press is followed by a click; a swipe has already been handled, so its click is ignored.
  let start: { id: number; y: number } | null = null;
  let swiped = false;
  toggle.addEventListener('pointerdown', (event) => {
    start = { id: event.pointerId, y: event.clientY };
    swiped = false;
    // Keep receiving the pointer when the finger or mouse leaves the heading during the swipe.
    try {
      toggle.setPointerCapture(event.pointerId);
    } catch {
      // not supported: a swipe that ends on the heading still works
    }
  });
  toggle.addEventListener('pointerup', (event) => {
    if (!start || start.id !== event.pointerId) return;
    const dy = event.clientY - start.y;
    start = null;
    if (Math.abs(dy) >= SWIPE_DISTANCE) {
      swiped = true;
      set(gestureResult(folded, dy));
    }
  });
  toggle.addEventListener('pointercancel', () => {
    start = null;
  });
  toggle.addEventListener('click', () => {
    if (swiped) {
      swiped = false;
      return;
    }
    set(!folded);
  });

  set(folded);
}
