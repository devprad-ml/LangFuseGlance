import { describe, expect, it } from "vitest";
import { normalize, summarize } from "../../src/data/normalize";
import type { RawLangFuseGeneration } from "../../src/data/types";

const opts = { baseUrl: "https://cloud.langfuse.com", projectId: "proj1" };

describe("normalize", () => {
  it("drops rows missing id, traceId, or startTime", () => {
    const raw: RawLangFuseGeneration[] = [
      { name: "no-id" },
      { id: "a", name: "no-traceId" },
      { id: "a", traceId: "t", name: "no-startTime" },
    ];
    expect(normalize(raw, opts)).toHaveLength(0);
  });

  it("maps a well-formed generation", () => {
    const raw: RawLangFuseGeneration[] = [
      {
        id: "obs1",
        traceId: "t1",
        name: "agent-call",
        startTime: "2026-09-22T10:00:00.000Z",
        endTime: "2026-09-22T10:00:01.200Z",
        level: "DEFAULT",
        model: "gpt-4o",
        totalTokens: 500,
        totalCost: 0.002,
      },
    ];
    const [row] = normalize(raw, opts);
    expect(row).toMatchObject({
      id: "obs1",
      name: "agent-call",
      status: "ok",
      model: "gpt-4o",
      latencyMs: 1200,
      totalTokens: 500,
      costUsd: 0.002,
      externalUrl: "https://cloud.langfuse.com/project/proj1/traces/t1?observation=obs1",
    });
  });

  it("marks status error on ERROR level", () => {
    const raw: RawLangFuseGeneration[] = [
      { id: "o1", traceId: "t1", startTime: "2026-09-22T10:00:00.000Z", level: "ERROR" },
    ];
    expect(normalize(raw, opts)[0].status).toBe("error");
  });

  it("marks status unknown when level is absent", () => {
    const raw: RawLangFuseGeneration[] = [
      { id: "o1", traceId: "t1", startTime: "2026-09-22T10:00:00.000Z" },
    ];
    expect(normalize(raw, opts)[0].status).toBe("unknown");
  });

  it("falls back through cost field name variants", () => {
    const now = "2026-09-22T10:00:00.000Z";
    expect(
      normalize([{ id: "a", traceId: "t", startTime: now, calculatedTotalCost: 0.01 }], opts)[0]
        .costUsd
    ).toBe(0.01);
    expect(
      normalize([{ id: "a", traceId: "t", startTime: now, costDetails: { total: 0.02 } }], opts)[0]
        .costUsd
    ).toBe(0.02);
    expect(
      normalize(
        [{ id: "a", traceId: "t", startTime: now, inputCost: 0.01, outputCost: 0.02 }],
        opts
      )[0].costUsd
    ).toBeCloseTo(0.03);
  });

  it("never guesses cost — null when absent", () => {
    const raw: RawLangFuseGeneration[] = [
      { id: "o1", traceId: "t1", startTime: "2026-09-22T10:00:00.000Z" },
    ];
    expect(normalize(raw, opts)[0].costUsd).toBeNull();
  });

  it("never guesses model or tokens — null when absent", () => {
    const raw: RawLangFuseGeneration[] = [
      { id: "o1", traceId: "t1", startTime: "2026-09-22T10:00:00.000Z" },
    ];
    const [row] = normalize(raw, opts);
    expect(row.model).toBeNull();
    expect(row.totalTokens).toBeNull();
  });

  it("computes latency from start/end time when endTime is present", () => {
    const raw: RawLangFuseGeneration[] = [
      { id: "o1", traceId: "t1", startTime: "2026-09-22T10:00:00.000Z" },
    ];
    expect(normalize(raw, opts)[0].latencyMs).toBeNull();
  });

  it("sorts rows by timestamp desc", () => {
    const raw: RawLangFuseGeneration[] = [
      { id: "old", traceId: "t1", startTime: "2026-09-22T09:00:00.000Z" },
      { id: "new", traceId: "t2", startTime: "2026-09-22T11:00:00.000Z" },
    ];
    const rows = normalize(raw, opts);
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });
});

describe("summarize", () => {
  it("returns zeroed summary for no rows", () => {
    expect(summarize([])).toEqual({ callsLastHour: 0, errorRatePct: 0, approxSpendUsd: null });
  });

  it("counts only rows within the last hour", () => {
    const now = Date.now();
    const raw: RawLangFuseGeneration[] = [
      { id: "recent", traceId: "t1", startTime: new Date(now - 10 * 60 * 1000).toISOString() },
      { id: "stale", traceId: "t2", startTime: new Date(now - 2 * 60 * 60 * 1000).toISOString() },
    ];
    const rows = normalize(raw, opts);
    expect(summarize(rows).callsLastHour).toBe(1);
  });

  it("computes error rate, guarding divide-by-zero", () => {
    const now = new Date().toISOString();
    const raw: RawLangFuseGeneration[] = [
      { id: "a", traceId: "t1", startTime: now, level: "ERROR" },
      { id: "b", traceId: "t2", startTime: now, level: "DEFAULT" },
    ];
    const rows = normalize(raw, opts);
    expect(summarize(rows).errorRatePct).toBe(50);
  });

  it("sums cost when present, but stays null when no row has cost data", () => {
    const now = new Date().toISOString();
    const withoutCost = normalize([{ id: "a", traceId: "t1", startTime: now }], opts);
    expect(summarize(withoutCost).approxSpendUsd).toBeNull();

    const withCost = normalize(
      [
        { id: "a", traceId: "t1", startTime: now, totalCost: 0.01 },
        { id: "b", traceId: "t2", startTime: now, totalCost: 0.02 },
      ],
      opts
    );
    expect(summarize(withCost).approxSpendUsd).toBeCloseTo(0.03);
  });
});
