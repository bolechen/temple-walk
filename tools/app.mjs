// Packages the built site as a macOS app with Pake (https://pake.run): a .dmg in tools/out/app/, or with --app only the
// .app. The site is the one `pnpm build` wrote to dist/. It is copied to a scratch folder first, where the page-view
// counter is taken out of index.html (the game does not need it, and an app should not phone it), the icon is cut
// from app/favicon.svg, and the window and behaviour come from pakeConfig below. Nothing in dist/ is changed.
//
//     pnpm run app                      build the site, then the .dmg
//     node tools/app.mjs --app          only the .app (iterative build, no disk image)
//     node tools/app.mjs --skip-build   package the dist/ that is already there
//     node tools/app.mjs --keep         keep the scratch folder (the config and the stripped site) to look at
//
// Needs the Pake CLI on PATH (npm i -g pake-cli@3.19.4, or PAKE=/path/to/pake), Rust and the Xcode command line tools.
// A rustup or crates mirror is taken from the environment (RUSTUP_DIST_SERVER, CARGO_HOME); nothing is set here.
// macOS only. Windows output comes from Pake's Windows build on a Windows machine, and is not made here.
//
// Pake's window state is kept in ~/Library/Application Support/<identifier>/.window-state.json and overrides the
// configured size after the first launch; delete that file to see the configured window again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist"), FAVICON = path.join(ROOT, "app/favicon.svg"), OUT = path.join(ROOT, "tools/out/app");
const NAME = "山门之外", IDENTIFIER = "com.rushiwowen.shangmen", PAKE_VERSION = "3.19.4";
// The page-view counter. The built index.html names it twice: a preconnect, and the script that sends the views.
const COUNTER_HOST = "u.rushiwowen.co";
const COUNTER_TAGS = [
  /[ \t]*<link rel="preconnect" href="https:\/\/u\.rushiwowen\.co"[^>]*>\n?/g,
  /[ \t]*<script[^>]*src="https:\/\/u\.rushiwowen\.co\/[^"]*"[^>]*><\/script>\n?/g,
];
const TEXT_FILES = new Set([".html", ".js", ".css", ".json", ".webmanifest", ".svg"]);
// Right-click in the page shows the WebView's own menu (reload, inspect); the game has none of its own there.
const INJECT = 'document.addEventListener("contextmenu", (event) => event.preventDefault(), true);\n';

// index.html with the counter taken out, and how many tags went. A page the counter never touched comes back unchanged.
export function stripCounter(html) {
  let removed = 0, out = html;
  for (const tag of COUNTER_TAGS) out = out.replace(tag, () => (removed++, ""));
  return { html: out, removed };
}

// The files under a folder that still name the counter's host, relative to it.
export function counterLeft(dir, rel = "") {
  const hits = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const here = path.join(rel, entry.name);
    if (entry.isDirectory()) hits.push(...counterLeft(dir, here));
    else if (TEXT_FILES.has(path.extname(entry.name)) && fs.readFileSync(path.join(dir, here), "utf8").includes(COUNTER_HOST)) hits.push(here);
  }
  return hits;
}

// The Pake configuration for the game. Field names are Pake's camelCase option names; paths must be absolute, because
// Pake resolves a relative one against the folder it is run from.
export function pakeConfig({ version, site, icon, inject, app }) {
  return {
    url: site,
    name: NAME,
    identifier: IDENTIFIER,
    icon,
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 600,
    maximize: true,
    hideTitleBar: true,
    hideOnClose: false,
    darkMode: true,
    downloadDir: "~/Pictures/山门之外",
    appVersion: version,
    targets: "dmg",
    inject: [inject],
    ...(app ? { iterativeBuild: true } : {}),
  };
}

// The outputs of a `pake --json` run. Pake prints exactly one JSON object on stdout; a failure carries a code and a hint.
export function parsePakeResult(stdout) {
  let result;
  try { result = JSON.parse(stdout); } catch { throw new Error("pake printed no JSON result"); }
  if (!result.ok) {
    const error = result.error ?? {};
    throw new Error(`pake ${error.code ?? "failed"}: ${error.message ?? "no message"}${error.hint ? `\n  hint: ${error.hint}` : ""}`);
  }
  return result.outputs ?? [];
}

function run(command, args, cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}

function pake(args, cwd) {
  const bin = process.env.PAKE || "pake";
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, { cwd, stdio: ["ignore", "pipe", "inherit"] });
    let stdout = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.on("error", (error) => reject(error.code === "ENOENT"
      ? new Error(`pake not found: npm i -g pake-cli@${PAKE_VERSION} (or set PAKE=/path/to/pake)`)
      : error));
    child.on("close", (code) => resolve({ code, stdout }));
  });
}

// The app icon: the site's own favicon, cut to the 1024 px square macOS expects. Pake turns it into .icns.
async function makeIcon(file) {
  const sharp = (await import("sharp")).default;
  await sharp(fs.readFileSync(FAVICON), { density: 1200 })
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
}

export async function main(argv = process.argv.slice(2)) {
  const has = (flag) => argv.includes(flag);
  if (process.platform !== "darwin") throw new Error("this packages for macOS only (see the header for Windows)");
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;

  if (!has("--skip-build")) await run("pnpm", ["run", "build"], ROOT);
  if (!fs.existsSync(path.join(DIST, "index.html"))) throw new Error("dist/index.html is missing: run pnpm run build");

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "yunjing-app-"));
  try {
    const site = path.join(scratch, "site");
    fs.cpSync(DIST, site, { recursive: true });
    const indexPath = path.join(site, "index.html");
    const stripped = stripCounter(fs.readFileSync(indexPath, "utf8"));
    fs.writeFileSync(indexPath, stripped.html);
    const left = counterLeft(site);
    if (left.length) throw new Error(`the page still names ${COUNTER_HOST} in: ${left.join(", ")}`);
    console.log(`site: copied dist/, removed ${stripped.removed} counter tag(s)`);

    const icon = path.join(scratch, "icon.png");
    await makeIcon(icon);
    const inject = path.join(scratch, "inject.js");
    fs.writeFileSync(inject, INJECT);
    const config = path.join(scratch, "pake.json");
    fs.writeFileSync(config, JSON.stringify(pakeConfig({ version, site, icon, inject, app: has("--app") }), null, 2));

    const found = await pake(["--version"], scratch);
    if (found.stdout.trim() !== PAKE_VERSION) console.warn(`app: pake ${found.stdout.trim()} is not the pinned ${PAKE_VERSION}; the output may differ`);

    fs.mkdirSync(OUT, { recursive: true });
    const { code, stdout } = await pake(["--config", config, "--json"], OUT);
    const outputs = parsePakeResult(stdout);
    if (code !== 0) throw new Error(`pake exited ${code}`);
    for (const output of outputs) console.log(`${output.format}: ${output.path} (${(output.sizeBytes / 1048576).toFixed(1)} MB)`);
    if (has("--keep")) console.log(`kept: ${scratch}`);
  } finally {
    if (!has("--keep")) fs.rmSync(scratch, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`app: ${error.message}`);
    process.exitCode = 1;
  });
}
