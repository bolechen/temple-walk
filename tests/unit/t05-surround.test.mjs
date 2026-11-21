// What stands outside the walls of T05 (#548, step one; app/levels/t05/surround.js): the art director chose "the county town's low houses and trees"
// (her comment 7068262688), so that above every wall top there is something, and set the limits this test holds (her section four):
//   - above the wall tops, between 0.5° and 3° above them, the share of what is outside is 40% to 80%: not an empty sky, not a solid hedge (judgment 12);
//   - in cam01's and cam07's pictures nothing outside rises over the great hall's eave line; on the stretch beside the hall (z < +15) the trees stand no higher than 10 m;
//   - the first two rows of roofs have their ridges at 5 m or lower, and on the line from the platform to the old town's pagoda (bearing 241°) nothing is tall;
//   - the row against the wall is real geometry that casts shadows into the sun's map (the base light is low and long);
//   - none of it is walked on or in: it stands outside the walls and is left out of the bake (walk-diff 0).
// How the share is counted: from each place of checks.js `horizon.places`, over a window of 30° either side of east, south or west, at every degree of bearing and
// every quarter degree from 0.5° to 3° above where the nearest wall's top is seen (above the horizon, if the eye is higher than the wall), a ray is cast. Of the rays
// that are not stopped by the temple's own buildings (the gates, the Wuliang hall, the great hall: only the rays that clear the wall and the buildings say what lies
// beyond), the share that meets something outside is the number. A place and direction with fewer than a quarter of its rays free is not judged (the hall
// stands in the way: A looking south, F looking east or west); the places that must be judged are listed below, so that a hall that grew could not take them all away.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildSite, createWalker, COMPOUND } = await import("../../app/levels/t05/site.js");
const { planSurround, withinWalls, LIMITS, EAVE_EYES, eaveCap } = await import("../../app/levels/t05/surround.js");
const { HALL_HALF, LANE, SECOND } = await import("../../app/levels/t05/axis.js");
const { HALL } = await import("../../app/levels/t05/hall.js");
const { default: checks } = await import("../../app/levels/t05/checks.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M); site.root.updateMatrixWorld(true);
const plan = planSurround(COMPOUND), C = COMPOUND, cx = C.x + C.t / 2, cs = C.zS + C.t / 2;
const meshes = []; site.root.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
const outside = (o) => !!o.userData.surround, rad = (d) => (d * Math.PI) / 180;
const ray = new THREE.Raycaster();

// The walls a visitor sees the top of, as plan segments with the top's height over the court's paving: the court's, the terrace's, the way's.
const WALLS = [
  [[-C.x, C.zN], [-C.x, C.zS], 3.2], [[C.x, C.zN], [C.x, C.zS], 3.2], [[-C.x, C.zS], [-HALL_HALF, C.zS], 3.2], [[HALL_HALF, C.zS], [C.x, C.zS], 3.2],
  [[-SECOND.hw, SECOND.zN], [-SECOND.hw, 140], SECOND.y + SECOND.wallH], [[SECOND.hw, SECOND.zN], [SECOND.hw, 140], SECOND.y + SECOND.wallH],
  [[-LANE.hw, 144], [-LANE.hw, 205], 0.5 + LANE.h], [[LANE.hw, 144], [LANE.hw, 205], 0.5 + LANE.h], [[-LANE.hw, 211], [-LANE.hw, 221], 1.7], [[LANE.hw, 211], [LANE.hw, 221], 1.7],
];
function wallTop(o, y, d) {   // the angle above the horizon at which the nearest wall's top is seen along the bearing d, or 0 where there is none or it lies under the eye
  let best = Infinity, top = 0;
  for (const [[x1, z1], [x2, z2], h] of WALLS) {
    const ex = x2 - x1, ez = z2 - z1, den = d[0] * ez - d[1] * ex; if (Math.abs(den) < 1e-9) continue;
    const t = ((x1 - o[0]) * ez - (z1 - o[1]) * ex) / den, u = ((x1 - o[0]) * d[1] - (z1 - o[1]) * d[0]) / den;
    if (t > 0 && u >= 0 && u <= 1 && t < best) { best = t; top = h; }
  }
  return best < Infinity ? Math.max(0, Math.atan2(top - y, best)) : 0;
}
function share(place, bearing, span = 30) {
  const [, x, z, y] = place; let out = 0, sky = 0, own = 0;
  for (let az = bearing - span; az <= bearing + span + 1e-9; az += 1) {
    const a = rad(az), d = [Math.sin(a), -Math.cos(a)], th = wallTop([x, z], y, d);
    for (let e = 0.5; e <= 3 + 1e-9; e += 0.25) {
      const el = th + rad(e); ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(d[0] * Math.cos(el), Math.sin(el), d[1] * Math.cos(el))); ray.far = 4000;
      const h = ray.intersectObjects(meshes, false)[0];
      if (!h) sky++; else if (outside(h.object)) out++; else own++;
    }
  }
  const n = out + sky + own; return { out, sky, own, free: (out + sky) / n, fill: out / Math.max(1, out + sky) };
}
const PLACES = Object.fromEntries(checks.horizon.places.map((p) => [p[0].replace(/^station /, ""), p]));   // (the table is the level's own, from PLAN.md item 11: the arrival, the axis's three passages and the six stations, each 1.6 m over its floor)
const JUDGED = { arrival: ["east", "south", "west"], A: ["east", "west"], B: ["east", "west"], C: ["east", "south", "west"], F: ["south"] };   // (what the issue asks for: the arrival east, south and west, A and B east and west, C and F south)
const BEARING = { east: 90, south: 180, west: 270 };

