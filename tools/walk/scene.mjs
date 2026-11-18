// The place as it is drawn, built in Node for baking the floor (#194): the plan's buildings (buildSite), the ground and
// the terraces' paving (ground.js, the same meshes the page lays), the censer (props.js, as far as it builds without a
// canvas), the trees (trees.js) and the rooms under the courts (interior.js). Not the far hills or the bamboo: what
// the bamboo means to his walking (the grove is walked round, not through) is an intent to be marked where it is
// drawn, in the migration's third step. Every material is only a name, so that what stops him can be told by it.
//
// And what the bake is asked for: the grids (where, from which seeds), the places checked for whether they can still be
// walked to, and the parts of the place each change of walkable floor is counted against.
import "../../tests/unit/dom-stub.mjs";
import * as THREE from "three";

const { buildSite, LEVELS, SITE, APPROACH } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createTrees } = await import("../../app/src/trees.js");
const { createProps } = await import("../../app/src/props.js");
const { createGround } = await import("../../app/src/ground.js");

export function namedMaterials() {
  const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
  return new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
}

/** Everything the walk draws that stands on the ground, outdoors and in. */
export function buildDrawn() {
  const M = namedMaterials(), site = buildSite(M), scene = new THREE.Scene();
  scene.add(site.root);
  const ground = new THREE.Scene(); createGround(ground, site.shade, site.censer, site.paving);
  ground.traverse((o) => { if (o.isMesh) o.userData.ground = true; }); scene.add(ground);
  try { createProps(scene, M, site.censer, (SITE.zN + SITE.zS) / 2); } catch { /* the censer is in; the mist and the shafts of light need a canvas, and are not there to stand on */ }
  createTrees(scene, M, site.trees, { a2c: false });
  const rooms = buildInteriors(M, site.halls);
  scene.updateMatrixWorld(true); rooms.group.updateMatrixWorld(true);
  return { site, scene, rooms };
}

/**
 * The grids to bake: the courts and the path up (one grid, floors at every height, from where he arrives), the summit
 * pavilion's top storey (from its door), and each room (from inside its door). `roots` is what each is gathered from.
 */
export function gridsOf({ site, scene, rooms }) {
  const out = [];
  const [x, z0, z1] = [SITE.x + 10, SITE.zN - 1, Math.ceil(APPROACH.end) + 2];
  out.push({ id: "outdoors", kind: "outdoors", name: "院落与山路", box: { x0: -x, x1: x, z0, z1, top: 60, bottom: -30 }, base: 0, seeds: [[site.start[0], site.start[1], -1e9]], roots: [scene], enter: (w) => { w.setRoom(null); w.setLoft?.(null); } });
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
export function targetsOf({ site, rooms }) {
  const t = [];
  const gridFor = (room) => (room ? `room:${room}` : "outdoors");
  // A place is offered within its ring (`r`, game.js placeAt); a seat within a step or two (1.5 m, game.js `seatHere`),
  // from wherever he can stand, however high the seat: one on a platform he hops up onto (drop.js seatHop).
  for (const [id, p] of Object.entries({ ...site.places, ...rooms.places })) if (p.at) t.push({ kind: "place", id, grid: gridFor(p.room), at: p.at, r: p.r ?? 1.0 });
  for (const [n, s] of [...site.seats, ...rooms.seats].entries()) t.push({ kind: "seat", id: `${s.room || "outdoors"}#${n} ${s.kind}`, grid: gridFor(s.room), at: s.at, r: 1.5 });
  for (const h of site.halls) t.push({ kind: "door", id: h.id, grid: "outdoors", at: h.out, r: 0.5 });
  const up = new Set(Object.keys(site.viewUp || {}));
  for (const [id, v] of Object.entries(site.views)) if (Array.isArray(v)) t.push({ kind: "view", id, grid: up.has(id) ? `loft:${site.viewUp[id]}` : "outdoors", at: [v[0], v[1]], r: 0.5 });
  return t;
}

/** What each change of walkable floor is counted against: a building (its platform, a metre round), else the part of the place. */
export function partsOf({ site }) {
  const parts = site.buildings.map((b) => ({ name: b.name || "无名", x0: b.x0 - 1, x1: b.x1 + 1, z0: b.z0 - 1, z1: b.z1 + 1 }));
  const bands = [["山路", SITE.fore, 1e9], ["山门前", SITE.zS, SITE.fore], ["首院", LEVELS[0].zS, SITE.zS], ["藏经楼院", LEVELS[1].zS, LEVELS[0].zS], ["观音殿院", LEVELS[1].zN, LEVELS[1].zS], ["茶园坡", LEVELS[2].zS, LEVELS[1].zN], ["山顶", -1e9, LEVELS[2].zS]];
  for (const [name, zN, zS] of bands) parts.push({ name, x0: -1e9, x1: 1e9, z0: zN, z1: zS });
  return parts;
}

/** The written plan's walk data, as a fingerprint: change it and the old walker's bits are stale. */
export function planText({ site, rooms, lofts = site.lofts }) {
  const drop = (k, v) => (v && typeof v === "object" && (v.isObject3D || v.isMaterial || v.isBufferGeometry || v.isTexture) ? undefined : v);
  return JSON.stringify({ walk: site.walk, lofts, rooms: Object.fromEntries(Object.entries(rooms.rooms).map(([id, r]) => [id, { ...r.room, frame: undefined }])) }, drop);
}
