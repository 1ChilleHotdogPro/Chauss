/** Remembers which collapsible sections of the Explore panel are open. Browser storage only. */
export const SECTIONS_STORAGE_KEY = 'chauss.sections.v1';

export type SectionId = 'book' | 'popular';

type Store = Pick<Storage, 'getItem' | 'setItem'>;

function defaultStore(): Store | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

function readAll(store: Store | undefined): Partial<Record<SectionId, boolean>> {
  try {
    const raw = store?.getItem(SECTIONS_STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    const result: Partial<Record<SectionId, boolean>> = {};
    for (const id of ['book', 'popular'] as const) {
      const value = (parsed as Record<string, unknown>)[id];
      if (typeof value === 'boolean') result[id] = value;
    }
    return result;
  } catch {
    return {};
  }
}

/** Sections are open unless the user closed them. */
export function isSectionOpen(id: SectionId, store: Store | undefined = defaultStore()): boolean {
  return readAll(store)[id] ?? true;
}

export function setSectionOpen(id: SectionId, open: boolean, store: Store | undefined = defaultStore()): void {
  try {
    store?.setItem(SECTIONS_STORAGE_KEY, JSON.stringify({ ...readAll(store), [id]: open }));
  } catch {
    // Storage may be blocked or full: the section simply forgets its state.
  }
}
