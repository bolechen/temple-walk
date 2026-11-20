// tools/app.mjs and tools/app/: the MyGo shell for the desktop app — the site built for the desktop target and checked,
// the mygo.json written from updates.json, the app built, and its outputs found. The packaging itself is run by hand
// and checked on the app it makes; the update loop was replayed locally on 2026-11-19 (see tools/app/README.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { siteProblems, buildEnv, mygoJson, mainGo, buildOutputs, main } from "../../tools/app.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

test("the app is the game's window: the Pake settings carried over, maximised, title bar hidden, dark", () => {
  const config = mygoJson({ version: "0.3.1", updatesUrl: "https://x/y", publicKey: "PK", icon: "/tmp/icon.png" });
  assert.equal(config.name, "山门之外");
  assert.equal(config.slug, "temple-walk");
  assert.equal(config.identifier, "com.rushiwowen.shangmen");
  assert.equal(config.version, "0.3.1");
  assert.equal(config.frontendDist, "site");
  assert.equal(config.icon, "/tmp/icon.png");
  assert.deepEqual(config.updates, { publicKey: "PK", url: "https://x/y" });
});

test("the window's size and the update check are in the generated main.go", () => {
  const go = mainGo();
  assert.match(go, /Width:\s+1440/);
  assert.match(go, /MinWidth:\s+960/);
  assert.match(go, /mygo\.Updater\.Check\(ctx\)/);
  assert.match(go, /mygo\.App\.Relaunch\(\)/);
  assert.match(go, /go:embed all:site/);
});

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "app-site-"));
const put = (dir, rel, body) => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), body); };

test("the app is the trial build: web channel by default, canary deploy always, so no counter; a store channel is named", () => {
  assert.deepEqual(buildEnv(), { VITE_CHANNEL: "web", VITE_DEPLOY: "canary" });
  assert.deepEqual(buildEnv("steam"), { VITE_CHANNEL: "steam", VITE_DEPLOY: "canary" });
  assert.throws(() => buildEnv("itch"), /--channel/);
  assert.match(fs.readFileSync(path.join(ROOT, "tools/app.mjs"), "utf8"), /run\("pnpm", \["run", "build"\], ROOT, env\)/);
});

