// The seven painted figures of the great hall (#701, the second version): the table the page loads them from agrees with the altar and with the asset
// register, the files are the ones registered, and while the hall's doors are shut nothing of them is imported, fetched or drawn.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { readFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import * as THREE from "three";
const { FIGURE_FILES, MASK_FILES, LOAD_ORDER, NEAR, PLINTH, SOURCE } = await import("../../app/levels/t05/figures/registry.js");
const { FIGURES } = await import("../../app/levels/t05/altar.js");
const { HALL_DOORS } = await import("../../app/levels/t05/hall.js");
const dir = new URL("../../app/levels/t05/figures/", import.meta.url);   // anchors; the files and masks are not in git: app/shared/models/t05/, fetched by tools/setup.mjs
const bin = new URL("../../app/shared/models/t05/", import.meta.url);
const published = SOURCE.base !== null || existsSync(bin), skip = published ? false : "the seven are not published yet (registry.js SOURCE): nothing fetches them";
const need = (u) => assert.ok(existsSync(u), `${u.pathname.replace(/.*temple-walk\//, "")} is missing: run pnpm install (tools/setup.mjs fetches it, checked by SHA-256)`);
const sha = (u) => createHash("sha256").update(readFileSync(u)).digest("hex");

test("the table has the seven, in the altar's order, each with a file, its anchors and its two masks", { skip }, () => {
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

test("each file is the one registered: its SHA-256 is the table's and the asset register's", { skip }, () => {
  const reg = readFileSync(new URL("../../docs/t05/asset-register.csv", import.meta.url), "utf8");
  for (const [n, h] of Object.entries(MASK_FILES)) { need(new URL(`masks/${n}`, bin)); assert.equal(sha(new URL(`masks/${n}`, bin)), h, n); }
  for (const f of FIGURE_FILES) {
    assert.match(f.sha256, /^[0-9a-f]{64}$/);
    need(new URL(f.file, bin)); assert.equal(sha(new URL(f.file, bin)), f.sha256, `${f.file}'s bytes`);
    assert.ok(reg.includes(f.sha256), `${f.id} is in docs/t05/asset-register.csv with its hash`);
  }
});

test("the seven together stay (masks included) within 20.1 MB on the wire (the lead's line, 2026-11-26)", { skip }, () => {
  const files = FIGURE_FILES.reduce((n, f) => n + statSync(new URL(f.file, bin)).size, 0);
  const masks = FIGURE_FILES.reduce((n, f) => n + ["front", "hair"].reduce((m, k) => m + statSync(new URL(`masks/${f.id}-${k}.webp`, bin)).size, 0), 0);
  assert.ok(files + masks <= 20.1e6, `${files} bytes and the masks ${masks}`);
});

test("the figures are reached only by a dynamic import behind the open doors, and only in a page the bundler made: Node builds the hall without importing, fetching or building them", async () => {
  // The doors were opened on 2026-11-26 (docs/t05/DECISIONS.md, 开殿门); `shut: true` in hall.js brings the first release back, and with it no figure at all.
  const src = readFileSync(new URL("../../app/levels/t05/site.js", import.meta.url), "utf8");
  const refs = src.split("\n").filter((l) => /figures\//.test(l) && !/^\s*\/\//.test(l));
  assert.equal(refs.length, 1, refs.join("\n"));
  assert.match(refs[0], /showFigures && import\.meta\.env\)\s*import\("\.\/figures\/index\.js"\)/);
  assert.ok(!/^import .*figures\//m.test(src), "no static import");
  assert.match(src, /const showFigures = !HALL_DOORS\.shut/);
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const { buildSite } = await import("../../app/levels/t05/site.js"); buildSite(M);
  assert.equal(globalThis.__t05Figures, undefined, "no figure hook in Node");
  assert.equal(NEAR, 60);
});

test("the doors are one constant, open, and nothing an address says shuts or opens them", () => {
  const src = readFileSync(new URL("../../app/levels/t05/hall.js", import.meta.url), "utf8");
  assert.match(src, /export const HALL_DOORS = Object\.freeze\(\{ shut: false, gap: 0 \}\)/);
  assert.equal(HALL_DOORS.shut, false);
  assert.ok(!/location\.search/.test(src), "hall.js reads no address");
});

test("with the doors shut the altar's merged geometry is byte for byte what it was before the figures (main's altar.js, 2026-11-26): stone, clay and halo", async () => {
  const { buildAltar } = await import("../../app/levels/t05/altar.js"), { merge } = await import("../../app/src/geo.js");
  const h = (geos) => { const g = merge(geos), x = createHash("sha256"); for (const k of Object.keys(g.attributes).sort()) x.update(k).update(Buffer.from(g.attributes[k].array.buffer, g.attributes[k].array.byteOffset, g.attributes[k].array.byteLength)); if (g.index) x.update(Buffer.from(g.index.array.buffer, g.index.array.byteOffset, g.index.array.byteLength)); return x.digest("hex").slice(0, 16) + ":" + g.attributes.position.count; };
  const a = buildAltar();
  // recorded by running this same function over `git show origin/main:app/levels/t05/altar.js` (04ec3930's successor, before #763): the same three values
  assert.deepEqual({ stone: h(a.parts.stone), clay: h(a.parts.clay), halo: h(a.parts.halo) }, { stone: "7fae4025ccf3d207:144", clay: "d3443d268f744394:15480", halo: "cfeb2e85f6eee9d4:4032" });
});

test("a figure that arrives hides the white box's seated mass and its two attendant columns, and keeps the halo; one that does not arrive hides nothing (the art director, 2026-11-26)", async () => {
  const { buildAltar, benchFigures } = await import("../../app/levels/t05/altar.js");
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const fg = benchFigures(M, buildAltar(), {});
  for (const e of fg.list) { assert.deepEqual(e.parts.map((m) => m.name), [`altar-${e.id}-clay`, `altar-${e.id}-attend`, `altar-${e.id}-halo`]); assert.ok(e.parts.every((m) => m.visible), "all three stand until the figure arrives"); }
  const src = readFileSync(new URL("../../app/levels/t05/figures/load.js", import.meta.url), "utf8");
  assert.match(src, /const \[body, attend, halo\] = e\.parts; body\.visible = false; attend\.visible = false;/);
  // that line is reached only after the figure loaded and was painted: it follows the loader's await and sits in the try whose catch leaves the boxes as they are
  assert.ok(src.indexOf("attend.visible = false") > src.indexOf("await Promise.all") && src.indexOf("attend.visible = false") < src.indexOf("catch (err)"));
  assert.ok(!/halo\.visible\s*=\s*false/.test(src), "the halo stays");
});

test("the seven sit on one course of stone as long as the altar, every lotus wholly on it and it wholly on the altar: no lotus hangs over the altar's edge, and no slot stands open between two slabs (the black band and stub under the seats on the T4 of 2026-11-26)", { skip }, async () => {
  const { tierMesh, TIER } = await import("../../app/levels/t05/figures/plinth.js"), { PIVOT_DZ } = await import("../../app/levels/t05/figures/registry.js");
  const { ALTAR, SEAT } = await import("../../app/levels/t05/altar.js"), { loadFigure } = await import("../../tools/t05-paint-eval.mjs");
  const stone = new THREE.MeshBasicMaterial(), top = 3.87, m = tierMesh(stone, top), g = m.geometry, ao = g.attributes.ao;
  // the hall's stone reads the light a surface takes from a number in every corner: a box without it is black wherever no lamp reaches
  assert.ok(ao, "the course has an `ao` attribute"); assert.equal(ao.count, g.attributes.position.count); assert.ok([...ao.array].every((v) => v === 1), "open to the hall on every side");
  assert.equal(m.material, stone); assert.ok(m.castShadow && m.receiveShadow); assert.equal(m.userData.keep, true); assert.equal(m.userData.bake, false);
  g.computeBoundingBox(); const b = new THREE.Box3().copy(g.boundingBox).applyMatrix4(m.matrixWorld.identity().compose(m.position, m.quaternion, m.scale));
  assert.ok(Math.abs(b.min.y - top) < 1e-5 && Math.abs(b.max.y - (top + PLINTH.h)) < 1e-5, "it stands on the altar's top and is as high as the slab the figures were made for");
  // on the altar: inside its cap (0.15 m out from the altar all round) on every side
  const cap = { x: ALTAR.w / 2 + 0.15, zF: ALTAR.zF + 0.15, zB: ALTAR.zB - 0.15 };
  assert.ok(b.max.x <= cap.x + 1e-5 && b.min.x >= -cap.x - 1e-5 && b.max.z <= cap.zF + 1e-5 && b.min.z >= cap.zB - 1e-5, "the course keeps within the altar's cap");
  assert.equal(TIER.h, PLINTH.h);
  // every lotus: the lowest 0.3 m of the file, as load.js stands it (scaled to the game's height, turned, its middle at the figure's place)
  for (const d of FIGURE_FILES) {
    const f = FIGURES.find((x) => x.id === d.id), fig = await loadFigure(d.id), p = fig.pos, s = (f.h - PLINTH.h) / (d.stageH - PLINTH.h), c = Math.cos(f.yaw ?? 0), sn = Math.sin(f.yaw ?? 0);
    let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (let i = 0; i < p.length; i += 3) if (p[i + 1] < 0.3) { const x = f.x + (p[i] * c + p[i + 2] * sn) * s, z = SEAT.z + PIVOT_DZ + (-p[i] * sn + p[i + 2] * c) * s; x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
    assert.ok(x1 - x0 > 4 && z1 - z0 > 4, `${d.id}: the lotus's foot was found`);
    assert.ok(x0 >= b.min.x - 0.005 && x1 <= b.max.x + 0.005 && z0 >= b.min.z - 0.005 && z1 <= b.max.z + 0.005, `${d.id}'s lotus reaches off the course: x ${x0.toFixed(2)}..${x1.toFixed(2)}, z ${z0.toFixed(2)}..${z1.toFixed(2)} against x ±${b.max.x.toFixed(2)}, z ${b.min.z.toFixed(2)}..${b.max.z.toFixed(2)}`);
  }
  // and the loader lays that one course, once, drawing nothing of its own with the hall's materials
  const src = readFileSync(new URL("../../app/levels/t05/figures/load.js", import.meta.url), "utf8");
  assert.match(src, /if \(!tier\) root\.add\(\(tier = tierMesh\(M\.stone, top\)\)\)/); assert.ok(!/new THREE\.Mesh\([^;]*\bM\.\w/.test(src), "no bare mesh on one of the hall's materials");
});
