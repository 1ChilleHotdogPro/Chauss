/**
 * Builds src/data/openings/<id>.json: crawls an opening's tree from the Lichess opening explorer and
 * attaches a Stockfish score to every position and listed move.
 *
 *   npm run snapshot -- --survey                   look only: how big would the tree be for various settings?
 *   npm run snapshot                               crawl, evaluate and write the Ponziani file
 *   npm run snapshot -- --opening=caro-kann        another opening from src/openings/registry.ts
 *   npm run snapshot -- --min-games=5000           override a setting (see OPTIONS below)
 *   npm run snapshot -- --root="e4 c6" --side=black --out=path.json   an opening that is not in the registry
 *
 * Needs a personal Lichess token in .env.local (LICHESS_TOKEN=...) — see the README.
 * Safe to stop and restart: explorer answers and engine scores are kept in .cache/.
 */
import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import type { Score } from '../src/analysis/eval';
import { DEFAULT_OPENING_ID, findOpening, type Side } from '../src/openings/registry';
import { ENGINE_FILE } from '../src/engine/workerTransport';
import { ExplorerClient, EXPLORER_HOST } from '../src/explorer/client';
import { describeRatings } from '../src/explorer/settings';
import { RATING_BANDS, SPEEDS, type RatingBand, type Speed } from '../src/explorer/types';
import { assembleSnapshot, positionsToEvaluate, stringifySnapshot } from '../src/snapshot/assemble';
import { countReachable, crawl, type CrawlResult, type CrawlThresholds } from '../src/snapshot/crawl';
import { sumCounts, validateSnapshot } from '../src/snapshot/format';
import { CrawlAbort, createPoliteSource } from '../src/snapshot/politeSource';
import { createDiskCache, createEvalStore } from './lib/diskCache';
import { readToken } from './lib/env';
import { createEvaluator } from './lib/nodeEngine';
import { openingFiles } from './lib/openingFiles';

const OPTIONS = {
  survey: false,
  /** Registry id (sets the root line, side and thresholds), or '' for an ad hoc --root. */
  opening: '',
  /** The moves that define the opening, e.g. ['e4', 'c6']. */
  rootLine: [] as string[],
  /** The colour the user plays. */
  side: 'white' as Side,
  /** Output file; the default is src/data/openings/<id>.json. */
  out: '',
  /** Rating groups and speeds of the Lichess games that are counted. */
  ratings: [1000, 1200] as RatingBand[],
  speeds: ['blitz', 'rapid', 'classical'] as Speed[],
  /** Follow a move with at least this share of the games at its position ... */
  minShare: 0.03,
  /** ... and at least this many games (Lichess / masters). */
  minGames: 2000,
  minGamesMasters: 10,
  /** List (without following) moves from this share. */
  listShare: 0.01,
  maxListed: 12,
  maxPly: 24,
  /** 0 = the default: 800 for a real run, 1500 for a survey. */
  maxPositions: 0,
  /** Stockfish search depth. */
  depth: 18,
  /**
   * Pause between explorer requests, in milliseconds. Lichess started answering "too many
   * requests" after roughly 20 requests in a minute (observed November 2026), so stay under that.
   */
  interval: 3500,
};

function parseArgs(argv: readonly string[]): typeof OPTIONS {
  const options = { ...OPTIONS };
  // --opening first, so the other flags override its settings whatever the order.
  const named = argv.find((arg) => arg.startsWith('--opening='))?.slice('--opening='.length);
  const hasRoot = argv.some((arg) => arg.startsWith('--root='));
  const id = named ?? (hasRoot ? '' : DEFAULT_OPENING_ID);
  if (id !== '') {
    const opening = findOpening(id);
    if (!opening) throw new CrawlAbort(`Unknown opening "${id}".`);
    options.opening = opening.id;
    options.rootLine = [...opening.rootLine];
    options.side = opening.side;
    options.minShare = opening.crawl.minShare;
    options.minGames = opening.crawl.minGames;
    options.minGamesMasters = opening.crawl.minGamesMasters;
    options.maxPly = opening.crawl.maxPly;
    options.maxPositions = opening.crawl.maxPositions;
    options.depth = opening.crawl.depth;
  }
  for (const arg of argv) {
    const equals = arg.indexOf('=');
    const name = (equals < 0 ? arg : arg.slice(0, equals)).replace(/^--/, '');
    const value = equals < 0 ? undefined : arg.slice(equals + 1);
    const number = (): number => {
      const parsed = Number(value);
      if (value === undefined || !Number.isFinite(parsed)) throw new CrawlAbort(`--${name} needs a number`);
      return parsed;
    };
    switch (name) {
      case 'survey':
        options.survey = true;
        break;
      case 'opening':
        break; // handled above
      case 'root':
        options.rootLine = (value ?? '').split(/[s,]+/).filter(Boolean);
        break;
      case 'side':
        if (value !== 'white' && value !== 'black') throw new CrawlAbort('--side must be white or black');
        options.side = value;
        break;
      case 'out':
        options.out = value ?? '';
        break;
      case 'ratings':
        options.ratings = RATING_BANDS.filter((band) => (value ?? '').split(',').map(Number).includes(band));
        break;
      case 'speeds':
        options.speeds = SPEEDS.filter((speed) => (value ?? '').split(',').includes(speed));
        break;
      case 'min-share':
        options.minShare = number();
        break;
      case 'min-games':
        options.minGames = number();
        break;
      case 'min-games-masters':
        options.minGamesMasters = number();
        break;
      case 'list-share':
        options.listShare = number();
        break;
      case 'max-listed':
        options.maxListed = number();
        break;
      case 'max-ply':
        options.maxPly = number();
        break;
      case 'max-positions':
        options.maxPositions = number();
        break;
      case 'depth':
        options.depth = number();
        break;
      case 'interval':
        options.interval = number();
        break;
      default:
        throw new CrawlAbort(`Unknown option: ${arg}`);
    }
  }
  if (options.rootLine.length === 0) throw new CrawlAbort('--root needs at least one move.');
  if (options.opening === '' && options.out === '' && !options.survey) {
    throw new CrawlAbort('An opening that is not in the registry needs --out=<file>.');
  }
  if (options.ratings.length === 0 || options.speeds.length === 0) {
    throw new CrawlAbort('At least one rating group and one speed are needed.');
  }
  return options;
}

