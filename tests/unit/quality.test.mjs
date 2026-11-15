// Which tier a machine starts on, from the name of its graphics card.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { tierFor, mirrorAt } from "../../app/src/quality.js";
const { buildSite, createWalker, LEVELS, APPROACH } = await import("../../app/src/site.js");

test("a discrete card starts on the high tier", () => {
  for (const g of ["ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)", "ANGLE (AMD, Radeon RX 6700 XT, OpenGL 4.6)", "ANGLE (Intel, Intel(R) Arc(TM) A750 Graphics, D3D11)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Max, Unspecified Version)"]) assert.equal(tierFor(g), "high", g);
});
test("integrated, base Apple, software and hidden cards start on medium", () => {
  for (const g of ["ANGLE (Apple, ANGLE Metal Renderer: Apple M1, Unspecified Version)", "ANGLE (Apple, ANGLE Metal Renderer: Apple M3, Unspecified Version)", "Apple GPU", "ANGLE (Intel, Intel(R) UHD Graphics 630, OpenGL 4.1)", "Google SwiftShader", "Mali-G78", "Adreno (TM) 740"]) assert.equal(tierFor(g), "medium", g);
});
test("no name at all is taken for a capable card, as before", () => { assert.equal(tierFor(""), "high"); assert.equal(tierFor(undefined), "high"); });

test("the mirror is drawn in the forecourt and first court and on their platforms, and nowhere else", () => {
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const walker = createWalker(buildSite(M)), at = (x, z) => mirrorAt(walker.heightAt(x, z));
  assert.ok(at(0, 29) && at(0, 50) && at(8, 60), "the first court and the forecourt");
  assert.ok(at(0, 40), "the gate's platform"); assert.ok(at(0, -4.5), "the great hall's platform, which looks over the court");
  assert.ok(!at(APPROACH.xC, APPROACH.zC1 - 1.2) && !at(0, APPROACH.zA0 + 2), "not from the approach, where the eye is under it");
  assert.ok(!at(0, LEVELS[0].zS - 6) && !at(0, LEVELS[1].zS - 6) && !at(0, LEVELS[2].zS - 6), "not from the terraces above");
  let on = 0, n = 0; for (let z = APPROACH.top + 0.5; z < APPROACH.zA0; z += 0.25) { n++; if (at(0, z)) on++; }
  assert.ok(on / n < 0.15, `the last flight should draw the mirror only near its top, not on ${on} of ${n} samples`);
});
