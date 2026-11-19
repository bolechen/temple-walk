// Which build this is (src/version.js, #310; where it is served is src/deploy.js, #308): the public page says its version, the internal address and
// a pull request's preview say their commit. Each target is built and what comes out is read; the line itself is
// written in each language here.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import "./dom-stub.mjs";
import { DEPLOYS } from "../../app/src/deploy.js";
import { versionLine } from "../../app/src/version.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const VERSION = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).version;
const SHA = "3f2a1c4e9b8d7f6a5c4b3a2918273645f0e1d2c3";
const walk = (dir, base = dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? walk(path.join(dir, e.name), base) : [[path.relative(base, path.join(dir, e.name)), path.join(dir, e.name)]]);
function build(env) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `temple-deploy-`));
  const e = { ...process.env }; for (const k of ["VITE_DEPLOY", "VITE_COMMIT", "VITE_PR", "GITHUB_SHA"]) delete e[k];
  execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...e, ...env }, stdio: ["ignore", "inherit", "pipe"] });
  return out;
}
/** The page's own scripts, as one text. */
const scripts = (out) => walk(out).filter(([rel]) => rel.startsWith("assets/") && rel.endsWith(".js")).map(([, abs]) => fs.readFileSync(abs, "utf8")).join("\n");

test("the line: the version on the public page, the commit on the internal address and on a preview, in every language", () => {
  const o = { version: VERSION, commit: SHA };
  assert.equal(versionLine({ ...o, deploy: "production", to: "zh" }), `云径禅寺 v${VERSION}`);
  assert.equal(versionLine({ ...o, deploy: "production", style: "commit", to: "zh" }), `v${VERSION} · 3f2a1c4`);
  assert.equal(versionLine({ ...o, deploy: "canary", to: "zh" }), "内测版 · 3f2a1c4");
  assert.equal(versionLine({ ...o, deploy: "preview", pr: "123", to: "zh" }), "预览 · PR #123 · 3f2a1c4");
  assert.equal(versionLine({ ...o, deploy: "preview", to: "zh" }), "预览 · 3f2a1c4");
  assert.equal(versionLine({ ...o, deploy: "production", to: "ja" }), `雲径禅寺 v${VERSION}`);
  assert.equal(versionLine({ ...o, deploy: "production", to: "en" }), `Yunjing Temple v${VERSION}`);
  assert.equal(versionLine({ ...o, deploy: "production", to: "ko" }), `운경선사 v${VERSION}`);
  assert.equal(versionLine({ ...o, deploy: "canary", to: "en" }), "canary · 3f2a1c4");
  assert.equal(versionLine({ ...o, deploy: "preview", pr: "123", to: "ko" }), "미리보기 · PR #123 · 3f2a1c4");
  for (const to of ["zh", "ja", "en", "ko"]) for (const deploy of DEPLOYS) {
    const line = versionLine({ ...o, deploy, pr: "123", to });
    assert.ok(deploy === "production" ? line.endsWith(`v${VERSION}`) : line.endsWith("3f2a1c4"), `${to} ${deploy}: ${line}`);
  }
});

test("each target is built with its version, its commit and its name, and a pull request's number only on a preview", () => {
  for (const deploy of DEPLOYS) {
    const out = build({ VITE_DEPLOY: deploy, VITE_COMMIT: SHA, VITE_PR: deploy === "preview" ? "123" : "" });
    try {
      const js = scripts(out);
      const quoted = (v) => new RegExp("[\"'`]" + v.replace(/\./g, "\\.") + "[\"'`]").test(js);   // the bundler writes a string in any of the three quotes
      assert.ok(quoted(VERSION), `${deploy}: the version is not in the build`);
      assert.ok(js.includes(SHA), `${deploy}: the commit is not in the build`);
      assert.ok(quoted(deploy), `${deploy}: the target is not in the build`);
      assert.equal(quoted("123"), deploy === "preview", `${deploy}: the pull request's number`);
      assert.ok(js.includes("menuVersion") && fs.readFileSync(path.join(out, "index.html"), "utf8").includes('id="menuVersion"') && fs.readFileSync(path.join(out, "index.html"), "utf8").includes('id="creditsVersion"'), `${deploy}: the menu's and the thanks' lines are not in the page`);
    } finally { fs.rmSync(out, { recursive: true, force: true }); }
  }
});

test("a build nobody named a target for says it is a preview, with the commit git gives", () => {
  const out = build({});
  try {
    const head = execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim(), js = scripts(out);
    assert.ok(js.includes(head), "the unnamed build does not carry the commit git gives");
    assert.ok(/[\"'`]preview[\"'`]/.test(js), "the unnamed build is not a preview");
  } finally { fs.rmSync(out, { recursive: true, force: true }); }
});
