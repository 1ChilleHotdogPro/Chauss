import type { Transport } from './engine';

/**
 * A stand-in engine for tests: records what was sent and lets the test decide what comes back.
 * Not used by the app itself.
 */
export class FakeTransport implements Transport {
  readonly sent: string[] = [];
  terminated = false;
  private lineHandler: (line: string) => void = () => {};
  private errorHandler: (message: string) => void = () => {};

  post(command: string): void {
    this.sent.push(command);
  }

  onLine(handler: (line: string) => void): void {
    this.lineHandler = handler;
  }

  onError(handler: (message: string) => void): void {
    this.errorHandler = handler;
  }

  terminate(): void {
    this.terminated = true;
  }

  /** The engine "says" these lines. */
  emit(...lines: string[]): void {
    for (const line of lines) this.lineHandler(line);
  }

  fail(message: string): void {
    this.errorHandler(message);
  }

  /** Answer the start-up handshake the way a real engine does. */
  completeHandshake(name = 'Fake Engine 1'): void {
    this.emit(`id name ${name}`, 'id author nobody', 'uciok');
    this.emit('readyok');
  }

  /** Commands sent since the last call (or since the start). */
  takeSent(): string[] {
    return this.sent.splice(0, this.sent.length);
  }
}
