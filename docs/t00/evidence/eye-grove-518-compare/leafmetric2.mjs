// scratch, not committed: #518 art criteria from the recorded cameras, leaves alpha-tested by the card's own texture
// (drawn in a browser, leafalpha.cjs, averaged 4x4, opaque at 0.5). Only leaves nearer the eye than he is count as
// "in front": cover over the frame, how much of it lies outside the corners, samples inside his box widened 5%, and the
// first opaque thing on the lines to his head, waist and feet, the pool's middle and the stele.
import test from "node:test";
import fs from "node:fs";
import "/home/user/temple-walk/tests/unit/dom-stub.mjs";
const THREE = await import("/home/user/temple-walk/node_modules/three/build/three.module.js");
const { GROVE, terrain, APPROACH: A } = await import("/home/user/temple-walk/app/src/site.js");
const { createBamboo } = await import(process.env.BAMBOO);
const DIR = process.env.CMP_DIR, AL = JSON.parse(fs.readFileSync(new URL("./leafalpha.json", import.meta.url)));
const opaque = (h) => { if (!h.uv) return true; const u = Math.min(255, Math.max(0, Math.floor(h.uv.x * 256))), v = Math.min(255, Math.max(0, Math.floor((1 - h.uv.y) * 256))); return AL[v * 256 + u] >= 0.5; };
test("metrics", () => {
  const grow = (clear) => { const sc = new THREE.Scene(); createBamboo(sc, GROVE.areas, terrain, GROVE.keep, { fine: true, clear }); sc.updateMatrixWorld(true); return sc.children; };
  const CLEAR = (x, z) => x > 17 && x < 30 && z > 68 && z < 82 && [0, 1, 2, 3, 4, 5, 6, 7].some((k) => !GROVE.grows(x + Math.cos(k * Math.PI / 4) * 1.4, z + Math.sin(k * Math.PI / 4) * 1.4));
  const plain = grow(), cleared = grow(CLEAR), rc = new THREE.Raycaster(), out = {};
  const pool = [A.xB1 + 2.2, A.zMid], stele = [A.xB1 + 2.2 + 1.95, A.zMid];
  const first = (meshes, from, dir, far) => { rc.set(from, dir); rc.far = far; const hs = rc.intersectObjects(meshes, false); for (const h of hs) { if (h.object === meshes[1] && !opaque(h)) continue; return { what: h.object === meshes[1] ? "leaf" : "culm", d: h.distance }; } return null; };
  for (const tag of ["v060", "main", "new", "d08", "clear"]) {
    const f = `${DIR}/compare-${tag}.json`; if (!fs.existsSync(f)) continue;
    const meshes = tag === "clear" ? cleared : plain, res = JSON.parse(fs.readFileSync(f, "utf8"));
    for (const shot of ["pool-16x9", "pool-9x19.5"]) {
      const r = res[shot]; if (!r) continue;
      const [W, H] = shot === "pool-16x9" ? [1280, 720] : [390, 845], cam = new THREE.PerspectiveCamera(50, W / H, 0.05, 500);
      cam.position.set(...r.eye); cam.rotation.set(r.cameraPitch * Math.PI / 180, Math.atan2(-(r.at[0] - r.eye[0]), -(r.at[2] - r.eye[2])), 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
      const him = Math.hypot(r.at[0] - r.eye[0], r.at[2] - r.eye[2]);
      const box = [r.box[0] / W * 2 - 1, 1 - (r.box[1] + r.box[3]) / H * 2, (r.box[0] + r.box[2]) / W * 2 - 1, 1 - r.box[1] / H * 2], pad = [(box[2] - box[0]) * 0.05, (box[3] - box[1]) * 0.05];
      let n = 0, near = 0, notCorner = 0, inBox = 0; const NX = 64, NY = 36;
      for (let i = 0; i < NX; i++) for (let j = 0; j < NY; j++) {
        const ndc = new THREE.Vector2(-1 + (i + 0.5) * 2 / NX, -1 + (j + 0.5) * 2 / NY); rc.setFromCamera(ndc, cam); n++;
        const h = first(meshes, rc.ray.origin.clone(), rc.ray.direction.clone(), him / Math.cos(0) + 0.5);
        if (!h || h.what !== "leaf") continue;
        // nearer than he is along the line of sight (his horizontal distance, measured along the ray's own ground run)
        const run = h.d * Math.hypot(rc.ray.direction.x, rc.ray.direction.z); if (run > him) continue;
        near++; if (!(Math.abs(ndc.x) > 0.6 && Math.abs(ndc.y) > 0.6)) notCorner++;
        if (ndc.x > box[0] - pad[0] && ndc.x < box[2] + pad[0] && ndc.y > box[1] - pad[1] && ndc.y < box[3] + pad[1]) inBox++;
      }
      const line = (x, y, z) => { const t = new THREE.Vector3(x, y, z), d = t.clone().sub(cam.position), L = d.length(); const h = first(meshes, cam.position.clone(), d.normalize(), L - 0.05); return h ? h.what : "clear"; };
      const yb = r.at[1];
      out[`${tag} ${shot}`] = { nearLeafCover: +(near / n * 100).toFixed(1), nearLeafOutsideCorners: +(notCorner / n * 100).toFixed(1), nearLeafInBoxPlus5: +(inBox / n * 100).toFixed(1),
        toHead: line(r.at[0], yb + 1.15, r.at[2]), toWaist: line(r.at[0], yb + 0.6, r.at[2]), toFeet: line(r.at[0], yb + 0.05, r.at[2]), toPool: line(pool[0], yb + 0.05, pool[1]), toStele: line(stele[0], yb + 1.0, stele[1]) };
      console.log("METRIC", tag, shot, JSON.stringify(out[`${tag} ${shot}`]));
    }
  }
  fs.writeFileSync(`${DIR}/metrics.json`, JSON.stringify(out, null, 1));
});
