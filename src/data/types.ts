export interface TraceRow {
  id: string;
  timestamp: string; // ISO
  name: string;
  model: string | null;
  latencyMs: number | null;
  totalTokens: number | null;
  costUsd: number | null;
  status: "ok" | "error" | "unknown";
  externalUrl: string;
}

export interface Summary {
  callsLastHour: number;
  errorRatePct: number;
  approxSpendUsd: number | null;
}

export interface ConnectionConfig {
  baseUrl: string;
  publicKey: string;
  secretKey: string;
  projectId?: string;
}

// Raw shape from LangFuse's Public API GET /api/public/observations?type=GENERATION.
// A GENERATION observation is one LLM call — this is what the extension actually
// wants to show, not a trace (which can bundle many calls). Traces only carry
// aggregate cost; model/tokens/per-call status live on observations. Fields are
// defensively optional because the API may omit them; normalize.ts owns validation.
export interface RawLangFuseGeneration {
  id?: string;
  traceId?: string;
  name?: string;
  startTime?: string;
  endTime?: string;
  level?: string;
  statusMessage?: string;
  model?: string;
  totalTokens?: number;
  // Cost field naming varies across LangFuse versions/self-host vs cloud —
  // normalize.ts checks these in order rather than guessing one name.
  totalCost?: number;
  calculatedTotalCost?: number;
  inputCost?: number;
  outputCost?: number;
  costDetails?: { total?: number };
  [key: string]: unknown;
}
