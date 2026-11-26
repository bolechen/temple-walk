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
const { planSurround, withinWalls, LIMITS, EAVE_EYES, eaveCap, TILE_TONES, ROOF_SHARE, SHED_RISE, WALL_TONES, WALL_AT_ARRIVAL, house } = await import("../../app/levels/t05/surround.js");
const { HALL_HALF, LANE, SECOND } = await import("../../app/levels/t05/axis.js");
const { HALL, HALL_DOORS } = await import("../../app/levels/t05/hall.js");
const SHUT = HALL_DOORS.shut;   // (the great hall's doors are shut in the first release: station F, inside it, cannot be judged, DECISIONS.md 先行版关殿门)
const { default: checks } = await import("../../app/levels/t05/checks.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M); site.root.updateMatrixWorld(true);
const plan = planSurround(COMPOUND), C = COMPOUND, cx = C.x + C.t / 2, cs = C.zS + C.t / 2;
const meshes = []; site.root.traverse((o) => { if (o.isMesh && o.visible) meshes.push(o); });
// (the middle town and the far layers, ./distance.js, are the town too)
const outside = (o) => !!(o.userData.surround || o.userData.distance), rad = (d) => (d * Math.PI) / 180;
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
const JUDGED = { arrival: ["east", "south", "west"], A: ["east", "west"], B: ["east", "west"], C: ["east", "south", "west"], F: SHUT ? [] : ["south"] };   // (what the issue asks for: the arrival east, south and west, A and B east and west, C and F south)
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
  assert.equal(table.length, SHUT ? 10 : 11, table.join("\n"));
});

test("the great hall's eave line is kept where the roof stands (all of cam01's picture, within 12° of the axis in cam07's), no tree is over 13 m, and the trees beside the hall (z < +15) stand no higher than 10 m", () => {
  for (const e of EAVE_EYES) {
    const eye = new THREE.Vector3(e.x, e.y, e.z), cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.1, 800);
    const yaw = e.id === "cam07" ? site.views.cam07[2] : 0, pitch = e.id === "cam07" ? site.views.cam07[3] : 0.1;
    cam.position.copy(eye); cam.rotation.set(pitch, -yaw, 0, "YXZ"); cam.updateMatrixWorld();
    const seen = [], tops = [...plan.trees.map((t) => [t.x, 0.06 + t.h, t.z, t.kind]), ...plan.houses.map((h) => [h.x, 0.06 + h.ridge, h.z, "house"])];
    for (const [x, y, z, what] of tops) {
      const p = new THREE.Vector3(x, y, z), n = p.clone().project(cam); if (Math.abs(n.x) > 1.05 || n.y < -1 || n.y > 1.05) continue;
      const az = Math.atan2(x - e.x, e.z - z); if (Math.abs(az) > rad(e.within)) continue;   // (beyond `within` of the axis the eave line is not asked of it: the art director, 2nd round)
      const d = p.clone().sub(eye), L = d.length(); ray.set(eye, d.normalize()); ray.far = L - 0.3; if (ray.intersectObjects(meshes, false).find((h) => !outside(h.object) && !/^trees-/.test(h.object.name))) continue;   // hidden behind the temple's own (not its trees: the eave line is asked of what stands behind a court tree too)
      const el = Math.atan2(y - e.y, Math.hypot(x - e.x, z - e.z)), eaveEl = Math.atan2(HALL.eave - e.y, (e.z - HALL.overhang) / Math.cos(az));
      seen.push(el - eaveEl); if (el > eaveEl) assert.fail(`${e.id}: a ${what} at (${x}, ${z}), ${y.toFixed(1)} m, stands ${(((el - eaveEl) * 180) / Math.PI).toFixed(2)}° over the eave line`);
    }
    if (e.id === "cam01") assert.ok(seen.length > 8, `${e.id}: the picture holds some of the surround (${seen.length}), so that this means something`);
  }
  for (const t of plan.trees) assert.ok(t.h <= LIMITS.treeMax && eaveCap(t.x, t.z) >= t.h - 0.02, `(${t.x}, ${t.z}) ${t.h} m is within the 13 m and the cap the eave line sets`);
  for (const t of plan.trees) if (Math.abs(t.x) > cx && t.z < LIMITS.nearHallZ && t.z > C.zN - 8) assert.ok(t.h <= LIMITS.nearHall, `a tree beside the hall at (${t.x}, ${t.z}) is ${t.h} m, over 10`);
  assert.ok(plan.trees.some((t) => t.h > 11.01), "and the rows outside the axis are free to stand taller than the eave line: some are");
});