test("over the wall tops, 0.5° to 3° up, 40% to 80% of what is not the temple's own is the town's: from the arrival east, south and west, A and B east and west, C and F south", () => {
  const table = [];
  for (const [name, dirs] of Object.entries(JUDGED)) for (const dir of dirs) {
    const s = share(PLACES[name], BEARING[dir]);
    table.push(`${name} ${dir}: ${(s.fill * 100).toFixed(0)}% (outside ${s.out}, sky ${s.sky}, the temple's own ${s.own})`);
    if (process.env.SHOW) console.log(table.at(-1));
    assert.ok(s.free >= 0.25, `${name} ${dir}: only ${(s.free * 100).toFixed(0)}% of the rays are free of the temple's own buildings, so it cannot be judged: it must be one that can`);
    assert.ok(s.fill >= 0.4, `${name} ${dir}: ${(s.fill * 100).toFixed(0)}% of the band over the wall is the town's, under the 40% the art director set`);
    assert.ok(s.fill <= 0.8, `${name} ${dir}: ${(s.fill * 100).toFixed(0)}% is the town's, over the 80% (a hedge, not a band of trees)`);
  }
  assert.equal(table.length, 11, table.join("\n"));
});

test("nothing outside rises over the great hall's eave line in cam01's or cam07's picture, and the trees beside the hall (z < +15) stand no higher than 10 m", () => {
  for (const e of EAVE_EYES) {
    const eye = new THREE.Vector3(e.x, e.y, e.z), cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 800);
    const yaw = e.id === "cam07" ? site.views.cam07[2] : 0, pitch = e.id === "cam07" ? site.views.cam07[3] : 0.1;
    cam.position.copy(eye); cam.rotation.set(pitch, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
    const seen = [], tops = [...plan.trees.map((t) => [t.x, 0.06 + t.h, t.z, t.kind]), ...plan.houses.map((h) => [h.x, 0.06 + h.ridge, h.z, "house"])];
    for (const [x, y, z, what] of tops) {
      const p = new THREE.Vector3(x, y, z), n = p.clone().project(cam); if (Math.abs(n.x) > 1.05 || n.y < -1 || n.y > 1.05) continue;
      const d = p.clone().sub(eye), L = d.length(); ray.set(eye, d.normalize()); ray.far = L - 0.3; if (ray.intersectObjects(meshes, false).find((h) => !outside(h.object))) continue;   // hidden behind the temple's own
      const az = Math.atan2(x - e.x, e.z - z), el = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z)), eaveEl = Math.atan2(HALL.eave - e.y, (e.z - HALL.overhang) / Math.cos(az));
      seen.push(el - eaveEl); if (el > eaveEl) assert.fail(`${e.id}: a ${what} at (${x}, ${z}), ${y.toFixed(1)} m, stands ${(rad(1) ? ((el - eaveEl) * 180) / Math.PI : 0).toFixed(2)}° over the eave line`);
    }
    assert.ok(seen.length > 20, `${e.id}: the picture holds some of the surround (${seen.length}), so that this means something`);
  }
  for (const t of plan.trees) if (Math.abs(t.x) > cx && t.z < LIMITS.nearHallZ && t.z > C.zN - 8) assert.ok(t.h <= LIMITS.nearHall, `a tree beside the hall at (${t.x}, ${t.z}) is ${t.h} m, over 10`);
  for (const t of plan.trees) assert.ok(t.h <= HALL.eave - 0.8 && eaveCap(t.x, t.z) >= t.h - 0.02, `(${t.x}, ${t.z}) ${t.h} m is within the cap the eave line sets`);
});

