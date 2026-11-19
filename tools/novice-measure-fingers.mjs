// Issue #246, second round: the fingers of a body in novice.glb's format beside the figure built in code: how far the fingertips spread and how far they lie from the palm.
//   node tools/novice-measure-fingers.mjs <body.glb> [...]
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../app/src/monk.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");
const m = createMonk(); m.update(1/30,0,"bind",0); m.group.updateMatrixWorld(true);
function fingers(g, label, side = "left") {
  const p = g.attributes.position, idx = g.index, wr = m.bones[side+"Hand"].getWorldPosition(new THREE.Vector3()), el = m.bones[side+"LowerArm"].getWorldPosition(new THREE.Vector3());
  const d = wr.clone().sub(el).normalize(), z = new THREE.Vector3(0,0,1), a = d.clone().cross(z).normalize(), v = new THREE.Vector3();
  const T = (i) => v.fromBufferAttribute(p, i).sub(wr).dot(d), near = (i) => v.fromBufferAttribute(p, i).sub(wr).clone().sub(d.clone().multiplyScalar(T(i))).length();
  const onHand = new Uint8Array(p.count); let L = 0; for (let i = 0; i < p.count; i++) { const t = T(i); if (t > -0.005 && t < 0.13 && near(i) < 0.08 && Math.sign(p.getX(i)) === (side === "left" ? 1 : -1)) { onHand[i] = 1; L = Math.max(L, t); } }
  // palm centre: hand points within the first 45% of the length
  const pc = new THREE.Vector3(); let n = 0; for (let i = 0; i < p.count; i++) if (onHand[i] && T(i) < 0.45 * L) { pc.add(v.fromBufferAttribute(p, i)); n++; } pc.divideScalar(n);
  // fingers: components of the hand beyond 55% of its length, joined through shared positions
  const tk = 0.55 * L, key = (i) => `${p.getX(i).toFixed(5)},${p.getY(i).toFixed(5)},${p.getZ(i).toFixed(5)}`, id = new Map(), par = []; const f = (x) => { while (par[x] !== x) x = par[x] = par[par[x]]; return x; };
  const node = (i) => { const k = key(i); if (!id.has(k)) { id.set(k, par.length); par.push(par.length); } return id.get(k); };
  for (let t = 0; t < idx.count; t += 3) { const c = [0,1,2].map((k) => idx.getX(t + k)); if (!c.every((i) => onHand[i] && T(i) > tk)) continue; const [x, y, w] = c.map(node); par[f(y)] = f(x); par[f(w)] = f(x); }
  const comps = new Map(); for (let i = 0; i < p.count; i++) if (onHand[i] && T(i) > tk && id.has(key(i))) { const r = f(id.get(key(i))); if (!comps.has(r)) comps.set(r, []); comps.get(r).push(i); }
  const tips = [...comps.values()].filter((c) => c.length > 8).map((c) => { let best = c[0]; for (const i of c) if (T(i) > T(best)) best = i; const tp = new THREE.Vector3().fromBufferAttribute(p, best); return { n: c.length, tip: tp, toPalm: tp.distanceTo(pc), across: tp.clone().sub(wr).dot(a), front: tp.clone().sub(wr).dot(z) }; });
  tips.sort((x, y) => x.across - y.across);
  const span = tips.length ? Math.max(...tips.map((t) => t.across)) - Math.min(...tips.map((t) => t.across)) : 0, spanZ = tips.length ? Math.max(...tips.map((t) => t.front)) - Math.min(...tips.map((t) => t.front)) : 0;
  console.log(label.padEnd(12), side, `length ${(L*100).toFixed(1)} cm, ${tips.length} fingers beyond the knuckles; fingertips to palm centre ${tips.map((t) => (t.toPalm*100).toFixed(1)).join(" / ")} cm; tips spread across ${(span*100).toFixed(1)} cm, front-back ${(spanZ*100).toFixed(1)} cm`);
}
fingers(m.parts.skin.geometry, "code");
for (const f of process.argv.slice(2)) fingers(readNovice(f).geometries.skin, f.split("/").pop());
