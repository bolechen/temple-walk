// The great hall's inside timber (app/levels/t05/timber.js, #762): the beams, purlins and frames within the walls wear T05's own
// wood, without the court's rain streaks (which read as rusted iron under the door's light) and darker, so that the beam over the
// seven's heads, lit face on by the door's spots, stays below their faces; the wall ring's timber, seen from the court under the
// eaves too, keeps the court's wood.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { readFileSync } from "node:fs";
const { HALL_TIMBER } = await import("../../app/levels/t05/timber.js");

const luma = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

test("the inside timber has no weathering and is darker and still warm against the court's wood", () => {
  const src = readFileSync(new URL("../../app/levels/t05/timber.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("procMat(key"));
  assert.ok(!/weather|damp/.test(body), "the shader carries the court's rain streaks or damp feet");
  assert.ok(luma(HALL_TIMBER.base) < 0.6 * luma([0.125, 0.07, 0.05]), `base luma ${luma(HALL_TIMBER.base).toFixed(4)}`);
  const [r, g, b] = HALL_TIMBER.base; assert.ok(r > g && g > b, "a warm brown");
});

test("site.js gives the inside's beams, purlins and frames the hall's timber and the wall ring the court's", () => {
  const src = readFileSync(new URL("../../app/levels/t05/site.js", import.meta.url), "utf8");
  assert.match(src, /ownRing\(hp\.wood, HT\.x, M\.woodX\)/);
  assert.match(src, /ownRing\(hp\.woodZ, HT\.z, M\.woodZ\)/);
  assert.match(src, /mesh\(merge\(hp\.frame\), HT\.z, shBeam\)/);
});

test("in the built hall, the hall's timber stands within the walls, but for the beams' ends that run out through them to the eave", async () => {
  const M = (await import("../../app/src/materials.js")).createMaterials();
  const { buildSite } = await import("../../app/levels/t05/site.js");
  const site = buildSite(M), { hallTimber } = await import("../../app/levels/t05/timber.js"), HT = hallTimber(M);
  const box = new THREE.Box3(); let n = 0;
  site.root.updateMatrixWorld(true);
  site.root.traverse((o) => { if (o.isMesh && (o.material === HT.x || o.material === HT.z)) { n++; box.union(new THREE.Box3().setFromObject(o)); } });
  assert.ok(n >= 2, `meshes in the hall's timber: ${n}`);
  const f = site.fogShut; assert.ok(f, "the hall's inside box");
  const out = 3.5;   // the tie-beams run out through the walls to the bracket sets under the eave, about 3 m
  assert.ok(box.min.x > f.x0 - out && box.max.x < f.x1 + out && box.min.z > f.z0 - out && box.max.z < f.z1 + out, `the hall's timber reaches ${JSON.stringify(box)} past the inside ${JSON.stringify(f)}`);
});
