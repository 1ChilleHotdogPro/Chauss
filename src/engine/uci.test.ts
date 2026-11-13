import { describe, expect, it } from 'vitest';
import { parseBestMove, parseInfo } from './uci';

describe('parseInfo', () => {
  it('parses a normal line (copied from real Stockfish 19 Lite output)', () => {
    const info = parseInfo(
      'info depth 12 seldepth 20 multipv 1 score cp 31 nodes 74428 nps 865441 hashfull 27 time 86 pv e2e4 e7e5 g1f3 b8c6',
    );
    expect(info).toEqual({
      depth: 12,
      multipv: 1,
      score: { type: 'cp', value: 31 },
      pv: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
      nodes: 74428,
      timeMs: 86,
    });
  });

  it('parses the second and third lines and negative scores', () => {
    const info = parseInfo(
      'info depth 6 seldepth 9 multipv 2 score cp -180 nodes 1426 nps 203714 hashfull 0 time 7 pv h5e2 c6d4',
    );
    expect(info?.multipv).toBe(2);
    expect(info?.score).toEqual({ type: 'cp', value: -180 });
  });

  it('parses mate scores', () => {
    expect(parseInfo('info depth 1 seldepth 3 multipv 1 score mate 1 nodes 140 pv h5f7')?.score).toEqual({
      type: 'mate',
      value: 1,
    });
    expect(parseInfo('info depth 9 multipv 1 score mate -3 pv e8e7 h5f7')?.score).toEqual({
      type: 'mate',
      value: -3,
    });
  });

  it('parses the game-over lines, which have no moves', () => {
    // Real output for a checkmated and a stalemated side to move.
    expect(parseInfo('info depth 0 score mate 0')).toEqual({
      depth: 0,
      multipv: 1,
      score: { type: 'mate', value: 0 },
      pv: [],
    });
    expect(parseInfo('info depth 0 score cp 0')?.score).toEqual({ type: 'cp', value: 0 });
  });

  it('flags lower and upper bounds', () => {
    expect(parseInfo('info depth 20 multipv 1 score cp 45 lowerbound nodes 9 pv e2e4')?.bound).toBe('lower');
    expect(parseInfo('info depth 20 multipv 1 score cp 12 upperbound nodes 9 pv e2e4')?.bound).toBe('upper');
    expect(parseInfo('info depth 20 multipv 1 score cp 12 nodes 9 pv e2e4')?.bound).toBeUndefined();
  });

  it('ignores lines without a score', () => {
    expect(parseInfo('info string Network replica 1: Local memory.')).toBeNull();
    expect(parseInfo('info depth 15 currmove e2e4 currmovenumber 1')).toBeNull();
    expect(parseInfo('bestmove e2e4 ponder e7e5')).toBeNull();
    expect(parseInfo('readyok')).toBeNull();
    expect(parseInfo('')).toBeNull();
  });

  it('is not confused by text after "string" that looks like a score', () => {
    expect(parseInfo('info string depth 5 score cp 100 pv e2e4')).toBeNull();
  });
});

describe('parseBestMove', () => {
  it('reads the move', () => {
    expect(parseBestMove('bestmove e2e4 ponder e7e5')).toEqual({ move: 'e2e4' });
    expect(parseBestMove('bestmove h5f7')).toEqual({ move: 'h5f7' });
    expect(parseBestMove('bestmove a7a8q')).toEqual({ move: 'a7a8q' });
  });

  it('returns a null move when the game is over', () => {
    expect(parseBestMove('bestmove (none)')).toEqual({ move: null });
  });

  it('returns null for other lines', () => {
    expect(parseBestMove('info depth 1 score cp 3 pv e2e4')).toBeNull();
    expect(parseBestMove('uciok')).toBeNull();
  });
});
