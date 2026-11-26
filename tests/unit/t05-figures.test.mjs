// The seven painted figures of the great hall (#701, the second version): the table the page loads them from agrees with the altar and with the asset
// register, the files are the ones registered, and while the hall's doors are shut nothing of them is imported, fetched or drawn.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
const { FIGURE_FILES, MASK_FILES, LOAD_ORDER, NEAR, PLINTH } = await import("../../app/levels/t05/figures/registry.js");
const { FIGURES } = await import("../../app/levels/t05/altar.js");
const { HALL_DOORS } = await import("../../app/levels/t05/hall.js");
const dir = new URL("../../app/levels/t05/figures/", import.meta.url);   // anchors; the files and masks are not in git: app/shared/models/t05/, fetched by tools/setup.mjs
const bin = new URL("../../app/shared/models/t05/", import.meta.url);
const need = (u) => assert.ok(existsSync(u), `${u.pathname.replace(/.*temple-walk\//, "")} is missing: run pnpm install (tools/setup.mjs fetches it, checked by SHA-256)`);
const sha = (u) => createHash("sha256").update(readFileSync(u)).digest("hex");

test("the table has the seven, in the altar's order, each with a file, its anchors and its two masks", () => {
  assert.deepEqual(FIGURE_FILES.map((f) => f.id), FIGURES.map((f) => f.id));
  assert.deepEqual([...LOAD_ORDER].sort(), FIGURE_FILES.map((f) => f.id).sort());
  assert.equal(LOAD_ORDER[0], "vipasyin", "the middle one first");
  for (const f of FIGURE_FILES) {
    need(new URL(f.file, bin));
    const a = JSON.parse(readFileSync(new URL(`anchors/${f.id}.json`, dir), "utf8")).anchors;
    for (const m of [a.maskFront.file, a.maskHair.file]) { need(new URL(`masks/${m}`, bin)); assert.ok(MASK_FILES[m], `${m} has a hash in the registry`); }
    assert.ok(f.stageH > PLINTH.h && f.stageH < 10);
  }
});

test("each file is the one registered: its SHA-256 is the table's and the asset register's", () => {
  const reg = readFileSync(new URL("../../docs/t05/asset-register.csv", import.meta.url), "utf8");
  for (const [n, h] of Object.entries(MASK_FILES)) { need(new URL(`masks/${n}`, bin)); assert.equal(sha(new URL(`masks/${n}`, bin)), h, n); }
  for (const f of FIGURE_FILES) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
    need(new URL(f.file, bin)); assert.equal(sha(new URL(f.file, bin)), f.sha256, `${f.file}'s bytes`);
    assert.ok(reg.includes(f.sha256), `${f.id} is in docs/t05/asset-register.csv with its hash`);
  }
});

test("the seven together stay (masks included) within 20.1 MB on the wire (the lead's line, 2026-11-26)", () => {
  const files = FIGURE_FILES.reduce((n, f) => n + statSync(new URL(f.file, bin)).size, 0);
  const masks = FIGURE_FILES.reduce((n, f) => n + ["front", "hair"].reduce((m, k) => m + statSync(new URL(`masks/${f.id}-${k}.webp`, bin)).size, 0), 0);
  assert.ok(files + masks <= 20.1e6, `${files} bytes and the masks ${masks}`);
});

test("with the doors shut the figures are not imported, fetched or built: site.js reaches ./figures/ only by a dynamic import behind the open doors", async () => {
  assert.equal(HALL_DOORS.shut, true, "shut in Node, and in any page not on the workbench with ?hall=open");
  const src = readFileSync(new URL("../../app/levels/t05/site.js", import.meta.url), "utf8");
  const refs = src.split("\n").filter((l) => /figures\//.test(l) && !/^\s*\/\//.test(l));
  assert.equal(refs.length, 1, refs.join("\n"));
  assert.match(refs[0], /showFigures\)\s*import\("\.\/figures\/index\.js"\)/);
  assert.ok(!/^import .*figures\//m.test(src), "no static import");
  assert.match(src, /const showFigures = !HALL_DOORS\.shut/);
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const { buildSite } = await import("../../app/levels/t05/site.js"); buildSite(M);
  assert.equal(globalThis.__t05Figures, undefined, "no figure hook, no tap sheet");
  assert.equal(NEAR, 60);
});

test("the workbench's switch is read only on the workbench: hall.js asks onBench, and a production page cannot open the doors by an address", () => {
  const src = readFileSync(new URL("../../app/levels/t05/hall.js", import.meta.url), "utf8");
  assert.match(src, /onBench\(\{ dev: !!import\.meta\.env\?\.DEV, hostname: location\.hostname \}\) && new URLSearchParams\(location\.search\)\.get\("hall"\) === "open"/);
});
