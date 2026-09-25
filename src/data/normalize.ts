import type { RawLangFuseGeneration, Summary, TraceRow } from "./types";

const ONE_HOUR_MS = 60 * 60 * 1000;

export interface NormalizeOptions {
  baseUrl: string;
  projectId: string;
  onDropped?: (raw: RawLangFuseGeneration, reason: string) => void;
}

// Raw LangFuse GENERATION observations -> internal TraceRow[]. Drops malformed rows
// instead of throwing; the caller's onDropped hook is for logging, not control flow.
export function normalize(raw: RawLangFuseGeneration[], options: NormalizeOptions): TraceRow[] {
  const rows: TraceRow[] = [];

  for (const gen of raw) {
    if (!gen.id || !gen.traceId || !gen.startTime) {
      options.onDropped?.(gen, "missing id, traceId, or startTime");
      continue;
    }

    const status: TraceRow["status"] =
      gen.level === "ERROR" ? "error" : gen.level ? "ok" : "unknown";

    const latencyMs =
      gen.endTime && gen.startTime
        ? new Date(gen.endTime).getTime() - new Date(gen.startTime).getTime()
        : null;

    rows.push({
      id: gen.id,
      timestamp: gen.startTime,
      name: gen.name ?? "(unnamed)",
      model: gen.model ?? null,
      latencyMs,
      totalTokens: typeof gen.totalTokens === "number" ? gen.totalTokens : null,
      costUsd: readCost(gen),
      status,
      externalUrl: `${options.baseUrl}/project/${options.projectId}/traces/${gen.traceId}?observation=${gen.id}`,
    });
  }

  return rows.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
}

function readCost(gen: RawLangFuseGeneration): number | null {
  if (typeof gen.totalCost === "number") return gen.totalCost;
  if (typeof gen.calculatedTotalCost === "number") return gen.calculatedTotalCost;
  if (typeof gen.costDetails?.total === "number") return gen.costDetails.total;
  if (typeof gen.inputCost === "number" && typeof gen.outputCost === "number") {
    return gen.inputCost + gen.outputCost;
  }
  return null;
}

export function summarize(rows: TraceRow[]): Summary {
  const cutoff = Date.now() - ONE_HOUR_MS;
  const recent = rows.filter((r) => new Date(r.timestamp).getTime() >= cutoff);

  const errorCount = recent.filter((r) => r.status === "error").length;
  const errorRatePct = recent.length > 0 ? (errorCount / recent.length) * 100 : 0;

  const costs = recent.map((r) => r.costUsd).filter((c): c is number => c !== null);
  const approxSpendUsd = costs.length > 0 ? costs.reduce((a, b) => a + b, 0) : null;

  return {
    callsLastHour: recent.length,
    errorRatePct,
    approxSpendUsd,
  };
}
