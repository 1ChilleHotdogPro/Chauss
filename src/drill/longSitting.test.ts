// A long drill sitting on the real bundled data (src/data/ponziani.json): the next line must keep
// changing instead of getting stuck on one card (bug: the same line came back over and over).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildRepertoire } from '../repertoire/repertoire';
import type { Snapshot } from '../snapshot/format';
import { DrillController } from './controller';
import { emptyProgress } from './progress';
import { isDue } from './srs';

const file = fileURLToPath(new URL('../data/ponziani.json', import.meta.url));
const snapshot = JSON.parse(readFileSync(file, 'utf8')) as Snapshot;
const repertoire = buildRepertoire(snapshot);
const NOW = Date.UTC(2026, 10, 15, 12, 0, 0);

/** Small seeded random generator (mulberry32), so every run plays the same games. */
function seeded(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Play `lines` drill lines; the user gets each card right at the first try with chance `skill`. */
function sitting(lines: number, skill: number, stepMs: number, seed: number) {
  let time = NOW;
  const random = seeded(seed);
  const userRandom = seeded(seed + 1);
  const controller = new DrillController({
    snapshot,
    repertoire,
    progress: emptyProgress(),
    onProgress: () => {},
    now: () => time,
    random,
  });
  const targets: string[] = [];
  for (let i = 0; i < lines; i += 1) {
    controller.next();
    const view = controller.view();
    targets.push(view.target?.key ?? 'none');
    for (let guard = 0; guard < 40; guard += 1) {
      const card = controller.view().card;
      if (!card) break;
      if (userRandom() >= skill) controller.answer('a1a1', '??');
      controller.answer(card.move.uci, card.move.san);
      time += stepMs;
    }
  }
  return { targets, controller, time: () => time };
}

/** Longest run of the same target in a row. */
function longestRepeat(targets: readonly string[]): number {
  let best = 0;
  let run = 0;
  targets.forEach((target, index) => {
    run = index > 0 && targets[index - 1] === target ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

describe('a long drill sitting on the bundled data', () => {
  it('has a repertoire to drill', () => {
    expect(repertoire.cards.size).toBeGreaterThan(20);
  });

  for (const [label, skill, stepMs] of [
    ['always right, frozen clock', 1, 0],
    ['always right, 20 s per move', 1, 20_000],
    ['often wrong, frozen clock', 0.5, 0],
    ['often wrong, 20 s per move', 0.5, 20_000],
  ] as const) {
    it(`keeps giving new lines (${label})`, () => {
      const { targets } = sitting(200, skill, stepMs, 7);
      expect(longestRepeat(targets)).toBe(1);
      // Late in the sitting (long after every card was seen) the lines still vary.
      expect(new Set(targets.slice(-40)).size).toBeGreaterThanOrEqual(10);
    });
  }

  it('still puts due cards first', () => {
    const { controller } = sitting(200, 0.5, 20_000, 3);
    const progress = controller.currentProgress();
    // After the sitting, move the clock two days on: everything is due, so the next line says so.
    const later = NOW + 1000 * 24 * 60 * 60 * 1000;
    expect(Object.values(progress.cards).some((state) => isDue(state, later))).toBe(true);
    const fresh = new DrillController({
      snapshot,
      repertoire,
      progress,
      onProgress: () => {},
      now: () => later,
      random: seeded(1),
    });
    fresh.next();
    expect(fresh.view().targetReason).toBe('due');
  });
});