test("the first two rows of roofs are 5 m or lower at the ridge, and the line from the platform to the old town's pagoda (241°) is kept low", () => {
  assert.ok(plan.houses.length > 20 && plan.houses.every((h) => h.ridge <= LIMITS.firstRows && h.eave === 3 && h.row <= 1), "every house stands in the first two rows, one storey, a ridge at 5 m or lower");
  assert.ok(plan.houses.every((h) => h.ridge >= 3.2), "and is a house, not a hut");
  const T = LIMITS.tower, near = (x, z) => { const dx = x - T.from[0], dz = z - T.from[1]; let b = (Math.atan2(dx, -dz) * 180) / Math.PI; if (b < 0) b += 360; return Math.abs(b - T.bearing) <= T.wide; };
  const onLine = plan.trees.filter((t) => near(t.x, t.z));
  assert.ok(onLine.length >= 3, `trees do stand near the line (${onLine.length}), kept low`);
  for (const t of onLine) assert.ok(t.h <= T.max, `a tree at (${t.x}, ${t.z}) on the line to the pagoda is ${t.h} m, over ${T.max}`);
  for (const h of plan.houses.filter((q) => near(q.x, q.z))) assert.ok(h.ridge <= T.max, "a roof on the line is 5 m or lower");
});

test("it stands outside the walls, none of it walked on or in (left out of the bake), the row against the wall is real geometry that casts shadows, and the whole is a few tens of thousands of triangles", () => {
  for (const t of plan.trees) assert.ok(!withinWalls(C, t.x, t.z, 1.2), `a tree at (${t.x}, ${t.z}) stands inside or against a wall`);
  for (const h of plan.houses) assert.ok(!withinWalls(C, h.x, h.z, 1.5 + h.w / 2, 1.5 + h.d / 2), `a house at (${h.x}, ${h.z}) stands inside or against a wall`);
  let tris = 0, near = 0, far = 0, shadowless = 0;
  site.root.traverse((o) => {
    if (!o.userData.surround) return;
    assert.equal(o.userData.walk, false, `${o.name} is not in the bake`);
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; tris += n;
    if (o.userData.surround === "near") { near++; assert.ok(o.castShadow, `${o.name} casts shadows`); } else { far++; if (!o.castShadow) shadowless++; }
  });
  assert.ok(near >= 3 && far >= 3 && shadowless === far, `the near row's meshes cast shadows (${near}), the far ones do not (${far})`);
  assert.ok(tris > 5000 && tris < 45000, `${tris} triangles outside the walls`);
  assert.ok(plan.trees.filter((t) => t.row === 0).length >= 40 && plan.trees.some((t) => t.kind === "pine") && plan.trees.some((t) => t.kind === "bare"), "pines and bare broadleaves, the row against the walls the longer");
});
