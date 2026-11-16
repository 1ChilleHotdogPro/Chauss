import { describe, expect, it } from 'vitest';
import { ARROW_LOOKS, arrowPath, arrowSvg, isKnightJump, screenDelta } from './arrowShape';

/** All x,y points of a path (arc radii and flags skipped). */
function points(d: string): [number, number][] {
  return [...d.matchAll(/[ML](-?[\d.]+),(-?[\d.]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
}

describe('screenDelta', () => {
  it('turns square names into steps on screen, for either side at the bottom', () => {
    expect(screenDelta('e2', 'e4', 'white')).toEqual({ dx: 0, dy: -2 });
    expect(screenDelta('e2', 'e4', 'black')).toEqual({ dx: 0, dy: 2 });
    expect(screenDelta('g1', 'f3', 'white')).toEqual({ dx: -1, dy: -2 });
  });
});

describe('arrowPath', () => {
  it('a straight arrow runs along +x, ends just short of the target centre, and is turned the right way', () => {
    const { d, angle } = arrowPath(0, -2, ARROW_LOOKS[0]!);
    expect(angle).toBe(-90);
    const xs = points(d).map(([x]) => x);
    expect(Math.max(...xs)).toBeGreaterThan(185);
    expect(Math.max(...xs)).toBeLessThan(200);
    expect(Math.min(...xs)).toBe(0);
  });

  it('the head is wider than the shaft', () => {
    const look = ARROW_LOOKS[1]!;
    const ys = points(arrowPath(1, 1, look).d).map(([, y]) => Math.abs(y));
    expect(Math.max(...ys)).toBeGreaterThan(look.half * 1.5);
  });

  it('a knight jump is an L: long leg first, then the turn', () => {
    expect(isKnightJump(-1, -2)).toBe(true);
    expect(isKnightJump(2, 2)).toBe(false);
    // g1-f3 with White below: two up (the first leg), then one to the left.
    const { d, angle } = arrowPath(-1, -2, ARROW_LOOKS[0]!);
    expect(angle).toBe(-90);
    const all = points(d);
    // The first leg reaches about 200 along x; the tip sits one square to the side.
    expect(Math.max(...all.map(([x]) => x))).toBeGreaterThan(200);
    const tip = all[4]!;
    expect(tip[0]).toBe(200);
    expect(Math.abs(tip[1])).toBeGreaterThan(85);
    expect(Math.abs(tip[1])).toBeLessThan(100);
  });

  it('turns the knight arrow the right way: up then left ends left of the start on screen', () => {
    // Rotating local (x, y) by -90 degrees gives screen (y, -x): the tip's screen x is its local y.
    const tip = points(arrowPath(-1, -2, ARROW_LOOKS[0]!).d)[4]!;
    expect(tip[1]).toBeLessThan(0);
    const right = points(arrowPath(1, -2, ARROW_LOOKS[0]!).d)[4]!;
    expect(right[1]).toBeGreaterThan(0);
  });
});

describe('arrowSvg', () => {
  it('is one filled path, centred on the start square', () => {
    const svg = arrowSvg(0, -2, ARROW_LOOKS[0]!, '#3b8a45', 0.9);
    expect(svg).toContain('translate(50 50) rotate(-90)');
    expect(svg).toContain('fill="#3b8a45"');
    expect(svg).toContain('opacity="0.9"');
    expect(svg.match(/<path/g)).toHaveLength(1);
  });
});
