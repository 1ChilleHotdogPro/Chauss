/**
 * Drafts src/explore/ideas/<id>.ts from an opening's snapshot: a few short remarks at key positions,
 * each sentence built from the bundled data and carrying the checks that back it (see
 * src/explore/ideas.ts). The draft is a starting point to read and edit by hand, never from memory.
 *
 *   npm run ideas -- --opening=italian          print the draft
 *   npm run ideas -- --opening=italian --write  write it to src/explore/ideas/italian.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sideToMove } from '../src/analysis/eval';
import { failedChecks, nodeAfter, type Idea, type IdeaCheck } from '../src/explore/ideas';
import { buildExplorePosition, type ExploreMove } from '../src/explore/position';
import { getOpening } from '../src/openings/registry';
import { positionKey, type Snapshot } from '../src/snapshot/format';
import { openingFiles } from './lib/openingFiles';

/** "3.Nc3" / "3...Nf6" for the move played after `line`. */
function moveLabel(line: readonly string[], san: string): string {
  const number = Math.floor(line.length / 2) + 1;
  return line.length % 2 === 0 ? `${number}.${san}` : `${number}...${san}`;
}

/** The moves of a line with numbers: "2.Nf3 d5 3.exd5". */
function lineText(line: readonly string[], from = 0): string {
  return line
    .slice(from)
    .map((san, offset) => {
      const index = from + offset;
      if (index % 2 === 0) return `${index / 2 + 1}.${san}`;
      return offset === 0 ? `${Math.floor(index / 2) + 1}...${san}` : san;
    })
    .join(' ');
}

const percent = (share: number): number => Math.round(share * 100);
const pct = (value: number): { min: number; max: number } => ({ min: (value - 0.5) / 100, max: (value + 0.5) / 100 });
const pawnsOf = (move: ExploreMove): number | null => (move.eval?.type === 'cp' ? Math.round(move.eval.value / 10) / 10 : null);

/** "+0.4 for White", "+1.2 for Black", "about equal". */
function scoreText(pawns: number): string {
  if (Math.abs(pawns) < 0.05) return 'about equal';
  return pawns > 0 ? `+${pawns.toFixed(1)} for White` : `+${(-pawns).toFixed(1)} for Black`;
}
const scoreCheck = (line: string[], san: string, pawns: number): IdeaCheck => ({
  kind: 'move-score',
  line,
  san,
  min: Math.round((pawns - 0.05) * 100) / 100,
  max: Math.round((pawns + 0.05) * 100) / 100,
});

const BAND_TEXT = 'Lichess games rated 1000–1399';

