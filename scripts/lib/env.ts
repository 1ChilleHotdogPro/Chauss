import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Lichess token for the snapshot script: from the environment variable LICHESS_TOKEN, or from
 * a line "LICHESS_TOKEN=..." in .env.local (which Git ignores). Returns null when there is none.
 * The value is only ever handed to the explorer client; it is never printed or written anywhere.
 */
export function readToken(projectRoot: string): string | null {
  const fromEnvironment = process.env.LICHESS_TOKEN?.trim();
  if (fromEnvironment) return fromEnvironment;

  const file = join(projectRoot, '.env.local');
  if (!existsSync(file)) return null;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = /^\s*(?:export\s+)?LICHESS_TOKEN\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    const value = match[1]!.trim().replace(/^(['"])(.*)\1$/, '$2').trim();
    if (value) return value;
  }
  return null;
}
