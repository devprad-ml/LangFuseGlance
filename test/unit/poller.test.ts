import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { Poller } from "../../src/data/poller";
import { Cache } from "../../src/data/cache";
import { AuthError, RateLimitError, TransientError } from "../../src/data/errors";
import type { LangFuseClient } from "../../src/data/langfuseClient";

const normalizeOptions = { baseUrl: "https://cloud.langfuse.com", projectId: "p1" };
const BASE_INTERVAL = 15000;

function makeClient(fetchImpl: () => Promise<unknown[]>): LangFuseClient {
  return { fetchRecentTraces: fetchImpl } as unknown as LangFuseClient;
}

describe("Poller", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetches on start and calls onUpdate with normalized rows", async () => {
    const client = makeClient(async () => [
      { id: "o1", traceId: "t1", startTime: "2026-09-22T10:00:00.000Z", level: "DEFAULT" },
    ]);
    const cache = new Cache(100);
    const onUpdate = vi.fn();
    const onError = vi.fn();
    const poller = new Poller(client, cache, normalizeOptions, onUpdate, onError, BASE_INTERVAL);

    poller.start();
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    expect(cache.getAll()).toHaveLength(1);
    poller.stop();
  });

  it("does not double-start", async () => {
    const fetchFn = vi.fn().mockResolvedValue([]);
    const client = makeClient(fetchFn);
    const poller = new Poller(client, new Cache(100), normalizeOptions, vi.fn(), vi.fn(), BASE_INTERVAL);

    poller.start();
    poller.start();
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalledTimes(1));
    poller.stop();
  });

  it("backs off exponentially on rate limit and reports retryInMs", async () => {
    const client = makeClient(async () => {
      throw new RateLimitError(null);
    });
    const onError = vi.fn();
    const poller = new Poller(client, new Cache(100), normalizeOptions, vi.fn(), onError, BASE_INTERVAL);

    poller.start();
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({ kind: "rate_limited", retryInMs: BASE_INTERVAL * 2 })
    );
    poller.stop();
  });

  it("respects Retry-After when larger than doubled backoff", async () => {
    const client = makeClient(async () => {
      throw new RateLimitError(120000);
    });
    const onError = vi.fn();
    const poller = new Poller(client, new Cache(100), normalizeOptions, vi.fn(), onError, BASE_INTERVAL);

    poller.start();
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({ kind: "rate_limited", retryInMs: 120000 })
    );
    poller.stop();
  });

  it("stops polling on auth failure instead of hammering a dead key", async () => {
    const fetchFn = vi.fn().mockRejectedValue(new AuthError("bad key"));
    const client = makeClient(fetchFn);
    const onError = vi.fn();
    const poller = new Poller(client, new Cache(100), normalizeOptions, vi.fn(), onError, BASE_INTERVAL);

    poller.start();
    await vi.waitFor(() => expect(onError).toHaveBeenCalledWith({ kind: "auth_failed" }));

    await vi.advanceTimersByTimeAsync(BASE_INTERVAL * 10);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it("backs off exponentially on transient error and resets on next success", async () => {
    let call = 0;
    const client = makeClient(async () => {
      call += 1;
      if (call === 1) throw new TransientError("network blip");
      return [];
    });
    const onError = vi.fn();
    const onUpdate = vi.fn();
    const poller = new Poller(client, new Cache(100), normalizeOptions, onUpdate, onError, BASE_INTERVAL);

    poller.start();
    await vi.waitFor(() =>
      expect(onError).toHaveBeenCalledWith({ kind: "transient", retryInMs: BASE_INTERVAL * 2 })
    );

    await vi.advanceTimersByTimeAsync(BASE_INTERVAL * 2);
    await vi.waitFor(() => expect(onUpdate).toHaveBeenCalledTimes(1));
    poller.stop();
  });
});