export function draftIdeas(snapshot: Snapshot, rootLine: readonly string[]): Idea[] {
  const band: IdeaCheck = { kind: 'ratings', line: [], ratings: [...snapshot.meta.lichess.ratings] };
  const ideas: Idea[] = [];
  const used = new Set<string>();
  const add = (idea: Idea): void => {
    const node = nodeAfter(snapshot, idea.line);
    if (!node || used.has(positionKey(node.fen))) return;
    if (idea.text.length > 260 || failedChecks(snapshot, idea).length > 0) return;
    used.add(positionKey(node.fen));
    ideas.push(idea);
  };
  const positionAt = (line: string[]) => {
    const node = nodeAfter(snapshot, line);
    return node ? buildExplorePosition(node) : null;
  };

  // 1. The opening position: what the opponent plays here, at this level and among masters.
  const root = [...rootLine];
  const start = positionAt(root);
  if (start) {
    const popular = start.popularMoves.filter((move) => move.popular && percent(move.popular.share) >= 1).slice(0, 2);
    const book = start.bookMoves[0];
    if (popular.length > 0 && book?.book) {
      const parts = popular.map((move) => `${moveLabel(root, move.san)} (${percent(move.popular!.share)}%)`);
      const checks: IdeaCheck[] = [band, { kind: 'popular-top', line: root, san: popular[0]!.san }];
      for (const move of popular) checks.push({ kind: 'popular-share', line: root, san: move.san, ...pct(percent(move.popular!.share)) });
      checks.push({ kind: 'book-top', line: root, san: book.san }, { kind: 'book-share', line: root, san: book.san, ...pct(percent(book.book.share)) });
      const bookPart =
        book.san === popular[0]!.san
          ? `it is also the masters’ choice (${percent(book.book.share)}%)`
          : `masters mostly play ${moveLabel(root, book.san)} (${percent(book.book.share)}%)`;
      add({ line: root, text: `In ${BAND_TEXT}, the usual replies here are ${parts.join(' and ')}; ${bookPart}.`, checks });
    }
  }

  // 2. After each of the opponent's two most played replies: the user's book move and its score.
  for (const reply of start?.popularMoves.slice(0, 2) ?? []) {
    const line = [...root, reply.san];
    const position = positionAt(line);
    const best = position?.bookMoves[0];
    if (!position || !best?.book || position.bookGames < 10) continue;
    const pawns = pawnsOf(best);
    if (pawns === null) continue;
    const share = percent(best.book.share);
    add({
      line,
      text: `Against ${moveLabel(root, reply.san)}, masters play ${moveLabel(line, best.san)} in ${share}% of their games; Stockfish scores it ${scoreText(pawns)}.`,
      checks: [
        { kind: 'book-top', line, san: best.san },
        { kind: 'book-share', line, san: best.san, ...pct(share) },
        scoreCheck(line, best.san, pawns),
      ],
    });
  }

  // 3. The opponent's most played mistakes in the tree, so the user knows what to punish.
  const user = snapshot.meta.side ?? 'white';
  const mistakes: { line: string[]; move: ExploreMove; games: number }[] = [];
  const walk = (line: string[], depth: number): void => {
    const node = nodeAfter(snapshot, line);
    if (!node || node.kind !== 'tree' || depth > 30) return;
    const position = buildExplorePosition(node);
    if (sideToMove(node.fen) !== user) {
      for (const move of position.moves) {
        if ((move.flag === 'mistake' || move.flag === 'blunder') && move.popular && move.popular.share >= 0.04 && percent(move.popular.share) >= 1) {
          mistakes.push({ line, move, games: move.popular.games });
        }
      }
    }
    for (const move of node.moves) if (move.next !== undefined) walk([...line, move.san], depth + 1);
  };
  walk(root, 0);
  mistakes.sort((a, b) => b.games - a.games);
  for (const { line, move } of mistakes) {
    if (ideas.length >= 5) break;
    const pawns = pawnsOf(move);
    if (pawns === null) continue;
    const mark = move.flag === 'blunder' ? '??' : '?';
    const where = line.length > rootLine.length ? `After ${lineText(line, rootLine.length)}, ` : '';
    const text = `${where}${moveLabel(line, move.san)}${mark} is played in ${percent(move.popular!.share)}% of ${BAND_TEXT}, and Stockfish calls it a ${move.flag}: ${scoreText(pawns)}.`;
    add({
      line,
      text: where ? text : text.charAt(0).toUpperCase() + text.slice(1),
      checks: [
        band,
        { kind: 'popular-share', line, san: move.san, ...pct(percent(move.popular!.share)) },
        { kind: 'flagged', line, san: move.san, atLeast: move.flag === 'blunder' ? 'blunder' : 'mistake' },
        scoreCheck(line, move.san, pawns),
      ],
    });
  }
  return ideas;
}

/** A value as TypeScript source in the project's style: single quotes, `{ key: value }`. */
function literal(value: unknown): string {
  if (typeof value === 'string') return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  if (Array.isArray(value)) return `[${value.map(literal).join(', ')}]`;
  if (value && typeof value === 'object') {
    return `{ ${Object.entries(value).map(([key, inner]) => `${key}: ${literal(inner)}`).join(', ')} }`;
  }
  return String(value);
}

function render(name: string, snapshot: Snapshot, ideas: readonly Idea[]): string {
  const date = new Date(snapshot.meta.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const body = ideas
    .map((idea) => {
      const checks = idea.checks.map((check) => `      ${literal(check)},`).join('\n');
      return `  {\n    line: ${literal(idea.line)},\n    text:\n      ${literal(idea.text)},\n    checks: [\n${checks}\n    ],\n  },`;
    })
    .join('\n');
  return `import type { Idea } from '../ideas';

/**
 * The short remarks shown at key positions of the ${name}. Each one is backed by checks against the
 * bundled data (see ideas.ts): every number and claim in a text has a check, and a remark whose
 * checks fail is not shown. Percentages are checked to the whole percent shown; scores to one
 * decimal, from White's point of view.
 *
 * Drafted by scripts/draft-ideas.ts from the snapshot of ${date} (Lichess 1000-1399,
 * blitz/rapid/classical; ${snapshot.meta.engine.name}, depth ${snapshot.meta.engine.depth}) and read
 * through by hand — not written from memory.
 */
export const IDEAS: readonly Idea[] = [
${body}
];
`;
}

export async function main(argv: readonly string[]): Promise<number> {
  const id = argv.find((arg) => arg.startsWith('--opening='))?.slice('--opening='.length);
  if (!id) {
    console.log('Usage: npm run ideas -- --opening=<id> [--write]');
    return 1;
  }
  const opening = getOpening(id);
  const root = process.cwd();
  const snapshot = JSON.parse(readFileSync(openingFiles(root, id).snapshot, 'utf8')) as Snapshot;
  const ideas = draftIdeas(snapshot, opening.rootLine);
  const text = render(opening.name, snapshot, ideas);
  if (argv.includes('--write')) {
    const file = join(root, 'src', 'explore', 'ideas', `${id}.ts`);
    writeFileSync(file, text);
    console.log(`Wrote ${file}: ${ideas.length} remarks.`);
  } else {
    console.log(text);
  }
  return 0;
}
