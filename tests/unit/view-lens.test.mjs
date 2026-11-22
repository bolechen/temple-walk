// A named view may carry a lens of its own (`site.lens[name] = { first, third }`, app/yard.js `baseFov`, tools/cameras.mjs; docs/t05/PRD.md §3: cam06 at 65°).
// The prologue has no such table, so its fixed views stay at 52° from his eyes and 44° from behind him. The page's own reading of the table is held by the `t05` e2e scenario.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import fs from "node:fs";
const { LENS, buildSite } = await import("../../app/levels/t05/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const read = (f) => JSON.parse(fs.readFileSync(new URL(`../../docs/${f}/camera-manifest.json`, import.meta.url), "utf8"));

test("T05 gives cam06 a lens of 65° from his eyes and 50° from behind him, and no other view one", () => {
  assert.deepEqual(LENS, { cam06: { first: 65, third: 50 } });
  const site = buildSite(M); assert.equal(site.lens, LENS, "the plan carries the table the page reads");
  for (const k of Object.keys(site.lens)) assert.ok(k in site.views, `${k} is a view of the plan`);
});

test("the manifests say the lens each view is seen through: T05's cam06 at 65°, its other views 52° (cam03's still, taken from behind him, 44°), the prologue's all 52° and 44°", () => {
  const t5 = read("t05"), by = Object.fromEntries(t5.cameras.map((c) => [c.view, c]));
  assert.equal(by.cam06.fov_degrees, 65);
  for (const k of ["cam01", "cam02", "cam04", "cam05", "cam07"]) assert.equal(by[k].fov_degrees, 52, `${k} keeps the fixed views' angle`);
  assert.equal(by.cam03.fov_degrees, 44, "cam03's still is from behind him");
  for (const c of read("t00").cameras) assert.ok([44, 52].includes(c.fov_degrees), `${c.id} of the prologue keeps the fixed views' angle (${c.fov_degrees})`);
});
