/**
 * Builds src/data/traps.json from the snapshot (src/data/ponziani.json):
 *   1. picks the moves that are popular at the snapshot's level and lose a lot by its scores;
 *   2. re-checks each with a deeper Stockfish search (the position before and after the move);
 *   3. keeps those that are still at least a mistake, with the engine's punishing line.
 *
 *   npm run traps
 *
 * No network and no token: everything comes from the snapshot and the local engine.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Chess } from 'chess.js';
import { judgeMove } from '../src/analysis/eval';
import { pvToSan } from '../src/analysis/pv';
import { ENGINE_FILE } from '../src/engine/workerTransport';
import { explainRefutation } from '../src/explore/refutation';
import { trapCandidates, validateTrapFile, type Trap, type TrapFile, type TrapRule } from '../src/explore/traps';
import { sumCounts, validateSnapshot, type Snapshot } from '../src/snapshot/format';
import { createEvaluator } from './lib/nodeEngine';

const RULE: TrapRule = {
  /** Played in at least 5% of the games at its position, and at least 1,000 times. */
  minShare: 0.05,
  minGames: 1000,
  /** At least a mistake (20 points of winning chances) by the snapshot's scores. */
  minDrop: 20,
  maxCandidates: 60,
};
/** Deeper than the snapshot's own search. */
const DEPTH = 22;
/** How many moves of the punishing line to keep. */
const LINE_LENGTH = 10;
/** How many traps to keep at most. */
const MAX_TRAPS = 30;

const log = (message: string): void => console.log(message);

export async function main(): Promise<number> {
  const root = process.cwd();
  const snapshot = JSON.parse(readFileSync(join(root, 'src', 'data', 'ponziani.json'), 'utf8')) as Snapshot;
  const snapshotProblems = validateSnapshot(snapshot);
  if (snapshotProblems.length > 0) {
    log(`The snapshot is not sound: ${snapshotProblems[0]}`);
    return 1;
  }

  const candidates = trapCandidates(snapshot, RULE);
  log(`${candidates.length} candidates from the snapshot (played in >= ${RULE.minShare * 100}% of games and >= ${RULE.minGames} games, losing >= ${RULE.minDrop} points).`);

  const evaluator = createEvaluator(join(root, 'public', ENGINE_FILE), DEPTH);
  const traps: Trap[] = [];
  let dropped = 0;
  try {
    const engineName = await evaluator.ready();
    log(`Re-checking each with ${engineName} at depth ${DEPTH}.`);

    for (const candidate of candidates) {
      const { node, move, victim } = candidate;
      const fenAfter = new Chess(node.fen).move(move.san).after;
      const before = await evaluator.evaluateLine(node.fen);
      const after = await evaluator.evaluateLine(fenAfter);
      const judgement = judgeMove({
        before: before.score,
        after: after.score,
        mover: victim,
        playedBest: before.pv[0] === move.uci,
      });
      const label = `${candidate.line.join(' ')} ${move.san}`;
      if (judgement.verdict !== 'mistake' && judgement.verdict !== 'blunder') {
        dropped += 1;
        log(`  dropped  ${label} — only "${judgement.verdict}" at depth ${DEPTH} (drop ${judgement.drop.toFixed(1)})`);
        continue;
      }

      const pv = after.pv.slice(0, LINE_LENGTH);
      const trap: Trap = {
        id: `${candidate.key}|${move.uci}`,
        line: candidate.line,
        fen: node.fen,
        victim,
        kind: victim === 'white' ? 'avoid' : 'exploit',
        move: { uci: move.uci, san: move.san },
        popular: { games: candidate.games, share: candidate.share },
        book: {
          games: sumCounts(move.masters),
          share: sumCounts(node.masters) > 0 ? sumCounts(move.masters) / sumCounts(node.masters) : 0,
        },
        scoreBefore: before.score,
        scoreAfter: after.score,
        drop: Math.round(judgement.drop * 10) / 10,
        verdict: judgement.verdict,
        refutation: {
          uci: pv,
          san: pvToSan(fenAfter, pv),
          why: explainRefutation({ fen: fenAfter, pv, score: after.score, judgement }),
        },
      };
      const opening = move.opening ?? node.opening?.name;
      if (opening) trap.opening = opening;
      traps.push(trap);
      log(`  kept     ${label}${judgement.verdict === 'blunder' ? '??' : '?'} — ${trap.refutation.why}`);
    }
  } finally {
    evaluator.close();
  }

  // The traps met most often first; cap the list.
  traps.sort((a, b) => b.popular.games - a.popular.games);
  const file: TrapFile = {
    meta: {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      snapshotCreatedAt: snapshot.meta.createdAt,
      engine: { name: snapshot.meta.engine.name, depth: DEPTH },
      rule: RULE,
    },
    traps: traps.slice(0, MAX_TRAPS),
  };
  const problems = validateTrapFile(file);
  if (problems.length > 0) {
    log(`The trap list failed its own checks, nothing was written: ${problems.slice(0, 5).join('; ')}`);
    return 1;
  }

  const outFile = join(root, 'src', 'data', 'traps.json');
  writeFileSync(outFile, `${JSON.stringify(file, null, 1)}\n`);
  log(`Wrote ${outFile}: ${file.traps.length} traps (${dropped} candidates did not survive the deeper check).`);
  return 0;
}
