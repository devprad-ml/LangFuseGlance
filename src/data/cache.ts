import type { TraceRow } from "./types";

// Fixed-size ring buffer — bounds memory/render cost regardless of trace volume.
export class Cache {
  private rows: TraceRow[] = [];

  constructor(private maxSize: number) {}

  replace(rows: TraceRow[]): void {
    this.rows = rows.slice(0, this.maxSize);
  }

  getAll(): TraceRow[] {
    return this.rows;
  }
}
