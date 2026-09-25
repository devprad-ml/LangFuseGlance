# LangFuse Glance

A minimal, always-current VS Code sidebar view of your recent LangFuse traces. No
backend, no other vendor, no floating window — one list of recent calls (model and cost
inline), one summary strip, and click-to-expand details for each call, with an optional
link to LangFuse's own UI for deep debugging.

See `docs/adr/` for decision records.

## Setup

```bash
npm install
npm run build
```

Press F5 in VS Code (or the Extension Development Host launch config) to run the
extension. Use the command **LangFuse Glance: Configure Connection** to set your
LangFuse base URL, public key, and secret key (stored in `SecretStorage`).

## Security: what happens to your keys

- Your public and secret keys are stored in your OS keychain via VS Code's
  `SecretStorage`, never in `settings.json` or any file that could be committed.
- They are only sent to the LangFuse base URL you enter. There is no backend,
  relay, or third party; the extension talks directly to your own LangFuse host.
- The sidebar UI (webview) never receives the keys. All network calls happen in the
  extension host (`src/data/langfuseClient.ts` is the only file that makes requests).
- Tip: create a dedicated API key pair for this extension in LangFuse
  (Project Settings → API Keys). You can revoke it at any time without touching the
  keys your app uses.

## Development

- `npm run watch` — rebuild on change
- `npm test` — unit tests (Vitest, no `vscode` dependency)
- `npm run typecheck` — strict TypeScript check
- `npm run lint` — ESLint
