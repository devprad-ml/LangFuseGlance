import { afterEach, describe, expect, it, vi } from "vitest";
import { LangFuseClient } from "../../src/data/langfuseClient";
import { AuthError, TransientError } from "../../src/data/errors";
import fixture from "../fixtures/langfuse-traces-sample.json";

const config = {
  baseUrl: "https://cloud.langfuse.com",
  publicKey: "pk",
  secretKey: "sk",
};

function mockFetch(response: Partial<Response> & { json?: () => Promise<unknown> }) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(),
      json: async () => ({}),
      ...response,
    })
  );
}

describe("LangFuseClient.fetchRecentTraces", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns parsed data on success", async () => {
    mockFetch({ json: async () => fixture });
    const client = new LangFuseClient(config);
    const traces = await client.fetchRecentTraces(20);
    expect(traces).toHaveLength(2);
    expect(traces[0].id).toBe("obs-1");
  });

  it("throws AuthError on 401", async () => {
    mockFetch({ ok: false, status: 401 });
    const client = new LangFuseClient(config);
    await expect(client.fetchRecentTraces(20)).rejects.toBeInstanceOf(AuthError);
  });

  it("throws RateLimitError on 429 with Retry-After", async () => {
    mockFetch({ ok: false, status: 429, headers: new Headers({ "Retry-After": "30" }) });
    const client = new LangFuseClient(config);
    await expect(client.fetchRecentTraces(20)).rejects.toMatchObject({
      retryAfterMs: 30000,
    });
  });

  it("throws TransientError on network failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("ECONNREFUSED"))
    );
    const client = new LangFuseClient(config);
    await expect(client.fetchRecentTraces(20)).rejects.toBeInstanceOf(TransientError);
  });

  it("throws TransientError on unexpected non-ok status", async () => {
    mockFetch({ ok: false, status: 500 });
    const client = new LangFuseClient(config);
    await expect(client.fetchRecentTraces(20)).rejects.toBeInstanceOf(TransientError);
  });
});

describe("LangFuseClient.fetchProjectId", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the first project's id", async () => {
    mockFetch({ json: async () => ({ data: [{ id: "proj_abc" }] }) });
    const client = new LangFuseClient(config);
    await expect(client.fetchProjectId()).resolves.toBe("proj_abc");
  });

  it("returns null when no projects are returned", async () => {
    mockFetch({ json: async () => ({ data: [] }) });
    const client = new LangFuseClient(config);
    await expect(client.fetchProjectId()).resolves.toBeNull();
  });
});
