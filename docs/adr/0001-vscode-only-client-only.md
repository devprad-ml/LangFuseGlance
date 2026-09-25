# 0001: VS Code sidebar only, client-only, no backend

## Status
Accepted

## Context
The original idea considered a browser extension, a floating always-on-top window, and
a shared backend that could aggregate across users or support multiple trace providers
(LangFuse + LangSmith) behind one UI.

## Decision
Ship a single VS Code sidebar (`WebviewViewProvider`), talking directly from the
extension host to the user's own LangFuse instance with their own API keys. No backend,
no floating window, no browser extension, no second provider in v1.

## Rationale
- Each install's LangFuse credentials and data are the user's own; there is nothing to
  aggregate across users, so a shared backend adds cost, latency, and a credential-
  proxying security liability for zero functional benefit.
- A docked sidebar matches "always-current glance" better than a tab you can lose track
  of or a floating window that fights for screen space.
- Narrowing to one provider (LangFuse) let v1 actually ship; the `normalize.ts` /
  `langfuseClient.ts` split keeps a second provider a contained addition later.

## Consequences
- Zero shared infrastructure to run, fund, or scale.
- Adding LangSmith later means a new client module behind the same `TraceRow`/`Summary`
  shapes, not a rewrite.
