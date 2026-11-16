/**
 * The engine's arrows, drawn as one closed shape each (shaft and head together, so a see-through arrow has
 * no darker spot where they overlap), with a rounded tail. A knight's move gets an L-shaped arrow: the long
 * leg first, then the turn. Pure geometry, so it can be tested; the board puts the result on the board.
 *
 * Units: one square is 100, and (0, 0) is the centre of the square the arrow starts on. y points down
 * (as on screen).
 */

export interface ArrowLook {
  /** Half the shaft's width. */
  half: number;
}

/** Best move first: a bold arrow, then two slimmer ones. */
export const ARROW_LOOKS: readonly ArrowLook[] = [{ half: 9 }, { half: 7 }, { half: 5.5 }];

/** The tip stops this far short of the target square's centre, so it points at the piece, not through it. */
const TIP_GAP = 6;

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Squares between two squares as seen on screen: x to the right, y down. */
export function screenDelta(from: string, to: string, orientation: 'white' | 'black'): { dx: number; dy: number } {
  const files = to.charCodeAt(0) - from.charCodeAt(0);
  const ranks = Number(to[1]) - Number(from[1]);
  const sign = orientation === 'white' ? 1 : -1;
  return { dx: sign * files || 0, dy: -sign * ranks || 0 }; // `|| 0`: no -0
}

export function isKnightJump(dx: number, dy: number): boolean {
  const a = Math.abs(dx);
  const b = Math.abs(dy);
  return (a === 1 && b === 2) || (a === 2 && b === 1);
}

/**
 * The arrow's outline as an SVG path, in a frame turned so the (first) leg runs along +x, plus the angle
 * (degrees) to turn it back. `dx`, `dy` are in squares.
 */
export function arrowPath(dx: number, dy: number, look: ArrowLook): { d: string; angle: number } {
  const h = look.half;
  const headHalf = h + 11; // the head is always clearly wider than the shaft
  const headLength = h * 1.3 + 20;

  let legX: number; // first leg, along +x
  let legY = 0; // second leg (knights only), along +y (or -y when turning the other way)
  let angle: number;
  if (isKnightJump(dx, dy)) {
    // Long leg first. In the turned frame the second leg goes to +y or -y (the cross product's sign).
    const first = Math.abs(dx) === 2 ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
    const second = Math.abs(dx) === 2 ? { x: 0, y: dy } : { x: dx, y: 0 };
    legX = 200;
    legY = (first.x * second.y - first.y * second.x) * 100;
    angle = (Math.atan2(first.y, first.x) * 180) / Math.PI;
  } else {
    legX = Math.hypot(dx, dy) * 100;
    angle = (Math.atan2(dy, dx) * 180) / Math.PI;
  }

  const p = (x: number, y: number) => `${round(x)},${round(y)}`;
  if (legY === 0) {
    const tip = legX - TIP_GAP;
    const base = tip - headLength;
    const d = [
      `M${p(0, -h)}`,
      `L${p(base, -h)}`,
      `L${p(base, -headHalf)}`,
      `L${p(tip, 0)}`,
      `L${p(base, headHalf)}`,
      `L${p(base, h)}`,
      `L${p(0, h)}`,
      `A${h},${h} 0 0 1 ${p(0, -h)}`,
      'Z',
    ].join(' ');
    return { d, angle: round(angle) };
  }

  // L shape, worked out for a turn towards +y and mirrored (s = -1) for the other way.
  const s = Math.sign(legY);
  const tip = Math.abs(legY) - TIP_GAP;
  const base = tip - headLength;
  const d = [
    `M${p(0, -h * s)}`,
    `L${p(legX + h, -h * s)}`,
    `L${p(legX + h, base * s)}`,
    `L${p(legX + headHalf, base * s)}`,
    `L${p(legX, tip * s)}`,
    `L${p(legX - headHalf, base * s)}`,
    `L${p(legX - h, base * s)}`,
    `L${p(legX - h, h * s)}`,
    `L${p(0, h * s)}`,
    `A${h},${h} 0 0 ${s > 0 ? 1 : 0} ${p(0, -h * s)}`,
    'Z',
  ].join(' ');
  return { d, angle: round(angle) };
}

/** The SVG for one arrow, centred on its start square (chessground's custom-shape box: 0..100 per square). */
export function arrowSvg(dx: number, dy: number, look: ArrowLook, colour: string, opacity: number): string {
  const { d, angle } = arrowPath(dx, dy, look);
  return (
    `<g class="engine-arrow" opacity="${round(opacity)}" transform="translate(50 50) rotate(${angle})">` +
    `<path d="${d}" fill="${colour}" stroke="rgba(0,0,0,0.45)" stroke-width="2" stroke-linejoin="round"/>` +
    `</g>`
  );
}
