// What stops him, drawn (#274; the lead and the owner, 2026-11-19: when the owner next sees him pass through something,
// one picture should say whether it was his feet, his body or his eye). A switch on the debug panel (src/debug.js), so it
// is there only on the dev server and a pull request's preview; nothing here is built, and nothing more is drawn, until it
// is switched on, and it is taken out of the scene and thrown away when it is switched off.
//
//   the floor   every cell of the baked grid within a few metres of him, a dot at the floor's own height: green where he
//               may stand, red where he may not though a floor was reached there (within his reach of something, the
//               foot of a ledge, a doorway he is taken in at); nothing where no floor was reached (a wall's body)
//   his outline how far he reaches from his centre at each 5 cm of height (tools/walk/outline.json, measured from the
//               model: what the bake keeps off everything), as rings round him: white above the knee, blue below it,
//               where only his shoes and hem are counted
//   his eye     a ball of the radius the near plane's corners lie from his own eye (BAKE.EYE_R), at his eye's height
//
// The usual thing in engines is a debug layer that draws the navigation mesh, the character's capsule and the camera's
// probe (Recast's DebugDraw, Unreal's `show Collision` and `show Navigation`, Godot's Visible Collision Shapes); this is
// that, for a grid and an outline. three-mesh-bvh's MeshBVHHelper draws a hierarchy's boxes: the page holds no hierarchy
// (the grid is baked in Node), so there is nothing for it to draw here.
import * as THREE from "three";
import { NO_FLOOR } from "./walkgrid.js";

export const VIZ = Object.freeze({ radius: 5, lift: 0.03, redraw: 0.5 });

/**
 * The cells of `g` within `radius` of (x, z) as points: positions and colours. Kept apart from the drawing so that it can
 * be tested without a renderer.
 * @param {any} g a decoded grid @param {number} x @param {number} z
 */
export function cellsNear(g, x, z, radius = VIZ.radius, lift = VIZ.lift) {
  const R = Math.ceil(radius / g.step), ci = Math.floor((x - g.x0) / g.step), cj = Math.floor((z - g.z0) / g.step), pos = [], col = []; let open = 0, shut = 0;
  for (let j = Math.max(0, cj - R); j <= Math.min(g.nz - 1, cj + R); j++) for (let i = Math.max(0, ci - R); i <= Math.min(g.nx - 1, ci + R); i++) {
    if ((i - ci) ** 2 + (j - cj) ** 2 > R * R) continue;
    const k = j * g.nx + i, h = g.height[k]; if (h === NO_FLOOR) continue;
    pos.push(g.x0 + (i + 0.5) * g.step, h / 100 + g.base + lift, g.z0 + (j + 0.5) * g.step);
    if (g.state[k]) { col.push(0.95, 0.2, 0.15); shut++; } else { col.push(0.2, 0.9, 0.35); open++; }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col), open, shut };
}

/** His outline as line segments: a ring at each bin's height, `reach` above the knee and `low` (shoes and hem) below it. @param {{ bin: number, reach: number[], low: number[] }} outline */
export function outlineRings(outline, knee = 0.25, sides = 28) {
  const pos = [], col = [];
  for (let n = 0; n < outline.reach.length; n++) {
    const y = (n + 0.5) * outline.bin, below = y < knee, r = below ? outline.low[n] : outline.reach[n]; if (!(r > 0)) continue;
    for (let s = 0; s < sides; s++) {
      const a = (s / sides) * Math.PI * 2, b = ((s + 1) / sides) * Math.PI * 2;
      pos.push(Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(b) * r, y, Math.sin(b) * r);
      const c = below ? [0.35, 0.6, 1] : [1, 1, 1]; col.push(...c, ...c);
    }
  }
  return { positions: new Float32Array(pos), colors: new Float32Array(col) };
}

/**
 * @param {{ scene: THREE.Scene, walker: any, bake: { EYE: number, EYE_R: number, CLIMB: number } | null, outline: { bin: number, reach: number[], low: number[] } | null }} o
 */
export function createWalkViz({ scene, walker, bake, outline }) {
  const group = new THREE.Group(); group.name = "walkviz"; group.userData.walk = false; scene.add(group);
  const floor = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ size: 0.045, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
  floor.frustumCulled = false; group.add(floor);
  const line = (data) => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(data.positions, 3)); g.setAttribute("color", new THREE.BufferAttribute(data.colors, 3)); const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false, transparent: true, fog: false })); l.renderOrder = 999; l.frustumCulled = false; return l; };
  const body = outline ? line(outlineRings(outline, bake?.CLIMB ?? 0.25)) : null; if (body) group.add(body);
  const R = bake?.EYE_R ?? 0.24, EYE = bake?.EYE ?? 1.3;
  const eye = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(R, 14, 10)), new THREE.LineBasicMaterial({ color: 0xffd23a, depthTest: false, transparent: true, fog: false })); eye.renderOrder = 999; group.add(eye);
  let at = null, last = { grid: null, open: 0, shut: 0 };
  return {
    group,
    /** Each frame: where he stands (his centre and the floor under him). */
    update(/** @type {number} */ x, /** @type {number} */ y, /** @type {number} */ z) {
      if (body) body.position.set(x, y, z);
      eye.position.set(x, y + EYE, z);
      const g = walker.grid ? walker.grid() : null;
      if (at && at.g === g && Math.hypot(x - at.x, z - at.z) < VIZ.redraw) return;
      at = { g, x, z };
      const c = g ? cellsNear(g, x, z) : { positions: new Float32Array(0), colors: new Float32Array(0), open: 0, shut: 0 };
      floor.geometry.dispose(); floor.geometry = new THREE.BufferGeometry();
      floor.geometry.setAttribute("position", new THREE.BufferAttribute(c.positions, 3)); floor.geometry.setAttribute("color", new THREE.BufferAttribute(c.colors, 3));
      last = { grid: g ? g.id : null, open: c.open, shut: c.shut };
    },
    state: () => ({ on: true, ...last, outline: !!body, eyeR: R, objects: group.children.length }),
    dispose() { scene.remove(group); group.traverse((/** @type {any} */ o) => { o.geometry?.dispose(); o.material?.dispose(); }); },
  };
}
