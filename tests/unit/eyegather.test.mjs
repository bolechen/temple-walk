// What the eye is kept out of is gathered from the scene's parts (#295, #354). A part switched off for a test or a measurement (`?off=site`, the
// way the end-to-end scenarios with BARE draw nothing) still stands there: the floor is baked from it, so the eye must be kept out of it too. Before,
// `gatherEye` skipped a part that was not visible, and the `hallexit` scenario, which draws nothing, had the eye put behind the hall's rear wall
// after a hall's door (the pick from there found the wall, and a tap on the court led back into the hall).
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { gatherEye } = await import("../../app/src/eyegather.js");

const BOX = { x0: -50, x1: 50, y0: -50, y1: 50, z0: -50, z1: 50 };
function sceneWith(part, visible) {
  const scene = new THREE.Scene(), group = new THREE.Group();
  group.userData.part = part; group.visible = visible;
  group.add(new THREE.Mesh(new THREE.BoxGeometry(2, 2, 0.2), new THREE.MeshStandardMaterial()));   // a wall
  scene.add(group); return scene;
}
const count = (scene) => { const g = gatherEye(scene, BOX); let r; while (!(r = g.next()).done); return r.value.length / 9; };

test("a part that is drawn is gathered", () => assert.equal(count(sceneWith("site", true)), 12));
test("a part switched off is gathered all the same: it is still there", () => assert.equal(count(sceneWith("site", false)), 12));
test("what is not one of the parts the eye is kept out of is not gathered", () => assert.equal(count(sceneWith("sky", true)), 0));
test("a mesh that is itself hidden (a part's original after it was merged) is not gathered", () => {
  const scene = sceneWith("site", true); scene.children[0].children[0].visible = false;
  assert.equal(count(scene), 0);
});

test("a hall's dark box behind its open door is gathered although its shader makes it airy: the eye must not back out through the door into the hall", () => {
  const scene = sceneWith("site", true), box = scene.children[0].children[0];
  box.material = new THREE.ShaderMaterial(); box.userData.doorway = true;
  assert.equal(count(scene), 12);
  box.userData.doorway = false; assert.equal(count(scene), 0, "any other shader mesh is still airy");
});
