import { describe, expect, it } from 'vitest';
import { buildRepertoire } from '../repertoire/repertoire';
import { positionKey } from '../snapshot/format';
import { buildTestSnapshot, fenAfter, type FakeBook } from '../snapshot/testData';
import { emptyProgress, type Progress } from './progress';
import { DAY_MS, newCardState, review } from './srs';
import { lineAfter, statsRows, statsSummary } from './stats';

const P = 'e4 e5 Nf3 Nc6 c3';
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const key = (line: string) => positionKey(fenAfter(line));

const BOOK: FakeBook = {
  '': { lichess: { e4: 6000 }, masters: { e4: 500 } },
  e4: { lichess: { e5: 5000 }, masters: { e5: 300 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 1000 }, masters: { c3: 10 } },
  [P]: { lichess: { Nf6: 600, d5: 300 }, masters: { Nf6: 6 } },
  [`${P} Nf6`]: { lichess: { d4: 250 }, masters: { d4: 6 } },
  [`${P} Nf6 d4`]: { lichess: { Nxe4: 150 }, masters: { Nxe4: 5 } },
  [`${P} Nf6 d4 Nxe4`]: { lichess: { d5: 120 }, masters: { d5: 5 } },
  [`${P} d5`]: { lichess: { Qa4: 200 }, masters: {} },
};

describe('lineAfter', () => {
  it('numbers the moves and leaves out the opening itself', () => {
    const line = ['e4', 'e5', 'Nf3', 'Nc6', 'c3', 'Nf6', 'd4', 'Nxe4'];
    expect(lineAfter(line, 5)).toBe('3... Nf6 4. d4 Nxe4');
    expect(lineAfter(line.slice(0, 6), 5)).toBe('3... Nf6');
    expect(lineAfter(line, 0)).toBe('1. e4 e5 2. Nf3 Nc6 3. c3 Nf6 4. d4 Nxe4');
    expect(lineAfter(line, 6)).toBe('4. d4 Nxe4');
    expect(lineAfter(line, 8)).toBe('');
  });
});

describe('statsRows', () => {
  it('lists every card; untried ones by how often they come up', async () => {
    const repertoire = buildRepertoire(await buildTestSnapshot(BOOK));
    const rows = statsRows(repertoire, emptyProgress(), NOW);
    expect(rows.map((row) => [row.line, row.move])).toEqual([
      ['3... Nf6', 'd4'],
      ['3... Nf6 4. d4 Nxe4', 'd5'], // same reach as its parent, but a longer line
      ['3... d5', 'Qa4'],
    ]);
    expect(rows.every((row) => row.attempts === 0 && row.rightPercent === null && row.next === 'new' && !row.due)).toBe(true);
    expect(statsSummary(rows)).toEqual({ cards: 3, seen: 0, due: 0, attempts: 0, errors: 0 });
  });

  it('puts the weakest tried cards first, with their numbers', async () => {
    const repertoire = buildRepertoire(await buildTestSnapshot(BOOK));
    let weak = newCardState();
    for (const correct of [false, false, true]) weak = review(weak, correct, NOW - 3 * DAY_MS); // 1 of 3 right
    const strong = review(newCardState(), true, NOW - 1000); // 1 of 1 right, due tomorrow
    const progress: Progress = {
      version: 1,
      cards: { [key(`${P} d5`)]: weak, [key(`${P} Nf6`)]: strong },
    };

    const rows = statsRows(repertoire, progress, NOW);
    expect(rows.map((row) => row.move)).toEqual(['Qa4', 'd4', 'd5']);
    expect(rows[0]).toMatchObject({ line: '3... d5', attempts: 3, errors: 2, rightPercent: 33, next: 'now', due: true });
    expect(rows[1]).toMatchObject({ attempts: 1, errors: 0, rightPercent: 100, next: 'tomorrow', due: false });
    expect(rows[2]).toMatchObject({ attempts: 0, next: 'new' });
    expect(statsSummary(rows)).toEqual({ cards: 3, seen: 2, due: 1, attempts: 4, errors: 2 });
  });
});
