// A closed hall the mist does not fill (fog.js, FOGSHUT in glsl.js): the part of a line of sight inside the hall's box
// takes no mist. Asked of the same sum in JavaScript (`fogShut`), and of the shader text for what makes a level without a
// hall draw exactly as before: an empty box answers 0 before any sum.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
const { fogShut, FOGSHUT, U } = await import("../../app/src/glsl.js");
const box = { x0: -23, x1: 23, z0: -24.5, z1: -1, y0: 3, y1: 21 };

test("with no box, or an empty one, no part of any line is shut (the prologue, and every level that names no hall)", () => {
  for (const b of [null, { x0: 0, x1: 0, z0: 0, z1: 0, y0: 0, y1: 0 }, { ...box, x0: 5, x1: -5 }]) assert.equal(fogShut([0, 1.6, 44], [0, 6, -20], b), 0);
  assert.ok(U.uFogShut.value.x >= U.uFogShut.value.z, "the shared uniform starts empty");
  assert.match(FOGSHUT, /if\(uFogShut\.x>=uFogShut\.z\) return 0\.;/, "the shader answers an empty box with 0 before any sum");
});

test("outside the box the mist is as before; inside it, the part of the line within the box takes none", () => {
  // A line that never enters the box: from the court to the court.
  assert.equal(fogShut([0, 1.6, 44], [10, 1.6, 20], box), 0);
  // A line passing over the hall, above its box.
  assert.equal(fogShut([0, 30, 44], [0, 30, -40], box), 0);
  // From the court through the middle door to the back wall: the share inside is the share of the run from z -1 to -24.5.
  const eye = [0, 1.6, 44], p = [0, 6, -24.5], share = fogShut(eye, p, box);
  assert.ok(Math.abs(share - (24.5 - 1) / (44 + 24.5)) < 1e-9, `${share}`);
  // Standing inside the hall looking at its back wall: all of the line is inside.
  assert.ok(Math.abs(fogShut([0, 4.6, -5], [0, 6, -24], box) - 1) < 1e-9);
  // From inside out through the door to the court: only the part up to the box's front.
  const out = fogShut([0, 4.6, -10], [0, 4.6, 30], box);
  assert.ok(Math.abs(out - 9 / 40) < 1e-9, `${out}`);
  // A line straight along an axis (a zero component in its direction) is handled.
  assert.ok(Math.abs(fogShut([0, 10, -5], [0, 10, -20], box) - 1) < 1e-9);
});

test("a level that names no hall compiles three's fog chunks without the box's sums; naming one adds them, and they stay", async () => {
  const THREE = await import("three"), { layerFog } = await import("../../app/src/fog.js"), C = THREE.ShaderChunk;
  layerFog();
  const none = [C.fog_pars_vertex, C.fog_vertex, C.fog_pars_fragment, C.fog_fragment].join("\n");
  assert.ok(!/fogShut|vFogW|uFogShut/.test(none), "no box: not a word of it in the chunks (T00 draws the shaders it drew before #481)");
  assert.ok(C.fog_fragment.includes("vFogDepth * vFogDepth"), "the mist's depth is the plain distance");
  layerFog({ shut: true });
  assert.ok(C.fog_fragment.includes("fogShut( cameraPosition, vFogW )") && C.fog_vertex.includes("vFogW =") && C.fog_pars_fragment.includes("uniform vec4 uFogShut"));
  layerFog();
  assert.ok(C.fog_fragment.includes("fogShut("), "asked again without one, the box's sums stay (a page names its level once)");
});
