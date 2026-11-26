// What lies beyond the town round 奉明寺 (T05): the far layers the art director asked for on 2026-11-25 (docs/t05/DECISIONS.md, the revision of
// that date): the near layer is the walls and the first rows of houses and trees (./surround.js, within about 60 m); here are the middle and the far.
//
//  - The middle (about 60 to 220 m out): the county town's low roofs and a band of bare trees, grey-blue, low and flat, with a poplar's tip now and
//    then over them. Drawn plainly and left to the scene's own mist, which lightens them with distance as it does everything else.
//  - The far, to the north (behind the great hall): one very low line of distant hills, pale blue-grey, so that the hall's roof is cut against the
//    sky above it. The county lies in the Daling valley, with low hills east and west and the Yiwulü range to the north-east (docs/t05/RESEARCH.md
//    §2.2, a summary, S35, the original not read); the line's shape and height are ours. It is its own part (`?off=farhills`): whether it stays is
//    judged on cam01's picture, and it goes if it presses on the hall or reads as the prologue's mountains.
//  - The far, to the south: the plain going into the haze, with a line of far trees and two field ridges on it, so that behind the last houses
//    there is not an empty floor to the horizon.
//
// The far layers stand where the camera's far plane (800 m) still holds them and are given a fixed share of the mist's colour, as the old town's
// pagoda is (./tower.js), since at their real distance the scene's mist would take them out altogether. Nothing here is walked, held, or met by
// the eye; nothing casts. Every number is ours unless said.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { growTree, hashAt } from "./flora.js";
import { onTowerLine } from "./surround.js";

/** The layers' numbers. `north`: the hill line's arc (about cam01's eye), its bearings either side of north, its height range (m) and its mist share at foot and top; `south`: the tree line and field ridges about the arrival. */
export const DISTANCE = Object.freeze({
  north: Object.freeze({ at: [0, 44], r: 640, span: 72, low: 8, high: 33, haze: [0.84, 0.56] }),   // (33 m at 640 m: 3° from cam01, under a sixth of the hall's height in that picture)
  south: Object.freeze({ at: [0, 215], trees: Object.freeze({ r: 470, span: 80, low: 3.5, high: 8.5, haze: [0.8, 0.6] }), ridges: Object.freeze([{ r: 230, h: 0.9 }, { r: 330, h: 1.1 }]) }),
  middle: Object.freeze({ inner: Object.freeze({ x: 100, zN: -70, zS: 280 }), outer: Object.freeze({ x: 230, zN: -210, zS: 420 }), roofs: 150, trees: 44, poplars: 9 }),
});

