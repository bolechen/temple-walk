// The eye inside the halls (the owner on the canary, 27c9458: "很多地方走的时候都有穿模"; a visitor's picture from inside the
// great hall's door, ?cam=120,5,0.063,-0.07&view=third&in=main, black beyond the door with only its two lamps: the eye was
// out through the room's front door). Since #295 the eye asks a hierarchy of what is drawn, gathered by the page from its
// scene (eyegather.js), and once that is built it asks nothing else. The page gathered only the parts it could see, within
// the level's eye box: the rooms, side by side under the courts and hidden while he is out of doors (when the gathering is
// done), were never in it, so in a room nothing stopped the eye; and the doorway opens on nothing but a painted box, so the
// eye backed out through it into the dark. Here the scene is put together as yard.js has it (the rooms hidden), the eye
// space gathered as the page gathers it, and in every room, his back to each wall in turn and on the way in from the door
// and out again, the eye must stay inside the room and its near plane touch nothing drawn (a thin thing, a censer or a
// column, may stand between him and it: the eye lets those pass, as it does out of doors).
// The scene, the eye space and the walker shared by eye-rooms.test.mjs, eye-rooms-halls.test.mjs and eye-rooms-doors.test.mjs
// (split in #697 so that CI's shards can spread the one 108 s file; every assertion is where it was).
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import "./dom-stub.mjs";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
const { createWalker } = await import("../../app/src/site.js?real");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { followEye, createFollow, FRAMES, frameArm, aimAt, seesHim } = await import("../../app/src/eye.js");
const { createEyeSpace, eyeRadius } = await import("../../app/src/eyespace.js");
const { gatherEye, eyeBoxes } = await import("../../app/src/eyegather.js");
const { buildDrawn } = await import("../../tools/walk/scene.mjs");
const { gather } = await import("../../tools/walk/bake.mjs");
const level = (await import("../../app/levels/t00/level.js")).default;

const drawn = buildDrawn(), { site, rooms } = drawn;
// What is drawn as the page draws it: the dark behind a hall's leaves is a shader (materials.js `interior`, doorway.js
// paints the room on it), which the eye's gathering passes over as it does mist and glass.
for (const root of [drawn.scene, rooms.group]) root.traverse((o) => { if (o.isMesh && o.material?.name === "interior") o.material = new THREE.ShaderMaterial(); });
// The page's scene: the place's parts, each at the top of the scene as yard.js adds them (some a group, some a mesh of
// its own: the land, the trees), and the rooms as their own part, hidden from the courts.
const scene = new THREE.Scene(), place = [...drawn.scene.children];
for (const o of place) { let ground = false; o.traverse((m) => { if (m.userData.ground) ground = true; }); o.userData.part = ground ? "ground" : "site"; scene.add(o); }   // (the paving is the page's "ground", which the eye does not gather)
rooms.group.userData.part = "interior"; rooms.group.visible = false; scene.add(rooms.group);
scene.updateMatrixWorld(true);
const g = gatherEye(scene, eyeBoxes(level.eyeBox, rooms.group)); let r = g.next(); while (!r.done) r = g.next();
const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.BufferAttribute(r.value, 3));
const bvh = new MeshBVH(geo), space = createEyeSpace(bvh);
const FOV = 50, ASPECT = 16 / 9, dt = 1 / 60, frame = FRAMES.b, arm = frameArm(frame, FOV, ASPECT);
space.radius = eyeRadius(FOV, ASPECT, 0.1);
const grids = gridsByPlace(decode(ensure(prepare()).bytes, (b) => inflateRawSync(b)));
const walker = createGridWalker(createWalker(site), grids, { doors: site.halls });
const eyeWalker = Object.assign(Object.create(walker), { eyeShut: (x, y, z) => space.shut(x, y, z), railNear: () => false });

/** The eye after it has come to rest behind him at (x, z) looking `yaw`, from the eye's own follow springs. */
function settle(x, z, yaw, pitch = 0.04) {
  const follow = createFollow(), foot = walker.heightAt(x, z), eyeY = walker.eyeAt(x, z);
  let c = null;
  for (let n = 0; n < 240; n++) c = follow.step(dt, followEye(eyeWalker, { x, z, foot, eyeY, yaw, pitch, side: 1, reach: 6.2, arm, space }));
  return { c, head: [x, foot + 1.3, z] };
}

export { THREE, assert, drawn, site, rooms, scene, place, level, r as gathered, bvh, space, FOV, ASPECT, dt, frame, arm, walker, eyeWalker, settle, gatherEye, eyeBoxes, createFollow, followEye, aimAt, seesHim, gather, createWalker };

/** One room's case: the eye stays inside it, his back to every wall and on the way in and out. */
export function roomCase(id) {
  const { room: R, group } = rooms.rooms[id];
  walker.setRoom(R);
  const solid = gather([group], { x0: R.x0 - 1, x1: R.x1 + 1, z0: R.z0 - 1, z1: R.z1 + 1, bottom: R.y - 2, top: R.y + 30 }).bvh;
  const bad = [], ball = new THREE.Sphere();
  const check = (x, z, yaw, what) => {
    const { c } = settle(x, z, yaw), m = 0.4;   // (the walls are drawn a little outside the room's own bounds, up to their thickness)
    const inside = c[0] > R.x0 - m && c[0] < R.x1 + m && c[2] > R.z0 - m && c[2] < R.z1 + m && c[1] > R.y && c[1] < R.y + R.h + m;
    ball.center.set(...c); ball.radius = space.radius - 0.01;   // (the near plane's corners: what would show cut)
    const touching = solid.intersectsSphere(ball);
    if (!inside || touching) bad.push(`${what} at (${x.toFixed(1)}, ${z.toFixed(1)}): eye (${c.map((v) => v.toFixed(2)).join(", ")})${inside ? "" : " outside the room"}${touching ? " inside something drawn" : ""}`);
  };
  // his back to each wall: open spots a metre in from it, every metre along it, facing into the room
  const ins = 1.0, walls = [
    { yaw: 0, at: (t) => [t, R.z1 - ins], span: [R.x0, R.x1] },                // the front wall (the door's) behind him, facing the altar
    { yaw: Math.PI, at: (t) => [t, R.z0 + ins], span: [R.x0, R.x1] },          // the back wall
    { yaw: Math.PI / 2, at: (t) => [R.x0 + ins, t], span: [R.z0, R.z1] },      // the left wall, facing right
    { yaw: -Math.PI / 2, at: (t) => [R.x1 - ins, t], span: [R.z0, R.z1] },     // the right wall
  ];
  let spots = 0;
  for (const w of walls) for (let t = w.span[0] + ins; t <= w.span[1] - ins; t += 1) { const [x, z] = w.at(t); if (walker.blocked(x, z)) continue; spots++; check(x, z, w.yaw, "back to the wall"); }
  // in at the door toward the altar, and out again toward the door
  for (let k = 0; k <= 4; k++) { const z = R.door[1] - k * 0.8; if (walker.blocked(R.door[0], z)) continue; spots++; check(R.door[0], z, 0, "coming in"); check(R.door[0], z, Math.PI, "going out"); }
  assert.ok(spots >= 8, `${id}: too few open spots to look from (${spots})`);
  assert.deepEqual(bad, [], `${id}: the eye went into what is drawn:\n` + bad.slice(0, 12).join("\n"));

}
