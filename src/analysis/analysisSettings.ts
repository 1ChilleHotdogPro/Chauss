import type { KeyValueStorage } from '../explorer/cache';
import type { SearchLimit } from './gameAnalyser';

/** The choices for how long Stockfish looks at each position of a game under analysis. */
export const SEARCH_LIMITS: readonly { id: string; label: string; limit: SearchLimit }[] = [
  { id: 'd10', label: 'Depth 10 (quickest)', limit: { kind: 'depth', depth: 10 } },
  { id: 'd12', label: 'Depth 12', limit: { kind: 'depth', depth: 12 } },
  { id: 'd14', label: 'Depth 14', limit: { kind: 'depth', depth: 14 } },
  { id: 'd16', label: 'Depth 16', limit: { kind: 'depth', depth: 16 } },
  { id: 'd18', label: 'Depth 18 (slowest)', limit: { kind: 'depth', depth: 18 } },
  { id: 't500', label: '0.5 seconds per move', limit: { kind: 'time', ms: 500 } },
  { id: 't1000', label: '1 second per move', limit: { kind: 'time', ms: 1000 } },
  { id: 't2000', label: '2 seconds per move', limit: { kind: 'time', ms: 2000 } },
  { id: 't3000', label: '3 seconds per move', limit: { kind: 'time', ms: 3000 } },
];

export const DEFAULT_SEARCH_LIMIT_ID = 'd14';

export interface AnalysisSettings {
  version: 1;
  /** One of SEARCH_LIMITS' ids. */
  limit: string;
}

export const ANALYSIS_SETTINGS_KEY = 'chauss.analysis.v1';

export function defaultAnalysisSettings(): AnalysisSettings {
  return { version: 1, limit: DEFAULT_SEARCH_LIMIT_ID };
}

export function searchLimit(settings: AnalysisSettings): SearchLimit {
  return (SEARCH_LIMITS.find((choice) => choice.id === settings.limit) ?? SEARCH_LIMITS[2]!).limit;
}

/** Turn anything (missing, hand-edited or corrupt data) into valid settings. */
export function sanitizeAnalysisSettings(value: unknown): AnalysisSettings {
  const settings = defaultAnalysisSettings();
  if (typeof value !== 'object' || value === null) return settings;
  const raw = value as Record<string, unknown>;
  if (raw.version !== 1) return settings;
  if (typeof raw.limit === 'string' && SEARCH_LIMITS.some((choice) => choice.id === raw.limit)) settings.limit = raw.limit;
  return settings;
}

export function loadAnalysisSettings(storage: KeyValueStorage | undefined): AnalysisSettings {
  try {
    const text = storage?.getItem(ANALYSIS_SETTINGS_KEY);
    return sanitizeAnalysisSettings(text ? JSON.parse(text) : null);
  } catch {
    return defaultAnalysisSettings();
  }
}

/** Returns false when the browser refused to store them. */
export function saveAnalysisSettings(storage: KeyValueStorage | undefined, settings: AnalysisSettings): boolean {
  if (!storage) return false;
  try {
    storage.setItem(ANALYSIS_SETTINGS_KEY, JSON.stringify(sanitizeAnalysisSettings(settings)));
    return true;
  } catch {
    return false;
  }
}
