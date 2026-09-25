import type { ConnectionConfig, RawLangFuseGeneration } from "./types";
import { AuthError, RateLimitError, TransientError } from "./errors";

const REQUEST_TIMEOUT_MS = 5000;

export class LangFuseClient {
  constructor(private config: ConnectionConfig) {}

  async fetchRecentTraces(limit: number): Promise<RawLangFuseGeneration[]> {
    const url = new URL(`${this.config.baseUrl}/api/public/observations`);
    url.searchParams.set("type", "GENERATION");
    url.searchParams.set("limit", String(limit));

    const body = await this.request(url);
    return Array.isArray(body.data) ? (body.data as RawLangFuseGeneration[]) : [];
  }

  // Project ID isn't something a user normally knows to type in — it's the
  // internal ID LangFuse needs for web UI links (/project/{id}/traces/...).
  // A project-scoped API key can only see its own project, so we detect it
  // instead of asking for it.
  async fetchProjectId(): Promise<string | null> {
    const url = new URL(`${this.config.baseUrl}/api/public/projects`);
    const body = await this.request(url);
    const projects = Array.isArray(body.data) ? body.data : [];
    const id = (projects[0] as { id?: unknown } | undefined)?.id;
    return typeof id === "string" ? id : null;
  }

  private async request(url: URL): Promise<{ data?: unknown[] }> {
    const auth = Buffer.from(`${this.config.publicKey}:${this.config.secretKey}`).toString(
      "base64"
    );

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Authorization: `Basic ${auth}` },
        signal: controller.signal,
      });
    } catch (err) {
      throw new TransientError(err instanceof Error ? err.message : "network error");
    } finally {
      clearTimeout(timeout);
    }

    if (response.status === 401 || response.status === 403) {
      throw new AuthError(`authentication failed (${response.status})`);
    }
    if (response.status === 429) {
      const retryAfterHeader = response.headers.get("Retry-After");
      const retryAfterMs = retryAfterHeader ? Number(retryAfterHeader) * 1000 : null;
      throw new RateLimitError(retryAfterMs);
    }
    if (!response.ok) {
      throw new TransientError(`unexpected status ${response.status}`);
    }

    return (await response.json()) as { data?: unknown[] };
  }
}
