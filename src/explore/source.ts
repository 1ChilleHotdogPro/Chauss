import type { ExplorerClient } from '../explorer/client';
import { describeResult } from '../explorer/describe';
import { describeRatings, type ExplorerSettings } from '../explorer/settings';
import type { ExplorerPosition, RatingBand } from '../explorer/types';
import { mergeMoves } from '../snapshot/crawl';
import { positionKey, type Snapshot, type SnapshotNode } from '../snapshot/format';
import { buildExplorePosition, type ExplorePosition, type PositionData } from './position';

/** What the Explore panel can show for a position. */
export type ExploreView =
  | {
      status: 'ready';
      /** snapshot = the bundled data; live = just fetched from Lichess. */
      origin: 'snapshot' | 'live';
      position: ExplorePosition;
      /** Something the user should know about what they are looking at. */
      note?: string;
    }
  | { status: 'loading' }
  | { status: 'unavailable'; reason: string };

export interface ExploreSourceOptions {
  /** The bundled data: undefined while it is still loading, null if it could not be loaded. */
  snapshot: () => Snapshot | null | undefined;
  settings: () => ExplorerSettings;
  client: Pick<ExplorerClient, 'masters' | 'lichess'>;
  /** Called when a live answer has arrived and the view for some position changed. */
  onUpdate: () => void;
  /**
   * How long a position must stay wanted before Lichess is asked (milliseconds). Clicking quickly
   * through moves, or ticking several boxes in Settings, then costs one lookup instead of many —
   * Lichess allows only about twenty a minute.
   */
  liveDelayMs?: number;
}

type LiveState =
  | { status: 'pending' }
  | { status: 'ready'; data: PositionData }
  | { status: 'failed'; reason: string; at: number };

/** How long a failed live lookup is remembered before it may be tried again. */
const RETRY_AFTER_MS = 15_000;

function sameChoice(a: readonly (string | number)[], b: readonly (string | number)[]): boolean {
  return a.length === b.length && [...a].sort().join(',') === [...b].sort().join(',');
}

/**
 * Decides where the data for a position comes from:
 *  - the bundled snapshot, when it covers the position and was built for the rating groups and
 *    speeds the user has chosen;
 *  - otherwise the live Lichess explorer, if a token is set;
 *  - otherwise whatever the snapshot has (with a note), or a plain explanation.
 */
export class ExploreSource {
  private readonly live = new Map<string, LiveState>();
  /** The live lookup that is waiting for its delay to pass; only the newest one survives. */
  private waiting: { key: string; start: () => void; timer: ReturnType<typeof setTimeout> } | null = null;

  constructor(private readonly options: ExploreSourceOptions) {}

  view(fen: string, now: number = Date.now()): ExploreView {
    const snapshot = this.options.snapshot();
    if (snapshot === undefined) return { status: 'loading' };

    const settings = this.options.settings();
    const node = snapshot?.nodes[positionKey(fen)];
    const matchesSettings =
      snapshot !== null &&
      sameChoice(snapshot.meta.lichess.ratings, settings.ratings) &&
      sameChoice(snapshot.meta.lichess.speeds, settings.speeds);

    if (node && matchesSettings) {
      return { status: 'ready', origin: 'snapshot', position: buildExplorePosition(node) };
    }

    const bundledNote = (lead: string): string =>
      snapshot
        ? `${lead} Showing the bundled data instead (Lichess games rated ${describeRatings(snapshot.meta.lichess.ratings as RatingBand[])}).`
        : lead;

    if (!settings.token) {
      if (node) {
        return {
          status: 'ready',
          origin: 'snapshot',
          position: buildExplorePosition(node),
          note: bundledNote('Your chosen rating groups or speeds need live data, and no Lichess token is set.'),
        };
      }
      return {
        status: 'unavailable',
        reason:
          'This position is outside the bundled opening data. Add a Lichess token in Settings to look it up live. The engine still works here.',
      };
    }

    const key = `${positionKey(fen)}|${[...settings.ratings].sort().join(',')}|${[...settings.speeds].sort().join(',')}`;
    let state = this.live.get(key);
    if (state?.status === 'failed' && now - state.at >= RETRY_AFTER_MS) state = undefined;
    if (!state) {
      this.fetchSoon(key, () => {
        this.live.set(key, { status: 'pending' });
        void this.fetchLive(key, fen, settings, node);
      });
      return { status: 'loading' };
    }

    if (state.status === 'ready') {
      return { status: 'ready', origin: 'live', position: buildExplorePosition(state.data) };
    }
    if (state.status === 'failed') {
      if (node) {
        return { status: 'ready', origin: 'snapshot', position: buildExplorePosition(node), note: bundledNote(state.reason) };
      }
      return { status: 'unavailable', reason: state.reason };
    }
    return { status: 'loading' };
  }

  /** Start a lookup once `key` has stayed the wanted one for the delay; a newer want replaces it. */
  private fetchSoon(key: string, start: () => void): void {
    if (this.waiting?.key === key) return;
    if (this.waiting) clearTimeout(this.waiting.timer);
    const timer = setTimeout(() => {
      this.waiting = null;
      start();
    }, this.options.liveDelayMs ?? 600);
    this.waiting = { key, start, timer };
  }

  private async fetchLive(
    key: string,
    fen: string,
    settings: ExplorerSettings,
    node: SnapshotNode | undefined,
  ): Promise<void> {
    const masters = await this.options.client.masters(fen);
    const lichess =
      masters.status === 'ok'
        ? await this.options.client.lichess(fen, { ratings: settings.ratings, speeds: settings.speeds })
        : masters;

    if (masters.status === 'ok' && lichess.status === 'ok') {
      this.live.set(key, { status: 'ready', data: toPositionData(fen, masters.data, lichess.data, node) });
    } else {
      const failed = masters.status !== 'ok' ? masters : lichess;
      this.live.set(key, { status: 'failed', reason: describeResult(failed).text, at: Date.now() });
    }
    this.options.onUpdate();
  }
}

/**
 * Bring live explorer answers into the same shape as a snapshot position. Where the snapshot knows
 * the position too, its Stockfish scores and links are reused (they do not depend on rating groups).
 */
export function toPositionData(
  fen: string,
  masters: ExplorerPosition,
  lichess: ExplorerPosition,
  node?: SnapshotNode,
): PositionData {
  const data: PositionData = {
    fen,
    masters: [masters.white, masters.draws, masters.black],
    lichess: [lichess.white, lichess.draws, lichess.black],
    moves: mergeMoves(fen, masters, lichess).map((move) => {
      const known = node?.moves.find((candidate) => candidate.uci === move.uci);
      return {
        uci: move.uci,
        san: move.san,
        masters: move.masters,
        lichess: move.lichess,
        ...(move.opening ? { opening: move.opening } : {}),
        ...(known?.eval ? { eval: known.eval } : {}),
        ...(known?.next !== undefined ? { next: known.next } : {}),
      };
    }),
  };
  const opening = lichess.opening ?? masters.opening ?? node?.opening;
  if (opening) data.opening = opening;
  if (node?.eval) data.eval = node.eval;
  if (node?.recommended) data.recommended = node.recommended;
  return data;
}
