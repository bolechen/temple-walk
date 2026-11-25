// The great hall's gongyan boards (#602, issue #573's structure review, second batch, question 7): between the bracket sets, from
// the cap board up to the roof's underside, the wall is a thin board. A line of sight from outside, at any height of that band,
// along the wall's four faces and from a few eye heights, must meet something at or before the board's own plane: nothing may
// let the sky (or the dark roof space) show through between two sets.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const { buildHall, HALL, BOARD, XS, ZS } = await import("../../app/levels/t05/hall.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })) : (t[k] ||= new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))) });

test("no line of sight passes between two bracket sets through the gongyan band, on any of the hall's four faces", () => {
  const h = buildHall(M), root = new THREE.Group(), mat = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  // (the hall's parts are lists of geometry; site.js merges and draws them: here every one is a mesh, the shell's own and the walls', as it is drawn)
  for (const list of Object.values(h.parts)) if (Array.isArray(list)) for (const g of list) if (g.isBufferGeometry) root.add(new THREE.Mesh(g, mat));
  root.updateMatrixWorld(true);
  const EX = XS[XS.length - 1] + HALL.overhang, ef = ZS[0] + HALL.overhang, eb = ZS[ZS.length - 1] - HALL.out - 0 + 0 - (HALL.overhang - HALL.out);
  const zB = ZS[ZS.length - 1], X = XS[XS.length - 1], slope = (HALL.ridge - HALL.eave) / ((ef - (zB - HALL.overhang)) / 2);
  const underAt = (x, z) => Math.min(HALL.ridge, HALL.eave + slope * Math.min(ef - z, z - (zB - HALL.overhang), EX - Math.abs(x))) - HALL.roof;
  const cap = HALL.floor + HALL.column + 0.2 - 0 + 0;
  const sides = [[true, ZS[0], 1, XS, HALL.front], [true, zB, -1, XS, HALL.out], [false, XS[0], -1, ZS, HALL.out], [false, X, 1, ZS, HALL.out]];
  const ray = new THREE.Raycaster(), gaps = [];
  let n = 0;
  for (const [ax, at, out, pos, off] of sides) {
    const bLine = at + out * (off - BOARD.back), a = Math.min(pos[0], pos[pos.length - 1]), b = Math.max(pos[0], pos[pos.length - 1]);
    for (let u = a + 0.1; u < b; u += 0.35) {
      const top = ax ? underAt(u, bLine) : underAt(bLine, u);   // the roof's underside over this very point (lower over a hipped corner)
      for (let y = cap + 0.05; y < top - 0.02; y += 0.3) for (const [dist, eye, slide] of [[6, HALL.floor + 1.7, 0], [14, 1.7, 0], [10, 9, 0], [12, HALL.floor + 1.7, 10], [12, 1.7, -10], [20, 6, 18], [20, 6, -18]]) {
        const p = ax ? new THREE.Vector3(u, y, bLine) : new THREE.Vector3(bLine, y, u), o = ax ? new THREE.Vector3(u + slide, eye, bLine + out * dist) : new THREE.Vector3(bLine + out * dist, eye, u + slide);
        ray.set(o, p.clone().sub(o).normalize()); n++;
        const hit = ray.intersectObject(root, true)[0], depth = hit ? ax ? -(hit.point.z - bLine) * out : -(hit.point.x - bLine) * out : Infinity;   // how far past the board's plane (inward) the first thing is
        if (!hit || depth > 0.05) gaps.push(`${ax ? (out > 0 ? "front" : "back") : out > 0 ? "east" : "west"} u=${u.toFixed(2)} y=${y.toFixed(2)} eye=${eye} slide=${slide}: ${hit ? `first hit ${depth.toFixed(2)} m behind the board's plane` : "no hit"}`);
      }
    }
  }
  assert.ok(n > 5000, `${n} lines tried`);
  assert.deepEqual(gaps.slice(0, 8), [], `${gaps.length} of ${n} lines pass the gongyan band`);
});
