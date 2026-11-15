/**
 * Measures every endgame position in src/endgames/drills.ts with the bundled Stockfish and checks
 * the `par` written there.
 *
 *   npm run endgames
 *
 * 'mate' drills: par = the forced mate Stockfish finds for the side to move (searched deeper than the
 * drill itself judges). Prints the measured value for each position; exits with 1 if any differs.
 */
import { Chess } from 'chess.js';
import { Engine } from '../src/engine/engine';
import { ENGINE_FILE } from '../src/engine/workerTransport';
import { ENDGAME_DRILLS } from '../src/endgames/drills';
import { engineSearch } from '../src/endgames/search';
import { createNodeTransport } from './lib/nodeEngine';

/** Deeper than the drills judge at, so the measured mate is the shortest one. */
const DEPTH = 30;

export async function main(): Promise<number> {
  const engine = new Engine(createNodeTransport(`public/${ENGINE_FILE}`), { multiPv: 1 });
  const search = engineSearch(engine);
  let mismatches = 0;
  try {
    for (const drill of ENDGAME_DRILLS) {
      console.log(`${drill.title} (${drill.goal})`);
      for (const position of drill.positions) {
        new Chess(position.fen); // throws on a broken FEN
        const result = await search(position.fen, Math.max(DEPTH, drill.judging.depth));
        const score = result.score;
        const scoreText = score ? `${score.type} ${score.value}` : 'game over';
        if (drill.goal === 'mate') {
          const measured = score?.type === 'mate' && score.value > 0 ? score.value : null;
          const same = measured === position.par;
          if (!same) mismatches += 1;
          console.log(`  ${position.id}: ${scoreText}, best ${result.pv[0] ?? '-'} — par ${position.par}${same ? '' : `  <-- measured ${measured ?? 'no mate'}`}`);
        } else {
          console.log(`  ${position.id}: ${scoreText}, best ${result.pv[0] ?? '-'}`);
        }
      }
    }
  } finally {
    engine.dispose();
  }
  console.log(mismatches === 0 ? 'All par values match.' : `${mismatches} par value(s) differ.`);
  return mismatches === 0 ? 0 : 1;
}
