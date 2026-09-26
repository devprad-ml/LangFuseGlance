import type { TraceRow } from "./types";

// Fixed-size ring buffer — bounds memory/render cost regardless of trace volume.
export class Cache {
  private rows: TraceRow[] = [];
  // Every poll re-fetches the latest N calls, so "clear" has to be a cutoff, not an empty
  // array — otherwise the next poll brings the cleared calls straight back. In-memory only.
  // ponytail: compares LangFuse server timestamps to the local clock; skew of a few
  // seconds can hide/show a call right at the cutoff. Use the newest seen timestamp if it matters.
  private hideBeforeMs = 0;

  constructor(private maxSize: number) {}

  replace(rows: TraceRow[]): void {
    this.rows = rows
      .filter((r) => new Date(r.timestamp).getTime() > this.hideBeforeMs)
      .slice(0, this.maxSize);
  }

  getAll(): TraceRow[] {
    return this.rows;
  }

  // Hide everything up to now; only calls made after this show up.
  clear(): void {
    this.rows = [];
    this.hideBeforeMs = Date.now();
  }

  // Forget rows and the cutoff — used on disconnect, since the next connection may be a
  // different project whose history the user hasn't seen.
  reset(): void {
    this.rows = [];
    this.hideBeforeMs = 0;
  }
}
