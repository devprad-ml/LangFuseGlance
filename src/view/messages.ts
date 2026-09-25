import type { Summary, TraceRow } from "../data/types";
import type { PollerError } from "../data/poller";

// ext-host -> webview
export type OutboundMessage =
  | { type: "update"; rows: TraceRow[]; summary: Summary }
  | { type: "pollError"; error: PollerError }
  | { type: "needsConfiguration" };

// webview -> ext-host
export type InboundMessage =
  | { type: "openInLangFuse"; url: string }
  | { type: "refreshNow" }
  | { type: "openSettings" };
