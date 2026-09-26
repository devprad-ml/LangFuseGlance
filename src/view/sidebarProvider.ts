import * as vscode from "vscode";
import * as fs from "node:fs";
import { randomBytes } from "node:crypto";
import type { Cache } from "../data/cache";
import type { Poller } from "../data/poller";
import type { InboundMessage, OutboundMessage } from "./messages";
import { summarize } from "../data/normalize";
import type { PollerError } from "../data/poller";

export class SidebarProvider implements vscode.WebviewViewProvider {
  private view: vscode.WebviewView | undefined;
  // Remembered so a webview that loads (or reloads after being hidden) after the
  // "no connection" signal still shows the setup prompt instead of a blank panel.
  private needsConfiguration = false;

  constructor(
    private extensionUri: vscode.Uri,
    private cache: Cache,
    private poller: Poller | null,
    private onOpenSettings: () => void
  ) {}

  setPoller(poller: Poller | null): void {
    this.poller?.stop();
    this.poller = poller;
    if (poller) this.needsConfiguration = false;
    if (this.view?.visible) {
      this.poller?.start();
    }
  }

  postUpdate(): void {
    if (!this.view) return;
    if (this.needsConfiguration) {
      this.post({ type: "needsConfiguration" });
      return;
    }
    const rows = this.cache.getAll();
    this.post({ type: "update", rows, summary: summarize(rows) });
  }

  postNeedsConfiguration(): void {
    this.needsConfiguration = true;
    this.post({ type: "needsConfiguration" });
  }

  postError(error: PollerError): void {
    this.post({ type: "pollError", error });
  }

  private post(message: OutboundMessage): void {
    this.view?.webview.postMessage(message);
  }

  resolveWebviewView(view: vscode.WebviewView): void {
    this.view = view;
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "dist")],
    };
    view.webview.html = this.renderHtml(view.webview);

    view.webview.onDidReceiveMessage((message: InboundMessage) => {
      if (message.type === "openInLangFuse") {
        void vscode.env.openExternal(vscode.Uri.parse(message.url));
      } else if (message.type === "refreshNow") {
        void this.poller?.tickNow();
      } else if (message.type === "openSettings") {
        this.onOpenSettings();
      } else if (message.type === "ready") {
        this.postUpdate();
      }
    });

    view.onDidChangeVisibility(() => {
      if (view.visible) {
        this.poller?.start();
        this.postUpdate();
      } else {
        this.poller?.stop();
      }
    });

    if (view.visible) {
      this.poller?.start();
    }
  }

  private renderHtml(webview: vscode.Webview): string {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "main.js")
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this.extensionUri, "dist", "webview", "main.css")
    );
    const nonce = randomBytes(16).toString("base64");
    const templatePath = vscode.Uri.joinPath(
      this.extensionUri,
      "dist",
      "webview",
      "index.html"
    ).fsPath;
    const template = fs.readFileSync(templatePath, "utf8");

    return template
      .replace(/{{scriptUri}}/g, scriptUri.toString())
      .replace(/{{styleUri}}/g, styleUri.toString())
      .replace(/{{cspSource}}/g, webview.cspSource)
      .replace(/{{nonce}}/g, nonce);
  }
}