const log = (message: string): void => console.log(message);
const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));
const thousands = (n: number): string => n.toLocaleString('en-US');

function printSurvey(result: CrawlResult, thresholds: CrawlThresholds, options: typeof OPTIONS): void {
  log('');
  log(`Survey: ${result.nodes.size} positions seen with at least ${thresholds.minGamesLichess} games per move${result.truncated ? ' (cut off by the position limit)' : ''}.`);
  log('How many of the positions seen each setting would keep (rows: minimum Lichess games; columns: minimum master games).');
  log('Numbers close to the number of positions seen are underestimates: the real tree continues beyond what was crawled.');
  const mastersOptions = [10, 15, 20, 30, 50].filter((n) => n >= thresholds.minGamesMasters);
  log(`  min games | ${mastersOptions.map((n) => `masters>=${n}`.padStart(11)).join(' | ')}`);
  for (const minGames of [300, 5000, 20000, 50000, 75000, 100000, 150000, 200000, 500000, 10_000_000]) {
    if (minGames < thresholds.minGamesLichess) continue;
    const counts = mastersOptions.map((minGamesMasters) =>
      countReachable(result, options.rootLine, { ...thresholds, minGamesLichess: minGames, minGamesMasters }, options.side),
    );
    log(`  ${String(minGames).padStart(9)} | ${counts.map((n) => String(n).padStart(11)).join(' | ')}`);
  }
  // Which openings the tree wanders into (by the names Lichess gives the positions).
  const families = new Map<string, { positions: number; masters: number; lichess: number }>();
  for (const node of result.nodes.values()) {
    if (node.kind !== 'tree') continue;
    const name = node.opening?.name ?? '(unnamed)';
    const entry = families.get(name) ?? { positions: 0, masters: 0, lichess: 0 };
    entry.positions += 1;
    entry.masters = Math.max(entry.masters, sumCounts(node.masters));
    entry.lichess = Math.max(entry.lichess, sumCounts(node.lichess));
    families.set(name, entry);
  }
  log('');
  log('Opening names of the positions inside the tree (positions | most master games | most Lichess games):');
  for (const [name, entry] of [...families.entries()].sort((a, b) => b[1].positions - a[1].positions)) {
    log(`  ${String(entry.positions).padStart(4)} | ${thousands(entry.masters).padStart(7)} | ${thousands(entry.lichess).padStart(10)} | ${name}`);
  }

  const start = [...result.nodes.values()].find((node) => node.kind === 'tree' && node.ply === options.rootLine.length);
  if (start) {
    log('');
    log(`The opening position itself (${start.opening ? `the explorer names it "${start.opening.name}"` : 'unnamed'}): ${thousands(sumCounts(start.lichess))} Lichess games (${describeRatings(options.ratings)}, ${options.speeds.join('/')}), ${thousands(sumCounts(start.masters))} master games.`);
    for (const move of start.moves.slice(0, 8)) {
      log(`  ${move.san.padEnd(6)} Lichess ${thousands(sumCounts(move.lichess)).padStart(9)}   masters ${thousands(sumCounts(move.masters)).padStart(5)}${move.follow ? '' : '   (not followed)'}`);
    }
  }
}

