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
import test from "node:test";
import assert from "node:assert/strict";
import { inflateRawSync } from "node:zlib";
import "./dom-stub.mjs";
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
const { createWalker } = await import("../../app/src/site.js?real");
const { createGridWalker, gridsByPlace } = await import("../../app/src/gridwalker.js");
const { decode } = await import("../../app/src/walkgrid.js");
const { prepare, ensure } = await import("../../tools/bake-walk.mjs");
const { followEye, createFollow, FRAMES, frameArm, aimAt } = await import("../../app/src/eye.js");
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

for (const [id, { room: R, group }] of Object.entries(rooms.rooms)) {
  test(`the eye stays inside ${id}'s room, his back to every wall, and on the way in and out`, () => {
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
  });
}

// Gathered while he is in a room (a visit begun in a hall, ?in=, or a language changed there): the courts are hidden then,
// as the rooms are from the courts, and the eye must be kept out of the same things either way; only what the address
// switches off is left out.
test("the eye's space is the same gathered from a room as from the courts, less only what ?off= switches off", () => {
  const count = (off) => { const it = gatherEye(scene, eyeBoxes(level.eyeBox, rooms.group), 4, off); let s = it.next(); while (!s.done) s = it.next(); return s.value.length / 9; };
  const outdoors = r.value.length / 9;
  assert.ok(place.some((o) => o.isMesh), "some of the place's parts should be meshes at the top of the scene, as the land and the trees are in the page");
  for (const o of place) o.visible = false; rooms.group.visible = true;
  try {
    assert.equal(count(new Set()), outdoors, "gathered from inside a room, the courts went missing");
    assert.ok(count(new Set(["site"])) < outdoors * 0.5, "?off=site should leave the courts out");
  } finally { for (const o of place) o.visible = true; rooms.group.visible = false; }
});

// Coming out of a hall (the canary's pictures for #391: out of the great hall's door, facing the court, the eye backed in
// through the open door, past the dark box behind the leaves, into the hollow of the building, and him not in the picture).
// From where each hall sets him down coming out, facing the way out, the eye stays no deeper than the dark behind the
// leaves (2.4 m at most: since #396 it may stand in that dark and see him framed in the door), never in the hollow beyond.
test("coming out of every hall, the eye stays within the dark behind its door", () => {
  walker.setRoom(null);
  const bad = [];
  for (const h of site.halls) {
    const f = [Math.sin(h.outYaw), -Math.cos(h.outYaw)];   // the way out
    const { c } = settle(h.out[0], h.out[1], h.outYaw);
    const into = -((c[0] - h.door[0]) * f[0] + (c[2] - h.door[1]) * f[1]);   // how far behind the point before the door the eye stands
    if (into > 3.0) bad.push(`${h.id}: the eye is ${into.toFixed(2)} m in behind the door, past the dark (eye ${c.map((v) => v.toFixed(2)).join(", ")})`);
  }
  assert.deepEqual(bad, [], bad.join("\n"));
});

// #396: him in the picture where the eye has little room. Coming out of a hall's door the leaves stood right behind him and
// the eye, held half a metre off, hid him (`monkHidden` under 0.6 m of arm); below a platform, his back to it, the eye rose
// onto the platform and the balustrade stood between it and him. In both he must be seen: the eye a metre or more back from
// the point over his head, nothing drawn between it and his waist (he is a child, 1.22 m: a line to 1 m clears a balustrade that hides all of him below the head), and him at least 15% of the picture's height.
const ray = new THREE.Ray(), seesChest = (c, x, foot, z) => { const to = new THREE.Vector3(x, foot + 0.5, z).sub(new THREE.Vector3(...c)), len = to.length(); ray.origin.set(...c); ray.direction.copy(to).normalize(); const h = bvh.raycastFirst(ray, THREE.DoubleSide); return !h || h.distance > len - 0.05; };
const tallness = (c, x, foot, z, yaw) => {
  const aim = aimAt(c, [x, foot, z], yaw, frame, FOV); if (!aim) return 0;
  const cam = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 500); cam.position.set(...c); cam.rotation.set(aim[1], -aim[0], 0, "YXZ"); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
  const a = new THREE.Vector3(x, foot, z).project(cam), b = new THREE.Vector3(x, foot + 1.22, z).project(cam);
  return a.z < 1 && b.z < 1 ? Math.abs(b.y - a.y) / 2 : 0;
};
function seen(x, z, yaw, what, bad, pitch = 0.04) {
  const { c, head } = settle(x, z, yaw, pitch), foot = walker.heightAt(x, z), back = Math.hypot(c[0] - head[0], c[2] - head[2]), tall = tallness(c, x, foot, z, yaw);
  if (back < 0.9 || !seesChest(c, x, foot, z) || tall < 0.15) bad.push(`${what} at (${x.toFixed(2)}, ${z.toFixed(2)}): eye ${back.toFixed(2)} m back, ${seesChest(c, x, foot, z) ? "sees" : "does not see"} his chest, ${(tall * 100).toFixed(0)}% of the picture tall (eye ${c.map((v) => v.toFixed(2)).join(", ")})`);
}

