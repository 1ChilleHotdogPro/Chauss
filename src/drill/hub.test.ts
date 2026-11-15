import { describe, expect, it } from 'vitest';
import { ENDGAME_DRILLS } from '../endgames/drills';
import { OPENINGS } from '../openings/registry';
import { DRILL_CATEGORIES, ENDGAMES_CATEGORY, OPENINGS_CATEGORY, rootMoves } from './hub';

describe('drill hub data', () => {
  it('starts with Openings and Endgames', () => {
    expect(DRILL_CATEGORIES.map((category) => category.id)).toEqual(['openings', 'endgames']);
  });
  it('lists every registered opening and marks the current one', () => {
    const entries = OPENINGS_CATEGORY.entries('caro-kann');
    expect(entries.map((entry) => entry.id)).toEqual(OPENINGS.map((opening) => opening.id));
    expect(entries.filter((entry) => entry.current).map((entry) => entry.id)).toEqual(['caro-kann']);
    expect(OPENINGS_CATEGORY.entries(null).some((entry) => entry.current)).toBe(false);
  });
  it('lists every endgame drill from the data', () => {
    const entries = ENDGAMES_CATEGORY.entries(null);
    expect(entries.map((entry) => entry.id)).toEqual(ENDGAME_DRILLS.map((drill) => drill.id));
    expect(entries[0]?.detail).toContain('you play White');
  });
  it('writes root moves with move numbers', () => {
    expect(rootMoves({ rootLine: ['e4', 'c6'] })).toBe('1.e4 c6');
  });
});
