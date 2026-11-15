import type { Idea } from '../explore/ideas';

/**
 * Where each opening's files live. The paths are written out per opening (not built from the id)
 * so that Vite sees every one and emits each file on its own; only the chosen opening is fetched.
 * Browser only — the build scripts read the files from disk instead.
 */
export interface OpeningAssets {
  snapshotUrl: string;
  trapsUrl: string;
  ideas: () => Promise<readonly Idea[]>;
}

export const OPENING_ASSETS: Record<string, OpeningAssets> = {
  ponziani: {
    snapshotUrl: new URL('../data/openings/ponziani.json', import.meta.url).href,
    trapsUrl: new URL('../data/openings/ponziani.traps.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/ponziani').then((module) => module.IDEAS),
  },
};

/** True when the opening's data files are part of the site (an opening can be listed before they are built). */
export function hasOpeningData(id: string): boolean {
  return Object.hasOwn(OPENING_ASSETS, id);
}

export function assetsFor(id: string): OpeningAssets {
  const assets = OPENING_ASSETS[id];
  if (!assets) throw new Error(`no data files for opening "${id}"`);
  return assets;
}
