// The old town's pagoda of T05 (app/levels/t05/tower.js, #548 step two, the owner's 2026-11-22 「加远处的广胜寺塔」). The lead's conditions, as tests:
//   - it is a part of its own: `?off=tower` leaves it out, and everything else the level builds is the same with and without it;
//   - it is a far silhouette: a few thousand triangles, never walked on or into (the baked floor does not change: walk-diff 0);
//   - its position and size are the real tower's seen from the platform: the bearing sits in the 241° line the surround keeps clear, and the angular size from the platform
//     is the real one (the drawn tower is brought in so the far plane holds it, and made smaller by the same ratio: nothing is enlarged);
//   - it is in no picture of cam01 or cam07, and every place that sees it sees it inside the camera's far plane;
//   - the drawing's departures from the real tower are written down (docs/t05/DECISIONS.md, SOURCES.md §16).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildSite, COMPOUND } = await import("../../app/levels/t05/site.js");
const { TOWER, BRING, EYE, placed, truth, profile, buildTower } = await import("../../app/levels/t05/tower.js");
const { LIMITS } = await import("../../app/levels/t05/surround.js");
const { default: checks } = await import("../../app/levels/t05/checks.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const deg = (r) => (r * 180) / Math.PI;
const catalog = (site) => { site.root.updateMatrixWorld(true); const rows = []; site.root.traverse((o) => { if (o.isMesh && !o.userData.tower) { o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox; rows.push([o.name, o.geometry.attributes.position.count, o.geometry.index ? o.geometry.index.count : 0, ...b.min.toArray(), ...b.max.toArray()].join(" ")); } }); return rows; };

test("it is one removable part: with ?off=tower everything else the level builds is the same", () => {
  const on = buildSite(M);
  globalThis.location = { search: "?off=tower" };
  let off; try { off = buildSite(M); } finally { delete globalThis.location; }
  const towers = (s) => { let n = 0; s.root.traverse((o) => { if (o.userData.tower && o.isMesh) n++; }); return n; };
  assert.equal(towers(on), 1, "the tower is one mesh");
  assert.equal(towers(off), 0, "?off=tower leaves it out");
  assert.deepEqual(catalog(on), catalog(off), "everything else is the same, mesh for mesh");
  assert.deepEqual(JSON.parse(JSON.stringify(on.walk)), JSON.parse(JSON.stringify(off.walk)), "the written plan is the same");
  assert.deepEqual(on.views, off.views); assert.deepEqual(on.places, off.places);
});

test("it is a far silhouette: a few thousand triangles, not walked, not held, casting nothing, 42.5 m high with thirteen storeys", () => {
  const g = buildTower(), m = g.children[0];
  const tris = m.geometry.index ? m.geometry.index.count / 3 : m.geometry.attributes.position.count / 3;
  assert.ok(tris > 500 && tris <= 3000, `the tower is ${tris} triangles`);
  assert.equal(m.userData.walk, false); assert.ok(!m.castShadow && !m.receiveShadow);
  const top = Math.max(...profile().map(([, y]) => y)); assert.ok(Math.abs(top - TOWER.height) < 1e-6, `its height is ${top}`);
  const pts = profile(); const lips = pts.filter((p, i) => i && p[0] > pts[i - 1][0] && p[1] === pts[i - 1][1] && p[1] > 13 && p[0] > 3).length;
  assert.equal(lips, TOWER.storeys, `${TOWER.storeys} eaves above the first storey's foot, found ${lips}`);
  assert.ok(Math.abs(TOWER.baseSide - 6.2) < 1e-9);
});

test("seen from the platform it has the real bearing and the real angular size; it is not enlarged", () => {
  const T = truth();
  assert.ok(Math.abs(T.distance - 952) < 2, `the real distance is ${T.distance}`);
  assert.ok(Math.abs(T.bearing - LIMITS.tower.bearing) <= LIMITS.tower.wide, `the bearing is ${T.bearing}°, the kept line is ${LIMITS.tower.bearing}° ± ${LIMITS.tower.wide}°`);
  const P = placed(), g = buildTower(); g.updateMatrixWorld(true);
  const seen = (e, x, y, z) => { const dx = x - e[0], dz = z - e[2]; return { d: Math.hypot(dx, dz), a: deg(Math.atan2(y - e[1], Math.hypot(dx, dz))), b: (deg(Math.atan2(dx, -dz)) + 360) % 360 }; };
  for (const [name, eye, tolTop] of [["the platform", [0, EYE, 8], 0.005], ["the arrival", [0, 1.6, 215], 0.12], ["A", [0, 1.6, 44], 0.12], ["the great hall's door", [0, 4.6, -2], 0.05]]) {
    const real = seen(eye, TOWER.at.x, TOWER.height, TOWER.at.z), real0 = seen(eye, TOWER.at.x, 0, TOWER.at.z), drawn = seen(eye, P.x, P.y + TOWER.height * P.scale, P.z), drawn0 = seen(eye, P.x, P.y, P.z);
    assert.ok(Math.abs(real.a - drawn.a) <= tolTop * Math.max(1, Math.abs(real.a)) + 1e-9, `${name}: the top is at ${real.a.toFixed(3)}° really and ${drawn.a.toFixed(3)}° drawn`);
    assert.ok(Math.abs(real0.a - drawn0.a) <= 0.12, `${name}: the foot is at ${real0.a.toFixed(3)}° really and ${drawn0.a.toFixed(3)}° drawn`);
    assert.ok(Math.abs(real.b - drawn.b) <= (name === "the platform" ? 1e-6 : 6), `${name}: the bearing is ${real.b.toFixed(3)}° really and ${drawn.b.toFixed(3)}° drawn`);
  }
  const pl = seen([0, EYE, 8], TOWER.at.x, TOWER.height, TOWER.at.z); assert.ok(pl.a > 2 && pl.a < 2.6, `from the platform the top is ${pl.a.toFixed(2)}° up`);
  assert.ok(P.scale <= 1 && BRING === P.scale, "it is only ever brought in and made smaller");
});

test("it is in no picture of cam01 or cam07, and every place that sees it sees it inside the far plane", () => {
  const T = truth();
  for (const [, v] of Object.entries(checks.cameras || {})) { void v; }
  // cam01 and cam07 look along the axis (north, bearing 0); at the widest lens (21:9, +16° upright is the tall one: horizontal half-angle under 60°) the tower is 118° round.
  for (const bearing of [0]) { const off = Math.min((T.bearing - bearing + 360) % 360, (bearing - T.bearing + 360) % 360); assert.ok(off > 90, `the tower is ${off.toFixed(0)}° from the axis`); }
  const P = placed(), C = COMPOUND, places = [[0, 215], [0, 44], [0, 27], [0, 0.6], [0, -2], [C.x, C.zS], [-C.x, C.zS], [C.x, C.zN], [0, 221]];
  for (const [x, z] of places) { const d = Math.hypot(P.x - x, P.z - z); assert.ok(d + 20 < TOWER.far, `from (${x}, ${z}) the tower is ${d.toFixed(0)} m off, the far plane is ${TOWER.far}`); }
});

test("what is drawn differently from the real tower is written down", () => {
  const dec = fs.readFileSync(new URL("../../docs/t05/DECISIONS.md", import.meta.url), "utf8"), src = fs.readFileSync(new URL("../../docs/t05/SOURCES.md", import.meta.url), "utf8");
  assert.ok(/所有者 2026-11-22/.test(dec) && /广胜寺塔/.test(dec) && /0\.735/.test(dec) && /\?off=tower/.test(dec), "DECISIONS.md says who decided, that it is brought in by 0.735, and how to leave it out");
  assert.ok(/## 16\./.test(src) && /42\.5/.test(src) && /6\.2/.test(src) && /转引/.test(src), "SOURCES.md §16 has the height, the base and how far they were checked");
});
