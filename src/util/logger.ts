import * as vscode from "vscode";

const channel = vscode.window.createOutputChannel("LangFuse Glance");

export const logger = {
  info(message: string): void {
    channel.appendLine(`[info] ${message}`);
  },
  warn(message: string): void {
    channel.appendLine(`[warn] ${message}`);
  },
};
