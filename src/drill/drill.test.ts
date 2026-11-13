import { describe, expect, it } from 'vitest';
import type { Score } from '../analysis/eval';
import { buildRepertoire, type Card, type Repertoire } from '../repertoire/repertoire';
import { assembleSnapshot, positionsToEvaluate } from '../snapshot/assemble';
import { crawl, type CrawlThresholds } from '../snapshot/crawl';
import { positionKey, type Snapshot } from '../snapshot/format';
import { fakeSource, fenAfter, type FakeBook } from '../snapshot/testData';
import { emptyProgress, type Progress } from './progress';
import { countCards, pickTarget } from './select';
import { DrillSession } from './session';
import { DAY_MS, newCardState, review } from './srs';

const ROOT = ['e4', 'e5', 'Nf3', 'Nc6', 'c3'];
const P = 'e4 e5 Nf3 Nc6 c3';
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const THRESHOLDS: CrawlThresholds = { minShare: 0.03, minGamesLichess: 100, minGamesMasters: 5, maxPly: 30, maxPositions: 1000 };
const cp = (value: number): Score => ({ type: 'cp', value });
const key = (line: string) => positionKey(fenAfter(line));

// Made-up tree. Repertoire: 3...Nf6 4.d4, then 4...Nxe4 5.d5 / 4...exd4 5.e5; 3...d5 4.Qa4.
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000 }, masters: { e4: 500 } },
  e4: { lichess: { e5: 5000 }, masters: { e5: 300 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 1000 }, masters: { c3: 10 } },
  [P]: { lichess: { Nf6: 600, d5: 300 }, masters: { Nf6: 6 } },
  [`${P} Nf6`]: { lichess: { d4: 250, d3: 350 }, masters: { d4: 6 } },
  [`${P} Nf6 d4`]: { lichess: { Nxe4: 150, exd4: 100 }, masters: { Nxe4: 5 } },
  [`${P} Nf6 d4 Nxe4`]: { lichess: { d5: 120 }, masters: { d5: 5 } },
  [`${P} Nf6 d4 exd4`]: { lichess: { e5: 100 }, masters: {} },
  [`${P} d5`]: { lichess: { Qa4: 200 }, masters: {} },
};

async function setup(): Promise<{ snapshot: Snapshot; repertoire: Repertoire; card: (line: string) => Card }> {
  const result = await crawl(fakeSource(BOOK), { rootLine: ROOT, thresholds: THRESHOLDS });
  const evals = new Map<string, Score>();
  for (const k of positionsToEvaluate(result, { listShare: 0.01, maxListedMoves: 12 }).keys()) evals.set(k, cp(20));
  const snapshot = assembleSnapshot(result, evals, {
    formatVersion: 1,
    createdAt: '2026-11-13T10:00:00.000Z',
    explorerHost: 'https://explorer.lichess.org',
    lichess: { ratings: [1000, 1200], speeds: ['blitz'] },
    rootLine: ROOT,
    thresholds: { ...THRESHOLDS, listShare: 0.01, maxListedMoves: 12 },
    engine: { name: 'Test Engine', depth: 18 },
    counts: { explorerRequests: 0, evaluations: 0 },
  });
  const repertoire = buildRepertoire(snapshot);
  return { snapshot, repertoire, card: (line) => repertoire.cards.get(key(line))! };
}

/** A "random" source that always returns the same number. */
const always = (value: number) => () => value;

