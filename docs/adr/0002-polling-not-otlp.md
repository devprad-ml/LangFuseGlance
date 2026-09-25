# 0002: REST polling against LangFuse's Public API, OTLP deferred

## Status
Accepted

## Context
LangFuse's Public API is REST/pull-based; there's no outbound webhook for "new trace
created" in the surface used here. An alternative would be an embedded local OTLP
receiver, ingesting spans directly from instrumented SDKs (OpenAI/Anthropic via
community OTel instrumentation, Google ADK natively) — push-based and vendor-neutral.

## Decision
v1 polls LangFuse's REST API with visibility-aware pausing and exponential backoff.
OTLP ingestion is deferred to a possible v2, not built now.

## Rationale
- OTLP would require parsing OTLP/protobuf and assembling span trees from scratch, with
  no ready-made "give me the last 20 traces" endpoint to lean on — materially more
  engineering than the MVP scope justifies.
- Polling only while the sidebar is visible, with backoff on 429/5xx, bounds worst-case
  request volume to roughly `3600 / interval` requests/hour per user — trivially within
  both self-host and Cloud Hobby-tier limits for a single developer's own project.

## Consequences
- No true push/real-time updates; freshness is bounded by the poll interval.
- If OTLP is added later, it's a new ingestion path behind the same `TraceRow`/`Summary`
  shapes, not a replacement of the LangFuse client.
