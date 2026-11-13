import { validateTrapFile, type TrapFile } from './traps';

/** Address of the bundled trap list (a separate file of the built site, like the snapshot). */
const TRAPS_URL = new URL('../data/traps.json', import.meta.url).href;

let loading: Promise<TrapFile> | null = null;

/** The bundled trap list (downloaded once, then reused). Rejects if it is missing or damaged. */
export function loadTraps(): Promise<TrapFile> {
  loading ??= fetch(TRAPS_URL).then(async (response) => {
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data: unknown = await response.json();
    const problems = validateTrapFile(data);
    if (problems.length > 0) throw new Error(`the trap list is damaged (${problems[0]})`);
    return data as TrapFile;
  });
  return loading;
}
