import { join } from 'node:path';

/** Where an opening's data files are written and read (Node scripts; the app uses openings/assets). */
export function openingFiles(root: string, id: string): { dir: string; snapshot: string; traps: string } {
  const dir = join(root, 'src', 'data', 'openings');
  return { dir, snapshot: join(dir, `${id}.json`), traps: join(dir, `${id}.traps.json`) };
}