test("the first row of houses stands 3 to 6 m off the wall's outer face; ridges 5 to 6.3 m, and 5 m or lower for the first two rows on the line to the pagoda (241°), where the trees are kept low too", () => {
  const first = plan.houses.filter((h) => h.row === 0 && (h.where === "ew" || h.where === "s"));
  assert.ok(first.length >= 15, `${first.length} houses in the first rows against the east, west and south walls`);
  for (const h of first) {
    const off = h.where === "ew" ? Math.abs(h.x) - h.w / 2 - cx : h.z - h.d / 2 - cs;
    assert.ok(off >= 2.99 && off <= 6.01, `the house at (${h.x}, ${h.z}) stands ${off.toFixed(2)} m off the wall`);
  }
  assert.ok(plan.houses.every((h) => h.eave === 3 && h.ridge >= 3.8 && h.ridge <= LIMITS.ridgeMax), "one storey, eaves at 3 m, ridges no higher than 6.3 m");
  assert.ok(plan.houses.filter((h) => h.ridge > 5.5).length >= 10, "and most of them over 5.5 m, so that the roofs show over the wall");
  const T = LIMITS.tower, near = (x, z) => { const dx = x - T.from[0], dz = z - T.from[1]; let b = (Math.atan2(dx, -dz) * 180) / Math.PI; if (b < 0) b += 360; return Math.abs(b - T.bearing) <= T.wide; };
  const onLine = plan.trees.filter((t) => near(t.x, t.z));
  assert.ok(onLine.length >= 2, `trees do stand near the line (${onLine.length}), kept low`);
  for (const t of onLine) assert.ok(t.h <= T.max, `a tree at (${t.x}, ${t.z}) on the line to the pagoda is ${t.h} m, over ${T.max}`);
  for (const h of plan.houses.filter((q) => near(q.x, q.z))) assert.ok(h.ridge <= T.max, `a roof at (${h.x}, ${h.z}) on the line is ${h.ridge} m, over 5`);
});

// A, B looking east and west (#548 named these two stations): over the wall top there are roofs, not only tree tips. Counted at each degree of bearing over the picture's
// width, a ray 1° over the wall top: where it meets a house's roof, that bearing is a roof; runs of such bearings are the roof slopes; the share of bearings that meet a house is how much
// of the wall's length has a house standing a degree or more over it. The art director (2nd round): not fewer than 4 slopes, each standing 1° or more over the wall; houses 35% to 60% of the wall's length in the picture.
test("from A and B, east and west, four or more roof slopes show a degree or more over the wall, and the houses are 35% to 65% of its length in the picture", () => {
  const roof = (o) => /roofs$/.test(o.name), house = (o) => /(roofs|walls)$/.test(o.name), table = [];
  for (const [name, dirs] of [["A", ["east", "west"]], ["B", ["east", "west"]]]) for (const dir of dirs) {
    const [, x, z, y] = PLACES[name]; let runs = 0, inRun = false, houseAt = 0, n = 0;
    for (let az = BEARING[dir] - 30; az <= BEARING[dir] + 30 + 1e-9; az += 0.25) {
      const a = rad(az), d = [Math.sin(a), -Math.cos(a)], th = wallTop([x, z], y, d), el = th + rad(1);
      ray.set(new THREE.Vector3(x, y, z), new THREE.Vector3(d[0] * Math.cos(el), Math.sin(el), d[1] * Math.cos(el))); ray.far = 4000;
      // (a winter tree's wood, trunks and bare twigs, is looked through: the grown trees' twigs are an open lace a house is seen through, which a ray that grazes one would count as solid; needles are not looked through)
      const h = ray.intersectObjects(meshes, false).find((q) => !/-trees(-[a-z]+)?-(bark|pale)(-trunks)?$/.test(q.object.name)), isRoof = !!h && roof(h.object), isHouse = !!h && house(h.object);
      n++; if (isHouse) houseAt++;
      if (isRoof && !inRun) runs++; inRun = isRoof;
    }
    table.push(`${name} ${dir}: ${runs} slopes, houses ${((houseAt / n) * 100).toFixed(0)}% of the wall`);
    if (process.env.SHOW) console.log(table.at(-1));
    assert.ok(runs >= 4, `${name} ${dir}: only ${runs} roof slopes show a degree over the wall`);
    assert.ok(houseAt / n >= 0.35 && houseAt / n <= 0.65, `${name} ${dir}: houses are ${((houseAt / n) * 100).toFixed(0)}% of the wall's length, outside 35% to 65%`);
  }
});

