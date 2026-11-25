// The monument's stele has a head (#573, the structure review's second batch, question 2): the Yingzao Fashi's proportions for the shaft and the head
// (chapter 3, 造赑屃鳌坐碑之制), no tortoise. Kept in a file of its own beside t05-axis.test.mjs, which the pavilion's move also adds to.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
const T05 = await import("../../app/levels/t05/site.js");
const AX = await import("../../app/levels/t05/axis.js");
const { buildSite } = T05, { MONUMENT } = AX;
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M);
const near = (a, b, tol = 0.03) => Math.abs(a - b) <= tol;

test("the monument's stele has a head: the Yingzao Fashi's proportions (chapter 3, 造赑屃鳌坐碑之制) for the shaft and the head, a head wider and thicker than the shaft, a cloud plate under it, and no tortoise", () => {
  const M0 = MONUMENT, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2, S = AX.STELE, floor = M0.y + AX.MONUMENT_FORM.base + 0.45;
  // The shaft: 0.4 wide and 0.15 thick to every unit of its length (原文), the head 0.44 square-wide and 0.18 thick (原文), its cloud plate 0.15 of the shaft's width high (原文).
  assert.ok(near(S.w / S.L, 0.4, 1e-6) && near(S.t / S.L, 0.15, 1e-6), "the shaft is 4/10 wide and 1.5/10 thick of its length");
  assert.ok(near(S.headW / S.L, 0.44, 1e-6) && near(S.headT / S.L, 0.18, 1e-6) && near(S.cloud, 0.15 * S.w, 1e-6), "the head 0.44 and 0.18 of the shaft's length; the cloud plate 0.15 of its width");
  assert.ok(S.headW > S.w && S.headT > S.t, "the head is wider and thicker than the shaft");
  // Drawn so: a line at the head's height across its middle meets the head's full width; at the shaft's height, only the shaft's.
  site.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(), widthAt = (y) => {
    const along = (dx) => { ray.set(new THREE.Vector3(mx + dx * 3, y, mz), new THREE.Vector3(-dx, 0, 0)); const h = ray.intersectObject(site.root, true).find((q) => Math.abs(q.point.z - mz) < 1e-6 && Math.abs(q.point.x - mx) < 1.2); return h ? Math.abs(h.point.x - mx) : 0; };
    return along(1) + along(-1);
  };
  assert.ok(near(widthAt(floor + S.L / 2), S.w, 0.01), `the shaft's width ${widthAt(floor + S.L / 2)}`);
  assert.ok(near(widthAt(floor + S.L + S.cloud + 0.1), S.headW, 0.02), `the head's width ${widthAt(floor + S.L + S.cloud + 0.1)}`);
  // It stands clear under the ceiling plate, and nothing of it is a tortoise: the plinth stays the one plain block (the owner's lead: no turtle).
  assert.ok(floor + S.L + S.headH < M0.y + AX.MONUMENT_FORM.base + AX.MONUMENT_FORM.column + 0.3 + AX.MONUMENT_FORM.beam - 0.1, "the head clears the ceiling plate");
});

test("the stele, shaft and head, is one piece of stone with no courses: it takes the stele monolith's material, and the coursed stone stops at the plinth", () => {
  const M0 = MONUMENT, S = AX.STELE, floor = M0.y + AX.MONUMENT_FORM.base + 0.45, mx = (M0.x0 + M0.x1) / 2;
  site.root.updateMatrixWorld(true);
  const meshes = []; site.root.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); meshes.push({ m: o.material, b: o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld) }); } });
  const inPavilion = (b) => b.min.x >= M0.x0 - 0.01 && b.max.x <= M0.x1 + 0.01 && b.max.z <= M0.z1 + 0.01 && b.min.z >= M0.z0 - 0.01;
  const stele = meshes.filter((q) => q.m === M.steleMono && inPavilion(q.b) && Math.abs((q.b.min.x + q.b.max.x) / 2 - mx) < 0.01);
  assert.equal(stele.length, 1, "one stele-monolith mesh stands in the pavilion");
  assert.ok(near(stele[0].b.max.x - stele[0].b.min.x, S.headW, 0.01) && near(stele[0].b.max.y, floor + S.L + S.headH, 0.01), "it is the shaft with its head, whole");
  // The coursed stone round the stele (the base, the plinth) rises no higher than the plinth's top.
  for (const q of meshes) if (q.m === M.stone && inPavilion(q.b)) assert.ok(q.b.max.y <= floor + 0.01, `the coursed stone in the pavilion stops at the plinth (${q.b.max.y.toFixed(2)})`);
});
