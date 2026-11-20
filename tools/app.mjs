// Packages the built site as a desktop app with MyGo (https://github.com/egoist/mygo), for macOS here and for
// Windows and Linux from any machine by cross-compiling. The site is the one `pnpm build` wrote to dist/: it is
// built for the desktop target (--channel=web by default, the trial build; VITE_DEPLOY=canary, so no counter, as the
// build itself leaves it out, not as an edit afterwards), checked, and copied to a scratch folder that
// `mygo build` embeds; it names the app and signs the update files. Nothing in dist/ is changed.
//
//     pnpm run app                      build the site, then the .app and the .dmg (macOS)
//     node tools/app.mjs --channel=steam   a store build: no offering box, address or payment code
//     node tools/app.mjs --app          the .app only, no disk image
//     node tools/app.mjs --skip-build   package the dist/ that is already there, if it holds none of what an app leaves out (it is refused otherwise)
//     node tools/app.mjs --keep         keep the scratch folder (the mygo project and the stripped site) to look at
//
// Needs the mygo CLI (PAKE → MYGO env var, or `go install github.com/egoist/mygo/cmd/mygo@v0.10.0`), Go 1.27.3+ and,
// for the update files, a key pair from `mygo keygen`: the secret in tools/app-keys/mygo-update.key (git-ignored,
// or MYGO_UPDATER_PRIVATE_KEY in the environment), the public key already in tools/app/mygo.json. Without the
// secret the app is still built; the update archive and manifest are skipped, as mygo does.
//
// The app checks updates.updatesUrl when it runs. Publishing is upload archives first, manifests last, so an app
// never sees a manifest naming missing files; see tools/app/README.md.
//
// MyGo keeps the window state in ~/Library/Application Support/<identifier>/.window-state.json, which overrides
// the configured size after the first launch; delete that file to see the configured window again.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist"), OUT = path.join(ROOT, "tools/out/app"), APP = path.join(ROOT, "tools/app");
const NAME = "山门之外", IDENTIFIER = "com.rushiwowen.shangmen", SLUG = "temple-walk", MYGO_VERSION = "v0.10.0";
// What the desktop build must not hold: the page-view counter always; and, in a build for a store (--channel=steam or
// platform), the sponsor page's address and tags and the WeChat payment code too (the web channel's, #202). Looked for in
// the built files themselves, so a dist/ built some other way is caught by what it contains, not by what anyone says.
const COUNTER_HOST = "u.rushiwowen.co";
const SPONSOR = ["rushiwowen.co/donate", "utm_campaign", "offering-box"];
const QR_NAME = "wechat-support-2026-08-28.jpg";
const TEXT_FILES = new Set([".html", ".js", ".mjs", ".css", ".json", ".webmanifest", ".svg", ".txt", ".map"]);
export const CHANNELS = ["web", "steam", "platform"];
// The desktop app is the trial build, so its default channel is web: the same content as the web page, the offering box
// included; a store build passes --channel=steam. The deploy is `canary`, always: only `production` carries the
// page-view counter (app/src/deploy.js, #309), and canary behaves as production in every other way, differing by noindex
// alone, which a window at mygo://localhost makes harmless. `preview` would drop the counter too, but is a pull
// request's build by name.
export function buildEnv(channel = "web") {
  if (!CHANNELS.includes(channel)) throw new Error(`--channel must be one of ${CHANNELS.join(", ")}, not "${channel}"`);
  return { VITE_CHANNEL: channel, VITE_DEPLOY: "canary" };
}

function walk(dir, rel = "") {
  return fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).flatMap((e) => {
    const here = path.join(rel, e.name);
    return e.isDirectory() ? walk(dir, here) : [here];
  });
}