test("trees are broken up: neighbours on a row differ in height by 20% or more, no more than three of a kind in a row, 4 to 14 m apart (the rows behind the first houses east and west), the south side's trees in groves with 15 to 25 m of roofs between; pines, cypresses and broadleaves all stand", () => {
  const byStrip = new Map(); for (const t of plan.trees) (byStrip.get(t.strip) || byStrip.set(t.strip, []).get(t.strip)).push(t);
  assert.ok(byStrip.size >= 10, `${byStrip.size} rows of trees`);
  for (const [strip, row] of byStrip) {
    row.sort((a, b) => a.along - b.along); let run = 1;
    for (let k = 1; k < row.length; k++) {
      const a = row[k - 1], b = row[k];
      assert.ok(Math.abs(a.h - b.h) / Math.max(a.h, b.h) >= 0.2 - 1e-6, `${strip}: neighbours at ${a.along} and ${b.along} are ${a.h} and ${b.h} m high`);
      run = a.kind === b.kind ? run + 1 : 1; assert.ok(run <= 3, `${strip}: a fourth ${b.kind} in a row at ${b.along}`);
      if (/^ew.*-behind/.test(strip)) { const gap = Math.hypot(a.x - b.x, a.z - b.z); assert.ok(gap >= 3.9 && gap <= 14.5, `${strip}: neighbours ${gap.toFixed(1)} m apart`); }
    }
  }
  // The south side stands in groves (the art director, step two): two to four trees of a grove 3 to 6 m apart, and 15 to 25 m of roofs with no tree between one grove and the next.
  let groves = 0;
  for (const [strip, row] of byStrip) {
    if (!/^s.*-behind/.test(strip)) continue;
    const by = new Map(); for (const t of row) (by.get(t.clump) || by.set(t.clump, []).get(t.clump)).push(t);
    const list = [...by.values()].map((g) => g.sort((a, b) => a.along - b.along)).sort((a, b) => a[0].along - b[0].along);
    for (const g of list) { groves++; assert.ok(g.length >= 2 && g.length <= 4, `${strip}: a grove of ${g.length} at ${g[0].along}`); for (let k = 1; k < g.length; k++) assert.ok(g[k].along - g[k - 1].along >= 3.1 && g[k].along - g[k - 1].along <= 6.5, `${strip}: grove trees ${(g[k].along - g[k - 1].along).toFixed(1)} m apart`); }
    for (let k = 1; k < list.length; k++) { const gap = list[k][0].along - list[k - 1].at(-1).along; assert.ok(gap >= 14.9 && gap <= 25.1, `${strip}: ${gap.toFixed(1)} m of roofs between the groves at ${list[k - 1].at(-1).along} and ${list[k][0].along}`); }
  }
  assert.ok(groves >= 8, `${groves} groves along the south side`);
  for (const k of ["pine", "cypress", "bare"]) assert.ok(plan.trees.filter((t) => t.kind === k).length >= 12, `enough ${k}s`);
  const south = plan.trees.filter((t) => t.strip.startsWith("s") && /-behind/.test(t.strip)); assert.ok(["pine", "cypress", "bare"].every((k) => south.some((t) => t.kind === k)), "the south rows mix pines, cypresses and broadleaves");
});

