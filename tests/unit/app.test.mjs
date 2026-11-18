// tools/app.mjs: the Pake configuration for the game, the page-view counter taken out of the built index.html, and the
// reading of Pake's --json result. The packaging itself (pnpm run app) is run by hand and checked on the app it makes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { pakeConfig, stripCounter, parsePakeResult } from "../../tools/app.mjs";

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

test("the app is the game's window: maximised, title bar hidden, closing does not hide it, dark", () => {
  const config = pakeConfig({ version: "0.3.0", site: "/s", icon: "/i.png", inject: "/j.js", app: false });
  assert.equal(config.url, "/s");
  assert.equal(config.name, "山门之外");
  assert.equal(config.identifier, "com.rushiwowen.shangmen");
  assert.equal(config.appVersion, "0.3.0");
  assert.equal(config.maximize, true);
  assert.equal(config.hideTitleBar, true);
  assert.equal(config.hideOnClose, false);
  assert.equal(config.darkMode, true);
  assert.equal(config.targets, "dmg");
  assert.deepEqual(config.inject, ["/j.js"]);
  assert.equal("iterativeBuild" in config, false);
});

test("--app asks Pake for the .app alone, with the same window", () => {
  const config = pakeConfig({ version: "0.3.0", site: "/s", icon: "/i.png", inject: "/j.js", app: true });
  assert.equal(config.iterativeBuild, true);
  assert.equal(config.width, 1440);
  assert.equal(config.minWidth, 960);
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

test("a successful pake --json run gives its outputs", () => {
  const stdout = JSON.stringify({ ok: true, outputs: [{ path: "/o/山门之外.dmg", sizeBytes: 1, format: "dmg" }], error: null });
  assert.deepEqual(parsePakeResult(stdout), [{ path: "/o/山门之外.dmg", sizeBytes: 1, format: "dmg" }]);
});

test("a failed pake run says its code and the hint", () => {
  const stdout = JSON.stringify({ ok: false, outputs: [], error: { code: "ENV_MISSING", message: "no rustc", hint: "install Rust" } });
  assert.throws(() => parsePakeResult(stdout), /ENV_MISSING: no rustc\n {2}hint: install Rust/);
});

test("output that is not one JSON object is refused", () => {
  assert.throws(() => parsePakeResult("Building app...\n"), /printed no JSON result/);
});