// What in a built site does not belong in an app for this channel, as "file: what" lines; empty when it is clean. The
// payment code is found by name and by its bytes under any name. A web build must also hold the sponsor sheet, or the
// dist/ was built for another channel.
export function siteProblems(dir, qrSha, channel = "web") {
  const problems = [], web = channel === "web";
  let sponsor = false;
  for (const rel of walk(dir)) {
    const abs = path.join(dir, rel);
    if (/wechat-support/.test(rel)) { if (web) sponsor = true; else problems.push(`${rel}: the payment code`); }
    else if (qrSha && !web && crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex") === qrSha) problems.push(`${rel}: the payment code (by its bytes)`);
    if (!TEXT_FILES.has(path.extname(rel))) continue;
    const text = fs.readFileSync(abs, "utf8");
    if (text.includes(COUNTER_HOST)) problems.push(`${rel}: the counter's host ${COUNTER_HOST}`);
    if (web) { if (text.includes("utm_campaign")) sponsor = true; continue; }
    for (const x of SPONSOR) if (text.includes(x)) problems.push(`${rel}: ${x}`);
    if (/wechat-support|offeringQr/.test(text)) problems.push(`${rel}: names the payment code`);
  }
  if (web && !sponsor) problems.push(`(site): no sponsor sheet; built for another channel than web`);
  return problems;
}

function qrHash() {
  const f = path.join(ROOT, "app/web", QR_NAME);
  return fs.existsSync(f) ? crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex") : undefined;
}

// The mygo.json for the game. The window carries over the Pake settings this replaces (#220): maximised, the title
// bar hidden, dark, closing quits. frontendDist is the stripped copy in the scratch folder; `mygo build` embeds it.
// The icon is the site's own favicon, cut to the 1024 px square MyGo and macOS expect.
// A placeholder public key (the key pair not yet generated) leaves updates out entirely: mygo refuses a malformed
// key outright, and without updates the build simply skips the update files.
export function mygoJson({ version, updatesUrl, publicKey, icon }) {
  const hasKey = publicKey && /^[A-Za-z0-9+/=]+$/.test(publicKey);
  const updates = {
    ...(hasKey ? { publicKey } : {}),
    ...(hasKey && updatesUrl ? { url: updatesUrl } : {}),
  };
  return {
    name: NAME,
    slug: SLUG,
    identifier: IDENTIFIER,
    version,
    ...(icon ? { icon } : {}),
    frontendDist: "site",
    out: "build",
    ...(Object.keys(updates).length ? { updates } : {}),
  };
}

// The main.go for the app: serve the embedded site and check the update feed once, a few seconds after launch,
// installing what it finds and relaunching. Every step is logged next to the user data of the app, which survives
// the relaunch.
export function mainGo() {
  return String.raw`// Generated by tools/app.mjs. The built site, served at mygo://localhost/, and the update check.
package main

import (
	"context"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"time"

	"github.com/egoist/mygo"
)

//go:embed all:site
var site embed.FS

func main() {
	front, err := fs.Sub(site, "site")
	if err != nil {
		log.Fatal(err)
	}
	mygo.SetFrontend(front)
	mygo.App.WhenReady(func() {
		logStep("running version %s", mygo.App.Version())
		mygo.NewWindow(mygo.WindowOptions{
			Title:     "山门之外",
			URL:       "/",
			Width:     1440,
			Height:    900,
			MinWidth:  960,
			MinHeight: 600,
		})
		go checkForUpdates()
	})
	if err := mygo.App.Run(); err != nil {
		log.Fatal(err)
	}
}

// logStep appends to update.log in the app's data directory, across relaunches.
func logStep(format string, a ...any) {
	dir, err := mygo.App.Path(mygo.PathUserData)
	if err != nil {
		return
	}
	f, err := os.OpenFile(filepath.Join(dir, "update.log"), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return
	}
	defer f.Close()
	fmt.Fprintf(f, "%s %s\n", time.Now().Format("2006-01-02 15:04:05"), fmt.Sprintf(format, a...))
}

// checkForUpdates asks the feed once, installs what it finds, and relaunches.
func checkForUpdates() {
	time.Sleep(3 * time.Second)
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Minute)
	defer cancel()
	logStep("check: enabled=%v", mygo.Updater.Enabled())
	up, err := mygo.Updater.Check(ctx)
	if err != nil {
		logStep("check: error: %v", err)
		return
	}
	if up == nil {
		logStep("check: up to date")
		return
	}
	logStep("check: found %s", up.Version)
	if err := up.Install(ctx, func(downloaded, total int64) {}); err != nil {
		logStep("install: error: %v", err)
		return
	}
	logStep("install: %s done, relaunching", up.Version)
	mygo.App.Relaunch()
}
`;
}

// The outputs of a `mygo build` run: the paths this tool reports and copies.
export function buildOutputs(buildDir, { version, platform }) {
  const dir = path.join(buildDir, platform);
  if (!fs.existsSync(dir)) throw new Error(`mygo build wrote no ${platform}: ${buildDir}`);
  const files = fs.readdirSync(dir);
  const app = files.find((f) => f.endsWith(".app"));
  const archive = files.find((f) => f.endsWith(".tar.gz"));
  const manifest = files.find((f) => f.startsWith("update-") && f.endsWith(".json"));
  if (!app) throw new Error(`no .app in ${dir}: ${files.join(", ")}`);
  return { dir, app: path.join(dir, app), archive: archive ? path.join(dir, archive) : null, manifest: manifest ? path.join(dir, manifest) : null };
}

// The app icon: the site's own favicon, cut to the 1024 px square MyGo and macOS expect.
async function makeIcon(file) {
  const sharp = (await import("sharp")).default;
  await sharp(fs.readFileSync(path.join(ROOT, "app/favicon.svg")), { density: 1200 })
    .resize(1024, 1024, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(file);
}

function run(command, args, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...process.env, ...env }, stdio: "inherit" });
    child.on("error", (error) => reject(error.code === "ENOENT" ? new Error(`${command} not found`) : error));
    child.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`${command} ${args.join(" ")} exited ${code}`))));
  });
}

