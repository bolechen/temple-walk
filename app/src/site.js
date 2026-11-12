// The temple as a plan: which buildings stand where, the walls between the courts,
// and from those, where a visitor can walk. 1 unit = 1 m. North is -z; you enter from the south.
import * as THREE from "../v/build/three.module.js";
import { box, merge, mesh } from "./geo.js";
import { buildHall } from "./building.js";

export const SITE = { x: 17, zN: -52, zS: 40, apron: 54, wallH: 3.0 };

// Turn a local point / rect by a quarter-turn count and move it to its place.
const turn = (x, z, q) => (q === 0 ? [x, z] : q === 1 ? [z, -x] : q === 2 ? [-x, -z] : [-z, x]);
function place(r, at, q) {
  const [ax, az] = turn(r.x0, r.z0, q), [bx, bz] = turn(r.x1, r.z1, q);
  const out = { ...r, x0: Math.min(ax, bx) + at[0], x1: Math.max(ax, bx) + at[0], z0: Math.min(az, bz) + at[1], z1: Math.max(az, bz) + at[1] };
  for (const k of ["low", "high"]) if (r[k]) { const [x, z] = turn(r[k][0], r[k][1], q); out[k] = [x + at[0], z + at[1]]; }
  return out;
}

export function buildSite(M) {
  const root = new THREE.Group();
  const walk = { solids: [], decks: [], ramps: [] }, shade = [];   // shade: rects that darken the ground around them
  const put = (b, at, q = 0) => {
    b.group.position.set(at[0], 0, at[1]); b.group.rotation.y = (q * Math.PI) / 2; root.add(b.group);
    for (const k of ["solids", "decks", "ramps"]) for (const r of b.walk[k]) walk[k].push(place(r, at, q));
    shade.push(place(b.plat, at, q));
    return b;
  };

  // ---- Buildings, south to north ----
  const gate = put(buildHall(M, {   // mountain gate: you walk through its middle bay
    xs: [-5.4, -1.9, 1.9, 5.4], zs: [2.4, -2.4], platH: 0.36, platOut: 1.2, colTop: 3.7, overhang: 1.9, rise: 3.3, G: 2.3,
    front: "pass", back: "pass", dark: false, steps: 3.4, stepsBack: 3.4, plaque: "云径禅寺",
  }), [0, SITE.zS]);
  const strikers = [];
  for (const sx of [-1, 1]) {   // bell pavilion (east) and drum pavilion (west), open on all sides
    const t = put(buildHall(M, {
      xs: [-1.7, 1.7], zs: [1.7, -1.7], platH: 0.6, platOut: 0.9, colTop: 4.4, overhang: 1.5, rise: 3.0, G: 9, lift: 0.6, liftLen: 2.6,
      front: "open", back: "open", sides: "open", dark: false, steps: 0, plaque: sx > 0 ? "钟楼" : "鼓楼",
    }), [sx * 11.2, 27.5], sx > 0 ? 3 : 1);
    const thing = sx > 0 ? bell(M, t) : drum(M, t);
    t.group.add(thing.group); strikers.push({ kind: sx > 0 ? "bell" : "drum", mesh: thing.hit, swing: thing.swing });
  }
  const main = put(buildHall(M, { plaque: "大雄宝殿" }), [0, -9.4]);   // the main hall, as first built
  for (const sx of [-1, 1]) put(buildHall(M, {     // covered walks down both sides of the main court
    xs: Array.from({ length: 10 }, (_, i) => -13.5 + i * 3), zs: [1.15, -1.15], platH: 0.3, platOut: 0.45, colTop: 2.9, overhang: 0.9, rise: 1.25, G: 0,
    brackets: false, front: "open", back: "open", sides: "open", dark: false, steps: 0, walkAll: true,
  }), [sx * 14.9, -2], 1);
  // Sutra library, two storeys: the lower roof is a skirt whose ridge hides inside the upper storey,
  // and the upper storey starts where that skirt meets its walls.
  const lower = put(buildHall(M, {
    xs: [-9.4, -5.4, -1.9, 1.9, 5.4, 9.4], zs: [4.2, 0, -4.2], platH: 1.26, platOut: 1.7, colTop: 5.0, overhang: 2.6, rise: 3.0, G: 6.0,
    steps: 5.2,
  }), [0, -41.5]);
  put(buildHall(M, {
    xs: [-6.4, -2.2, 2.2, 6.4], zs: [2.6, -2.6], platH: lower.roofAt(lower.EZ - 2.6) - 0.08, platOut: 0.05, colTop: 3.1, overhang: 2.3, rise: 4.4, G: 2.9,
    platBase: lower.roofAt(lower.EZ - 2.6) - 0.4, dark: false, steps: 0, plaque: "藏经楼",
  }), [0, -41.5]);
  put(buildHall(M, {   // tea house on the east side of the rear court, facing west
    xs: [-4.2, -1.4, 1.4, 4.2], zs: [2.1, -2.1], platH: 0.45, platOut: 1.0, colTop: 3.3, overhang: 1.5, rise: 2.7, G: 1.9,
    lamps: false, steps: 2.8, plaque: "吃茶去",
  }), [11.3, -28.5], 3);

  // Stone lanterns in pairs along the axis, each with a flame.
  const lanternStone = [], lanternAt = [[3.0, 33], [3.0, 21.5], [4.5, 1.4], [3.6, -30]];
  for (const [lx, lz] of lanternAt) for (const sx of [-1, 1]) {
    lanternStone.push(lantern().translate(sx * lx, 0, lz));
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), M.flame); f.position.set(sx * lx, 1.36, lz); root.add(f);
    walk.solids.push({ x0: sx * lx - 0.5, x1: sx * lx + 0.5, z0: lz - 0.5, z1: lz + 0.5 });
    shade.push({ x0: sx * lx - 0.3, x1: sx * lx + 0.3, z0: lz - 0.3, z1: lz + 0.3 });
  }
  root.add(mesh(merge(lanternStone), M.stone));

  // ---- Walls ----
  const body = [], ridge = [], capPos = [], capUv = [], capIdx = [], H = SITE.wallH, T = 0.42;
  function wall(x0, z0, x1, z1) {
    const alongX = Math.abs(x1 - x0) > Math.abs(z1 - z0), len = alongX ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
    body.push(box(alongX ? len : T, H, alongX ? T : len, (x0 + x1) / 2, H / 2, (z0 + z1) / 2));
    ridge.push(box(alongX ? len : 0.16, 0.14, alongX ? 0.16 : len, (x0 + x1) / 2, H + 0.5, (z0 + z1) / 2));
    for (const side of [-1, 1]) {   // two tiled slopes
      const b = capPos.length / 3;
      for (const [l, y, o] of [[0, H + 0.46, 0], [len, H + 0.46, 0], [len, H + 0.1, side * 0.62], [0, H + 0.1, side * 0.62]]) {
        capPos.push(alongX ? Math.min(x0, x1) + l : x0 + o, y, alongX ? z0 + o : Math.min(z0, z1) + l); capUv.push(l, o === 0 ? 0.72 : 0);
      }
      capIdx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const r = { x0: Math.min(x0, x1) - (alongX ? 0 : T / 2), x1: Math.max(x0, x1) + (alongX ? 0 : T / 2), z0: Math.min(z0, z1) - (alongX ? T / 2 : 0), z1: Math.max(z0, z1) + (alongX ? T / 2 : 0) };
    shade.push(r);
    walk.solids.push({ x0: r.x0 - 0.45, x1: r.x1 + 0.45, z0: r.z0 - 0.45, z1: r.z1 + 0.45 });
  }
  // A cross wall at z with openings: each opening gets posts, a head beam and a small tiled hood.
  const posts = [], heads = [], hp = [], hu = [], hi = [];
  function crossWall(z, openings) {
    let x = -SITE.x;
    for (const [cx, w] of [...openings].sort((a, b) => a[0] - b[0])) {
      wall(x, z, cx - w / 2, z); x = cx + w / 2;
      posts.push(box(0.3, 3.7, 0.3, cx - w / 2, 1.85, z), box(0.3, 3.7, 0.3, cx + w / 2, 1.85, z));
      heads.push(box(w + 1.2, 0.3, 0.34, cx, 3.55, z));
      for (const side of [-1, 1]) {
        const b = hp.length / 3, L = w + 2.0;
        for (const [l, y, o] of [[0, 4.35, 0], [L, 4.35, 0], [L, 3.8, side], [0, 3.8, side]]) { hp.push(cx - L / 2 + l, y, z + o); hu.push(l, o === 0 ? 1.1 : 0); }
        hi.push(b, b + 1, b + 2, b, b + 2, b + 3);
      }
    }
    wall(x, z, SITE.x, z);
  }
  const X = SITE.x, gw = 5.4 + 1.2;   // the outer south wall meets the gate house's platform
  wall(-X, SITE.zN, X, SITE.zN); wall(-X, SITE.zN, -X, SITE.zS); wall(X, SITE.zN, X, SITE.zS);
  wall(-X, SITE.zS, -gw, SITE.zS); wall(gw, SITE.zS, X, SITE.zS);
  crossWall(15, [[0, 3.4]]);                       // front court | main court
  crossWall(-19, [[-12.2, 2.8], [12.2, 2.8]]);     // main court | rear court: you pass either side of the hall

  const tiles = (pos, uv, idx) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals(); return g; };
  root.add(mesh(merge(body), M.plaster(0)), mesh(tiles(capPos, capUv, capIdx), M.tile), mesh(merge(ridge), M.stone),
    mesh(merge(posts), M.woodV), mesh(merge(heads), M.woodX), mesh(tiles(hp, hu, hi), M.tile));

  // ---- The main hall can be entered ----
  const mz = -9.4, doorZ = mz + main.frontZ + 0.55;
  const hall = {
    box: new THREE.Box3(new THREE.Vector3(-main.plat.x1, 0, mz + main.zB), new THREE.Vector3(main.plat.x1, 11, mz + main.zF + main.run)),
    foot: new THREE.Vector3(0, 0, mz + main.zF + main.run + 0.4),
    door: new THREE.Vector3(0, 0, doorZ),
    inside: (x, z) => Math.abs(x) < 1.35 && z < doorZ + 0.25 && z > doorZ - 0.6,
    out: [0, doorZ + 0.6],
  };

  // ---- Named views: one per thing worth looking at. The screenshot tool renders each of them. ----
  const views = {
    arrive: [0, 50.5, 0, 0.1], gate: [3.2, 46.5, -0.35, 0.22], frontcourt: [0, 36, 0, 0.06], towers: [-4, 33, 0.9, 0.28],
    court: [7.5, 12.5, -0.52, 0.07], eave: [3.5, 2.2, -0.3, 0.42], walk: [14.9, 11, 0, 0.02], corner: [-10, 6, 0.75, 0.2],
    passage: [12.2, -14, 0, 0.1], rear: [-6, -21.5, 0.3, 0.16], library: [0, -24, 0, 0.16], teahouse: [2, -24, 1.25, 0.1],
    bell: [5.5, 30.5, 1.15, 0.2], drum: [-5.5, 30.5, -1.15, 0.2], plaque: [0, 4.6, 0, 0.36], lantern: [1.2, 24.5, -0.5, 0.02],
    back: [-5, -31, Math.PI + 0.35, 0.14],
  };

  return { root, walk, shade, hall, views, strikers, start: views.arrive, censer: new THREE.Vector3(0, 0, 3.2), sunFocus: [0, -6] };
}

