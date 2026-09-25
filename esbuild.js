const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");
const production = process.argv.includes("--production");

/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
  entryPoints: ["src/extension.ts"],
  bundle: true,
  outfile: "dist/extension.js",
  external: ["vscode"],
  format: "cjs",
  platform: "node",
  sourcemap: !production,
  minify: production,
};

/** @type {import('esbuild').BuildOptions} */
const webviewConfig = {
  entryPoints: ["src/view/webview/main.ts"],
  bundle: true,
  outfile: "dist/webview/main.js",
  format: "iife",
  platform: "browser",
  sourcemap: !production,
  minify: production,
};

function copyWebviewHtml() {
  fs.mkdirSync(path.join(__dirname, "dist", "webview"), { recursive: true });
  for (const file of ["index.html", "main.css"]) {
    fs.copyFileSync(
      path.join(__dirname, "src", "view", "webview", file),
      path.join(__dirname, "dist", "webview", file)
    );
  }
}

async function run() {
  copyWebviewHtml();
  if (watch) {
    const ctxs = await Promise.all(
      [extensionConfig, webviewConfig].map((cfg) => esbuild.context(cfg))
    );
    await Promise.all(ctxs.map((ctx) => ctx.watch()));
  } else {
    await Promise.all(
      [extensionConfig, webviewConfig].map((cfg) => esbuild.build(cfg))
    );
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
