import * as vscode from "vscode";
import type { SecretStore } from "../auth/secretStore";
import type { ConnectionConfig } from "../data/types";
import { LangFuseClient } from "../data/langfuseClient";

export async function configureConnection(secretStore: SecretStore): Promise<ConnectionConfig | undefined> {
  const baseUrl = await vscode.window.showInputBox({
    prompt: "LangFuse base URL",
    placeHolder: "https://cloud.langfuse.com",
    validateInput: (v) => (v.startsWith("http") ? undefined : "Must start with http/https"),
  });
  if (!baseUrl) return undefined;

  const publicKey = await vscode.window.showInputBox({
    prompt: "LangFuse public key",
    validateInput: (v) => (v.length > 0 ? undefined : "Required"),
  });
  if (!publicKey) return undefined;

  const secretKey = await vscode.window.showInputBox({
    prompt:
      "LangFuse secret key. Stored in your OS keychain and only sent to your LangFuse host. It never goes anywhere else.",
    password: true,
    validateInput: (v) => (v.length > 0 ? undefined : "Required"),
  });
  if (!secretKey) return undefined;

  const normalizedBaseUrl = baseUrl.replace(/\/$/, "");

  // Project ID drives the "Open in LangFuse" deep link — detect it from the key
  // rather than asking the user to find and paste an internal ID.
  let projectId: string | undefined;
  try {
    projectId =
      (await new LangFuseClient({
        baseUrl: normalizedBaseUrl,
        publicKey,
        secretKey,
      }).fetchProjectId()) ?? undefined;
  } catch {
    projectId = undefined;
  }
  if (!projectId) {
    void vscode.window.showWarningMessage(
      "LangFuse Glance: couldn't auto-detect your project ID. Trace data will still load, but 'Open in LangFuse' links may not work."
    );
  }

  const config: ConnectionConfig = {
    baseUrl: normalizedBaseUrl,
    publicKey,
    secretKey,
    projectId,
  };

  await secretStore.save(config);
  return config;
}
