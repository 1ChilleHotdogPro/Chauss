// The endgame drill judged by the real Stockfish file from public/engine/, at the drill's own depth:
// every position really is a forced mate, and right and wrong moves are told apart.
import { fileURLToPath } from 'node:url';
import { afterAll, describe, expect, it } from 'vitest';
import { createNodeTransport } from '../../scripts/lib/nodeEngine.ts';
import { EndgameController } from '../../src/endgames/controller.ts';
import { getEndgameDrill } from '../../src/endgames/drills.ts';
import { engineSearch } from '../../src/endgames/search.ts';
import { Engine } from '../../src/engine/engine.ts';
import { ENGINE_FILE } from '../../src/engine/workerTransport.ts';

const enginePath = fileURLToPath(new URL(`../../public/${ENGINE_FILE}`, import.meta.url));
const transport = createNodeTransport(enginePath);
const engine = new Engine(transport, { multiPv: 1 });
const search = engineSearch(engine);
const drill = getEndgameDrill('kq-vs-k');

// The player's own engine: a search on the drill's engine would replace the drill's pending one.
const playerTransport = createNodeTransport(enginePath);
const playerSearch = engineSearch(new Engine(playerTransport, { multiPv: 1 }));

afterAll(() => {
  transport.child.kill();
  playerTransport.child.kill();
});

function controllerAt(positionId) {
  const index = drill.positions.findIndex((position) => position.id === positionId);
  const controller = new EndgameController({ drill, search, onChange: () => {}, wait: async () => {} });
  controller.start(index);
  return controller;
}

describe('King and Queen vs King with the real Stockfish', () => {
  it('finds a forced mate for the user in every position, at the depth the drill judges with', async () => {
    for (const position of drill.positions) {
      const result = await search(position.fen, drill.judging.depth);
      expect(result.score?.type, position.id).toBe('mate');
      // Never a shorter mate than the measured par, and not much longer either.
      expect(result.score.value, position.id).toBeGreaterThanOrEqual(position.par);
      expect(result.score.value, position.id).toBeLessThanOrEqual(position.par + drill.judging.slack);
    }
  });

  it('accepts the right move and lets the king defend', async () => {
    const controller = controllerAt('edge-1');
    await controller.play('g5g6'); // Kg6: the king comes closer
    const view = controller.view();
    expect(view.state).toBe('your-move');
    expect(view.sans).toHaveLength(2);
    expect(view.feedback.kind).toBe('good');
  });

  it('rejects the stalemate Qf7 and points to a better move', async () => {
    const controller = controllerAt('edge-1');
    await controller.play('f1f7');
    const view = controller.view();
    expect(view.feedback.kind).toBe('wrong');
    expect(view.feedback.text).toMatch(/Stalemate/);
    expect(view.feedback.hint).toMatch(/^[a-h][1-8][a-h][1-8]$/);
    expect(view.sans).toEqual([]);
  });

  it('rejects Qe4+, which hangs the queen to the king', async () => {
    const controller = controllerAt('center-2');
    await controller.play('b1e4');
    const view = controller.view();
    expect(view.feedback.kind).toBe('wrong');
    expect(view.feedback.text).toMatch(/can simply be taken/);
  });

  it('plays a whole position to mate when the user follows Stockfish', async () => {
    const controller = controllerAt('edge-1');
    for (let guard = 0; guard < 10 && controller.view().state === 'your-move'; guard++) {
      const best = (await playerSearch(controller.view().fen, drill.judging.depth)).pv[0];
      await controller.play(best);
    }
    expect(controller.view().state).toBe('solved');
    expect(controller.view().results[0]).toEqual({ solved: true, stars: 3, moves: 3, mistakes: 0 });
  });
});