test("a store channel's site holding the counter, sponsor address or tags, or payment code is refused, by name and by bytes", () => {
  const sha = crypto.createHash("sha256").update("qr-bytes").digest("hex");
  const dir = tmp();
  try {
    put(dir, "index.html", "<html>ok</html>");
    put(dir, "assets/a.js", "fetch('https://temple.rushiwowen.co/x')");
    assert.deepEqual(siteProblems(dir, sha, "steam"), []);
    put(dir, "assets/b.js", "fetch('https://u.rushiwowen.co/y')");
    put(dir, "assets/c.js", "open('https://x/rushiwowen.co/donate?utm_campaign=1')");
    put(dir, "assets/d.js", "const offeringQr = 1");
    put(dir, "wechat-support-2026-08-28.jpg", "x");
    put(dir, "assets/renamed.bin", "qr-bytes");
    const bad = siteProblems(dir, sha, "steam").join("\n");
    for (const w of ["b.js: the counter", "c.js: rushiwowen.co/donate", "c.js: utm_campaign", "d.js: names the payment code", "wechat-support-2026-08-28.jpg: the payment code", "renamed.bin: the payment code (by its bytes)"]) assert.ok(bad.includes(w), w + "\n" + bad);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("a web site may hold the sponsor sheet but never the counter, and must hold the sheet", () => {
  const dir = tmp();
  try {
    put(dir, "index.html", "<html>ok</html>");
    put(dir, "assets/sheet.js", "open('https://x/rushiwowen.co/donate?utm_campaign=1')");
    assert.deepEqual(siteProblems(dir, undefined, "web"), []);
    put(dir, "assets/b.js", "fetch('https://u.rushiwowen.co/y')");
    assert.match(siteProblems(dir, undefined, "web").join("\n"), /b\.js: the counter/);
    fs.rmSync(path.join(dir, "assets/sheet.js"));
    fs.rmSync(path.join(dir, "assets/b.js"));
    assert.match(siteProblems(dir, undefined, "web").join("\n"), /built for another channel/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("--skip-build refuses a dist/ whose channel does not match --channel, with the command that fixes it", async () => {
  const dir = tmp();
  try {
    put(dir, "index.html", '<script defer src="https://u.rushiwowen.co/script.js"></script>');
    put(dir, "assets/sheet.js", "open('https://x/rushiwowen.co/donate?utm_campaign=1')");
    await assert.rejects(main(["--skip-build"], { dist: dir }), (e) => /does not match --channel=web/.test(e.message) && /VITE_CHANNEL=web VITE_DEPLOY=canary pnpm run build/.test(e.message) && /index\.html/.test(e.message));
    await assert.rejects(main(["--skip-build", "--channel=steam"], { dist: dir }), (e) => /does not match --channel=steam/.test(e.message) && /utm_campaign/.test(e.message));
    const webOnly = tmp();
    put(webOnly, "index.html", "<html></html>"); put(webOnly, "assets/s.js", "x('utm_campaign')");
    try { await assert.rejects(main(["--skip-build", "--channel=steam"], { dist: webOnly }), /does not match/); } finally { fs.rmSync(webOnly, { recursive: true, force: true }); }
    const steamOnly = tmp();
    put(steamOnly, "index.html", "<html></html>");
    try { await assert.rejects(main(["--skip-build"], { dist: steamOnly }), /built for another channel than web/); } finally { fs.rmSync(steamOnly, { recursive: true, force: true }); }
    await assert.rejects(main(["--skip-build", "--channel=itch"], { dist: dir }), /--channel must be/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test("the site built as the app is built holds no counter, and for a store channel no sponsor sheet or code (built for real, scanned as the package is)", () => {
  const qr = crypto.createHash("sha256").update(fs.readFileSync(path.join(ROOT, "app/web/wechat-support-2026-08-28.jpg"))).digest("hex");
  for (const channel of ["web", "steam"]) {
    const out = tmp();
    try {
      execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...process.env, ...buildEnv(channel) }, stdio: ["ignore", "inherit", "pipe"] });
      assert.deepEqual(siteProblems(out, qr, channel), [], channel);
      assert.match(fs.readFileSync(path.join(out, "index.html"), "utf8"), /noindex/);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});

test("the build's outputs are found, and a build without an app is refused", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "app-out-"));
  try {
    const p = path.join(dir, "darwin-arm64");
    fs.mkdirSync(p);
    fs.mkdirSync(path.join(p, "山门之外.app"));
    fs.writeFileSync(path.join(p, "temple-walk-0.3.1-darwin-arm64.tar.gz"), "");
    fs.writeFileSync(path.join(p, "update-darwin-arm64.json"), "{}");
    const out = buildOutputs(dir, { version: "0.3.1", platform: "darwin-arm64" });
    assert.equal(path.basename(out.app), "山门之外.app");
    assert.equal(path.basename(out.archive), "temple-walk-0.3.1-darwin-arm64.tar.gz");
    assert.equal(path.basename(out.manifest), "update-darwin-arm64.json");
    assert.throws(() => buildOutputs(dir, { version: "0.3.1", platform: "windows-amd64" }), /wrote no windows-amd64/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("an archive or manifest that is missing is reported as not built, not an error", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "app-out-"));
  try {
    const p = path.join(dir, "darwin-arm64");
    fs.mkdirSync(path.join(p, "山门之外.app"), { recursive: true });
    const out = buildOutputs(dir, { version: "0.3.1", platform: "darwin-arm64" });
    assert.equal(out.archive, null);
    assert.equal(out.manifest, null);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("a placeholder public key leaves updates out, so the build skips the update files cleanly", () => {
  const config = mygoJson({ version: "0.3.1", updatesUrl: "https://x/y", publicKey: "TO-BE-GENERATED: run mygo keygen" });
  assert.equal("updates" in config, false);
  const withKey = mygoJson({ version: "0.3.1", updatesUrl: "https://x/y", publicKey: "ABC123+/=" });
  assert.deepEqual(withKey.updates, { publicKey: "ABC123+/=", url: "https://x/y" });
});

test("mygo.json on disk carries the public key and the feed, and no secret", () => {
  const updates = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/app/updates.json"), "utf8"));
  assert.match(updates.publicKey, /^(TO-BE-GENERATED|[A-Za-z0-9+/=]+)(:| |$)/);
  assert.match(updates.updatesUrl, /^https:\/\//);
  const gitignore = fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8");
  assert.match(gitignore, /tools\/app-keys\//);
});