describe('DrillSession', () => {
  it('starts at the opening, plays Black, and asks for the repertoire move', async () => {
    const { snapshot, repertoire } = await setup();
    const session = new DrillSession(snapshot, repertoire, null, always(0)); // 0 -> Black's most played move
    expect(session.line()).toEqual([...ROOT, 'Nf6']);
    expect(session.fen()).toBe(fenAfter(`${P} Nf6`));
    expect(session.card()?.move.san).toBe('d4');
    expect(session.lastBlackMove()?.san).toBe('Nf6');
    expect(session.finished()).toBeNull();
  });

  it('follows a whole line when every answer is right', async () => {
    const { snapshot, repertoire } = await setup();
    const session = new DrillSession(snapshot, repertoire, null, always(0));

    expect(session.answer('d2d4')).toMatchObject({ result: 'correct', firstTry: true });
    expect(session.line()).toEqual([...ROOT, 'Nf6', 'd4', 'Nxe4']);
    expect(session.card()?.move.san).toBe('d5');

    expect(session.answer('d4d5')).toMatchObject({ result: 'correct', firstTry: true });
    // The bundled data ends after 5.d5.
    expect(session.finished()).toBe('end-of-data');
    expect(session.card()).toBeNull();
    expect(session.line()).toEqual([...ROOT, 'Nf6', 'd4', 'Nxe4', 'd5']);
    expect(session.steps().map((step) => [step.card.move.san, step.firstTry])).toEqual([
      ['d4', true],
      ['d5', true],
    ]);
    expect(session.answer('a2a3')).toEqual({ result: 'ignored' });
  });

  it('keeps asking after a wrong move and remembers that it was not first try', async () => {
    const { snapshot, repertoire } = await setup();
    const session = new DrillSession(snapshot, repertoire, null, always(0));

    const wrong = session.answer('d2d3');
    expect(wrong.result).toBe('wrong');
    if (wrong.result === 'wrong') {
      expect(wrong.card.move.san).toBe('d4');
      expect(wrong.played?.san).toBe('d3'); // a move the data knows about
    }
    expect(session.missedHere()).toBe(true);
    expect(session.line()).toEqual([...ROOT, 'Nf6']); // nothing was played

    const unknown = session.answer('h2h4'); // a move the data has never seen
    expect(unknown).toMatchObject({ result: 'wrong', played: undefined });

    expect(session.answer('d2d4')).toMatchObject({ result: 'correct', firstTry: false });
    expect(session.missedHere()).toBe(false);
    expect(session.steps()).toHaveLength(1);
    expect(session.steps()[0]?.firstTry).toBe(false);
  });

  it("draws Black's moves in proportion to how often they are played", async () => {
    const { snapshot, repertoire } = await setup();
    // At the opening position: Nf6 600, d5 300 -> Nf6 for the first two thirds of the range.
    expect(new DrillSession(snapshot, repertoire, null, always(0.66)).line().at(-1)).toBe('Nf6');
    expect(new DrillSession(snapshot, repertoire, null, always(0.67)).line().at(-1)).toBe('d5');
    expect(new DrillSession(snapshot, repertoire, null, always(0.999)).line().at(-1)).toBe('d5');

    // Over many draws the split is about two to one.
    let seed = 12345;
    const random = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    let nf6 = 0;
    for (let i = 0; i < 3000; i++) if (new DrillSession(snapshot, repertoire, null, random).line().at(-1) === 'Nf6') nf6 += 1;
    expect(nf6 / 3000).toBeGreaterThan(0.62);
    expect(nf6 / 3000).toBeLessThan(0.71);
  });

  it('steers Black towards the target card, whatever the dice say', async () => {
    const { snapshot, repertoire, card } = await setup();
    const target = card(`${P} Nf6 d4 exd4`); // needs 3...Nf6 and the rarer 4...exd4
    const session = new DrillSession(snapshot, repertoire, target, always(0.999)); // dice favour the last reply
    expect(session.line()).toEqual([...ROOT, 'Nf6']); // not d5, although the dice said so
    session.answer('d2d4');
    expect(session.line()).toEqual([...ROOT, 'Nf6', 'd4', 'exd4']);
    expect(session.card()).toBe(target);
  });

  it('goes back to the dice once the target has been passed', async () => {
    const { snapshot, repertoire, card } = await setup();
    const target = card(`${P} Nf6`);
    const session = new DrillSession(snapshot, repertoire, target, always(0.999));
    expect(session.card()).toBe(target);
    session.answer('d2d4');
    expect(session.line().at(-1)).toBe('exd4'); // the dice chose the last reply
  });

  it('reaches a card on a different first move when that is the target', async () => {
    const { snapshot, repertoire, card } = await setup();
    const session = new DrillSession(snapshot, repertoire, card(`${P} d5`), always(0));
    expect(session.line()).toEqual([...ROOT, 'd5']);
    expect(session.card()?.move.san).toBe('Qa4');
  });
});

describe('pickTarget and countCards', () => {
  const seen = (correct: boolean, when: number) => review(newCardState(), correct, when);

  it('starts with new cards, the most common first', async () => {
    const { repertoire, card } = await setup();
    const picked = pickTarget(repertoire.cards.values(), emptyProgress(), NOW);
    expect(picked?.reason).toBe('new');
    expect(picked?.card).toBe(card(`${P} Nf6`)); // comes up in two thirds of games
    expect(countCards(repertoire.cards.values(), emptyProgress(), NOW)).toEqual({ due: 0, new: 4, total: 4 });
  });

  it('puts due cards before new ones, the longest overdue first', async () => {
    const { repertoire, card } = await setup();
    const progress: Progress = {
      version: 1,
      cards: {
        [card(`${P} Nf6`).key]: seen(true, NOW - 3 * DAY_MS), // due 2 days ago
        [card(`${P} d5`).key]: seen(true, NOW - 10 * DAY_MS), // due 9 days ago
        [card(`${P} Nf6 d4 Nxe4`).key]: seen(true, NOW - 1000), // due tomorrow
      },
    };
    expect(pickTarget(repertoire.cards.values(), progress, NOW)).toEqual({ card: card(`${P} d5`), reason: 'due' });
    expect(countCards(repertoire.cards.values(), progress, NOW)).toEqual({ due: 2, new: 1, total: 4 });
  });

  it('treats a card missed a while ago as due', async () => {
    const { repertoire, card } = await setup();
    const progress: Progress = { version: 1, cards: { [card(`${P} Nf6 d4 exd4`).key]: seen(false, NOW - 60 * 60 * 1000) } };
    expect(pickTarget(repertoire.cards.values(), progress, NOW)).toEqual({ card: card(`${P} Nf6 d4 exd4`), reason: 'due' });
  });

  it('practises ahead when nothing is due or new: the card due soonest', async () => {
    const { repertoire, card } = await setup();
    const progress: Progress = { version: 1, cards: {} };
    const lines = [`${P} Nf6`, `${P} d5`, `${P} Nf6 d4 Nxe4`, `${P} Nf6 d4 exd4`];
    lines.forEach((line, index) => {
      progress.cards[card(line).key] = seen(true, NOW - index * 1000); // the last one was seen earliest
    });
    expect(pickTarget(repertoire.cards.values(), progress, NOW)).toEqual({ card: card(`${P} Nf6 d4 exd4`), reason: 'ahead' });
    expect(countCards(repertoire.cards.values(), progress, NOW)).toEqual({ due: 0, new: 0, total: 4 });
  });

  it('skips cards already drilled in this sitting, unless nothing else is left', async () => {
    const { repertoire, card } = await setup();
    const first = card(`${P} Nf6`);
    const picked = pickTarget(repertoire.cards.values(), emptyProgress(), NOW, new Set([first.key]));
    expect(picked?.card).not.toBe(first);
    const all = new Set([...repertoire.cards.keys()]);
    expect(pickTarget(repertoire.cards.values(), emptyProgress(), NOW, all)?.card).toBe(first);
  });

  it('has nothing to pick from an empty repertoire', () => {
    expect(pickTarget([], emptyProgress(), NOW)).toBeNull();
  });
});
