import type { Transport } from './engine';

/** The engine file in public/engine/ (see the README there). */
export const ENGINE_FILE = 'engine/stockfish-19-lite-single.js';

/** Address of the engine script, respecting the site's base path (e.g. /Chauss/). */
export function engineUrl(baseUrl: string): string {
  return `${baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`}${ENGINE_FILE}`;
}

/**
 * Runs the engine in a Web Worker, so searching never freezes the page.
 * The Stockfish script is itself the worker: it takes UCI commands as messages and posts back
 * lines of text. It finds its .wasm file next to itself.
 */
export function createWorkerTransport(url: string): Transport {
  let lineHandler: (line: string) => void = () => {};
  let errorHandler: (message: string) => void = () => {};
  let worker: Worker | null = null;

  try {
    worker = new Worker(url);
    worker.addEventListener('message', (event: MessageEvent<unknown>) => {
      if (typeof event.data !== 'string') return; // e.g. download-progress objects
      for (const line of event.data.split('\n')) {
        const text = line.trim();
        if (text) lineHandler(text);
      }
    });
    worker.addEventListener('error', (event: ErrorEvent) => {
      event.preventDefault(); // reported through the engine status instead of the console
      errorHandler(event.message || 'The engine could not be loaded.');
    });
  } catch (error) {
    // Report after the caller has had the chance to register its handlers.
    queueMicrotask(() => errorHandler(error instanceof Error ? error.message : String(error)));
  }

  return {
    post: (command) => worker?.postMessage(command),
    onLine: (handler) => {
      lineHandler = handler;
    },
    onError: (handler) => {
      errorHandler = handler;
    },
    terminate: () => {
      worker?.terminate();
      worker = null;
    },
  };
}
