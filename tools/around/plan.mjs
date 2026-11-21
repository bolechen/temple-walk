// The walk-round survey's list and its camera stations (#252), read from the plan's own data: nothing here says where a
// thing stands. `inventory()` names every kind of thing set out in the place and each one's position, with the data it came
// from; `stationsFor()` finds, from the baked floor (app/shared/walk/<level>.bin, the prologue's), the spots a visitor can stand round it.
import "../../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { inflateRawSync } from "node:zlib";
import { decode, oldReached, NO_FLOOR } from "../../app/src/walkgrid.js";
import { buildDrawn } from "../walk/scene.mjs";
import { walkFile, DEFAULT_LEVEL } from "../walk/level-arg.mjs";

export const FILE = walkFile(DEFAULT_LEVEL);
export const EYE = 1.3;          // his eye above the floor (the walk bake's CLEAR note: a child, his eye at 1.3)
export const HIGH = 4.0;         // the raised camera's eye above the floor, for the slanting look down

/** The baked floor, ready to ask: which grid a spot belongs to, whether he may stand there, the height of the floor. */
export function floor(bytes = readFileSync(FILE), { shipped = true } = {}) {
  const { header, grids } = decode(new Uint8Array(bytes), (b) => inflateRawSync(b));
  const by = new Map(grids.map((g) => [g.id, g]));
  const at = (grid, x, z) => { const g = by.get(grid); if (!g) return null; const k = g.cell(x, z); if (k < 0 || g.height[k] === NO_FLOOR || g.state[k] !== 0) return null;
    // `shipped`: also reached by the walker the page runs today (the baked `old` bit). The new floor alone stands in places the visitor cannot get to (1,327 m² outdoors on 2026-11-19: strips outside the walls, the gate's timber).
    if (shipped && !oldReached(g.old, k)) return null; return { k, y: g.height[k] / 100 + g.base }; };
  /** The nearest open cell to (x, z) within `r` metres, or null. */
  const near = (grid, x, z, r) => {
    const g = by.get(grid); if (!g) return null; let best = null;
    const n = Math.ceil(r / g.step);
    for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
      const px = x + a * g.step, pz = z + b * g.step, d = Math.hypot(a, b) * g.step; if (d > r || (best && d >= best.d)) continue;
      const c = at(grid, px, pz); if (c) best = { x: px, z: pz, y: c.y, d };
    }
    return best;
  };
  return { header, grids, by, at, near, open: (grid) => { const g = by.get(grid), out = []; for (let k = 0; k < g.nx * g.nz; k++) if (g.height[k] !== NO_FLOOR && g.state[k] === 0 && (!shipped || oldReached(g.old, k))) out.push([g.x0 + ((k % g.nx) + 0.5) * g.step, g.z0 + (Math.floor(k / g.nx) + 0.5) * g.step, g.height[k] / 100 + g.base]); return out; } };
}

const unit = (a) => { const l = Math.hypot(a[0], a[1]) || 1; return [a[0] / l, a[1] / l]; };
const round = (v) => Math.round(v * 100) / 100;

/**
 * Everything set out in the place, by kind. Each item: { cls, id, at: [x, y, z], face: yaw | null, room, d, up, source }.
 * `face` is the way it looks (forward is (sin, cos) of it in x, z); null where it looks every way. `d` is the distance the
 * visitor is asked to look from. `room` is the hall id or null outdoors. `source` says which data it was read from.
 */
