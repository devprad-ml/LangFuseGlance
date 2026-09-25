import * as vscode from "vscode";
import type { ConnectionConfig } from "../data/types";

const SECRET_KEY = "langfuseGlance.connection";

export class SecretStore {
  constructor(private secrets: vscode.SecretStorage) {}

  async get(): Promise<ConnectionConfig | null> {
    const raw = await this.secrets.get(SECRET_KEY);
    return raw ? (JSON.parse(raw) as ConnectionConfig) : null;
  }

  async save(config: ConnectionConfig): Promise<void> {
    await this.secrets.store(SECRET_KEY, JSON.stringify(config));
  }

  async clear(): Promise<void> {
    await this.secrets.delete(SECRET_KEY);
  }
}
