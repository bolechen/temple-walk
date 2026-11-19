// tools/app.mjs and tools/app/: the MyGo shell for the desktop app — the counter taken out of the built index.html,
// the mygo.json written from updates.json, the app built, and its outputs found. The packaging itself is run by hand
// and checked on the app it makes; the update loop was replayed locally on 2026-11-19 (see tools/app/README.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { stripCounter, counterLeft, mygoJson, mainGo, buildOutputs } from "../../tools/app.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

// The two lines the built index.html carries for the counter, as dist/ writes them.
const COUNTER = `<link rel="preconnect" href="https://u.rushiwowen.co">
<script defer src="https://u.rushiwowen.co/script.js" data-website-id="e9b57921-f7a4-4d50-b0e9-8f0fcdccfa42" data-domains="temple.rushiwowen.co" data-do-not-track="true" data-exclude-hash="true" data-performance="true"></script>
`;
const PAGE = `<!doctype html>
<html lang="zh-Hans">
${COUNTER}<link rel="canonical" href="https://temple.rushiwowen.co/">
<title>山门之外 · 云径禅寺</title>
</html>
`;

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

test("the counter's preconnect and script are taken out, and the rest of the page is kept", () => {
  const { html, removed } = stripCounter(PAGE);
  assert.equal(removed, 2);
  assert.equal(html.includes("u.rushiwowen.co"), false);
  assert.match(html, /<link rel="canonical" href="https:\/\/temple\.rushiwowen\.co\/">/);
  assert.match(html, /<title>山门之外 · 云径禅寺<\/title>/);
  assert.equal(html.includes("<script"), false);
});

test("a page without the counter comes back unchanged", () => {
  const plain = "<!doctype html><html><body>no counter</body></html>\n";
  assert.deepEqual(stripCounter(plain), { html: plain, removed: 0 });
});

test("the checked copy of the site names the counter's host nowhere", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "app-check-"));
  try {
    fs.mkdirSync(path.join(dir, "assets"), { recursive: true });
    fs.writeFileSync(path.join(dir, "index.html"), stripCounter(PAGE).html);
    fs.writeFileSync(path.join(dir, "assets", "a.js"), "fetch('https://temple.rushiwowen.co/x')\n");
    fs.writeFileSync(path.join(dir, "assets", "b.js"), "fetch('https://u.rushiwowen.co/y')\n");
    fs.writeFileSync(path.join(dir, "texture.webp"), "not text");
    assert.deepEqual(counterLeft(dir), [path.join("assets", "b.js")]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
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
