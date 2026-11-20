// Every name board is read from where a visitor may stand, and nothing stands on its writing (#213). The great hall's
// 「正法眼藏」 hung so that the bracket arms under the eaves came between it and an eye that looked up from the court, and a black
// block lay over two of its characters. For every board on the plan, each of its characters is sampled at 3 × 3 points, and from
// every walkable place in the court it faces, at a standing eye and at the eye that follows him, a ray goes to each point: where
// the writing is seen from the front, the first thing it meets must be the board itself.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { buildSite, createWalker } from "../../app/src/site.js";
import { followEye } from "../../app/src/eye.js";
import { airy } from "../../tools/walk/bake.mjs";

const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
const site = buildSite(M), walker = createWalker(site);
site.root.updateMatrixWorld(true);

// Every board: the object makePlaque marked, the mesh that carries its face, and its face in the world.
const boards = [];
site.root.traverse((o) => {
  const pq = o.userData.plaque; if (!pq) return;
  const face = o.isMesh ? o : o.children[0], m = face.matrixWorld;
  const centre = new THREE.Vector3(0, 0, pq.z).applyMatrix4(m), normal = new THREE.Vector3(0, 0, 1).transformDirection(m);
  boards.push({ o, face, pq, centre, normal, name: pq.text });
});

// One bounding hierarchy over everything drawn that is solid, each triangle remembering what it came from.
const pos = [], owner = [], labels = [], v = new THREE.Vector3();
const label = (o) => { const m = Array.isArray(o.material) ? o.material[0] : o.material; let p = o, trail = []; while (p && trail.length < 3) { if (p.name) trail.push(p.name); p = p.parent; } return `${m?.name || m?.type}${trail.length ? " in " + trail.join("/") : ""}`; };
site.root.traverse((o) => {
  if (!o.isMesh || !o.visible || o.isInstancedMesh) return;
  const m = Array.isArray(o.material) ? o.material[0] : o.material; if (!o.userData.ground && airy(m)) return;
  const mine = boards.findIndex((b) => b.o === o || b.o === o.parent), tag = mine >= 0 ? "board:" + mine : String(labels.push(label(o)) - 1);
  const p = o.geometry.attributes.position, idx = o.geometry.index, n = idx ? idx.count : p.count;
  for (let i = 0; i + 2 < n; i += 3) { for (let k = 0; k < 3; k++) { v.fromBufferAttribute(p, idx ? idx.getX(i + k) : i + k).applyMatrix4(o.matrixWorld); pos.push(v.x, v.y, v.z); } owner.push(tag); }
});
const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(Float32Array.from(pos), 3));
const hitDist = new Map(), bvh = new MeshBVH(geo), ray = new THREE.Ray(), NEAR = 0.6;   // metres from the writing within which what is met counts as lying on it (arms, beaks, beams hung or standing at the board; not the eave edge or the next building, which only stand in the way)

function sweep(b) {
  const bad = new Map(); let seen = 0, tried = 0;
  const { w, h, chars } = b.pq, to = new THREE.Vector3(), eye = new THREE.Vector3(), dir = new THREE.Vector3();
  const points = [];
  chars.forEach((c, ci) => { for (const du of [-1, 0, 1]) for (const dv of [-1, 0, 1]) points.push({ ci, p: new THREE.Vector3((c.u + du * c.du * 0.8 - 0.5) * w, (0.5 - (c.v + dv * c.dv * 0.8)) * h, b.pq.z + 0.002).applyMatrix4(b.face.matrixWorld) }); });
    const hx = b.normal.x, hz = b.normal.z, hl = Math.hypot(hx, hz) || 1;
  const ground = walker.heightAt(b.centre.x + (hx / hl) * 2.5, b.centre.z + (hz / hl) * 2.5);   // the ground in front of it: the court it faces
  for (let x = b.centre.x - 20; x <= b.centre.x + 20; x += 0.5) for (let z = b.centre.z - 20; z <= b.centre.z + 20; z += 0.5) {
    const dx = x - b.centre.x, dz = z - b.centre.z, d = Math.hypot(dx, dz);
    if (d < 2 || d > 16 || (dx * hx + dz * hz) / (d * hl) < Math.cos(Math.PI / 15)) continue;   // in front of it, within 12° of straight on
    if (walker.blocked(x, z)) continue;
    const foot = walker.heightAt(x, z); if (Math.abs(foot - ground) > 2.6 || foot > b.centre.y - 0.8) continue;   // in its court (the building's own floor and a stair's rise below it), with the board above the eye
    const yaw = Math.atan2(-dx, dz), pitch = Math.atan2(b.centre.y - foot - 1.2, d);
    const third = followEye(walker, { x, z, foot, eyeY: foot, yaw, pitch, side: 1.2, reach: 6.2 });
    // (the eye from behind him as the page has it: never under the floor, where createFollow puts it back up)
    const back = third.at(third.d); back[1] = Math.max(back[1], third.floorAt(third.d));
    for (const e of [eye.set(x, walker.eyeAt(x, z), z).clone(), new THREE.Vector3(...back)]) {
      for (const { ci, p } of points) {
        dir.copy(p).sub(e); const len = dir.length(); dir.divideScalar(len);
        if (dir.dot(b.normal) > -0.1) continue;   // only where its front is seen
        tried++; ray.set(e, dir); const hit = bvh.raycastFirst(ray, THREE.DoubleSide, 0, len + 0.01);
        if (!hit || hit.distance > len - 0.02) { seen++; continue; }
        // Something a long way in front of the board (the next building, a stele, a tea table) is only in the way, as anything is; the writing is covered by what hangs or stands at the board itself (a bracket arm, a beak, a beam).
        if (len - hit.distance > NEAR) { seen++; continue; }
        const who = owner[hit.faceIndex];
        if (who === "board:" + boards.indexOf(b)) { seen++; continue; }
        const key = `${b.name} 「${[...b.name][ci]}」 ← ${who.startsWith("board:") ? "another board" : labels[+who]}`, rec = bad.get(key) || { n: 0, at: e.toArray().map((q) => +q.toFixed(1)), hit: hit.point.toArray().map((q) => +q.toFixed(2)) };
        rec.n++; bad.set(key, rec); hitDist.set(key, `${(len - hit.distance).toFixed(2)} m in front of the point`);
      }
    }
  }
  return { bad, seen, tried };
}

test("the plan has its name boards, each with its characters laid out", () => {
  assert.ok(boards.length >= 18, `only ${boards.length} boards marked`);
  for (const b of boards) assert.ok(b.pq.chars.length === [...b.pq.text].length && b.pq.w > 0 && b.pq.h > 0, `${b.name}: no layout`);
});

test("nothing stands on any board's writing, from anywhere in its court", () => {
  const report = [];
  const unseen = [];
  for (const b of boards) { const r = sweep(b); if (!r.tried) unseen.push(b.name); for (const [k, rec] of r.bad) report.push(`${k}: ${rec.n} rays, first from ${rec.at}, met at ${rec.hit}, ${hitDist.get(k) ?? ""}`); }
  assert.equal(report.length, 0, `${report.length} characters have something in front of them:\n` + report.join("\n"));
  // (a board no walkable place looks at from the front within the court it faces has nothing to be tested from: the pavilions on the steep path)
  assert.ok(unseen.length <= 4, `${unseen.length} boards were seen from nowhere: ${unseen.join(" ")}`);
});
