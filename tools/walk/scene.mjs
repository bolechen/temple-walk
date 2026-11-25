// The place as it is drawn, built in Node for baking the floor (#194): the plan's buildings (buildSite), the ground and
// the terraces' paving (ground.js, the same meshes the page lays), the land the place sits in (backdrop.js's earth), the
// censer (props.js, as far as it builds without a canvas), the trees (trees.js) and the rooms under the courts
// (interior.js). Not the bamboo, nor the far hills' painted cards. Every material is only a name, so that what stops him can be told by it.
//
// And what the bake is asked for: the grids (where, from which seeds), the places checked for whether they can still be
// walked to, and the parts of the place each change of walkable floor is counted against.
//
// Which place: a level (app/src/level.js, #405), the prologue unless one is named. What is built is the level's own
// `build`; how far the outdoor grid reaches and the parts a change is counted against are its app/levels/<id>/bake.js
// (which the page never imports); the far land is its `backdrop` and `land`; the indoor cameras checked are its own
// app/levels/<id>/hall-views.js, if it has one.
import "../../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { existsSync } from "node:fs";

const { LEVELS: KNOWN, DEFAULT_LEVEL, loadLevel } = await import("../../app/src/level.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createTrees } = await import("../../app/src/trees.js");
const { createProps } = await import("../../app/src/props.js");
const { createGround } = await import("../../app/src/ground.js");
const { createBackdrop } = await import("../../app/src/backdrop.js");
/** Each level's indoor cameras (none for a level that registers none), and what its bake needs (bake.js, which it must have). */
const HALL_VIEWS = {}, BAKES = {};
for (const id of Object.keys(KNOWN)) {
  const f = new URL(`../../app/levels/${id}/hall-views.js`, import.meta.url), b = new URL(`../../app/levels/${id}/bake.js`, import.meta.url);
  HALL_VIEWS[id] = existsSync(f) ? (await import(f.href)).HALL_VIEWS : [];
  if (existsSync(b)) BAKES[id] = (await import(b.href)).default;
}
/** What the bake needs of the level `id`. */
export function bakeOf(id) {
  if (!BAKES[id]) throw new Error(`app/levels/${id}/bake.js is missing: the floor's bake needs its outdoor box and bands`);
  return BAKES[id];
}
const PROLOGUE = await loadLevel(DEFAULT_LEVEL);

export function namedMaterials() {
  const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
  return new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
}

/** Everything the walk draws that stands on the ground, outdoors and in, for the level `L` (the prologue by default). */
export function buildDrawn(L = PROLOGUE) {
  const M = namedMaterials(), site = L.build(M), scene = new THREE.Scene();
  scene.add(site.root);
  const ground = new THREE.Scene(); createGround(ground, site.shade, site.censer, site.paving);
  ground.traverse((o) => { if (o.isMesh) o.userData.ground = true; }); scene.add(ground);
  // The land (backdrop.js's earth: the hillside between the terraces, the slope under the grove): it is not walked, as the
  // written plan has it (the hill and the grove are solid there), and what lies under it is underground.
  const land = new THREE.Scene(); if (L.backdrop) createBackdrop(land, M, L.backdrop.site, L.backdrop.terraces, L.land);
  land.traverse((o) => { if (o.isMesh && !o.material.transparent && o.material.type !== "ShaderMaterial") o.userData.land = true; else if (o.isMesh) o.userData.walk = false; }); scene.add(land);
  try { createProps(scene, M, site.censer, L.propsAt); } catch { /* the censer is in; the mist and the shafts of light need a canvas, and are not there to stand on */ }
  createTrees(scene, M, site.trees, { a2c: false });
  const rooms = buildInteriors(M, site.halls);
  scene.updateMatrixWorld(true); rooms.group.updateMatrixWorld(true);
  return { level: L, site, scene, rooms };
}

/**
 * The grids to bake: the courts and the path up (one grid, floors at every height, from where he arrives), the summit
 * pavilion's top storey (from its door), and each room (from inside its door). `roots` is what each is gathered from.
 */
export function gridsOf({ level, site, scene, rooms }) {
  const out = [];
  const { x0, x1, z0, z1 } = bakeOf(level.id).outdoors;
  out.push({ id: "outdoors", kind: "outdoors", name: "院落与山路", box: { x0, x1, z0, z1, top: 60, bottom: -30 }, base: 0, seeds: [[site.start[0], site.start[1], -1e9]], closed: [...site.halls.map((h) => h.stop).filter(Boolean), ...(site.closed || [])], roots: [scene], enter: (w) => { w.setRoom(null); w.setLoft?.(null); } });
  for (const [id, L] of Object.entries(site.lofts)) {
    const o = L.outer;
    out.push({ id: `loft:${id}`, kind: "loft", name: `${id} 顶层`, box: { x0: o.x0 - 0.6, x1: o.x1 + 0.6, z0: o.z0 - 0.6, z1: o.z1 + 0.6, top: L.ceil + 8, bottom: L.floor - 2 }, base: L.floor, seeds: [[L.door[0], L.door[1], L.floor]], roots: [scene], enter: (w) => { w.setRoom(null); w.setLoft(id); } });
  }
  for (const [id, r] of Object.entries(rooms.rooms)) {
    const R = r.room;
    out.push({ id: `room:${id}`, kind: "room", name: `${id} 殿内`, box: { x0: R.x0 - 0.3, x1: R.x1 + 0.3, z0: R.z0 - 0.3, z1: R.z1 + 0.3, top: R.y + 20, bottom: R.y - 2 }, base: R.y, seeds: [[R.door[0], R.door[1], R.y]], roots: [r.group], postBase: R.y, enter: (w) => { w.setLoft?.(null); w.setRoom(R); } });
  }
  // Snap each box to whole cells, so that two bakes of the same place lay their cells on the same lines.
  for (const g of out) for (const k of ["x0", "z0"]) g.box[k] = Math.floor(g.box[k] * 20) / 20;
  for (const g of out) for (const k of ["x1", "z1"]) g.box[k] = Math.ceil(g.box[k] * 20) / 20;
  return out;
}

/** The places that must still be walked to, each with the grid it lies in and how near a reached cell must be. */
export function targetsOf({ level, site, rooms }) {
  const t = [];
  const gridFor = (room) => (room ? `room:${room}` : "outdoors");
  // A place is offered within its ring (`r`, game.js placeAt); a seat within a step or two (1.5 m, game.js `seatHere`),
  // from wherever he can stand, however high the seat: one on a platform he hops up onto (drop.js seatHop).
  for (const [id, p] of Object.entries({ ...site.places, ...rooms.places })) if (p.at) t.push({ kind: "place", id, grid: gridFor(p.room), at: p.at, r: p.r ?? 1.0 });
  for (const [n, s] of [...site.seats, ...rooms.seats].entries()) t.push({ kind: "seat", id: `${s.room || "outdoors"}#${n} ${s.kind}`, grid: gridFor(s.room), at: s.at, r: 1.5 });
  for (const h of site.halls) t.push({ kind: "door", id: h.id, grid: "outdoors", at: h.out, r: 0.5 });
  const up = new Set(Object.keys(site.viewUp || {}));
  // (a level may name views it cannot offer for now, `site.closedViews`: T05's, inside the great hall while its doors are shut)
  const shutViews = new Set(site.closedViews || []);
  for (const [id, v] of Object.entries(site.views)) if (Array.isArray(v) && !shutViews.has(id)) t.push({ kind: "view", id, grid: up.has(id) ? `loft:${site.viewUp[id]}` : "outdoors", at: [v[0], v[1]], r: 0.5 });
  // Since the rooms and the balcony are walked on the baked floor too (#274): what hangs or stands in a room to be read or
  // used (each frame, the offering box: within its own ring), the foot of the stair up, where each indoor camera stands
  // (on open floor, as tests/unit/hall-views.test.mjs has it), and the balcony's door.
  for (const [id, p] of Object.entries(rooms.spots)) if (p.at && p.room) t.push({ kind: "spot", id, grid: gridFor(p.room), at: p.at, r: p.r ?? 1.0 });
  for (const [id, r] of Object.entries(rooms.rooms)) if (r.room.stair) t.push({ kind: "stair", id, grid: gridFor(id), at: r.room.stair.at, r: r.room.stair.r ?? 0.9 });
  for (const v of HALL_VIEWS[level.id] || []) { const R = rooms.rooms[v.hall]?.room; if (R) t.push({ kind: "hallview", id: v.name, grid: gridFor(v.hall), at: [R.cx + v.abs[0], v.abs[1]], r: 0.08 }); }
  for (const [id, L] of Object.entries(site.lofts)) t.push({ kind: "loftdoor", id, grid: `loft:${id}`, at: L.door, r: 0.5 });
  return t;
}

/** What each change of walkable floor is counted against: a building (its platform, a metre round), else the part of the place. */
export function partsOf({ level, site }) {
  const parts = site.buildings.map((b) => ({ name: b.name || "无名", x0: b.x0 - 1, x1: b.x1 + 1, z0: b.z0 - 1, z1: b.z1 + 1 }));
  for (const [name, zN, zS] of bakeOf(level.id).bands) parts.push({ name, x0: -1e9, x1: 1e9, z0: zN, z1: zS });
  return parts;
}

/** The written plan's walk data, as a fingerprint: change it and the old walker's bits are stale. */
export function planText({ site, rooms, lofts = site.lofts }) {
  const drop = (k, v) => (v && typeof v === "object" && (v.isObject3D || v.isMaterial || v.isBufferGeometry || v.isTexture) ? undefined : v);
  return JSON.stringify({ walk: site.walk, lofts, rooms: Object.fromEntries(Object.entries(rooms.rooms).map(([id, r]) => [id, { ...r.room, frame: undefined }])) }, drop);
}
