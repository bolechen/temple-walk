// The weights a sculpted or generated body takes from the novice built in code (monk.js), shared by the tools that make
// such a body: tools/novice-tripo.mjs (issue #246) uses these; tools/novice.mjs still carries its own copy of the same
// two steps (its 4 and 4a), so that the novice.glb that ships stays byte for byte what it was until it is rebuilt from
// the Meshy original and compared.
//
// `transferWeights`: each vertex takes the weights of the K nearest vertices of the same part on the figure built in code,
// which is the same height and is bound in the same A-pose, so the skirt bones, the sleeves and the legs keep the weights
// they were tuned with. `armWeights`: on the arm, skin and sleeve take their weights from how far along the arm they lie
// instead (upper arm, then forearm across the elbow, then hand across the wrist), because a body whose arms are held a
// little wider than the built figure's finds that figure's upper arm or hand nearest to its forearm (issue #80, 4a).
import * as THREE from "three";

const K = 4;

/**
 * @param {Float32Array} P positions, on him, in his bind pose
 * @param {Set<number>[]} vparts for each vertex, the part(s) it belongs to (indices into `parts`)
 * @param {*} monk createMonk(), updated in its bind pose
 * @param {string[]} parts the part names, e.g. ["skin", "robe", "legs", "shoes"]
 */
export function transferWeights(P, vparts, monk, parts) {
  const ref = parts.map((n) => { const g = monk.parts[n].geometry; return { p: g.attributes.position.array, si: g.attributes.skinIndex.array, sw: g.attributes.skinWeight.array, n: g.attributes.position.count }; });
  const nv = P.length / 3;
  // a grid over each part of the built figure, so a body of thirty thousand vertices is weighed in seconds
  const CELL = 0.05, grids = ref.map((R) => { const g = new Map(); for (let i = 0; i < R.n; i++) { const k = `${Math.floor(R.p[i * 3] / CELL)},${Math.floor(R.p[i * 3 + 1] / CELL)},${Math.floor(R.p[i * 3 + 2] / CELL)}`; if (!g.has(k)) g.set(k, []); g.get(k).push(i); } return g; });
  function weightsFor(x, y, z, part) {
    const R = ref[part], G = grids[part], best = [], c = [x, y, z].map((v) => Math.floor(v / CELL));
    for (let ring = 1; ring <= 8; ring++) {
      best.length = 0;
      for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) for (let dz = -ring; dz <= ring; dz++) for (const i of G.get(`${c[0] + dx},${c[1] + dy},${c[2] + dz}`) || []) {
        if (Math.abs(x) > 0.02 && R.p[i * 3] * x < -0.004) continue;   // an inner thigh never takes the other leg's weights
        const d = (R.p[i * 3] - x) ** 2 + (R.p[i * 3 + 1] - y) ** 2 + (R.p[i * 3 + 2] - z) ** 2;
        if (best.length < K || d < best[best.length - 1][0]) { best.push([d, i]); best.sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (best.length > K) best.pop(); }
      }
      // only trust the ring once the K-th nearest lies within it
      if (best.length === K && Math.sqrt(best[K - 1][0]) <= ring * CELL) break;
    }
    const w = new Map();
    for (const [d, i] of best) { const k = 1 / (d + 1e-5); for (let j = 0; j < 4; j++) { const bw = R.sw[i * 4 + j]; if (bw > 0) w.set(R.si[i * 4 + j], (w.get(R.si[i * 4 + j]) || 0) + k * bw); } }
    return w;
  }
  const J = new Uint16Array(nv * 4), W = new Float32Array(nv * 4);
  for (let i = 0; i < nv; i++) {
    const total = new Map();
    for (const part of vparts[i]) { const w = weightsFor(P[i * 3], P[i * 3 + 1], P[i * 3 + 2], part); let s = 0; for (const v of w.values()) s += v; for (const [b, v] of w) total.set(b, (total.get(b) || 0) + v / s); }
    const top = [...total].sort((a, b) => b[1] - a[1] || a[0] - b[0]).slice(0, 4), s = top.reduce((a, [, v]) => a + v, 0);
    top.forEach(([b, v], k) => { J[i * 4 + k] = b; W[i * 4 + k] = v / s; });
  }
  return { J, W };
}

/**
 * Skin and sleeve on the arm take their weights from how far along the arm they lie (tools/novice.mjs, step 4a).
 * Parts are numbered skin 0, robe 1, legs 2, shoes 3. Changes J and W in place; returns how many vertices it weighed.
 */
export function armWeights(P, vparts, J, W, monk) {
  const names = monk.skeleton.bones.map((b) => b.name), nv = P.length / 3;
  const at = (n) => monk.bones[n].getWorldPosition(new THREE.Vector3());
  const ramp = (v, a, b) => { const t = Math.min(1, Math.max(0, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  let n = 0;
  for (const side of ["left", "right"]) {
    const sh = at(side + "UpperArm"), el = at(side + "LowerArm"), wr = at(side + "Hand");
    const upper = sh.distanceTo(el), fore = el.distanceTo(wr), idx = ["UpperArm", "LowerArm", "Hand"].map((b) => names.indexOf(side + b));
    const on = (i) => (side === "left") === (P[i * 3] > 0);
    const hand = new THREE.Vector3(); let hn = 0;
    for (let i = 0; i < nv; i++) if (on(i) && vparts[i].has(0) && Math.abs(P[i * 3]) > Math.abs(wr.x) && P[i * 3 + 1] < 0.7) { hand.x += P[i * 3]; hand.y += P[i * 3 + 1]; hand.z += P[i * 3 + 2]; hn++; }
    if (!hn) continue;
    hand.divideScalar(hn); const dir = hand.clone().sub(sh).normalize(), p = new THREE.Vector3();
    for (let i = 0; i < nv; i++) {
      if (!on(i) || !(vparts[i].has(0) || vparts[i].has(1)) || vparts[i].has(2) || vparts[i].has(3)) continue;
      p.set(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]).sub(sh);
      const r = p.length(), t = p.dot(dir), d = p.clone().sub(dir.clone().multiplyScalar(t)).length();
      const k = ramp(t, 0.08, 0.14) * (1 - ramp(d, 0.07, 0.1)); if (k <= 0) continue;
      const toFore = ramp(r, upper - 0.03, upper + 0.03), toHand = ramp(r, upper + fore - 0.03, upper + fore + 0.02);
      const along = [1 - toFore, toFore * (1 - toHand), toHand], m = new Map();
      for (let j = 0; j < 4; j++) if (W[i * 4 + j] > 0) m.set(J[i * 4 + j], (m.get(J[i * 4 + j]) || 0) + (1 - k) * W[i * 4 + j]);
      along.forEach((w, j) => m.set(idx[j], (m.get(idx[j]) || 0) + k * w));
      const top = [...m].sort((x, y) => y[1] - x[1] || x[0] - y[0]).slice(0, 4), s = top.reduce((a, [, w]) => a + w, 0);
      for (let j = 0; j < 4; j++) { J[i * 4 + j] = top[j] ? top[j][0] : 0; W[i * 4 + j] = top[j] ? top[j][1] / s : 0; }
      n++;
    }
  }
  return n;
}
