import { parseBestMove, parseInfo, type InfoLine } from './uci';

/** How commands reach the engine and lines come back. A Web Worker in the browser; a fake in tests. */
export interface Transport {
  post(command: string): void;
  onLine(handler: (line: string) => void): void;
  onError(handler: (message: string) => void): void;
  terminate(): void;
}

export type EngineState = 'loading' | 'ready' | 'failed';

export interface AnalyseRequest {
  fen: string;
  depth: number;
  /** Called for every exact line the engine reports for this request. */
  onInfo(info: InfoLine): void;
  /**
   * Called once when the search ran to the end. `bestMove` is null when the side to move has no
   * legal move. Not called if the request was replaced or stopped first.
   */
  onDone(bestMove: string | null): void;
}

export interface EngineOptions {
  /** How many best moves the engine reports (MultiPV). */
  multiPv?: number;
  onStateChange?: (state: EngineState) => void;
}

/**
 * Talks to a UCI engine: start-up, then one search at a time.
 *
 * The tricky part is switching positions. After "stop" the engine still sends the tail of the old
 * search, ending in a "bestmove" line. Until that arrives, nothing may be attributed to the new
 * position — so the new search is only started once the old "bestmove" has been seen.
 */
export class Engine {
  private stateValue: EngineState = 'loading';
  private nameValue = '';
  private errorValue = '';
  private current: AnalyseRequest | null = null;
  private pending: AnalyseRequest | null = null;
  private stopping = false;
  private readonly onStateChange: ((state: EngineState) => void) | undefined;

  constructor(
    private readonly transport: Transport,
    options: EngineOptions = {},
  ) {
    this.onStateChange = options.onStateChange;
    const multiPv = options.multiPv ?? 1;

    transport.onError((message) => this.fail(message));
    transport.onLine((line) => this.handleLine(line, multiPv));
    transport.post('uci');
  }

  state(): EngineState {
    return this.stateValue;
  }

  /** The engine's own name, e.g. "Stockfish 19 Lite WASM". Empty until it has introduced itself. */
  name(): string {
    return this.nameValue;
  }

  error(): string {
    return this.errorValue;
  }

  /** Search this position. Replaces whatever was running or waiting. */
  analyse(request: AnalyseRequest): void {
    if (this.stateValue === 'failed') return;
    if (this.stateValue === 'loading' || this.current) {
      this.pending = request;
      this.interrupt();
      return;
    }
    this.start(request);
  }

  /** Stop searching. The stopped request's onDone is not called. */
  stop(): void {
    this.pending = null;
    this.interrupt();
  }

  dispose(): void {
    this.current = null;
    this.pending = null;
    this.transport.terminate();
  }

  private interrupt(): void {
    if (this.current && !this.stopping) {
      this.stopping = true;
      this.transport.post('stop');
    }
  }

  private start(request: AnalyseRequest): void {
    this.current = request;
    this.stopping = false;
    this.transport.post(`position fen ${request.fen}`);
    this.transport.post(`go depth ${request.depth}`);
  }

  private handleLine(line: string, multiPv: number): void {
    if (this.stateValue === 'failed') return;

    if (this.stateValue === 'loading') {
      if (line.startsWith('id name ')) {
        this.nameValue = line.slice('id name '.length).trim();
      } else if (line === 'uciok') {
        this.transport.post(`setoption name MultiPV value ${multiPv}`);
        this.transport.post('isready');
      } else if (line === 'readyok') {
        this.setState('ready');
        const next = this.pending;
        this.pending = null;
        if (next) this.start(next);
      }
      return;
    }

    if (!this.current) return;

    if (line.startsWith('info ')) {
      if (this.stopping) return; // tail of a search nobody wants any more
      const info = parseInfo(line);
      if (info && !info.bound) this.current.onInfo(info);
      return;
    }

    const best = parseBestMove(line);
    if (!best) return;

    const finished = this.current;
    const wasStopped = this.stopping;
    this.current = null;
    this.stopping = false;

    const next = this.pending;
    this.pending = null;
    if (next) this.start(next);
    if (!wasStopped) finished.onDone(best.move);
  }

  private fail(message: string): void {
    if (this.stateValue === 'failed') return;
    this.errorValue = message;
    this.current = null;
    this.pending = null;
    this.setState('failed');
  }

  private setState(state: EngineState): void {
    this.stateValue = state;
    this.onStateChange?.(state);
  }
}