export async function main(argv: readonly string[]): Promise<number> {
  const started = Date.now();
  const root = process.cwd();
  let evaluator: ReturnType<typeof createEvaluator> | null = null;

  try {
    const options = parseArgs(argv);
    const token = readToken(root);
    if (!token) throw new CrawlAbort('No Lichess token found. Put LICHESS_TOKEN=... in .env.local (see README).');

    const cacheDir = join(root, '.cache');
    const diskCache = createDiskCache(join(cacheDir, 'explorer'));
    const client = new ExplorerClient({
      fetch: (url, init) => fetch(url, init),
      getToken: () => token,
      cache: diskCache,
      minIntervalMs: options.interval,
    });
    const source = createPoliteSource(client, { ratings: options.ratings, speeds: options.speeds }, { now: Date.now, sleep, log });

    const thresholds: CrawlThresholds = {
      minShare: options.minShare,
      // A survey looks wider than any setting we would choose, so the table can be worked out from it.
      minGamesLichess: options.survey ? Math.min(options.minGames, 300) : options.minGames,
      minGamesMasters: options.minGamesMasters,
      maxPly: options.maxPly,
      maxPositions: options.maxPositions > 0 ? options.maxPositions : options.survey ? 1500 : 800,
    };

    log(`Crawling the opening explorer (${EXPLORER_HOST}) for ${options.rootLine.join(' ')}, played by ${options.side}.`);
    log(`Lichess games: rated ${describeRatings(options.ratings)}, speeds ${options.speeds.join(', ')}.`);
    log(`Following moves with >= ${options.minShare * 100}% of the games and >= ${thresholds.minGamesLichess} Lichess games or >= ${thresholds.minGamesMasters} master games; depth limit ${thresholds.maxPly} half-moves; at most ${thresholds.maxPositions} positions.`);

    const result = await crawl(source, { rootLine: options.rootLine, thresholds, side: options.side }, (visited, waiting, node) => {
      if (visited % 10 === 0 || waiting === 0) {
        log(`  ${visited} positions (${waiting} waiting) — move ${Math.ceil(node.ply / 2)}, ${node.opening?.name ?? 'unnamed'}; ${client.requestsSent()} requests sent, ${diskCache.hits()} answered from disk`);
      }
    });
    log(`Crawl finished: ${result.nodes.size} positions, ${client.requestsSent()} requests sent to Lichess, ${diskCache.hits()} answered from disk.`);
    if (result.truncated) {
      log(`The position limit cut the tree short. The most played move that was left out has ${thousands(result.largestCut)} Lichess games: run again with --min-games=${result.largestCut + 1} for a complete tree of this size.`);
    }

    if (options.survey) {
      printSurvey(result, thresholds, options);
      return 0;
    }

    // Stockfish scores.
    const listing = { listShare: options.listShare, maxListedMoves: options.maxListed };
    const positions = positionsToEvaluate(result, listing);
    const enginePath = join(root, 'public', ENGINE_FILE);
    evaluator = createEvaluator(enginePath, options.depth);
    const engineName = await evaluator.ready();
    const store = createEvalStore(join(cacheDir, `evals-${engineName.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-d${options.depth}.json`));
    log(`Evaluating ${positions.size} positions with ${engineName} at depth ${options.depth} (${[...positions.keys()].filter((key) => store.get(key)).length} already done).`);

    const evals = new Map<string, Score>();
    let computed = 0;
    let done = 0;
    for (const [key, fen] of positions) {
      let score = store.get(key);
      if (!score) {
        score = await evaluator.evaluate(fen);
        store.set(key, score);
        computed += 1;
      }
      evals.set(key, score);
      done += 1;
      if (done % 100 === 0) log(`  ${done} / ${positions.size} positions evaluated`);
    }
    store.save();
    log(`Evaluation finished: ${computed} computed now, ${positions.size - computed} taken from disk.`);

    const snapshot = assembleSnapshot(result, evals, {
      formatVersion: 1,
      createdAt: new Date().toISOString(),
      explorerHost: EXPLORER_HOST,
      lichess: { ratings: options.ratings, speeds: options.speeds },
      ...(options.opening ? { openingId: options.opening } : {}),
      side: options.side,
      rootLine: options.rootLine,
      ...(result.family ? { family: result.family } : {}),
      thresholds: {
        minShare: thresholds.minShare,
        minGamesLichess: thresholds.minGamesLichess,
        minGamesMasters: thresholds.minGamesMasters,
        listShare: options.listShare,
        maxListedMoves: options.maxListed,
        maxPly: thresholds.maxPly,
        maxPositions: thresholds.maxPositions,
      },
      engine: { name: engineName, depth: options.depth },
      counts: { explorerRequests: result.nodes.size * 2, evaluations: positions.size },
    });

    const problems = validateSnapshot(snapshot);
    if (problems.length > 0) {
      log(`The snapshot failed its own checks (${problems.length} problems), nothing was written:`);
      for (const problem of problems.slice(0, 20)) log(`  - ${problem}`);
      return 1;
    }
    const text = stringifySnapshot(snapshot);
    if (text.includes(token)) throw new CrawlAbort('Refusing to write: the token appeared in the output.');

    const outFile = options.out ? resolve(root, options.out) : openingFiles(root, options.opening).snapshot;
    mkdirSync(dirname(outFile), { recursive: true });
    writeFileSync(outFile, text);
    log(`Wrote ${outFile}: ${snapshot.meta.counts.positions} positions, ${snapshot.meta.counts.moves} moves, ${thousands(statSync(outFile).size)} bytes.`);
    log(`Total time: ${Math.round((Date.now() - started) / 1000)} s.`);
    return 0;
  } catch (error) {
    if (error instanceof CrawlAbort) {
      log(`Stopped: ${error.message}`);
      return 1;
    }
    throw error;
  } finally {
    evaluator?.close();
  }
}