export function inventory(drawn = buildDrawn()) {
  const { site, rooms, scene } = drawn, items = [], v = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
  const add = (i) => items.push({ face: null, room: null, up: null, ...i, at: i.at.map(round) });
  const yawOf = (o) => { o.updateWorldMatrix(true, false); o.matrixWorld.decompose(v, q, s); const f = new THREE.Vector3(0, 0, 1).applyQuaternion(q); return Math.atan2(f.x, f.z); };
  const roomOf = (y) => (y < -30 ? [...Object.entries(rooms.rooms)].find(([, r]) => y >= r.room.y - 1 && y <= r.room.y + 20)?.[0] || null : null);
  const roomAt = (x, y, z) => { for (const [id, r] of Object.entries(rooms.rooms)) { const R = r.room; if (x >= R.x0 - 1 && x <= R.x1 + 1 && z >= R.z0 - 1 && z <= R.z1 + 1 && y >= R.y - 1 && y <= R.y + 20) return id; } return null; };

  // Name boards: every mesh the plaque maker marked (site.root: outdoors; rooms.group: the boards in the halls).
  for (const root of [site.root, rooms.group]) root.traverse((o) => {
    if (!o.userData.plaque) return; o.updateWorldMatrix(true, false); const p = new THREE.Vector3().setFromMatrixPosition(o.matrixWorld);
    add({ cls: "匾", id: o.userData.plaque.text, at: [p.x, p.y, p.z], face: yawOf(o), room: roomAt(p.x, p.y, p.z), d: 3.5 + Math.max(0, p.y - 2) * 0.8, source: "userData.plaque (plaque.js)" });
  });
  // Buildings: the back and both gables as well as the front. site.buildings is the plan's own list.
  for (const b of site.buildings) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    add({ cls: "建筑", id: b.name || `无名${Math.round(cx)},${Math.round(cz)}`, at: [cx, b.y + 3, cz], face: null, d: Math.hypot(b.x1 - b.x0, b.z1 - b.z0) / 2 + 7, box: [b.x0, b.z0, b.x1, b.z1], source: "site.buildings" });
  }
  for (const h of site.halls) add({ cls: "殿门", id: h.id, at: [h.door[0], 1.2, h.door[1]], face: h.outYaw, d: 3.5, source: "site.halls" });
  for (const [id, p] of Object.entries(site.places)) add({ cls: "观礼处", id, at: [p.at[0], 1, p.at[1]], face: p.face ?? null, d: 2.6, source: "site.places" });
  for (const [id, p] of Object.entries(rooms.places)) add({ cls: "观礼处", id, at: [p.at[0], yOfRoom(rooms, p) + 1, p.at[1]], face: p.face ?? null, room: roomByX(rooms, p.at), d: 2.4, source: "rooms.places" });
  [...site.seats.map((p) => ({ p, src: "site.seats" })), ...rooms.seats.map((p) => ({ p, src: "rooms.seats" }))].forEach(({ p, src }, n) => add({ cls: "座" + p.kind, id: `${p.room || "户外"}#${n}`, at: [p.at[0], p.top + 0.3, p.at[1]], face: p.face, room: p.room, d: 2.2, source: src }));
  site.strikers.forEach((st) => { st.mesh.updateWorldMatrix(true, false); const p = new THREE.Vector3().setFromMatrixPosition(st.mesh.matrixWorld); add({ cls: "钟鼓", id: st.kind, at: [p.x, p.y, p.z], face: null, d: 3.2, source: "site.strikers" }); });
  add({ cls: "香炉", id: "censer", at: [site.censer.x, (site.censer.y || 0) + 0.9, site.censer.z], face: null, d: 3, source: "site.censer" });
  for (const [id, sp] of Object.entries(rooms.spots)) add({ cls: sp.item?.offering ? "功德箱" : "画框", id, at: [sp.at[0], roomYOf(rooms, sp.room) + 1.6, sp.at[1]], face: sp.face != null ? sp.face : null, room: sp.room, d: 2.4, wall: true, source: "rooms.spots (interior.js)" });
  for (const [id, r] of Object.entries(rooms.rooms)) { if (!r.altar) continue; r.altar.updateWorldMatrix(true, false); const p = new THREE.Vector3().setFromMatrixPosition(r.altar.matrixWorld); add({ cls: "佛像与台座", id, at: [p.x, p.y + 1.2, p.z], face: null, room: id, d: 4, source: "rooms.rooms[].altar" }); }
  for (const [i, r] of site.walk.rails.entries()) add({ cls: "栏杆", id: `rail${i}`, at: [(r.x0 + r.x1) / 2, (r.bottom + r.top) / 2, (r.z0 + r.z1) / 2], face: null, d: 3, source: "site.walk.rails" });
  site.cedars.forEach((c, i) => add({ cls: "柳杉", id: `cedar${i}`, at: [c[0], 3, c[2]], face: null, d: 7, source: "site.cedars" }));
  site.trees.filter((t) => t[3] !== "cedar").forEach((t, i) => add({ cls: "树", id: `${t[3]}${i}`, at: [t[0], 2.5, t[2]], face: null, d: 5, source: "site.trees" }));
  // Round posts that are not a building's own column (a lantern, a pillar): those standing clear of every building's footprint.
  site.walk.posts.filter((p) => p.r != null && !site.buildings.some((b) => p.x > b.x0 - 1.5 && p.x < b.x1 + 1.5 && p.z > b.z0 - 1.5 && p.z < b.z1 + 1.5)).forEach((p, i) => add({ cls: "独立柱石", id: `post${i}`, at: [p.x, 1, p.z], face: null, d: 2.8, source: "site.walk.posts (clear of every building)" }));
  return items;

  function roomYOf(rooms, id) { return rooms.rooms[id].room.y; }
  function roomByX(rooms, at) { for (const [id, r] of Object.entries(rooms.rooms)) { const R = r.room; if (at[0] >= R.x0 && at[0] <= R.x1 && at[1] >= R.z0 && at[1] <= R.z1) return id; } return null; }
  function yOfRoom(rooms, p) { const id = roomByX(rooms, p.at); return id ? rooms.rooms[id].room.y : 0; }
}

