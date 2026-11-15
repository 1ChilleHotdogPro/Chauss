import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { EndgameController, type PositionResult } from './controller';
import type { EndgameDrill } from './drills';
import type { SearchResult } from './judge';
import type { Search } from './search';

/** Black king h8, White king g6, White queen f1: Qf8 is mate, Qf7 is stalemate, Qb1 mates next move. */
const START = '7k/8/6K1/8/8/8/8/5Q2 w - - 0 1';

const after = (fen: string, ...moves: string[]): string => {
  const chess = new Chess(fen);
  for (const move of moves) chess.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
  return chess.fen();
};

const testDrill = (overrides: Partial<EndgameDrill> = {}): EndgameDrill => ({
  id: 'test',
  title: 'Test',
  skill: 'Testing',
  description: '',
  material: 'KQvK',
  goal: 'mate',
  judging: { slack: 2, extraMoves: 6, depth: 10 },
  positions: [
    { id: 'one', fen: START, par: 1 },
    { id: 'two', fen: after(START, 'g6f6'), par: 1 },
  ],
  ...overrides,
});

/** Stockfish as a table: position -> answer. A position missing from the table is a test error. */
function fakeSearch(table: Record<string, SearchResult>): Search & { asked: string[] } {
  const asked: string[] = [];
  const search = (fen: string) => {
    asked.push(fen);
    const answer = table[fen];
    return answer ? Promise.resolve(answer) : Promise.reject(new Error(`no answer for ${fen}`));
  };
  return Object.assign(search, { asked });
}

const TABLE: Record<string, SearchResult> = {
  [START]: { score: { type: 'mate', value: 1 }, pv: ['f1f8'] },
  // Qb1: Black's only move is Kg8, then Qb8 is mate.
  [after(START, 'f1b1')]: { score: { type: 'mate', value: -1 }, pv: ['h8g8', 'b1b8'] },
  [after(START, 'f1b1', 'h8g8')]: { score: { type: 'mate', value: 1 }, pv: ['b1b8'] },
  // Qa1: a quiet move that (for this test) gives up the mate.
  [after(START, 'f1a1')]: { score: { type: 'cp', value: 0 }, pv: ['h8g8'] },
  [after(START, 'g6f6')]: { score: { type: 'mate', value: 1 }, pv: ['f1h3'] },
};

function setup(drill = testDrill(), table = TABLE) {
  const results: PositionResult[] = [];
  let changes = 0;
  const controller = new EndgameController({
    drill,
    search: fakeSearch(table),
    onChange: () => {
      changes += 1;
    },
    onResult: (_, result) => results.push(result),
    wait: async () => {},
  });
  controller.start(0);
  return { controller, results, changes: () => changes };
}

describe('EndgameController', () => {
  it('starts at the first position with the user to move', () => {
    const { controller } = setup();
    const view = controller.view();
    expect(view.state).toBe('your-move');
    expect(view.fen).toBe(START);
    expect(view.side).toBe('white');
    expect(view.moveLimit).toBe(7);
  });

  it('solves a position with the mating move: three stars', async () => {
    const { controller, results } = setup();
    expect(await controller.play('f1f8')).toBe(true);
    const view = controller.view();
    expect(view.state).toBe('solved');
    expect(view.sans).toEqual(['Qf8#']);
    expect(view.feedback).toEqual({ kind: 'solved', text: 'Checkmate with Qf8#!' });
    expect(results).toEqual([{ solved: true, stars: 3, moves: 1, mistakes: 0 }]);
  });

  it('takes back a stalemating move, explains it and shows the right move', async () => {
    const { controller } = setup();
    await controller.play('f1f7');
    const view = controller.view();
    expect(view.state).toBe('your-move');
    expect(view.fen).toBe(START);
    expect(view.sans).toEqual([]);
    expect(view.mistakes).toBe(1);
    expect(view.feedback.kind).toBe('wrong');
    if (view.feedback.kind === 'wrong') {
      expect(view.feedback.hint).toBe('f1f8');
      expect(view.feedback.text).toMatch(/^Qf7\? Stalemate!.*Qf8# was better/);
    }
  });

  it('takes back a move that gives up the mate', async () => {
    const { controller } = setup();
    await controller.play('f1a1');
    expect(controller.view().feedback.kind).toBe('wrong');
    expect(controller.view().fen).toBe(START);
  });

  it('accepts a slower move, lets the defender reply, then mates: one star after a mistake', async () => {
    const { controller, results } = setup();
    await controller.play('f1f7'); // stalemate: wrong
    await controller.play('f1b1'); // mate in 2 instead of 1: within the slack
    let view = controller.view();
    expect(view.state).toBe('your-move');
    expect(view.sans).toEqual(['Qb1', 'Kg8']);
    expect(view.movesMade).toBe(1);
    await controller.play('b1b8');
    view = controller.view();
    expect(view.state).toBe('solved');
    expect(results).toEqual([{ solved: true, stars: 1, moves: 2, mistakes: 1 }]);
  });

  it('fails the position when the move limit is reached', async () => {
    const { controller, results } = setup(testDrill({ judging: { slack: 2, extraMoves: 0, depth: 10 } }));
    await controller.play('f1b1');
    expect(controller.view().state).toBe('failed');
    expect(controller.view().feedback.kind).toBe('failed');
    expect(results).toEqual([{ solved: false, stars: 0, moves: 1, mistakes: 0 }]);
  });

  it('ignores illegal moves and moves while it is not the user’s turn', async () => {
    const { controller } = setup();
    expect(await controller.play('f1f2f3')).toBe(false);
    expect(await controller.play('h8h7')).toBe(false);
    await controller.play('f1f8');
    expect(await controller.play('g6g7')).toBe(false);
  });

  it('retry restarts the position; next moves on and ends the run with a summary', async () => {
    const { controller } = setup();
    await controller.play('f1f8');
    controller.retry();
    expect(controller.view().state).toBe('your-move');
    expect(controller.view().sans).toEqual([]);
    expect(controller.view().results[0]).toMatchObject({ solved: true });

    controller.next();
    expect(controller.view().index).toBe(1);
    expect(controller.view().runFinished).toBe(false);
    controller.next();
    expect(controller.view().runFinished).toBe(true);

    controller.restartRun();
    expect(controller.view().index).toBe(0);
    expect(controller.view().results).toEqual([null, null]);
  });

  it('reports an engine failure instead of hanging', async () => {
    const { controller } = setup(testDrill(), {});
    await controller.play('f1f8');
    // Checkmate needs no search after the move, but the search before it failed.
    expect(controller.view().state).toBe('engine-failed');
    expect(controller.view().error).toMatch(/Stockfish could not check the move/);
  });

  it('drops the answer of a search that belongs to a position that was left', async () => {
    let release: (result: SearchResult) => void = () => {};
    const slow: Search = (fen) =>
      fen === START ? new Promise((resolve) => (release = resolve)) : Promise.resolve(TABLE[fen]!);
    const controller = new EndgameController({ drill: testDrill(), search: slow, onChange: () => {}, wait: async () => {} });
    controller.start(0);
    const judging = controller.play('f1f8');
    controller.next(); // leave while the move is being judged
    release(TABLE[START]!);
    await judging;
    expect(controller.view().index).toBe(1);
    expect(controller.view().state).toBe('your-move');
    expect(controller.view().results).toEqual([null, null]);
  });

});
