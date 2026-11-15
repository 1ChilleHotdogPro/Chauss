import { describe, expect, it } from 'vitest';
import type { AnalyseRequest } from '../engine/engine';
import type { UciScore } from '../engine/uci';
import type { AnalysisEngine } from './analysis';
import { NO_BOOK, type BookLookup } from './book';
import { GameAnalyser, type GameMove, type GameReport } from './gameAnalyser';

// Fool's mate: 1.f3 e5 2.g4 Qh4#. Engine answers below are made up for the test.
const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const MOVES: GameMove[] = [
  { san: 'f3', uci: 'f2f3', fenAfter: 'rnbqkbnr/pppppppp/8/8/8/5P2/PPPPP1PP/RNBQKBNR b KQkq - 0 1' },
  { san: 'e5', uci: 'e7e5', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/8/5P2/PPPPP1PP/RNBQKBNR w KQkq - 0 2' },
  { san: 'g4', uci: 'g2g4', fenAfter: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq - 0 2' },
  { san: 'Qh4#', uci: 'd8h4', fenAfter: 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3' },
];

class FakeEngine implements AnalysisEngine {
  requests: AnalyseRequest[] = [];
  stops = 0;
  analyse(request: AnalyseRequest): void {
    this.requests.push(request);
  }
  stop(): void {
    this.stops += 1;
  }
  answer(lines: { score: UciScore; pv: string[] }[]): void {
    const request = this.requests.at(-1)!;
    lines.forEach((line, index) => request.onInfo({ depth: 10, multipv: index + 1, ...line }));
    request.onDone(lines[0]?.pv[0] ?? null);
  }
}

const cp = (value: number): UciScore => ({ type: 'cp', value });
const mateIn = (value: number): UciScore => ({ type: 'mate', value });

function setup(book: BookLookup = NO_BOOK) {
  const engine = new FakeEngine();
  const analyser = new GameAnalyser(engine, { kind: 'depth', depth: 10 });
  const reports: GameReport[] = [];
  const outcome = analyser.start(START, MOVES, book, (report) => reports.push(report));
  return { engine, analyser, reports, outcome };
}

describe('GameAnalyser', () => {
  it('searches each position in turn with two lines and classifies moves as it goes', async () => {
    const { engine, reports, outcome } = setup();
    expect(engine.requests).toHaveLength(1);
    expect(engine.requests[0]).toMatchObject({ fen: START, depth: 10, multiPv: 2 });

    engine.answer([{ score: cp(30), pv: ['e2e4'] }, { score: cp(25), pv: ['d2d4'] }]);
    expect(reports.at(-1)).toMatchObject({ done: 1, total: 5 });
    expect(reports.at(-1)!.moves[0]).toBeUndefined();

    // After 1.f3, Black to move: Black is slightly better.
    engine.answer([{ score: cp(40), pv: ['e7e5'] }, { score: cp(30), pv: ['d7d5'] }]);
    expect(reports.at(-1)!.moves[0]).toMatchObject({ ply: 1, san: 'f3', color: 'white', bestMove: 'e2e4' });

    // After 1...e5, White to move.
    engine.answer([{ score: cp(-40), pv: ['e2e4'] }, { score: cp(-50), pv: ['g2g3'] }]);
    // After 2.g4??, Black mates in one.
    engine.answer([{ score: mateIn(1), pv: ['d8h4'] }]);
    expect(reports.at(-1)!.moves[2]).toMatchObject({ san: 'g4', classification: 'blunder' });

    // The final position is checkmate: worked out without the engine.
    expect(engine.requests).toHaveLength(4);
    await expect(outcome).resolves.toBe('done');
    const last = reports.at(-1)!;
    expect(last.done).toBe(5);
    expect(last.moves[3]).toMatchObject({ san: 'Qh4#', classification: 'best', color: 'black' });
    expect(last.moves.every(Boolean)).toBe(true);
  });

  it('marks book moves only while every earlier move was book', async () => {
    const book: BookLookup = { isBook: (_fen, uci) => uci === 'f2f3' || uci === 'g2g4' };
    const { engine, reports, outcome } = setup(book);
    engine.answer([{ score: cp(30), pv: ['e2e4'] }]);
    engine.answer([{ score: cp(40), pv: ['e7e5'] }]);
    engine.answer([{ score: cp(-40), pv: ['e2e4'] }]);
    engine.answer([{ score: mateIn(1), pv: ['d8h4'] }]);
    await outcome;
    const labels = reports.at(-1)!.moves.map((move) => move?.classification);
    expect(labels[0]).toBe('book');
    expect(labels[2]).toBe('blunder'); // listed as "book", but the game had already left the book
  });

  it('can be cancelled part-way', async () => {
    const { engine, analyser, reports, outcome } = setup();
    engine.answer([{ score: cp(30), pv: ['e2e4'] }]);
    expect(analyser.running()).toBe(true);
    analyser.cancel();
    await expect(outcome).resolves.toBe('cancelled');
    expect(engine.stops).toBe(1);
    expect(analyser.running()).toBe(false);
    // A late answer for the stopped search changes nothing.
    engine.answer([{ score: cp(40), pv: ['e7e5'] }]);
    expect(reports).toHaveLength(1);
    expect(engine.requests).toHaveLength(2);
  });

  it('searches for a fixed time when asked', () => {
    const engine = new FakeEngine();
    void new GameAnalyser(engine, { kind: 'time', ms: 500 }).start(START, MOVES, NO_BOOK, () => {});
    expect(engine.requests[0]).toMatchObject({ movetime: 500, multiPv: 2 });
  });
});
