/**
 * Measures every endgame position in src/endgames/drills.ts with the bundled Stockfish and checks
 * the `par` written there.
 *
 *   npm run endgames                       measure every position
 *   npm run endgames -- --play             also play each position through the drill itself
 *   npm run endgames -- --drill=lucena     only one drill
 *
 * 'mate' drills: par = the forced mate Stockfish finds for the side to move (searched deeper than the
 * drill itself judges). 'win' drills: the side to move must be at least 3 pawns ahead; 'draw' drills:
 * at most 1.5 pawns behind (the judge's own limits). With --play, the user's side plays Stockfish's
 * best move every time and the drill must call the position solved without a mistake.
 * Exits with 1 if anything differs.
 */
import { Chess } from 'chess.js';
import { Engine } from '../src/engine/engine';
import { ENGINE_FILE } from '../src/engine/workerTransport';
import { EndgameController } from '../src/endgames/controller';
import { ENDGAME_DRILLS, type EndgameDrill } from '../src/endgames/drills';
import { DRAW_CP, WIN_CP } from '../src/endgames/judge';
import { engineSearch } from '../src/endgames/search';
import { createNodeTransport } from './lib/nodeEngine';

/** Deeper than the drills judge at, so the measured mate is the shortest one. */
const DEPTH = 30;

/** Plays one position through the drill, the user always choosing Stockfish's move. */
async function playThrough(drill: EndgameDrill, index: number): Promise<string | null> {
  const drillTransport = createNodeTransport(`public/${ENGINE_FILE}`);
  const playerTransport = createNodeTransport(`public/${ENGINE_FILE}`);
  const search = engineSearch(new Engine(drillTransport, { multiPv: 1 }));
  // The player's own engine: a search on the drill's engine would replace the drill's pending one.
  const player = engineSearch(new Engine(playerTransport, { multiPv: 1 }));
  try {
    const controller = new EndgameController({ drill, search, onChange: () => {}, wait: async () => {} });
    controller.start(index);
    for (let guard = 0; guard < 80 && controller.view().state === 'your-move'; guard++) {
      const best = (await player(controller.view().fen, drill.judging.depth)).pv[0];
      if (!best) break;
      await controller.play(best);
      const view = controller.view();
      if (view.feedback.kind === 'wrong') return `Stockfish's own move ${best} was judged wrong: ${view.feedback.text}`;
    }
    const view = controller.view();
    const result = view.results[index];
    if (view.state !== 'solved' || !result) return `ended as "${view.state}"`;
    if (result.stars !== 3) return `solved with ${result.stars} stars`;
    return null;
  } finally {
    drillTransport.child.kill();
    playerTransport.child.kill();
  }
}

export async function main(argv: readonly string[] = []): Promise<number> {
  const play = argv.includes('--play');
  const only = argv.find((arg) => arg.startsWith('--drill='))?.slice('--drill='.length);
  const engine = new Engine(createNodeTransport(`public/${ENGINE_FILE}`), { multiPv: 1 });
  const search = engineSearch(engine);
  let problems = 0;
  try {
    for (const drill of ENDGAME_DRILLS) {
      if (only && drill.id !== only) continue;
      console.log(`${drill.title} (${drill.goal})`);
      for (const [index, position] of drill.positions.entries()) {
        new Chess(position.fen); // throws on a broken FEN
        const result = await search(position.fen, Math.max(DEPTH, drill.judging.depth));
        const score = result.score;
        const scoreText = score ? `${score.type} ${score.value}` : 'game over';
        let problem: string | null = null;
        if (drill.goal === 'mate') {
          const measured = score?.type === 'mate' && score.value > 0 ? score.value : null;
          if (measured !== position.par) problem = `par ${position.par}, measured ${measured ?? 'no mate'}`;
        } else {
          const cp = score?.type === 'mate' ? (score.value > 0 ? 100_000 : -100_000) : (score?.value ?? 0);
          if (drill.goal === 'win' && cp < WIN_CP) problem = `not winning enough (${cp} < ${WIN_CP})`;
          if (drill.goal === 'draw' && cp < -DRAW_CP) problem = `already lost (${cp} < ${-DRAW_CP})`;
        }
        if (!problem && play) problem = await playThrough(drill, index);
        if (problem) problems += 1;
        console.log(`  ${position.id}: ${scoreText}, best ${result.pv[0] ?? '-'}${problem ? `  <-- ${problem}` : ''}`);
      }
    }
  } finally {
    engine.dispose();
  }
  console.log(problems === 0 ? 'All positions check out.' : `${problems} position(s) need a look.`);
  return problems === 0 ? 0 : 1;
}
