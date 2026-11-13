import { describe, expect, it } from 'vitest';
import { buildRepertoire } from '../repertoire/repertoire';
import { positionKey } from '../snapshot/format';
import { buildTestSnapshot, fenAfter, type FakeBook } from '../snapshot/testData';
import { DrillController } from './controller';
import { emptyProgress, type Progress } from './progress';
import { DAY_MS, RELEARN_MS } from './srs';

const P = 'e4 e5 Nf3 Nc6 c3';
const NOW = Date.UTC(2026, 10, 13, 12, 0, 0);
const key = (line: string) => positionKey(fenAfter(line));

// Made-up tree. Repertoire: 3...Nf6 4.d4 (then 4...Nxe4 5.d5), 3...d5 4.Qa4.
// 4.d3 is popular with amateurs and (by the made-up score below) a mistake.
const BOOK: FakeBook = {
  '': { lichess: { e4: 6000 }, masters: { e4: 500 } },
  e4: { lichess: { e5: 5000 }, masters: { e5: 300 } },
  'e4 e5': { lichess: { Nf3: 4000 }, masters: { Nf3: 280 } },
  'e4 e5 Nf3': { lichess: { Nc6: 3000 }, masters: { Nc6: 200 } },
  'e4 e5 Nf3 Nc6': { lichess: { c3: 1000 }, masters: { c3: 10 } },
  [P]: { lichess: { Nf6: 600, d5: 300 }, masters: { Nf6: 6 } },
  [`${P} Nf6`]: { lichess: { d4: 250, d3: 350, Bd3: 50 }, masters: { d4: 6 } },
  [`${P} Nf6 d4`]: { lichess: { Nxe4: 150 }, masters: { Nxe4: 5 } },
  [`${P} Nf6 d4 Nxe4`]: { lichess: { d5: 120 }, masters: { d5: 5 } },
  [`${P} d5`]: { lichess: { Qa4: 200 }, masters: {} },
};