// ---- Furnishings ----
const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);

// A stone lantern: lotus base, shaft, an open chamber for the flame, a hexagonal cap.
function lantern() {
  const parts = [
    lathe([[0, 0], [0.42, 0], [0.42, 0.12], [0.3, 0.2], [0.16, 0.3], [0.14, 0.95], [0.2, 1.02], [0.36, 1.1], [0.38, 1.18], [0, 1.18]], 12),
    lathe([[0, 1.56], [0.46, 1.56], [0.5, 1.61], [0.3, 1.82], [0.1, 1.95], [0.07, 2.1], [0, 2.17]], 6),
  ];
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(box(0.06, 0.4, 0.06, a * 0.2, 1.37, b * 0.2));
  return merge(parts);
}

// A bronze bell hung from a cross beam, with the log that strikes it slung beside it.
function bell(M, t) {
  const g = new THREE.Group(), y0 = t.platH + 1.1, beamY = t.colTop - 0.55;
  const body = mesh(merge([
    lathe([[0.64, 0], [0.61, 0.07], [0.53, 0.3], [0.48, 0.8], [0.46, 1.25], [0.41, 1.5], [0.26, 1.68], [0.08, 1.75], [0, 1.75]], 28).translate(0, y0, 0),
    new THREE.TorusGeometry(0.12, 0.035, 8, 14).translate(0, y0 + 1.83, 0),
    new THREE.CylinderGeometry(0.025, 0.025, beamY - y0 - 1.9, 6).translate(0, (beamY + y0 + 1.9) / 2, 0),
  ]), M.bronze);
  const inside = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20).rotateX(Math.PI / 2).translate(0, y0 + 0.03, 0), M.dark.clone());
  inside.material.side = THREE.DoubleSide;
  const frame = mesh(merge([box(3.6, 0.24, 0.24, 0, beamY, 0), box(0.24, 0.24, 3.6, 0, beamY - 0.02, 0)]), M.woodX);
  const log = mesh(merge([
    new THREE.CylinderGeometry(0.09, 0.09, 1.7, 10).rotateX(Math.PI / 2).translate(0, y0 + 0.35, 1.55),
    new THREE.CylinderGeometry(0.012, 0.012, beamY - y0 - 0.4, 5).translate(0, (beamY + y0 + 0.4) / 2, 1.0),
    new THREE.CylinderGeometry(0.012, 0.012, beamY - y0 - 0.4, 5).translate(0, (beamY + y0 + 0.4) / 2, 2.1),
  ]), M.woodZ);
  g.add(body, inside, frame, log);
  return { group: g, hit: body, swing: log };
}