test("it stands outside the walls, none of it walked on or in (left out of the bake), what stands against the walls is real geometry that casts shadows, the houses' walls are pressed down to a grey brick, and the whole is a few tens of thousands of triangles", () => {
  for (const t of plan.trees) assert.ok(!withinWalls(C, t.x, t.z, 1.2), `a tree at (${t.x}, ${t.z}) stands inside or against a wall`);
  for (const h of plan.houses) assert.ok(!withinWalls(C, h.x, h.z, 1.5 + h.w / 2, 1.5 + h.d / 2) || h.where === "ew" || h.where === "s", `a house at (${h.x}, ${h.z}) stands inside or against a wall`);
  let tris = 0, near = 0, far = 0, shadowless = 0, brick = 0;
  site.root.traverse((o) => {
    if (!o.userData.surround) return;
    assert.equal(o.userData.walk, false, `${o.name} is not in the bake`);
    const n = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; tris += n;
    if (/walls$/.test(o.name)) { brick++; assert.ok(/^surround-brick-(grey|earth|dark)$/.test(o.material.name), "the houses' walls are the brick, not the court's plaster"); }
    if (o.userData.surround === "near") { near++; assert.ok(o.castShadow, `${o.name} casts shadows`); } else { far++; if (!o.castShadow) shadowless++; }
  });
  assert.ok(brick >= 4 && brick <= 6 && near >= 3 && far >= 3 && shadowless === far, `the near meshes cast shadows (${near}), the far ones do not (${far}); ${brick} wall meshes`);
  // (the houses as before, a few thousand; the trees since they are grown, ./flora.js, under 220 000 more, merged by stretch so that only what is in view is drawn)
  let trees = 0; site.root.traverse((o) => { if (o.userData.surround && /-trees(-|$)/.test(o.name)) trees += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  assert.ok(tris - trees > 2000 && tris - trees < 45000, `${tris - trees} triangles of houses outside the walls`);
  assert.ok(trees > 50000 && trees < 220000, `${trees} triangles of trees outside the walls`);
  assert.ok(plan.houses.filter((h) => h.row === 0 && h.cast).length >= 30 && plan.trees.filter((t) => t.cast).length >= 5, "the first row of houses and the trees by the walls are the real, shadow-casting geometry");
});

test("the roofs are mostly gable, a few hipped and a few leaning, in three tones of tile in three draws: the art director's step 5 (#573, #583)", () => {
  const n = plan.houses.length, share = (f) => plan.houses.filter(f).length / n;
  assert.ok(plan.houses.every((h) => ["gable", "hip", "shed"].includes(h.roof) && [0, 1, 2].includes(h.tone)), "every house has a shape and a tone");
  assert.ok(share((h) => h.roof === "gable") >= 0.6 && share((h) => h.roof === "gable") <= 0.9, `gable roofs ${(share((h) => h.roof === "gable") * 100).toFixed(0)}%: the common one, but not the only one`);
  assert.ok(share((h) => h.roof === "hip") >= 0.05 && share((h) => h.roof === "shed") >= 0.04, "a few hipped and a few leaning");
  assert.ok(plan.houses.filter((h) => h.roof === "hip").every((h) => Math.min(h.w, h.d) >= 6) && plan.houses.filter((h) => h.roof === "shed").every((h) => h.ridge <= 5.3 && Math.min(h.w, h.d) <= 7), "hips on the broad houses, lean-tos on the narrow ones");
  for (const [i, t] of TILE_TONES.entries()) assert.ok(Math.abs(share((h) => h.tone === i) - t.share) <= 0.12, `tone ${t.name}: ${(share((h) => h.tone === i) * 100).toFixed(0)}% against ${t.share * 100}%`);
  assert.ok(TILE_TONES.reduce((a, t) => a + t.share, 0) > 0.999 && TILE_TONES.some((t) => t.mul < 1) && TILE_TONES.some((t) => t.mul > 1), "three shares make one; one tone darker than the base, one paler");
  const near = [], far = [];
  site.root.traverse((o) => { if (/roofs$/.test(o.name) && o.userData.surround) (o.userData.surround === "near" ? near : far).push(o); });
  assert.ok(near.length === 3 && far.length === 3, `a mesh of roofs to each tone, near and far: ${near.length}, ${far.length}`);
  assert.equal(new Set([...near, ...far].map((o) => o.material.name)).size, 3, "three materials, shared by the near and far roofs of a tone");
  assert.ok(ROOF_SHARE.hip > 0 && ROOF_SHARE.shed < 1);
});

// The art director's first review of #630: a hip roof's faces look out and up (snow lies on them, the sun lights them); a lean-to's high side stands on brick, not in the air, and no lean-to stands in the row at the way's end.
const normals = (g) => { const p = g.attributes.position, out = []; for (let i = 0; i < p.count; i += 3) { const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2); out.push([b.clone().sub(a).cross(c.clone().sub(a)), a.clone().add(b).add(c).divideScalar(3)]); } return out; };
test("a hip roof's faces look outward and up, not in and down", () => {
  for (const alongX of [true, false]) {
    const roofs = [], hs = { x: 10, z: 20, w: alongX ? 9 : 7, d: alongX ? 7 : 9, eave: 3, ridge: 5.2, alongX, roof: "hip" };
    house(hs, [], roofs);
    const g = roofs[0], centre = new THREE.Vector3(hs.x, 0, hs.z);
    for (const [n, at] of normals(g)) { assert.ok(n.y > 0, `a hip face with its normal ${n.toArray().map((v) => v.toFixed(1))} looks down`); const out = at.clone().sub(centre); out.y = 0; assert.ok(n.x * out.x + n.z * out.z >= -1e-6, "and the face looks toward the house, not away"); }
  }
});
test("a lean-to's high side has brick under it and the slope stays low; none stands in the row at the way's end", () => {
  assert.ok(SHED_RISE <= 1.5);
  assert.ok(!plan.houses.some((h) => h.roof === "shed" && h.where === "end"), "no lean-to in the end row");
  for (const alongX of [true, false]) for (const x of [10, 11.3, 12.7, 14.1]) {
    const roofs = [], walls = [], hs = { x, z: 20, w: alongX ? 9 : 6, d: alongX ? 6 : 9, eave: 3, ridge: 5.3, alongX, roof: "shed" };
    house(hs, walls, roofs);
    const r = new THREE.Box3().setFromBufferAttribute(roofs[0].attributes.position), wall = new THREE.Box3().setFromBufferAttribute(walls[1].attributes.position);
    assert.ok(r.max.y - r.min.y <= SHED_RISE + 0.12 + 1e-6, `the slope rises ${(r.max.y - r.min.y).toFixed(2)} m`);
    // across the slope the roof sticks out past the wall on its low side only; on the high side it stops at the wall's face
    const [lo, hi] = alongX ? ["z", "z"] : ["x", "x"], sticks = [wall.min[lo] - r.min[lo], r.max[hi] - wall.max[hi]];
    assert.ok(Math.min(...sticks) <= 1e-6 && Math.max(...sticks) > 0.3, `the roof sticks out by ${sticks.map((v) => v.toFixed(2))} on its two sides: one side none`);
    assert.ok(wall.max.y >= r.max.y - 0.12 - 1e-6, `the brick rises to ${wall.max.y.toFixed(2)} under a high edge at ${r.max.y.toFixed(2)}`);
  }
});

test("two tiers of wall, the earth-grey about a quarter; a pale-tiled house has the dark wall; a lean-to's roof is a thin plate, so its brick shows", () => {
  const share = plan.houses.filter((h) => h.wall === 1).length / plan.houses.length;
  assert.ok(share >= 0.12 && share <= 0.35, `${(share * 100).toFixed(0)}% of the houses have the earth wall`);
  const set = (h) => WALL_AT_ARRIVAL.some(([x, z]) => Math.abs(h.x - x) < 0.3 && Math.abs(h.z - z) < 0.3);
  assert.equal(WALL_AT_ARRIVAL.filter(([x, z]) => plan.houses.some((h) => set(h) && Math.abs(h.x - x) < 0.3 && Math.abs(h.z - z) < 0.3)).length, WALL_AT_ARRIVAL.length, "every house named for the arrival point is in the plan");
  assert.ok(plan.houses.every((h) => set(h) || (h.tone === 2) === (h.wall === 2)), "the pale tile has the dark wall, and nothing else has, but at the arrival point");
  assert.ok(plan.houses.filter((h) => h.where === "end" && h.wall === 1).length >= 1 && plan.houses.filter((h) => h.where === "end" && h.wall === 1 && h.tone !== 2).length === plan.houses.filter((h) => h.where === "end" && h.wall === 1).length, "the arrival sees the earth wall, never under the pale tile");
  assert.equal(WALL_TONES.length, 3);
  const [g, e, k] = WALL_TONES.map((t) => t.mul); assert.ok(e[0] > g[0] && e[0] - e[2] > 0.05 && g[2] > g[0], "the earth is lighter and warmer (red over blue), the grey cooler");
  assert.ok(k[1] < g[1], "the dark wall is darker than the grey");
  const roofs = [], walls = [], hs = { x: 10, z: 20, w: 9, d: 6, eave: 3, ridge: 5.3, alongX: true, roof: "shed" };
  house(hs, walls, roofs);
  const p = roofs[0].attributes.position; const bb = new THREE.Box3().setFromBufferAttribute(p);
  const edge = (zEdge) => { let lo = 1e9, hi = -1e9; for (let i = 0; i < p.count; i++) if (Math.abs(p.getZ(i) - zEdge) < 1e-6) { lo = Math.min(lo, p.getY(i)); hi = Math.max(hi, p.getY(i)); } return [lo, hi]; };
  const highEdge = edge(edge(bb.max.z)[1] > edge(bb.min.z)[1] ? bb.max.z : bb.min.z);
  assert.ok(highEdge[1] - highEdge[0] <= 0.13, `the plate is ${(highEdge[1] - highEdge[0]).toFixed(2)} m thick at its high edge, not a solid wedge`);
});

// The art director's #637 note, followed up in step 7 (#573): a gable roof's end was a vertical triangle of tile, where snow cannot lie, so in winter it stood dark in a white town.
// Now the roof is a thin plate over the two slopes and the gable end is brick, in the house's own wall tier.
test("a gable house has no vertical triangle of tile; its two gable ends are brick under the plate", () => {
  const fattest = (g) => { const p = g.attributes.position; let worst = 0; for (let i = 0; i < p.count; i += 3) {   // of the faces that stand upright (no snow can lie on them), the one with the greatest breadth: a sliver is the plate's edge, a broad one is a gable
    const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2);
    const n = b.clone().sub(a).cross(c.clone().sub(a)); const len = n.length(); if (Math.abs(n.y / len) >= 0.1) continue;
    worst = Math.max(worst, len / Math.max(a.distanceTo(b), b.distanceTo(c), c.distanceTo(a))); } return worst; };   // (the shortest altitude is twice the area over the longest edge; the cross product's length is twice the area)
  const gables = plan.houses.filter((h) => h.roof === "gable"); assert.ok(gables.length >= 40, `${gables.length} gable houses in the plan`);
  for (const h of gables) {
    const roofs = [], walls = []; house(h, walls, roofs);
    assert.equal(roofs.length, 1); assert.equal(walls.length, 2, "the wall box and the gable brick");
    assert.ok(fattest(roofs[0]) <= 0.12 + 1e-6, `the tile's upright faces are the plate's edge, a sliver at most ${fattest(roofs[0]).toFixed(2)} m broad, not a triangle (house at ${h.x}, ${h.z})`);
    const r = new THREE.Box3().setFromBufferAttribute(roofs[0].attributes.position), b = new THREE.Box3().setFromBufferAttribute(walls[1].attributes.position);
    assert.ok(Math.abs(b.max.y - (r.max.y - 0.12)) <= 0.02, "the brick rises to the plate's underside at the ridge");
    assert.ok(b.min.y >= r.min.y + 0.12 - 1e-6 && b.min.y <= r.min.y + 0.2, "and stands on the eave line");
    const [lo, hi] = h.alongX ? ["z", "z"] : ["x", "x"], [len0, len1] = h.alongX ? ["x", "x"] : ["z", "z"];
    assert.ok(r.min[lo] <= b.min[lo] && r.max[hi] >= b.max[hi], "the plate covers the gable across the roof");
    assert.ok(r.min[len0] < b.min[len0] - 0.3 && r.max[len1] > b.max[len1] + 0.3, "and its verge sticks out past the gable end");
  }
});
