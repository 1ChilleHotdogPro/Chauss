import { describe, expect, it } from 'vitest';
import { Engine, type AnalyseRequest, type EngineState } from './engine';
import { FakeTransport } from './fakeTransport';
import type { InfoLine } from './uci';

const FEN_A = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const FEN_B = 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
const FEN_C = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';

interface Recorded {
  request: AnalyseRequest;
  infos: InfoLine[];
  done: (string | null)[];
}

function record(fen: string, depth = 12): Recorded {
  const recorded: Recorded = {
    infos: [],
    done: [],
    request: {
      fen,
      depth,
      onInfo: (info) => recorded.infos.push(info),
      onDone: (best) => recorded.done.push(best),
    },
  };
  return recorded;
}

function readyEngine(multiPv = 3) {
  const transport = new FakeTransport();
  const states: EngineState[] = [];
  const engine = new Engine(transport, { multiPv, onStateChange: (s) => states.push(s) });
  transport.completeHandshake();
  transport.takeSent();
  return { transport, engine, states };
}

describe('start-up', () => {
  it('does the UCI handshake in order and sets MultiPV', () => {
    const transport = new FakeTransport();
    const states: EngineState[] = [];
    const engine = new Engine(transport, { multiPv: 3, onStateChange: (s) => states.push(s) });

    expect(engine.state()).toBe('loading');
    expect(transport.takeSent()).toEqual(['uci']);

    transport.emit('Stockfish 19 Lite WASM by the Stockfish developers', 'id name Stockfish 19 Lite WASM');
    transport.emit('option name MultiPV type spin default 1 min 1 max 256', 'uciok');
    expect(transport.takeSent()).toEqual(['setoption name MultiPV value 3', 'isready']);
    expect(engine.state()).toBe('loading');

    transport.emit('readyok');
    expect(engine.state()).toBe('ready');
    expect(engine.name()).toBe('Stockfish 19 Lite WASM');
    expect(states).toEqual(['ready']);
  });

  it('holds a request made before the engine is ready, keeping only the newest', () => {
    const transport = new FakeTransport();
    const engine = new Engine(transport);
    const first = record(FEN_A);
    const second = record(FEN_B);
    engine.analyse(first.request);
    engine.analyse(second.request);
    expect(transport.takeSent()).toEqual(['uci']);

    transport.completeHandshake();
    expect(transport.takeSent()).toEqual([
      'setoption name MultiPV value 1',
      'isready',
      `position fen ${FEN_B}`,
      'go depth 12',
    ]);
  });

  it('reports a load failure and ignores later requests', () => {
    const transport = new FakeTransport();
    const states: EngineState[] = [];
    const engine = new Engine(transport, { onStateChange: (s) => states.push(s) });
    transport.fail('404 not found');
    expect(engine.state()).toBe('failed');
    expect(engine.error()).toBe('404 not found');
    expect(states).toEqual(['failed']);

    transport.takeSent();
    engine.analyse(record(FEN_A).request);
    expect(transport.takeSent()).toEqual([]);
  });
});

