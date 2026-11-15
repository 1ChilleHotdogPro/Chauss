import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_SETTINGS_KEY,
  loadAnalysisSettings,
  sanitizeAnalysisSettings,
  saveAnalysisSettings,
  searchLimit,
} from './analysisSettings';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
    data,
  };
}

describe('analysis settings', () => {
  it('defaults to depth 14', () => {
    expect(searchLimit(loadAnalysisSettings(undefined))).toEqual({ kind: 'depth', depth: 14 });
  });

  it('keeps a valid choice and drops anything else', () => {
    expect(sanitizeAnalysisSettings({ version: 1, limit: 't1000' }).limit).toBe('t1000');
    expect(sanitizeAnalysisSettings({ version: 1, limit: 'd99' }).limit).toBe('d14');
    expect(sanitizeAnalysisSettings({ version: 2, limit: 't1000' }).limit).toBe('d14');
    expect(sanitizeAnalysisSettings('junk').limit).toBe('d14');
  });

  it('saves and loads, and survives corrupt storage', () => {
    const storage = memoryStorage();
    expect(saveAnalysisSettings(storage, { version: 1, limit: 't500' })).toBe(true);
    expect(searchLimit(loadAnalysisSettings(storage))).toEqual({ kind: 'time', ms: 500 });
    const broken = memoryStorage({ [ANALYSIS_SETTINGS_KEY]: '{not json' });
    expect(loadAnalysisSettings(broken).limit).toBe('d14');
    expect(saveAnalysisSettings(undefined, { version: 1, limit: 'd10' })).toBe(false);
  });
});
