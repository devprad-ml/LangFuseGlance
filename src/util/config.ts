import * as vscode from "vscode";

export function getPollIntervalMs(): number {
  const seconds = vscode.workspace
    .getConfiguration("langfuseGlance")
    .get<number>("pollIntervalSeconds", 15);
  return seconds * 1000;
}