describe('searching', () => {
  it('sends position and go, forwards info lines, and reports the best move', () => {
    const { transport, engine } = readyEngine();
    const job = record(FEN_A, 10);
    engine.analyse(job.request);
    expect(transport.takeSent()).toEqual([`position fen ${FEN_A}`, 'go depth 10']);

    transport.emit(
      'info string Network replica 1: Local memory.',
      'info depth 1 seldepth 2 multipv 1 score cp 29 nodes 61 pv e2e4',
      'info depth 1 seldepth 2 multipv 2 score cp 6 nodes 61 pv e2e3',
      'bestmove e2e4 ponder e7e5',
    );
    expect(job.infos.map((i) => [i.depth, i.multipv, i.pv[0]])).toEqual([
      [1, 1, 'e2e4'],
      [1, 2, 'e2e3'],
    ]);
    expect(job.done).toEqual(['e2e4']);
  });

  it('does not forward bound-only scores', () => {
    const { transport, engine } = readyEngine();
    const job = record(FEN_A);
    engine.analyse(job.request);
    transport.emit('info depth 20 multipv 1 score cp 45 lowerbound nodes 9 pv e2e4');
    expect(job.infos).toEqual([]);
  });

  it('reports a null best move when the game is over', () => {
    const { transport, engine } = readyEngine();
    const job = record(FEN_A);
    engine.analyse(job.request);
    transport.emit('info depth 0 score mate 0', 'bestmove (none)');
    expect(job.infos).toHaveLength(1);
    expect(job.done).toEqual([null]);
  });

  it('waits for the old search to end before starting the new one, ignoring its late output', () => {
    const { transport, engine } = readyEngine();
    const first = record(FEN_A);
    const second = record(FEN_B);
    engine.analyse(first.request);
    transport.takeSent();
    transport.emit('info depth 5 multipv 1 score cp 20 pv e2e4');

    engine.analyse(second.request);
    // Only "stop" goes out; the new position must wait.
    expect(transport.takeSent()).toEqual(['stop']);

    // Late output of the old search: must reach neither request.
    transport.emit('info depth 6 multipv 1 score cp 25 pv d2d4');
    expect(first.infos).toHaveLength(1);
    expect(second.infos).toHaveLength(0);

    transport.emit('bestmove d2d4');
    expect(first.done).toEqual([]); // it was replaced, not finished
    expect(transport.takeSent()).toEqual([`position fen ${FEN_B}`, 'go depth 12']);

    transport.emit('info depth 1 multipv 1 score cp -30 pv e7e5', 'bestmove e7e5');
    expect(second.infos.map((i) => i.pv[0])).toEqual(['e7e5']);
    expect(second.done).toEqual(['e7e5']);
  });

  it('keeps only the newest request when several arrive during a search', () => {
    const { transport, engine } = readyEngine();
    const first = record(FEN_A);
    const second = record(FEN_B);
    const third = record(FEN_C);
    engine.analyse(first.request);
    engine.analyse(second.request);
    engine.analyse(third.request);
    expect(transport.takeSent()).toEqual([`position fen ${FEN_A}`, 'go depth 12', 'stop']);

    transport.emit('bestmove e2e4');
    expect(transport.takeSent()).toEqual([`position fen ${FEN_C}`, 'go depth 12']);
    transport.emit('bestmove g1f3');
    expect(first.done).toEqual([]);
    expect(second.done).toEqual([]);
    expect(third.done).toEqual(['g1f3']);
  });

  it('starts the next search straight away when the previous one had finished', () => {
    const { transport, engine } = readyEngine();
    const first = record(FEN_A);
    engine.analyse(first.request);
    transport.emit('bestmove e2e4');
    transport.takeSent();

    engine.analyse(record(FEN_B).request);
    expect(transport.takeSent()).toEqual([`position fen ${FEN_B}`, 'go depth 12']);
  });

  it('lets onDone start the next search', () => {
    const { transport, engine } = readyEngine();
    const second = record(FEN_B);
    engine.analyse({
      fen: FEN_A,
      depth: 12,
      onInfo: () => {},
      onDone: () => engine.analyse(second.request),
    });
    transport.takeSent();
    transport.emit('bestmove e2e4');
    expect(transport.takeSent()).toEqual([`position fen ${FEN_B}`, 'go depth 12']);
  });

  it('stop() ends the search without calling onDone, and a later request still works', () => {
    const { transport, engine } = readyEngine();
    const first = record(FEN_A);
    engine.analyse(first.request);
    transport.takeSent();

    engine.stop();
    engine.stop(); // a second stop sends nothing more
    expect(transport.takeSent()).toEqual(['stop']);

    const second = record(FEN_B);
    engine.analyse(second.request);
    expect(transport.takeSent()).toEqual([]); // still waiting for the old bestmove

    transport.emit('bestmove e2e4');
    expect(first.done).toEqual([]);
    expect(transport.takeSent()).toEqual([`position fen ${FEN_B}`, 'go depth 12']);
  });

  it('changes MultiPV only between searches, and only when a request asks for a different value', () => {
    const { transport, engine } = readyEngine(3);

    // Same as the default: no extra command.
    engine.analyse({ ...record(FEN_A).request, multiPv: 3 });
    expect(transport.takeSent()).toEqual([`position fen ${FEN_A}`, 'go depth 12']);

    // A different value, asked for mid-search: nothing but "stop" until the old search has ended.
    engine.analyse({ ...record(FEN_B).request, multiPv: 256 });
    expect(transport.takeSent()).toEqual(['stop']);
    transport.emit('bestmove e2e4');
    expect(transport.takeSent()).toEqual(['setoption name MultiPV value 256', `position fen ${FEN_B}`, 'go depth 12']);

    // Same value again: not repeated.
    transport.emit('bestmove e7e5');
    engine.analyse({ ...record(FEN_C).request, multiPv: 256 });
    expect(transport.takeSent()).toEqual([`position fen ${FEN_C}`, 'go depth 12']);

    // A request without a value goes back to the default.
    transport.emit('bestmove g1f3');
    engine.analyse(record(FEN_A).request);
    expect(transport.takeSent()).toEqual(['setoption name MultiPV value 3', `position fen ${FEN_A}`, 'go depth 12']);
  });

  it('sets other options (such as Skill Level) before a search, only when they change', () => {
    const { transport, engine } = readyEngine();
    engine.analyse({ ...record(FEN_A).request, options: { 'Skill Level': 3 } });
    expect(transport.takeSent()).toEqual(['setoption name Skill Level value 3', `position fen ${FEN_A}`, 'go depth 12']);

    // Same value: not sent again. A request without options leaves them as they are.
    transport.emit('bestmove e2e4');
    engine.analyse({ ...record(FEN_B).request, options: { 'Skill Level': 3 } });
    expect(transport.takeSent()).toEqual([`position fen ${FEN_B}`, 'go depth 12']);
    transport.emit('bestmove e7e5');
    engine.analyse(record(FEN_C).request);
    expect(transport.takeSent()).toEqual([`position fen ${FEN_C}`, 'go depth 12']);

    // A new value is sent; while a search runs it waits until that search has stopped.
    engine.analyse({ ...record(FEN_A).request, options: { 'Skill Level': 10 } });
    expect(transport.takeSent()).toEqual(['stop']);
    transport.emit('bestmove g1f3');
    expect(transport.takeSent()).toEqual(['setoption name Skill Level value 10', `position fen ${FEN_A}`, 'go depth 12']);
  });

  it('ignores stray output when nothing is being searched', () => {
    const { transport, engine } = readyEngine();
    transport.emit('info depth 3 multipv 1 score cp 10 pv e2e4', 'bestmove e2e4');
    expect(engine.state()).toBe('ready');
    expect(transport.takeSent()).toEqual([]);
  });

  it('dispose() shuts the engine down', () => {
    const { transport, engine } = readyEngine();
    engine.dispose();
    expect(transport.terminated).toBe(true);
  });
});
