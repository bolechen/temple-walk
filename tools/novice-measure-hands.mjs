// Issue #246, second round: measures the novice's hands on a body in novice.glb's format beside the figure built in code (docs/t00/refactor/novice-spike.md).
//   node tools/novice-measure-hands.mjs <body.glb> [...]
import "../tests/unit/dom-stub.mjs";
import * as THREE from "three";
const { createMonk } = await import("../app/src/monk.js");
const { readNovice } = await import("../tests/unit/novice-glb.mjs");
const m = createMonk(); m.update(1/30,0,"bind",0); m.group.updateMatrixWorld(true);
const names = m.skeleton.bones.map(b=>b.name);
function measure(geo, label) {
  const p = geo.attributes.position, si = geo.attributes.skinIndex, sw = geo.attributes.skinWeight;
  for (const side of ["left","right"]) {
    const hb = names.indexOf(side+"Hand"), wr = m.bones[side+"Hand"].getWorldPosition(new THREE.Vector3()), el = m.bones[side+"LowerArm"].getWorldPosition(new THREE.Vector3());
    const d = wr.clone().sub(el).normalize(), up = new THREE.Vector3(0,0,1), e = d.clone().cross(up).normalize();   // e: across the palm in the A-pose plane? d x z
    const pts = []; for (let i=0;i<p.count;i++){ let w=0; for(let k=0;k<4;k++) if(si.getComponent(i,k)===hb) w+=sw.getComponent(i,k); if (w>0.6) pts.push(new THREE.Vector3(p.getX(i),p.getY(i),p.getZ(i))); }
    if (!pts.length) { console.log(label, side, "no hand"); continue; }
    const rel = pts.map(q=>q.clone().sub(wr)), along = rel.map(r=>r.dot(d)), acr = rel.map(r=>r.dot(e)), thick = rel.map(r=>r.dot(up));
    const c = rel.reduce((a,r)=>a.add(r),new THREE.Vector3()).divideScalar(rel.length);
    const rng = (a)=>[Math.min(...a),Math.max(...a)];
    const [a0,a1]=rng(along), [b0,b1]=rng(acr), [t0,t1]=rng(thick);
    console.log(label.padEnd(10), side.padEnd(5), `n ${pts.length} | length past wrist ${(a1*100).toFixed(1)} cm (from ${(a0*100).toFixed(1)}) | width ${((b1-b0)*100).toFixed(1)} cm | thickness ${((t1-t0)*100).toFixed(1)} cm | centre from the hand bone: along ${(c.dot(d)*100).toFixed(1)}, across ${(c.dot(e)*100).toFixed(1)}, front ${(c.dot(up)*100).toFixed(1)} cm`);
  }
}
measure(m.parts.skin.geometry, "code");
for (const f of process.argv.slice(2)) measure(readNovice(f).geometries.skin, f.split("/").pop());