async function setup(progress: Progress = emptyProgress()) {
  const snapshot = await buildTestSnapshot(BOOK, { [`${P} Nf6 d3`]: { type: 'cp', value: -230 } });
  const repertoire = buildRepertoire(snapshot);
  let time = NOW;
  const saved: Progress[] = [];
  const controller = new DrillController({
    snapshot,
    repertoire,
    progress,
    onProgress: (p) => saved.push(p),
    now: () => time,
    random: () => 0, // Black always plays its most common move
  });
  return {
    controller,
    saved,
    repertoire,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('DrillController', () => {
  it('starts with the most common new card and shows what to do', async () => {
    const { controller } = await setup();
    controller.next();
    const view = controller.view();
    expect(view.line).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3', 'Nf6']);
    expect(view.card?.move.san).toBe('d4');
    expect(view.targetReason).toBe('new');
    expect(view.feedback).toEqual({ kind: 'none' });
    expect(view.finished).toBeNull();
    expect(view.counts).toEqual({ due: 0, new: 3, total: 3 });
  });

  it('records a right answer and moves on along the line', async () => {
    const { controller, saved } = await setup();
    controller.next();
    expect(controller.answer('d2d4', 'd4')).toBe('correct');

    const view = controller.view();
    expect(view.feedback).toEqual({ kind: 'correct', text: 'd4 — correct.' });
    expect(view.line.slice(-2)).toEqual(['d4', 'Nxe4']);
    expect(view.card?.move.san).toBe('d5');
    expect(view.lineScore).toEqual({ right: 1, asked: 1 });
    expect(view.sittingScore).toEqual({ right: 1, asked: 1 });

    // Stored at once, due tomorrow.
    expect(saved).toHaveLength(1);
    const state = saved[0]!.cards[key(`${P} Nf6`)]!;
    expect(state).toMatchObject({ attempts: 1, errors: 0, streak: 1, due: NOW + DAY_MS });
    expect(view.counts).toEqual({ due: 0, new: 2, total: 3 });
  });

  it('explains a wrong move, shows the right one, and counts the miss once', async () => {
    const { controller, saved } = await setup();
    controller.next();

    expect(controller.answer('d2d3', 'd3')).toBe('wrong');
    const view = controller.view();
    expect(view.feedback.kind).toBe('wrong');
    if (view.feedback.kind === 'wrong') {
      expect(view.feedback.hint).toBe('d2d4');
      expect(view.feedback.text).toMatch(/^d3 is not the repertoire move, and Stockfish calls it a mistake: your winning chances drop from \d+% to \d+%\./);
      expect(view.feedback.text).toMatch(/The repertoire move is d4\. Masters play it in 100% of their games here \(6 games\)/);
    }
    // The position has not changed.
    expect(view.line.at(-1)).toBe('Nf6');
    expect(view.card?.move.san).toBe('d4');

    // Another wrong try is explained but not counted again.
    expect(controller.answer('f1d3', 'Bd3')).toBe('wrong');
    expect(controller.view().feedback).toMatchObject({ kind: 'wrong' });
    expect(saved).toHaveLength(1);
    expect(saved[0]!.cards[key(`${P} Nf6`)]).toMatchObject({ attempts: 1, errors: 1, due: NOW + RELEARN_MS });

    // Finding it afterwards continues the line without a second record for that card.
    expect(controller.answer('d2d4', 'd4')).toBe('correct');
    expect(controller.view().feedback).toEqual({ kind: 'correct', text: 'd4 — that is the one.' });
    expect(saved).toHaveLength(1);
    expect(controller.view().lineScore).toEqual({ right: 0, asked: 1 });
    expect(controller.view().sittingScore).toEqual({ right: 0, asked: 1 });
  });

  it('says less about a wrong move the data does not know', async () => {
    const { controller } = await setup();
    controller.next();
    controller.answer('h2h4', 'h4');
    const feedback = controller.view().feedback;
    expect(feedback.kind === 'wrong' && feedback.text).toMatch(/^h4 is not the repertoire move\. The repertoire move is d4\./);
  });

  it('ends the line where the data ends, and the next line aims at another card', async () => {
    const { controller } = await setup();
    controller.next();
    controller.answer('d2d4', 'd4');
    controller.answer('d4d5', 'd5');
    const done = controller.view();
    expect(done.finished).toBe('end-of-data');
    expect(done.card).toBeNull();
    expect(done.lineScore).toEqual({ right: 2, asked: 2 });
    expect(controller.answer('a2a3', 'a3')).toBe('ignored');

    controller.next();
    const next = controller.view();
    // random() is 0, which would mean 3...Nf6 again — but the remaining new card is after 3...d5.
    expect(next.line).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'c3', 'd5']);
    expect(next.card?.move.san).toBe('Qa4');
    expect(next.feedback).toEqual({ kind: 'none' });
    expect(next.sittingScore).toEqual({ right: 2, asked: 2 });
  });

  it('brings a missed card back when it is due', async () => {
    const { controller, advance } = await setup();
    controller.next();
    controller.answer('d2d3', 'd3'); // miss the first card
    controller.answer('d2d4', 'd4');
    controller.answer('d4d5', 'd5');
    controller.next(); // 3...d5 line
    controller.answer('d1a4', 'Qa4');

    advance(RELEARN_MS + 1000);
    controller.next();
    const view = controller.view();
    expect(view.targetReason).toBe('due');
    expect(view.card?.move.san).toBe('d4');
    expect(view.counts.due).toBe(1);
  });

  it('continues from progress made earlier', async () => {
    const earlier: Progress = {
      version: 1,
      cards: {
        [key(`${P} Nf6`)]: { streak: 3, intervalDays: 16, ease: 2.6, due: NOW + 10 * DAY_MS, attempts: 3, errors: 0, lastSeen: NOW - 6 * DAY_MS },
      },
    };
    const { controller } = await setup(earlier);
    controller.next();
    // The known card is not due: the first line aims at a new one.
    expect(controller.view().targetReason).toBe('new');
    expect(controller.view().counts).toEqual({ due: 0, new: 2, total: 3 });
    expect(controller.currentProgress()).toBe(earlier);
  });

  it('does not push a card further away when it is answered before it is due', async () => {
    const cardKey = key(`${P} Nf6`);
    const { controller, saved } = await setup();
    controller.next();
    controller.answer('d2d4', 'd4'); // first time: due tomorrow
    const first = saved.at(-1)!.cards[cardKey]!;
    expect(first).toMatchObject({ streak: 1, intervalDays: 1, due: NOW + DAY_MS });

    // Finish this line and the other one; with everything seen, the next line starts over
    // through the same position — moments later, long before it is due.
    controller.answer('d4d5', 'd5');
    controller.next();
    controller.answer('d1a4', 'Qa4');
    controller.next();
    expect(controller.view().card?.key).toBe(cardKey);
    expect(controller.view().targetReason).toBe('ahead');
    controller.answer('d2d4', 'd4');

    const again = saved.at(-1)!.cards[cardKey]!;
    expect(again.attempts).toBe(2); // it is counted ...
    expect(again).toMatchObject({ streak: 1, intervalDays: 1, due: NOW + DAY_MS, ease: first.ease }); // ... but not rescheduled
  });

  it('still records a miss on a card that was not due', async () => {
    const cardKey = key(`${P} Nf6`);
    const { controller, saved } = await setup();
    controller.next();
    controller.answer('d2d4', 'd4');
    controller.answer('d4d5', 'd5');
    controller.next();
    controller.answer('d1a4', 'Qa4');
    controller.next();
    expect(controller.view().card?.key).toBe(cardKey);
    controller.answer('d2d3', 'd3');
    expect(saved.at(-1)!.cards[cardKey]).toMatchObject({ attempts: 2, errors: 1, streak: 0, due: NOW + RELEARN_MS });
  });

  it('can have its progress replaced (import, reset)', async () => {
    const { controller } = await setup();
    controller.next();
    controller.answer('d2d4', 'd4');
    controller.setProgress(emptyProgress());
    expect(controller.view().counts).toEqual({ due: 0, new: 3, total: 3 });
  });
});
