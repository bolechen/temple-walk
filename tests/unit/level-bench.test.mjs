// A level still being made is the workbench's only (#409; the owner's rule of 2026-11-20, app/src/bench.js): a pull
// request's preview lists T05 and ships its code, its baked floor and its doorway list; the canary and the public page
// neither list it (?level=t05 walks the prologue there) nor carry any of it. The only way to be sure is to build each
// target and look in what comes out, as deploy.test.mjs does for the visitor counter.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";
import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";
import { BENCH_LEVELS, benchBuild } from "../../app/src/bench.js";
import { LEVELS } from "../../app/src/level.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]));
function build(target) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `temple-bench-${target}-`));
  execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...process.env, VITE_DEPLOY: target }, stdio: ["ignore", "inherit", "inherit"] });
  return out;
}
// What of T05 a built site may hold: its level's module (the plan names the platform and the terrace), the registry's
// entry for it, its floor and its doorway list.
const SIGN = /["'`]月台["'`]|["'`]台基["'`]/, KEY = /\bt05\s*:\s*\(\)\s*=>/;
const scripts = (out) => walk(out).filter((f) => /\.m?js$/.test(f)).map((f) => fs.readFileSync(f, "utf8"));
const ofT05 = (out) => ({
  module: scripts(out).some((s) => SIGN.test(s)), listed: scripts(out).some((s) => KEY.test(s)),
  floor: fs.existsSync(path.join(out, "shared/walk/t05.bin")), doorways: fs.existsSync(path.join(out, "shared/doorways/t05.json")),
});

test("the levels only the workbench lists are the ones the registry lists behind its test of the build", () => {
  assert.deepEqual(BENCH_LEVELS, ["t05"]);
  // In Node (no build target) the workbench's levels are listed, as on the dev server and a preview.
  for (const id of BENCH_LEVELS) assert.ok(Object.hasOwn(LEVELS, id), id);
  assert.equal(benchBuild("preview"), true); assert.equal(benchBuild("canary"), false); assert.equal(benchBuild("production"), false);
  // The registry lists each of them behind one test the bundler can fold, and nothing else is behind it.
  const src = fs.readFileSync(path.join(ROOT, "app/src/level.js"), "utf8");
  assert.match(src, /const WORKBENCH = typeof __DEPLOY__ === "undefined" \|\| __DEPLOY__ === "preview";/);
  const behind = [...(src.match(/\.\.\.\(WORKBENCH \? \{([^}]*)\} : \{\}\)/)?.[1] || "").matchAll(/\b(\w+)\s*:/g)].map((m) => m[1]);
  assert.deepEqual(behind, [...BENCH_LEVELS]);
});

test("a preview ships T05; the canary and the public page carry none of it", () => {
  const baked = { floor: fs.existsSync(path.join(ROOT, "app/shared/walk/t05.bin")), doorways: fs.existsSync(path.join(ROOT, "app/shared/doorways/t05.json")) };
  const outs = { preview: build("preview"), canary: build("canary"), production: build("production") };
  try {
    const p = ofT05(outs.preview);
    assert.ok(p.module, "the preview holds T05's level module"); assert.ok(p.listed, "and lists it");
    if (baked.floor) assert.ok(p.floor, "and its baked floor"); if (baked.doorways) assert.ok(p.doorways, "and its doorway list");
    for (const t of ["canary", "production"]) assert.deepEqual(ofT05(outs[t]), { module: false, listed: false, floor: false, doorways: false }, `${t} carries nothing of T05`);
  } finally { for (const o of Object.values(outs)) fs.rmSync(o, { recursive: true, force: true }); }
});
