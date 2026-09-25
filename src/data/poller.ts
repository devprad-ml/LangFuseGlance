import type { Cache } from "./cache";
import { AuthError, RateLimitError, TransientError } from "./errors";
import type { LangFuseClient } from "./langfuseClient";
import { normalize, summarize, type NormalizeOptions } from "./normalize";
import type { Summary, TraceRow } from "./types";

export type PollerError =
  | { kind: "rate_limited"; retryInMs: number }
  | { kind: "auth_failed" }
  | { kind: "transient"; retryInMs: number };

const MAX_BACKOFF_MS = 5 * 60 * 1000;
const TRACE_LIMIT = 100;

export class Poller {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private backoffMs: number;
  private started = false;

  constructor(
    private client: LangFuseClient,
    private cache: Cache,
    private normalizeOptions: NormalizeOptions,
    private onUpdate: (rows: TraceRow[], summary: Summary) => void,
    private onError: (error: PollerError) => void,
    private baseIntervalMs: number
  ) {
    this.backoffMs = baseIntervalMs;
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    void this.tick();
  }

  stop(): void {
    this.started = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  async tickNow(): Promise<void> {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    await this.tick();
  }

  private async tick(): Promise<void> {
    try {
      const raw = await this.client.fetchRecentTraces(TRACE_LIMIT);
      const rows = normalize(raw, this.normalizeOptions);
      this.cache.replace(rows);
      this.onUpdate(rows, summarize(rows));
      this.backoffMs = this.baseIntervalMs;
    } catch (err) {
      if (err instanceof RateLimitError) {
        this.backoffMs = Math.min(
          Math.max(this.backoffMs * 2, err.retryAfterMs ?? this.backoffMs * 2),
          MAX_BACKOFF_MS
        );
        this.onError({ kind: "rate_limited", retryInMs: this.backoffMs });
      } else if (err instanceof AuthError) {
        this.stop();
        this.onError({ kind: "auth_failed" });
        return;
      } else if (err instanceof TransientError) {
        this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS);
        this.onError({ kind: "transient", retryInMs: this.backoffMs });
      } else {
        throw err;
      }
    }

    if (this.started) {
      this.timer = setTimeout(() => void this.tick(), this.backoffMs);
    }
  }
}