/** A strip whose top follows `top(u)` (u from 0 to 1 along it) from `y0` up, laid on an arc about (cx, cz) of radius r over bearings a0..a1 (from north, clockwise). */
function ribbon(cx, cz, r, a0, a1, y0, top, n = 160) {
  const pos = [], idx = [], uv = [];
  for (let i = 0; i <= n; i++) {
    const u = i / n, a = ((a0 + (a1 - a0) * u) * Math.PI) / 180, x = cx + Math.sin(a) * r, z = cz - Math.cos(a) * r, t = top(u);
    pos.push(x, y0, z, x, t, z); uv.push(u, 0, u, 1);
    if (i < n) { const k = i * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}

/** A smooth wandering number in [0, 1] along u, from a few waves (seeded by `k`). */
const wander = (u, k) => { let v = 0, a = 0.5, f = 2.3; for (let o = 0; o < 4; o++) { v += a * (0.5 + 0.5 * Math.sin(u * f * 6.283 + k * 1.7 + o * 2.1)); a *= 0.5; f *= 2.13; } return v / 0.9375; };

/** An unlit far thing, its colour drawn toward the mist's by a share from `foot` (at the strip's foot) to `top`, and greyed (the art director: chroma 3 or less). */
function hazed(color, foot, top, name, grey = 0.45) {
  const m = new THREE.MeshBasicMaterial({ color, fog: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vUpD;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvUpD = uv.y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vUpD;").replace("#include <fog_fragment>", `
      #ifdef USE_FOG
      { gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, mix(${foot.toFixed(3)}, ${top.toFixed(3)}, clamp(vUpD, 0., 1.))); float l_ = dot(gl_FragColor.rgb, vec3(.2126, .7152, .0722)); gl_FragColor.rgb = mix(gl_FragColor.rgb, vec3(l_), ${grey.toFixed(3)}); }
      #endif`);
  };
  m.customProgramCacheKey = () => name; m.name = name;
  return m;
}

/** The north hill line: two or three soft swells, rising a little toward the north-east (where the Yiwulü range lies), never steep. */
function northHills() {
  const N = DISTANCE.north, [cx, cz] = N.at;
  const top = (u) => { const ne = 0.35 + 0.65 * Math.max(0, u - 0.25) / 0.75, w = 0.55 * wander(u, 3) + 0.45 * Math.pow(Math.sin(Math.PI * Math.min(1, Math.max(0, (u - 0.08) / 0.84))), 1.4); return N.low + (N.high - N.low) * Math.min(1, w * ne * 1.15); };
  return ribbon(cx, cz, N.r, -N.span, N.span, -12, top);
}
/** The south: a line of far trees (a ragged top of crowns, low) and two field ridges nearer, on the plain. */
function southTrees() {
  const S = DISTANCE.south, T = S.trees, [cx, cz] = S.at;
  const top = (u) => { const crowns = Math.pow(Math.abs(Math.sin(u * 140 + 1.3 * Math.sin(u * 37))), 0.6), gaps = wander(u, 7) > 0.32 ? 1 : 0.25; return T.low + (T.high - T.low) * crowns * gaps * (0.7 + 0.3 * wander(u, 11)); };
  return ribbon(cx, cz, T.r, 180 - T.span, 180 + T.span, -4, top, 900);
}
function southRidges() {
  const S = DISTANCE.south, [cx, cz] = S.at;
  return S.ridges.map((R, k) => ribbon(cx, cz, R.r, 180 - 70, 180 + 70, -0.3, (u) => R.h * (0.75 + 0.25 * wander(u, 20 + k)), 120));
}

/** The middle layer's houses and trees: placed by a hash in the ring between the near town and the outer box, not on the line to the pagoda. */
export function middlePlan() {
  const D = DISTANCE.middle, I = D.inner, O = D.outer, houses = [], trees = [];
  const inRing = (x, z, pad) => !(Math.abs(x) < I.x + pad && z > I.zN - pad && z < I.zS + pad) && Math.abs(x) < O.x && z > O.zN && z < O.zS;
  const pick = (k, salt) => { const x = (hashAt(k * 1.37, 3.1, salt) * 2 - 1) * O.x, z = O.zN + hashAt(k * 0.71, 8.3, salt + 1) * (O.zS - O.zN); return [+x.toFixed(2), +z.toFixed(2)]; };
  for (let k = 0, n = 0; n < D.roofs && k < D.roofs * 8; k++) {
    const [x, z] = pick(k, 40); if (!inRing(x, z, 4) || onTowerLine(x, z, 8)) continue;
    const w = 6 + 6 * hashAt(x, z, 41), d = 5 + 3 * hashAt(x, z, 42); if (houses.some((h) => Math.abs(h.x - x) < (h.w + w) / 2 + 2 && Math.abs(h.z - z) < (h.d + d) / 2 + 2)) continue;
    houses.push({ x, z, w: +w.toFixed(2), d: +d.toFixed(2), alongX: hashAt(x, z, 43) < 0.6, ridge: +(4.6 + 1.3 * hashAt(x, z, 44)).toFixed(2) }); n++;
  }
  for (let k = 0, n = 0; n < D.trees + D.poplars && k < (D.trees + D.poplars) * 10; k++) {
    const [x, z] = pick(k, 60); if (!inRing(x, z, 6) || onTowerLine(x, z, 10)) continue;
    if (houses.some((h) => Math.abs(h.x - x) < h.w / 2 + 2 && Math.abs(h.z - z) < h.d / 2 + 2) || trees.some((t) => Math.hypot(t.x - x, t.z - z) < 7)) continue;
    const poplar = n >= D.trees; trees.push({ kind: poplar ? "poplar" : "broad", x, z, h: +(poplar ? 15 + 4 * hashAt(x, z, 61) : 7 + 3 * hashAt(x, z, 62)).toFixed(2), r: poplar ? 0.26 : 0.3 }); n++;
  }
  return { houses, trees };
}
/** One middle house: walls and a gable roof, as plain prisms, coloured by vertex (roof darker than wall). */
function middleHouse(h, out) {
  const tint = (g, c) => { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set(c, i * 3); g.setAttribute("color", new THREE.BufferAttribute(a, 3)); return g; };
  const walls = new THREE.BoxGeometry(h.w, 3, h.d).translate(h.x, 1.5, h.z);
  const run = (h.alongX ? h.d : h.w) / 2 + 0.4, len = (h.alongX ? h.w : h.d) + 0.8, rise = h.ridge - 3, sh = new THREE.Shape();
  sh.moveTo(-run, 0); sh.lineTo(0, rise); sh.lineTo(run, 0); sh.closePath();
  const roof = new THREE.ExtrudeGeometry(sh, { depth: len, bevelEnabled: false }).translate(0, 0, -len / 2); if (h.alongX) roof.rotateY(Math.PI / 2); roof.translate(h.x, 3, h.z);
  const k = 0.85 + 0.3 * hashAt(h.x, h.z, 45);
  out.push(tint(walls.toNonIndexed(), [0.2 * k, 0.2 * k, 0.2 * k]), tint(roof.index ? roof.toNonIndexed() : roof, [0.11 * k, 0.12 * k, 0.135 * k]));
}

/**
 * The far layers as a group for the site's root (named parts `farhills` and `farland`, each left out by `?off=` with its name). Returns the group and
 * how many triangles it has.
 */
export function buildDistance() {
  const off = typeof location !== "undefined" ? (new URLSearchParams(location.search).get("off") || "").split(",") : [];
  const group = new THREE.Group(); group.name = "distance";
  const put = (geo, mat, name, part) => { const m = new THREE.Mesh(geo, mat); m.name = name; m.renderOrder = 1; m.castShadow = false; m.receiveShadow = false; m.userData.walk = false; m.userData.keep = true; m.userData.distance = part; group.add(m); return m; };
  if (!off.includes("farhills")) put(northHills(), hazed(0x56595c, ...DISTANCE.north.haze, "farHills"), "farhills", "farhills");
  if (!off.includes("farland")) {
    put(mergeGeometries([southTrees(), ...southRidges()]), hazed(0x3a3b38, ...DISTANCE.south.trees.haze, "farTrees", 0.5), "farland-south", "farland");
    // the middle town: plain unlit prisms and coarse bare trees in one draw, under the scene's own mist
    const { houses, trees } = middlePlan(), geos = [];
    for (const h of houses) middleHouse(h, geos);
    for (const t of trees) { const g = growTree(t, true); for (const w of [g.trunk, g.wood]) { const n = w.index ? w.toNonIndexed() : w, c = new Float32Array(n.attributes.position.count * 3).fill(t.kind === "poplar" ? 0.3 : 0.075); n.setAttribute("color", new THREE.BufferAttribute(c, 3)); geos.push(n); } }
    for (const g of geos) { for (const k of Object.keys(g.attributes)) if (!["position", "color"].includes(k)) g.deleteAttribute(k); }
    const mid = new THREE.MeshBasicMaterial({ vertexColors: true, fog: true }); mid.name = "farTown";
    put(mergeGeometries(geos), mid, "farland-middle", "farland").renderOrder = 0;
  }
  let tris = 0; group.traverse((/** @type {any} */ o) => { if (o.isMesh) tris += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; });
  group.userData.tris = tris;
  return group;
}