test("coming out of every hall's door, he is in the picture (#396)", () => {
  walker.setRoom(null);
  const bad = []; for (const h of site.halls) seen(h.out[0], h.out[1], h.outYaw, `out of ${h.id}`, bad);
  assert.deepEqual(bad, [], bad.join("\n"));
});

test("below a hall's platform, his back to it, he is in the picture (#396)", () => {
  walker.setRoom(null);
  const bad = [];
  for (const id of ["main", "chan", "yaoshi"]) {
    const h = site.halls.find((k) => k.id === id), f = [Math.sin(h.outYaw), -Math.cos(h.outYaw)], h0 = walker.heightAt(h.door[0], h.door[1]);
    let found = 0;
    for (const sgn of [1, -1]) {
      const r = [f[1] * -sgn, f[0] * sgn];   // along the front, either way, to where the platform ends
      let spot = null;
      for (let t = 1; t < 40 && !spot; t += 0.1) {
        const px = h.door[0] - f[0] * 3 + r[0] * t, pz = h.door[1] - f[1] * 3 + r[1] * t;   // a little in from the front, along the side
        if (!walker.blocked(px, pz) && walker.heightAt(px, pz) < h0 - 0.3) { const qx = px + r[0] * 0.8, qz = pz + r[1] * 0.8; if (!walker.blocked(qx, qz)) spot = [qx, qz]; }
      }
      if (!spot) continue;   // (that side may run into a wall of the court)
      found++; for (const pitch of [0.04, -0.07, -0.2]) seen(spot[0], spot[1], Math.atan2(r[0], -r[1]), `below ${id}'s platform, looking ${pitch}`, bad, pitch);   // facing away from it, along r, the view level or looking down a little
    }
    assert.ok(found, `${id}: found no ground beside the platform on either side`);
  }
  // and where the preview showed only the top of his head over the great hall's balustrade (0c66cfe, after-west-wall)
  for (const pitch of [0.04, -0.07, -0.2]) seen(-18.8, -12, -Math.PI / 2, `below main's platform at the preview's spot, looking ${pitch}`, bad, pitch);
  assert.deepEqual(bad, [], bad.join("\n"));
});

// The art review of #411 (c08c42c): out of the tea house's door, the view dragged round 65°, the whole picture was the
// inside of its front wall. Since #396 the front of the dark behind the leaves is open so that the eye may stand in it;
// turned aside, the arm ran on out of that dark through its painted sides (a shader, not gathered) into the hollow of the
// building, 4.3 m from him with the wall between. Out of every hall, the view turned 40° and 65° either way, he is seen.
test("out of every hall's door with the view turned aside, he is in the picture (#411's art review)", () => {
  walker.setRoom(null);
  const bad = [];
  for (const h of site.halls) for (const turn of [-65, -40, 40, 65]) seen(h.out[0], h.out[1], h.outYaw + (turn * Math.PI) / 180, `out of ${h.id}, turned ${turn}°`, bad);
  assert.deepEqual(bad, [], bad.join("\n"));
});
