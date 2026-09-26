import { describe, expect, it } from "vitest";
import { Cache } from "../../src/data/cache";
import type { TraceRow } from "../../src/data/types";

function row(id: string, timestamp: string): TraceRow {
  return {
    id,
    timestamp,
    name: id,
    model: null,
    latencyMs: null,
    totalTokens: null,
    costUsd: null,
    status: "ok",
    externalUrl: "",
  };
}

describe("Cache", () => {
  const old = row("old", new Date(Date.now() - 60_000).toISOString());

  it("clear() hides calls from before the clear, even when the next poll re-sends them", () => {
    const cache = new Cache(100);
    cache.replace([old]);
    cache.clear();
    const fresh = row("new", new Date(Date.now() + 1_000).toISOString());
    cache.replace([fresh, old]);
    expect(cache.getAll().map((r) => r.id)).toEqual(["new"]);
  });

  it("reset() drops the cutoff so history shows again", () => {
    const cache = new Cache(100);
    cache.clear();
    cache.reset();
    cache.replace([old]);
    expect(cache.getAll()).toHaveLength(1);
  });
});
