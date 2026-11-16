// One weight for one point of the sculpted body (issue #80, route A, a trial).
//
// tools/novice.mjs weighs every vertex copy on its own. Where the texture has a seam, or where one part of him meets
// another, two or three copies sit at the same point; each took the weights of its own part's nearest neighbours on the
// figure built in code, so they need not agree, and when the bones move the copies part and the cloth opens at the seam.
// `weldWeights` gathers the copies that lie within `eps` of each other and gives them all the same weights: the mean of
// theirs, cut to the four largest and made whole again. With `smooth` > 0 it then averages each point's weights with its
// neighbours' along the surface (the welded surface, so across seams), that many times, half and half.
//
// Nothing here is run when the page is built: tools/novice.mjs calls it only with NOVICE_WELD=1, and
// tools/novice-weld-trial.mjs measures it on the shipped novice.glb without writing anything.

/**
 * @param {Float32Array|number[]} P positions, xyz per vertex
 * @param {ArrayLike<number>} J joints, four per vertex
 * @param {ArrayLike<number>} W weights, four per vertex
 * @param {{ eps?: number, smooth?: number, index?: ArrayLike<number> }} [o] `index`: triangles, needed for `smooth`
 * @returns {{ J: Uint16Array, W: Float32Array, group: Int32Array, groups: number }} new joints and weights, and for each
 *   vertex the number of its group of coincident copies
 */
export function weldWeights(P, J, W, { eps = 1e-5, smooth = 0, index = null } = {}) {
  const n = P.length / 3, cell = new Map(), group = new Int32Array(n).fill(-1);
  const key = (x, y, z) => `${x},${y},${z}`;
  let groups = 0;
  for (let i = 0; i < n; i++) {
    const cx = Math.round(P[i * 3] / eps), cy = Math.round(P[i * 3 + 1] / eps), cz = Math.round(P[i * 3 + 2] / eps);
    // a copy within eps lies in this cell or one beside it
    search: for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      const list = cell.get(key(cx + dx, cy + dy, cz + dz)); if (!list) continue;
      for (const j of list) if (Math.hypot(P[i * 3] - P[j * 3], P[i * 3 + 1] - P[j * 3 + 1], P[i * 3 + 2] - P[j * 3 + 2]) < eps) { group[i] = group[j]; break search; }
    }
    if (group[i] < 0) group[i] = groups++;
    const k = key(cx, cy, cz); if (!cell.has(k)) cell.set(k, []); cell.get(k).push(i);
  }
  // one weight map per group: the mean of its copies'
  let maps = Array.from({ length: groups }, () => new Map()), count = new Uint32Array(groups);
  for (let i = 0; i < n; i++) { const g = group[i], m = maps[g]; count[g]++; for (let k = 0; k < 4; k++) { const w = W[i * 4 + k]; if (w > 0) m.set(J[i * 4 + k], (m.get(J[i * 4 + k]) || 0) + w); } }
  maps.forEach((m, g) => { for (const [b, w] of m) m.set(b, w / count[g]); });
  if (smooth > 0) {
    if (!index) throw new Error("smoothing needs the triangles");
    const nbr = Array.from({ length: groups }, () => new Set());
    for (let t = 0; t < index.length; t += 3) for (let k = 0; k < 3; k++) { const a = group[index[t + k]], b = group[index[t + (k + 1) % 3]]; if (a !== b) { nbr[a].add(b); nbr[b].add(a); } }
    for (let pass = 0; pass < smooth; pass++) {
      maps = maps.map((m, g) => {
        if (!nbr[g].size) return m;
        const out = new Map(); for (const [b, w] of m) out.set(b, 0.5 * w);
        const share = 0.5 / nbr[g].size; for (const h of nbr[g]) for (const [b, w] of maps[h]) out.set(b, (out.get(b) || 0) + share * w);
        return out;
      });
    }
  }
  const J2 = new Uint16Array(n * 4), W2 = new Float32Array(n * 4);
  const packed = maps.map((m) => { const top = [...m].sort((a, b) => b[1] - a[1]).slice(0, 4), s = top.reduce((a, [, w]) => a + w, 0) || 1; return top.map(([b, w]) => [b, w / s]); });
  for (let i = 0; i < n; i++) packed[group[i]].forEach(([b, w], k) => { J2[i * 4 + k] = b; W2[i * 4 + k] = w; });
  return { J: J2, W: W2, group, groups };
}