/** What the data cannot give and that a survey must still look at: written here by hand, and said so in the report. */
export const BY_HAND = [];   // nothing is written by hand: lamps, the well, the screen wall and the sutra pillars all came out of the data (see the report's list)

/** How many of a kind to look at, by kind (the rest are the same make): a spread across the list, first and last included. */
export const CAP = { "匾": 99, "建筑": 99, "殿门": 3, "观礼处": 99, "座stool": 3, "座cushion": 4, "钟鼓": 2, "香炉": 1, "功德箱": 2, "画框": 4, "佛像与台座": 8, "栏杆": 4, "柳杉": 3, "树": 4, "独立柱石": 4 };
export function pick(items) {
  const by = new Map(); for (const i of items) (by.get(i.cls) || by.set(i.cls, []).get(i.cls)).push(i);
  const out = [];
  for (const [cls, list] of by) { const n = Math.min(list.length, CAP[cls] ?? 3); for (let k = 0; k < n; k++) out.push(list[n === 1 ? 0 : Math.round((k * (list.length - 1)) / (n - 1))]); }
  return out;
}

/**
 * Where a visitor may stand to look at `item` from each side: front, right, back, left (of its `face`, or the compass where it has
 * none), each the nearest open cell within `reach` m of the ring point; where there is none the side is "站不到". And one slanting
 * look down from the front (or the first side that can be stood on) with the eye raised.
 */
export function stationsFor(item, fl, { reach = Math.max(1.6, item.d * 0.45) } = {}) {
  const grid = item.room ? `room:${item.room}` : "outdoors", f = item.face != null ? [Math.sin(item.face), Math.cos(item.face)] : [0, 1], r = [f[1], -f[0]];
  const sides = item.face != null ? [["front", f], ["right", r], ["back", [-f[0], -f[1]]], ["left", [-r[0], -r[1]]]] : [["south", [0, 1]], ["east", [1, 0]], ["north", [0, -1]], ["west", [-1, 0]]];
  const out = [];
  for (const [name, dir] of sides) {
    const d = item.d, p = fl.near(grid, item.at[0] + dir[0] * d, item.at[2] + dir[1] * d, reach);
    // for a thing against a wall (a frame, a board) only its front is asked for from the room's side; the others are the wall's back, which no one stands behind
    // the nearest open cell may lie across the thing from the side asked for: it must keep at least half the ring's distance on that side
    const onSide = p && (p.x - item.at[0]) * dir[0] + (p.z - item.at[2]) * dir[1] >= d * 0.5;
    if (p && !onSide) { out.push({ side: name, stand: false, why: "the nearest open floor is not on this side of it" }); continue; }
    if (!p) { out.push({ side: name, stand: false, why: "no open floor within " + reach + " m of the ring" }); continue; }
    out.push({ side: name, stand: true, eye: [round(p.x), round(p.y + EYE), round(p.z)] });
  }
  const first = out.find((o) => o.stand);
  if (first) { const e = [first.eye[0], first.eye[1] - EYE + HIGH, first.eye[2]]; out.push({ side: "oblique", stand: true, eye: e.map(round), note: "from " + first.side + ", eye raised to " + HIGH + " m" }); }
  return out;
}

/** A tourist's stations: n spots spread evenly over the open floor of every grid (by area), a seeded draw. */
export function visitors(fl, n = 200, seed = 252) {
  let a = seed >>> 0; const rnd = () => ((a = (Math.imul(a, 1664525) + 1013904223) >>> 0) / 2 ** 32);
  const cells = []; for (const g of fl.grids) for (const c of fl.open(g.id)) cells.push([g.id, c]);
  const out = [];
  for (let i = 0; i < n; i++) { const [grid, c] = cells[Math.floor(rnd() * cells.length)]; out.push({ grid, eye: [round(c[0]), round(c[2] + EYE), round(c[1])] }); }
  return { stations: out, cells: cells.length };
}
