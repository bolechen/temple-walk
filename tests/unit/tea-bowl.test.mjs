// His tea bowl is solid from every side (#163, the owner's 2026-11-20 note: "茶杯底是空的"). What is held: from every
// direction round it, below it as he tilts it at his lips too, the first thing a line of sight meets on the bowl is a
// face turned toward it (a back face first would be a hole: the material draws one side only); the tea lies inside
// the bowl, below its rim, and stays so however far the bowl is tilted; and it can be seen from above.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { teaBowl, BOWL, TEA } = await import("../../app/src/rites.js");

const M = { glaze: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), tea: new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }) };
const cup = teaBowl(M), [bowl, tea] = cup.children;
const rimY = Math.max(...BOWL.map(([, y]) => y));
// the outer surface's radius at a height (the profile from the foot to the rim's outer edge)
const outer = (y) => { const o = BOWL.slice(1, 5); for (let i = 0; i + 1 < o.length; i++) { const [r0, y0] = o[i], [r1, y1] = o[i + 1]; if (y >= y0 && y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0); } return 0; };
// the inner wall's radius at a height (from the rim's inner edge down to the well)
const inner = (y) => { const [[r0, y0], [r1, y1]] = [BOWL[5], BOWL[6]]; return r1 + ((r0 - r1) * (y - y1)) / (y0 - y1); };

/** Lines of sight from every direction on a sphere round the bowl, aimed at points spread over it: the first face met on the bowl, and whether it faces the eye. */
function looks(tilt) {
  cup.rotation.set(-tilt, 0, 0); cup.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(cup), mid = box.getCenter(new THREE.Vector3()), ray = new THREE.Raycaster(), eye = new THREE.Vector3(), aim = new THREE.Vector3(), n = new THREE.Vector3();
  let seen = 0, back = 0, teaSeen = 0; const holes = [];
  for (let k = 0; k < 600; k++) {
    // a Fibonacci sphere of eyes, each aimed at a point jittered within the bowl's box
    const y = 1 - (2 * (k + 0.5)) / 600, r = Math.sqrt(1 - y * y), phi = k * Math.PI * (3 - Math.sqrt(5));
    eye.set(Math.cos(phi) * r, y, Math.sin(phi) * r).multiplyScalar(0.4).add(mid);
    aim.set(box.min.x + (box.max.x - box.min.x) * ((k * 0.618) % 1), box.min.y + (box.max.y - box.min.y) * ((k * 0.382) % 1), box.min.z + (box.max.z - box.min.z) * ((k * 0.786) % 1));
    ray.set(eye, aim.sub(eye).normalize());
    const hit = ray.intersectObject(cup, true)[0]; if (!hit) continue;
    seen++; if (hit.object === tea) teaSeen++;
    // the face's own way, from its winding (the side three draws), in the world
    n.copy(hit.face.normal).transformDirection(hit.object.matrixWorld);
    if (n.dot(ray.ray.direction) > 0) { back++; if (holes.length < 3) holes.push({ from: eye.clone().sub(mid).normalize().toArray().map((v) => +v.toFixed(2)), on: hit.object === tea ? "tea" : "bowl" }); }
  }
  return { seen, back, teaSeen, holes };
}

test("the bowl is solid from every side, upright and tilted as he drinks (to 0.78): no line of sight meets a back face first", () => {
  for (const tilt of [0, 0.5, 0.78]) {
    const { seen, back, holes } = looks(tilt);
    assert.ok(seen > 300, `tilted ${tilt}: only ${seen} of 600 lines of sight met the bowl`);
    assert.equal(back, 0, `tilted ${tilt}: ${back} lines of sight met a back face first (a hole), e.g. ${JSON.stringify(holes)}`);
  }
});

test("seen from straight below, the foot and the hollow under it are faces turned down", () => {
  cup.rotation.set(0, 0, 0); cup.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), n = new THREE.Vector3();
  for (const x of [0, 0.01, 0.02, 0.028, 0.033, 0.05, 0.07]) {
    ray.set(new THREE.Vector3(x, -0.5, 0.001), new THREE.Vector3(0, 1, 0));
    const hit = ray.intersectObject(bowl)[0]; assert.ok(hit, `nothing under the bowl at ${x} m from its axis`);
    n.copy(hit.face.normal).transformDirection(bowl.matrixWorld);
    assert.ok(n.y < -0.2, `at ${x} m from the axis the face seen from below is turned ${n.y.toFixed(2)} up`);
  }
});

test("the tea lies inside the bowl, below its rim, however far it is tilted, and is seen from above", () => {
  const p = tea.geometry.attributes.position, v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); const r = Math.hypot(v.x, v.z); assert.ok(v.y < rimY && r <= inner(v.y) + 1e-6 && r < outer(v.y), `a point of the tea at ${r.toFixed(4)} m, ${v.y.toFixed(3)} m up is not inside the bowl`); }
  assert.ok(TEA.y < rimY - 0.01, "the tea lies a centimetre or more below the rim");
  // carried with the bowl: tilted to the drink's full 0.78, each of its points is still inside the bowl's own shape
  cup.rotation.set(-0.78, 0, 0); cup.updateMatrixWorld(true);
  const inv = bowl.matrixWorld.clone().invert();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(tea.matrixWorld).applyMatrix4(inv); assert.ok(v.y < rimY && Math.hypot(v.x, v.z) <= inner(v.y) + 1e-6, "tilted, the tea passes out of the bowl"); }
  const { teaSeen } = (() => { cup.rotation.set(0, 0, 0); cup.updateMatrixWorld(true); const ray = new THREE.Raycaster(); let teaSeen = 0; for (const [x, z] of [[0, 0], [0.02, 0], [0, -0.03], [-0.04, 0.01]]) { ray.set(new THREE.Vector3(x, 0.4, z), new THREE.Vector3(0, -1, 0)); if (ray.intersectObject(cup, true)[0]?.object === tea) teaSeen++; } return { teaSeen }; })();
  assert.equal(teaSeen, 4, "looking down into the bowl, the tea is what is seen");
});
