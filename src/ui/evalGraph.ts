import type { Classification } from '../analysis/classify';
import { moveNumber } from '../analysis/pv';
import { CLASSIFICATION_INFO } from '../analysis/classificationText';

export interface EvalGraphModel {
  /** White's winning chances (0-100) after each half-move; [0] is the start. undefined = not yet known. */
  white: (number | undefined)[];
  /** The label of move i (1-based), for the coloured dots on bad moves. */
  classes: (Classification | undefined)[];
  /** The half-move on the board. */
  current: number;
  /** Where the game starts, for the move numbers in the tooltips. */
  startFen: string;
}

/** Moves that get a dot on the graph. */
const MARKED = new Set<Classification>(['brilliant', 'great', 'inaccuracy', 'mistake', 'miss', 'blunder']);
const SVG = 'http://www.w3.org/2000/svg';
const WIDTH = 1000;
const HEIGHT = 100;

function svg<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string>): SVGElementTagNameMap[K] {
  const element = document.createElementNS(SVG, name);
  for (const [key, value] of Object.entries(attrs)) element.setAttribute(key, value);
  return element;
}

/**
 * The game's evaluation over time, as an inline SVG: the light area is White's winning chances,
 * so it rises when White is better. Clicking a point jumps to that move.
 */
export function createEvalGraph(container: HTMLElement, onSelect: (ply: number) => void) {
  let plies = 0;

  container.addEventListener('click', (event) => {
    if (plies === 0) return;
    const box = container.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
    onSelect(Math.round(ratio * plies));
  });

  return {
    render(model: EvalGraphModel): void {
      plies = Math.max(1, model.white.length - 1);
      const x = (ply: number) => (ply / plies) * WIDTH;
      const y = (white: number) => HEIGHT - white; // 100% White at the top

      const known = model.white.flatMap((value, ply) => (value === undefined ? [] : [[x(ply), y(value)] as const]));
      const root = svg('svg', {
        viewBox: `0 0 ${WIDTH} ${HEIGHT}`,
        preserveAspectRatio: 'none',
        class: 'eval-graph-svg',
        'aria-hidden': 'true',
      });
      root.append(svg('rect', { x: '0', y: '0', width: String(WIDTH), height: String(HEIGHT), class: 'eval-graph-black' }));
      if (known.length > 0) {
        const last = known[known.length - 1]!;
        const points = known.map(([px, py]) => `${px.toFixed(1)},${py.toFixed(1)}`).join(' ');
        root.append(
          svg('polygon', { points: `0,${HEIGHT} ${points} ${last[0].toFixed(1)},${HEIGHT}`, class: 'eval-graph-white' }),
          svg('polyline', { points, class: 'eval-graph-line' }),
        );
      }
      root.append(svg('line', { x1: '0', x2: String(WIDTH), y1: '50', y2: '50', class: 'eval-graph-mid' }));
      root.append(
        svg('line', {
          x1: String(x(model.current)),
          x2: String(x(model.current)),
          y1: '0',
          y2: String(HEIGHT),
          class: 'eval-graph-cursor',
        }),
      );

      // Dots are HTML so they stay round however the graph is stretched.
      const dots = model.classes.flatMap((classification, index) => {
        const ply = index + 1;
        const value = model.white[ply];
        if (!classification || value === undefined || !MARKED.has(classification)) return [];
        const dot = document.createElement('span');
        dot.className = 'eval-graph-dot';
        dot.dataset.class = classification;
        dot.style.left = `${(ply / plies) * 100}%`;
        dot.style.top = `${100 - value}%`;
        dot.title = `Move ${moveNumber(model.startFen, ply)}: ${CLASSIFICATION_INFO[classification].name}`;
        return [dot];
      });

      container.replaceChildren(root, ...dots);
      container.dataset.plies = String(model.white.length - 1);
    },
  };
}
