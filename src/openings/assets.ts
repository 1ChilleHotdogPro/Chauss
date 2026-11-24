import type { Idea } from '../explore/ideas';

/**
 * Where each opening's files live. The paths are written out per opening (not built from the id)
 * so that Vite sees every one and emits each file on its own; only the chosen opening is fetched.
 * Browser only — the build scripts read the files from disk instead.
 */
export interface OpeningAssets {
  snapshotUrl: string;
  ideas: () => Promise<readonly Idea[]>;
}

export const OPENING_ASSETS: Record<string, OpeningAssets> = {
  ponziani: {
    snapshotUrl: new URL('../data/openings/ponziani.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/ponziani').then((module) => module.IDEAS),
  },
  'caro-kann': {
    snapshotUrl: new URL('../data/openings/caro-kann.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/caro-kann').then((module) => module.IDEAS),
  },
  'italian': {
    snapshotUrl: new URL('../data/openings/italian.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/italian').then((module) => module.IDEAS),
  },
  'ruy-lopez': {
    snapshotUrl: new URL('../data/openings/ruy-lopez.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/ruy-lopez').then((module) => module.IDEAS),
  },
  'scotch': {
    snapshotUrl: new URL('../data/openings/scotch.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/scotch').then((module) => module.IDEAS),
  },
  'vienna': {
    snapshotUrl: new URL('../data/openings/vienna.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/vienna').then((module) => module.IDEAS),
  },
  'kings-gambit': {
    snapshotUrl: new URL('../data/openings/kings-gambit.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/kings-gambit').then((module) => module.IDEAS),
  },
  'evans-gambit': {
    snapshotUrl: new URL('../data/openings/evans-gambit.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/evans-gambit').then((module) => module.IDEAS),
  },
  'danish-gambit': {
    snapshotUrl: new URL('../data/openings/danish-gambit.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/danish-gambit').then((module) => module.IDEAS),
  },
  'bishops-opening': {
    snapshotUrl: new URL('../data/openings/bishops-opening.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/bishops-opening').then((module) => module.IDEAS),
  },
  'fried-liver': {
    snapshotUrl: new URL('../data/openings/fried-liver.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/fried-liver').then((module) => module.IDEAS),
  },
  'queens-gambit': {
    snapshotUrl: new URL('../data/openings/queens-gambit.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/queens-gambit').then((module) => module.IDEAS),
  },
  'london': {
    snapshotUrl: new URL('../data/openings/london.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/london').then((module) => module.IDEAS),
  },
  'english': {
    snapshotUrl: new URL('../data/openings/english.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/english').then((module) => module.IDEAS),
  },
  'smith-morra': {
    snapshotUrl: new URL('../data/openings/smith-morra.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/smith-morra').then((module) => module.IDEAS),
  },
  'alapin': {
    snapshotUrl: new URL('../data/openings/alapin.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/alapin').then((module) => module.IDEAS),
  },
  'catalan': {
    snapshotUrl: new URL('../data/openings/catalan.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/catalan').then((module) => module.IDEAS),
  },
  'sicilian': {
    snapshotUrl: new URL('../data/openings/sicilian.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/sicilian').then((module) => module.IDEAS),
  },
  'french': {
    snapshotUrl: new URL('../data/openings/french.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/french').then((module) => module.IDEAS),
  },
  'scandinavian': {
    snapshotUrl: new URL('../data/openings/scandinavian.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/scandinavian').then((module) => module.IDEAS),
  },
  'pirc': {
    snapshotUrl: new URL('../data/openings/pirc.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/pirc').then((module) => module.IDEAS),
  },
  'alekhine': {
    snapshotUrl: new URL('../data/openings/alekhine.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/alekhine').then((module) => module.IDEAS),
  },
  'modern': {
    snapshotUrl: new URL('../data/openings/modern.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/modern').then((module) => module.IDEAS),
  },
  'two-knights': {
    snapshotUrl: new URL('../data/openings/two-knights.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/two-knights').then((module) => module.IDEAS),
  },
  'petrov': {
    snapshotUrl: new URL('../data/openings/petrov.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/petrov').then((module) => module.IDEAS),
  },
  'philidor': {
    snapshotUrl: new URL('../data/openings/philidor.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/philidor').then((module) => module.IDEAS),
  },
  'qgd': {
    snapshotUrl: new URL('../data/openings/qgd.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/qgd').then((module) => module.IDEAS),
  },
  'slav': {
    snapshotUrl: new URL('../data/openings/slav.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/slav').then((module) => module.IDEAS),
  },
  'kings-indian': {
    snapshotUrl: new URL('../data/openings/kings-indian.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/kings-indian').then((module) => module.IDEAS),
  },
  'nimzo-indian': {
    snapshotUrl: new URL('../data/openings/nimzo-indian.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/nimzo-indian').then((module) => module.IDEAS),
  },
  'dutch': {
    snapshotUrl: new URL('../data/openings/dutch.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/dutch').then((module) => module.IDEAS),
  },
  'grunfeld': {
    snapshotUrl: new URL('../data/openings/grunfeld.json', import.meta.url).href,
    ideas: () => import('../explore/ideas/grunfeld').then((module) => module.IDEAS),
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
