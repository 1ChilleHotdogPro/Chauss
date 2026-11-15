import { describe, expect, it } from 'vitest';
import { capturesOnReply, judgeMove, moveLimit, starsFor, wrongText, type JudgeInput } from './judge';

const mateInput = (overrides: Partial<JudgeInput>): JudgeInput => ({
  goal: 'mate',
  slack: 2,
  before: { score: { type: 'mate', value: 5 }, pv: ['d1d7'] },
  statusAfter: 'playing',
  after: { score: { type: 'mate', value: -4 }, pv: ['e8f8'] },
  replyCaptures: false,
  movesMade: 1,
  par: 5,
  ...overrides,
});

describe('judging a move in a mate drill', () => {
  it('accepts the best move (mate in 5 becomes mate in 4 after it)', () => {
    expect(judgeMove(mateInput({}))).toEqual({ ok: true, done: false });
  });
  it('accepts a slower move within the slack', () => {
    // Mate in 5 before; after this move mate in 6 more: 7 in total, 2 slower than best.
    expect(judgeMove(mateInput({ after: { score: { type: 'mate', value: -6 }, pv: [] } }))).toEqual({ ok: true, done: false });
  });
  it('rejects a move that is too slow', () => {
    expect(judgeMove(mateInput({ after: { score: { type: 'mate', value: -7 }, pv: [] } }))).toEqual({ ok: false, reason: 'slow' });
  });
  it('finishes on checkmate', () => {
    expect(judgeMove(mateInput({ statusAfter: 'checkmate', after: null }))).toEqual({ ok: true, done: true });
  });
  it('rejects stalemate', () => {
    expect(judgeMove(mateInput({ statusAfter: 'stalemate', after: null }))).toEqual({ ok: false, reason: 'stalemate' });
  });
  it('rejects a move that gives up the mate, and says so when the reply takes a piece', () => {
    const noMate = { score: { type: 'cp' as const, value: 0 }, pv: ['e8d7'] };
    expect(judgeMove(mateInput({ after: noMate }))).toEqual({ ok: false, reason: 'lost' });
    expect(judgeMove(mateInput({ after: noMate, replyCaptures: true }))).toEqual({ ok: false, reason: 'hangs' });
  });
  it('rejects a move after which the other side is the one mating', () => {
    expect(judgeMove(mateInput({ after: { score: { type: 'mate', value: 3 }, pv: [] } }))).toEqual({ ok: false, reason: 'lost' });
  });
  it('without a mate score before the move, only asks that a mate stays on', () => {
    const before = { score: { type: 'cp' as const, value: 900 }, pv: [] };
    expect(judgeMove(mateInput({ before, after: { score: { type: 'mate', value: -20 }, pv: [] } }))).toEqual({ ok: true, done: false });
  });
});

describe('judging a move in win and draw drills', () => {
  it('win: keeps a clear advantage, and is done after par moves', () => {
    const base = mateInput({ goal: 'win', par: 3 });
    expect(judgeMove({ ...base, after: { score: { type: 'cp', value: -450 }, pv: [] }, movesMade: 1 })).toEqual({ ok: true, done: false });
    expect(judgeMove({ ...base, after: { score: { type: 'cp', value: -450 }, pv: [] }, movesMade: 3 })).toEqual({ ok: true, done: true });
    expect(judgeMove({ ...base, after: { score: { type: 'cp', value: -20 }, pv: [] } })).toEqual({ ok: false, reason: 'lost' });
    expect(judgeMove({ ...base, statusAfter: 'stalemate', after: null })).toEqual({ ok: false, reason: 'stalemate' });
  });
  it('draw: holds unless the position becomes lost; a draw by the rules finishes it', () => {
    const base = mateInput({ goal: 'draw', par: 5 });
    expect(judgeMove({ ...base, after: { score: { type: 'cp', value: 90 }, pv: [] } })).toEqual({ ok: true, done: false });
    expect(judgeMove({ ...base, after: { score: { type: 'cp', value: 400 }, pv: [] } })).toEqual({ ok: false, reason: 'lost' });
    expect(judgeMove({ ...base, after: { score: { type: 'mate', value: 6 }, pv: [] } })).toEqual({ ok: false, reason: 'lost' });
    expect(judgeMove({ ...base, statusAfter: 'draw', after: null })).toEqual({ ok: true, done: true });
  });
});

describe('helpers', () => {
  it('sees whether a reply lands on an occupied square', () => {
    const fen = '7k/6Q1/8/6K1/8/8/8/8 b - - 0 1';
    expect(capturesOnReply(fen, ['h8g7'])).toBe(true);
    expect(capturesOnReply(fen, ['h8g8'])).toBe(false);
    expect(capturesOnReply(fen, [])).toBe(false);
  });
  it('explains each kind of wrong move, naming the better move', () => {
    expect(wrongText('stalemate', 'mate', 'Qf8#')).toMatch(/Stalemate.*Qf8# was better/);
    expect(wrongText('hangs', 'mate', null)).toMatch(/taken/);
    expect(wrongText('lost', 'mate', 'Kg6')).toMatch(/no forced mate/);
    expect(wrongText('slow', 'mate', null)).toMatch(/longer/);
  });
  it('gives stars for clean, fast solutions', () => {
    const drill = { goal: 'mate' as const, judging: { slack: 2, extraMoves: 6, depth: 20 } };
    expect(starsFor({ solved: true, mistakes: 0, moves: 6, par: 5, drill })).toBe(3);
    expect(starsFor({ solved: true, mistakes: 0, moves: 8, par: 5, drill })).toBe(2);
    expect(starsFor({ solved: true, mistakes: 2, moves: 5, par: 5, drill })).toBe(1);
    expect(starsFor({ solved: false, mistakes: 0, moves: 11, par: 5, drill })).toBe(0);
    expect(moveLimit(5, drill)).toBe(11);
  });
});
