import type { OutboundMessage, InboundMessage } from "../messages";
import type { TraceRow, Summary } from "../../data/types";
import type { PollerError } from "../../data/poller";

declare function acquireVsCodeApi(): { postMessage: (msg: InboundMessage) => void };
const vscode = acquireVsCodeApi();

const rowsEl = document.getElementById("rows")!;
const summaryEl = document.getElementById("summary")!;
const emptyEl = document.getElementById("empty")!;
const emptyText = document.getElementById("emptyText")!;
const configureLink = document.getElementById("configureLink")!;
const refreshBtn = document.getElementById("refreshBtn")!;

configureLink.addEventListener("click", (e) => {
  e.preventDefault();
  vscode.postMessage({ type: "openSettings" });
});

refreshBtn.addEventListener("click", () => {
  vscode.postMessage({ type: "refreshNow" });
});

function renderSummary(summary: Summary): void {
  const spend = summary.approxSpendUsd === null ? "—" : `$${summary.approxSpendUsd.toFixed(4)}`;
  summaryEl.innerHTML = `
    <span>${summary.callsLastHour} calls/hr</span>
    <span class="${summary.errorRatePct > 0 ? "error" : ""}">${summary.errorRatePct.toFixed(0)}% errors</span>
    <span>${spend}</span>
  `;
}

function formatCost(costUsd: number | null): string {
  return costUsd === null ? "—" : `$${costUsd.toFixed(4)}`;
}

function renderRows(rows: TraceRow[]): void {
  rowsEl.innerHTML = "";
  emptyEl.hidden = rows.length > 0;
  for (const row of rows) {
    const li = document.createElement("li");
    li.className = `row ${row.status === "error" ? "error" : ""}`;
    li.innerHTML = `
      <div class="row-main">
        <span class="name">${escapeHtml(row.name)}</span>
        <span class="model">${escapeHtml(row.model ?? "unknown model")}</span>
        <span class="cost">${formatCost(row.costUsd)}</span>
        <span class="time">${new Date(row.timestamp).toLocaleTimeString()}</span>
      </div>
      <div class="details" hidden></div>
    `;
    const details = li.querySelector<HTMLDivElement>(".details")!;
    li.addEventListener("click", () => {
      const wasHidden = details.hidden;
      rowsEl.querySelectorAll<HTMLDivElement>(".details").forEach((d) => (d.hidden = true));
      if (wasHidden) {
        details.innerHTML = renderDetails(row);
        details.hidden = false;
        details.querySelector<HTMLAnchorElement>(".open-external")?.addEventListener("click", (e) => {
          e.preventDefault();
          vscode.postMessage({ type: "openInLangFuse", url: row.externalUrl });
        });
      }
    });
    rowsEl.appendChild(li);
  }
}

function renderDetails(row: TraceRow): string {
  return `
    <div>Model: ${escapeHtml(row.model ?? "unknown")}</div>
    <div>Status: ${escapeHtml(row.status)}</div>
    <div>Latency: ${row.latencyMs === null ? "—" : `${row.latencyMs}ms`}</div>
    <div>Tokens: ${row.totalTokens === null ? "—" : row.totalTokens}</div>
    <div>Cost: ${formatCost(row.costUsd)}</div>
    <div>ID: ${escapeHtml(row.id)}</div>
    <a href="#" class="open-external">Open in LangFuse ↗</a>
  `;
}

function escapeHtml(s: string): string {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderError(error: PollerError): void {
  emptyEl.hidden = false;
  configureLink.hidden = error.kind !== "auth_failed";
  emptyText.textContent =
    error.kind === "auth_failed"
      ? "Authentication failed. Check your LangFuse keys."
      : `Connection issue, retrying in ${Math.round(error.retryInMs / 1000)}s...`;
}

window.addEventListener("message", (event: MessageEvent<OutboundMessage>) => {
  const msg = event.data;
  if (msg.type === "update") {
    configureLink.hidden = false;
    renderSummary(msg.summary);
    renderRows(msg.rows);
  } else if (msg.type === "needsConfiguration") {
    emptyEl.hidden = false;
    emptyText.textContent = "No connection configured.";
    configureLink.hidden = false;
  } else if (msg.type === "pollError") {
    renderError(msg.error);
  }
});
