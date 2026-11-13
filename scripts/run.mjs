// Runs one of the project's TypeScript scripts under Node, using Vite to load it (so it can share
// code with the app in src/). Usage: node scripts/run.mjs scripts/build-snapshot.ts [options]
import { resolve } from 'node:path';
import { runnerImport } from 'vite';

const [script, ...args] = process.argv.slice(2);
if (!script) {
  console.error('Usage: node scripts/run.mjs <script.ts> [options]');
  process.exit(2);
}

const { module } = await runnerImport(resolve(script), { logLevel: 'error' });
if (typeof module.main !== 'function') {
  console.error(`${script} does not export a main() function.`);
  process.exit(2);
}
process.exit(await module.main(args));
