import * as vscode from "vscode";
import { SecretStore } from "./auth/secretStore";
import { Cache } from "./data/cache";
import { LangFuseClient } from "./data/langfuseClient";
import { Poller } from "./data/poller";
import type { ConnectionConfig } from "./data/types";
import { SidebarProvider } from "./view/sidebarProvider";
import { configureConnection } from "./commands/configureConnection";
import { getPollIntervalMs } from "./util/config";
import { logger } from "./util/logger";

const CACHE_SIZE = 100;

export function activate(context: vscode.ExtensionContext): void {
  const secretStore = new SecretStore(context.secrets);
  const cache = new Cache(CACHE_SIZE);

  const sidebarProvider = new SidebarProvider(context.extensionUri, cache, null, () => {
    void vscode.commands.executeCommand("langfuseGlance.configureConnection");
  });

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider("langfuseGlance.sidebar", sidebarProvider)
  );

  let currentConfig: ConnectionConfig | null = null;

  function wireConnection(config: ConnectionConfig): void {
    currentConfig = config;
    const client = new LangFuseClient(config);
    const poller = new Poller(
      client,
      cache,
      { baseUrl: config.baseUrl, projectId: config.projectId ?? "" },
      () => sidebarProvider.postUpdate(),
      (error) => {
        if (error.kind === "auth_failed") {
          logger.warn("LangFuse authentication failed; stopping polling");
        } else {
          logger.warn(`LangFuse poll failed (${error.kind}); retrying in ${error.retryInMs}ms`);
        }
        sidebarProvider.postError(error);
      },
      getPollIntervalMs()
    );
    sidebarProvider.setPoller(poller);
  }

  void secretStore.get().then(async (existing) => {
    if (!existing) {
      sidebarProvider.postNeedsConfiguration();
      return;
    }
    // Always re-detect: older versions let users type a project *name* here, which breaks links.
    try {
      const projectId = await new LangFuseClient(existing).fetchProjectId();
      if (projectId && projectId !== existing.projectId) {
        existing = { ...existing, projectId };
        await secretStore.save(existing);
      }
    } catch {
      // non-fatal — "Open in LangFuse" links just won't resolve until detection succeeds
    }
    wireConnection(existing);
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("langfuseGlance.configureConnection", async () => {
      const config = await configureConnection(secretStore);
      if (config) {
        wireConnection(config);
      }
    }),
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (currentConfig && e.affectsConfiguration("langfuseGlance.pollIntervalSeconds")) {
        wireConnection(currentConfig);
      }
    }),
    { dispose: () => sidebarProvider.setPoller(null) }
  );
}
