import { ENDGAME_DRILLS, userSide, type EndgameGoal } from '../endgames/drills';
import { hasOpeningData } from '../openings/assets';
import { OPENINGS, type OpeningDef } from '../openings/registry';

/**
 * The Drill hub: the full-page menu that opens when the Drill tab is clicked. Pure data, so a new kind
 * of drill is one more category here plus a handler where the hub is wired up (main.ts).
 *
 * Two levels: first a category (Openings, Endgames), then an entry inside it (one opening, ...).
 */
export interface DrillEntry {
  id: string;
  title: string;
  /** Second line, e.g. "You play White". */
  detail?: string;
  /** Third, quieter line, e.g. the first moves of an opening. */
  note?: string;
  /** Set when the entry cannot be started; the text says why. */
  unavailable?: string;
  /** Marks the entry that is open now, e.g. the opening being drilled. */
  current?: boolean;
  /** A heading the entry is listed under ("You play White"); entries of one group come together. */
  group?: string;
}

export interface DrillCategory {
  id: string;
  title: string;
  description: string;
  /** The entries to choose from, given the id of the opening that is open now. */
  entries(currentOpening: string | null): readonly DrillEntry[];
  /** Shown instead of a list when there are no entries (a placeholder category). */
  emptyText?: string;
}

const sideName = (opening: OpeningDef): string => (opening.side === 'white' ? 'White' : 'Black');

/** "1.e4 e5 2.Nf3 Nc6 3.c3": the root moves with move numbers. */
export function rootMoves(opening: Pick<OpeningDef, 'rootLine'>): string {
  return opening.rootLine.map((san, index) => (index % 2 === 0 ? `${index / 2 + 1}.${san}` : san)).join(' ');
}

export const OPENINGS_CATEGORY: DrillCategory = {
  id: 'openings',
  title: 'Openings',
  description: 'Learn the theory move by move, from the side you play.',
  entries: (currentOpening) =>
    OPENINGS.map((opening) => ({
      id: opening.id,
      title: opening.name,
      detail: `You play ${sideName(opening)}`,
      note: rootMoves(opening),
      unavailable: hasOpeningData(opening.id) ? undefined : 'Coming soon: the data for this opening is still being built.',
      current: opening.id === currentOpening,
      group: `You play ${sideName(opening)}`,
    })),
};

const GOAL_GROUP: Record<EndgameGoal, string> = {
  mate: 'Give checkmate',
  win: 'Win it',
  draw: 'Hold the draw',
};

export const ENDGAMES_CATEGORY: DrillCategory = {
  id: 'endgames',
  title: 'Endgames',
  description: 'Practise the basic winning and drawing positions.',
  entries: () =>
    ENDGAME_DRILLS.map((drill) => {
      const side = drill.positions[0] ? userSide(drill.positions[0].fen) : 'white';
      return {
        id: drill.id,
        title: drill.title,
        detail: `${drill.skill} · you play ${side === 'white' ? 'White' : 'Black'}`,
        note: `${drill.positions.length} positions`,
        group: GOAL_GROUP[drill.goal],
      };
    }),
  emptyText: 'Endgame drills are coming soon.',
};

export const DRILL_CATEGORIES: readonly DrillCategory[] = [OPENINGS_CATEGORY, ENDGAMES_CATEGORY];
