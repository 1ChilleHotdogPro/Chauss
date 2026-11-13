// Every written idea is checked against the real bundled data (src/data/ponziani.json): a remark
// whose facts the data does not back fails here, instead of being silently hidden in the app.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { positionKey, type Snapshot } from '../snapshot/format';
import { IDEAS } from './ideaList';
import { failedChecks, ideaFor, nodeAfter } from './ideas';

const snapshot = JSON.parse(
  readFileSync(fileURLToPath(new URL('../data/ponziani.json', import.meta.url)), 'utf8'),
) as Snapshot;

describe('the written ideas', () => {
  it('are all backed by the bundled data', () => {
    const problems = IDEAS.flatMap((idea) => failedChecks(snapshot, idea).map((problem) => `${idea.line.join(' ')}: ${problem}`));
    expect(problems).toEqual([]);
  });

  it('each make at least one check, and are short (one or two sentences)', () => {
    for (const idea of IDEAS) {
      expect(idea.checks.length, idea.text).toBeGreaterThan(0);
      // A sentence ends at . ! or ? followed by a space and a capital ("5...Nxe5? and" does not end one).
      const sentences = idea.text.split(/(?<=[.!?])\s+(?=[A-Z])/).filter(Boolean);
      expect(sentences.length, idea.text).toBeLessThanOrEqual(2);
      expect(idea.text.length, idea.text).toBeLessThanOrEqual(260);
    }
  });

  it('are shown at their own position, one idea per position', () => {
    const keys = new Set<string>();
    for (const idea of IDEAS) {
      const node = nodeAfter(snapshot, idea.line)!;
      const key = positionKey(node.fen);
      expect(keys.has(key), idea.line.join(' ')).toBe(false);
      keys.add(key);
      expect(ideaFor(snapshot, IDEAS, node.fen)).toBe(idea.text);
    }
  });
});