export async function main(argv = process.argv.slice(2), { dist = DIST } = {}) {
  const has = (flag) => argv.includes(flag);
  const version = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
  const mygoBin = process.env.MYGO || "mygo";

  const channel = (argv.find((a) => a.startsWith("--channel=")) ?? "--channel=web").slice("--channel=".length);
  const env = buildEnv(channel);
  if (!has("--skip-build")) await run("pnpm", ["run", "build"], ROOT, env);
  if (!fs.existsSync(path.join(dist, "index.html"))) throw new Error("dist/index.html is missing: run pnpm run build");
  const bad = siteProblems(dist, qrHash(), channel);
  if (bad.length) throw new Error(`dist/ does not match --channel=${channel} (${bad.length} problem(s); rebuild it with ${Object.entries(env).map(([k, v]) => `${k}=${v}`).join(" ")} pnpm run build, or run without --skip-build):\n  ${bad.slice(0, 8).join("\n  ")}`);

  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "yunjing-app-"));
  try {
    const site = path.join(scratch, "site");
    fs.cpSync(dist, site, { recursive: true });
    console.log(`site: copied dist/, checked for channel ${channel}: no counter${channel === "web" ? "" : ", sponsor address or payment code"}`);

    fs.copyFileSync(path.join(APP, "main.go.template"), path.join(scratch, "main.go"));
    const updates = JSON.parse(fs.readFileSync(path.join(APP, "updates.json"), "utf8"));
    const icon = path.join(scratch, "icon.png");
    await makeIcon(icon);
    fs.writeFileSync(path.join(scratch, "mygo.json"), JSON.stringify(mygoJson({ version, icon, ...updates }), null, 2) + "\n");
    fs.writeFileSync(path.join(scratch, "go.mod"), `module templewalk/app\n\ngo 1.27.3\n\nrequire github.com/egoist/mygo v0.10.0\n`);
    fs.writeFileSync(path.join(scratch, ".gitignore"), "site/\nbuild/\nkeys/\n");
    // go.sum from the resolved graph, so `mygo build` compiles offline of this tool's own choices.
    await run("go", ["mod", "tidy"], scratch, { GOTOOLCHAIN: "go1.27.3", GOPROXY: process.env.GOPROXY || "https://goproxy.cn,direct" });

    const secret = process.env.MYGO_UPDATER_PRIVATE_KEY ?? (fs.existsSync(path.join(ROOT, "tools/app-keys/mygo-update.key")) ? fs.readFileSync(path.join(ROOT, "tools/app-keys/mygo-update.key"), "utf8").trim() : undefined);
    if (!secret) console.warn("app: no update key (tools/app-keys/mygo-update.key or MYGO_UPDATER_PRIVATE_KEY); the app builds, the update files are skipped");

    fs.mkdirSync(OUT, { recursive: true });
    const buildDir = path.join(scratch, "build");
    const env = { ...(secret ? { MYGO_UPDATER_PRIVATE_KEY: secret } : {}), GOTOOLCHAIN: "go1.27.3" };
    await run(mygoBin, ["build", ...(has("--app") ? ["-skip-dmg"] : []), "-o", buildDir, "."], scratch, env);

    const platform = `${process.platform}-${process.arch === "arm64" ? "arm64" : process.arch}`;
    const outputs = buildOutputs(buildDir, { version, platform });
    const dmg = fs.readdirSync(outputs.dir).find((f) => f.endsWith(".dmg"));
    console.log(`app: ${outputs.app}`);
    if (dmg) console.log(`dmg: ${path.join(outputs.dir, dmg)}`);
    console.log(`update archive: ${outputs.archive ?? "not built (no key)"}`);
    console.log(`manifest: ${outputs.manifest ?? "not built (no key)"}`);

    const staged = path.join(OUT, `v${version}`);
    fs.mkdirSync(staged, { recursive: true });
    for (const file of [outputs.app, outputs.archive, outputs.manifest].filter(Boolean)) {
      fs.cpSync(file, path.join(staged, path.basename(file)), { recursive: true });
    }
    if (dmg) fs.copyFileSync(path.join(outputs.dir, dmg), path.join(staged, dmg));
    console.log(`staged: ${staged}`);
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
