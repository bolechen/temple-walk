// The bloom's high pass gives nothing for a pixel that is not a number (app/src/post.js, #762): one such pixel, blurred by the
// bloom's widest levels, laid a dark slab over three quarters of the T05 hall on a T4 when seen 10 m before its fifth figure.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs"; import * as THREE from "three";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
const { guardBloom, BLOOM_GUARD } = await import("../../app/src/post.js");

test("the bloom's high pass reads its texel through the guard, once", () => {
  const b = guardBloom(new UnrealBloomPass(new THREE.Vector2(64, 64), 0.2, 0.7, 0.9)), fs = b.materialHighPassFilter.fragmentShader;
  assert.equal(fs.split(BLOOM_GUARD).length, 2, "the guard is laid exactly once");
  assert.match(fs, /isnan\( texel \)[^;]*isinf\( texel \)/);
  assert.ok(fs.indexOf(BLOOM_GUARD) < fs.indexOf("luminance( texel.xyz )"), "before the texel is read for its brightness");
  assert.equal(guardBloom(b).materialHighPassFilter.fragmentShader, fs, "laid twice, it is still once");
  const other = new UnrealBloomPass(new THREE.Vector2(64, 64), 0.2, 0.7, 0.9); other.materialHighPassFilter.fragmentShader = "void main() { gl_FragColor = vec4(1.0); }";
  assert.throws(() => guardBloom(other), /no longer reads its texel/, "on a shader that changed, it says so rather than leave the bloom unguarded");
});