// A barrel drum on a timber stand, its face toward the court.
function drum(M, t) {
  const g = new THREE.Group(), cy = t.platH + 1.75;
  const barrel = mesh(lathe([[0.8, -0.68], [0.9, -0.4], [0.95, 0], [0.9, 0.4], [0.8, 0.68]], 28).rotateX(Math.PI / 2).translate(0, cy, 0), M.lacquer);
  const skins = mesh(merge([new THREE.CircleGeometry(0.8, 28).translate(0, cy, 0.685), new THREE.CircleGeometry(0.8, 28).rotateY(Math.PI).translate(0, cy, -0.685)]), M.hide);
  const stand = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) stand.push(box(0.14, cy - t.platH - 0.3, 0.14, sx * 0.72, (cy + t.platH - 0.3) / 2, sz * 0.5));
  for (const sz of [-1, 1]) stand.push(box(1.7, 0.14, 0.14, 0, cy - 0.78, sz * 0.5), box(1.7, 0.12, 0.12, 0, t.platH + 0.35, sz * 0.5));
  for (const sx of [-1, 1]) stand.push(box(0.12, 0.12, 1.1, sx * 0.72, t.platH + 0.35, 0));
  g.add(barrel, skins, mesh(merge(stand), M.woodX));
  return { group: g, hit: skins, swing: null };
}

// ---- Walking over the plan ----
export function createWalker(site) {
  const { solids, decks, ramps } = site.walk;
  const inRect = (r, x, z) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1;
  function heightAt(x, z) {
    for (const d of decks) if (inRect(d, x, z)) return d.h;
    for (const r of ramps) if (inRect(r, x, z)) {
      const dx = r.high[0] - r.low[0], dz = r.high[1] - r.low[1];
      return r.h * Math.min(1, Math.max(0, ((x - r.low[0]) * dx + (z - r.low[1]) * dz) / (dx * dx + dz * dz)));
    }
    return -1;   // plain ground
  }
  return {
    heightAt: (x, z) => Math.max(0, heightAt(x, z)),
    onGround: (x, z) => heightAt(x, z) < 0,
    blocked(x, z) {
      if (heightAt(x, z) >= 0) return false;
      if (Math.abs(x) > SITE.x + 6 || z < SITE.zN - 0.5 || z > SITE.apron) return true;
      for (const s of solids) if (inRect(s, x, z)) return true;
      return false;
    },
  };
}
