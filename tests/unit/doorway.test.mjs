// Seen from outside, each hall's door shows its own room (doorway.js, #218): every hall that can be entered has the box
// behind its leaves that paints it, what the room holds is seen behind the hall's front and inside its walls, and a
// room is taken only when the visitor comes near its hall.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createDoorways, NEAR } = await import("../../app/src/doorway.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls);
const U = { uLamp: { value: 0 }, uSnow: { value: 0 }, uFogLayer: { value: new THREE.Vector4() } };
const doors = createDoorways({ renderer: /** @type {any} */ (null), scene: new THREE.Scene(), site, rooms, U });

test("every hall that can be entered has a doorway that paints its own room", () => {
  for (const h of site.halls) {
    assert.ok(site.doorways[h.id], `${h.name}: no dark box behind its door`);
    assert.ok(doors.halls[h.id], `${h.name}: its doorway paints nothing`);
    assert.equal(site.doorways[h.id].mesh.material, doors.halls[h.id].mat, `${h.name}: the box still wears the plain dark material`);
  }
  assert.equal(Object.keys(doors.halls).length, site.halls.length);
});

test("through the door, the room's altar and its back wall are seen behind the hall's front and within its walls", () => {
  for (const h of site.halls) {
    const r = rooms.rooms[h.id], R = r.room;
    const inward = new THREE.Vector2(-Math.sin(h.outYaw), Math.cos(h.outYaw)), door = new THREE.Vector2(...h.door);
    for (const [what, p] of [["the altar", r.altar.position.clone()], ["the back wall's middle", new THREE.Vector3(R.cx, R.y + 2, R.z0)], ["the door", new THREE.Vector3(R.cx, R.y + 1.5, R.z1 + 0.3)]]) {
      const w = doors.seenAt(h.id, p), into = new THREE.Vector2(w.x, w.z).sub(door).dot(inward);
      if (what === "the door") { assert.ok(Math.abs(into) < 0.5 && Math.hypot(w.x - h.door[0], w.z - h.door[1]) < 0.5, `${h.name}: the room's door is not seen at the hall's door (${into.toFixed(2)} m in)`); continue; }
      assert.ok(into > 1, `${h.name}: ${what} is seen ${into.toFixed(2)} m behind the door, in front of it or in the doorway`);
      // Across, within the building's walls. In depth the side halls' rooms are deeper than their buildings (interior.js
      // draws each room for its furniture), and the door shows the room as it is found on going in.
      const across = Math.abs(new THREE.Vector2(w.x, w.z).sub(door).dot(new THREE.Vector2(inward.y, -inward.x))), half = Math.max(...h.xs.map(Math.abs));
      assert.ok(across <= half + 0.5, `${h.name}: ${what} is seen ${across.toFixed(1)} m to the side, outside the building's walls (${half} m)`);
    }
  }
});

test("a room is taken only when he comes near its hall, not when the page opens", () => {
  const far = new THREE.Vector3(0, 0, 400);
  doors.tick(null, 0.016, far);
  assert.ok(Object.values(doors.report().halls).every((x) => !x.want), "a room was asked for from far away");
  const h = site.halls.find((x) => x.id === "main");
  doors.tick(null, 0.016, new THREE.Vector3(h.door[0], 3, h.door[1] + NEAR * 0.5));
  const want = doors.report().halls;
  assert.ok(want.main.want, "coming near the great hall did not ask for its room");
  assert.ok(Object.entries(want).filter(([, x]) => x.want).length < site.halls.length, "every room was asked for at once");
});

// #320's trial (`?doorway=live`, doorway-live.js): the room drawn live through the door from the eye carried into it.
const { roomEye } = await import("../../app/src/doorway-live.js");
test("drawn live, every point of a room falls on the pixel where the door shows it, and nothing on the court's side of the door is drawn", () => {
  for (const h of site.halls) {
    const o = doors.halls[h.id], r = rooms.rooms[h.id], R = r.room, zs = o.mat.uniforms.uMax.value.z;
    for (const [dist, turn] of [[6, 0], [12, 0.5], [2, -0.5]]) {
      // The eye `dist` metres out from the door, turned a little, looking in at the door at a man's height.
      const a = h.outYaw + turn, door = new THREE.Vector3(h.door[0], site.doorways[h.id].group.position.y + site.doorways[h.id].platH + 1.5, h.door[1]);
      const eye = new THREE.Vector3(door.x + Math.sin(a) * dist, door.y + 0.2, door.z - Math.cos(a) * dist);   // out of the door is (sin, -cos) of outYaw, as tools/doorway-views.cjs stands its views
      const camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.1, 700); camera.position.copy(eye); camera.lookAt(door); camera.updateMatrixWorld();
      const cam = roomEye(o, camera, new THREE.PerspectiveCamera());
      const ndc = (p, c) => p.clone().applyMatrix4(c.matrixWorldInverse).applyMatrix4(c.projectionMatrix);
      for (const [what, p] of [["the altar", r.altar.getWorldPosition(new THREE.Vector3())], ["the back wall", new THREE.Vector3(R.cx + 0.7, R.y + 2.2, R.z0 + 0.05)], ["just inside the door", new THREE.Vector3(R.cx - 0.4, R.y + 1.2, zs - 0.3)]]) {
        const live = ndc(p, cam), court = ndc(doors.seenAt(h.id, p), camera);
        assert.ok(Math.abs(live.x - court.x) < 1e-4 && Math.abs(live.y - court.y) < 1e-4, `${h.name} from ${dist} m: ${what} is drawn at (${live.x.toFixed(4)}, ${live.y.toFixed(4)}), the door shows it at (${court.x.toFixed(4)}, ${court.y.toFixed(4)})`);
        assert.ok(live.z > -1 && live.z < 1, `${h.name} from ${dist} m: ${what} is cut away (depth ${live.z.toFixed(3)})`);
      }
      // What stands beyond the door's plane, on the court's side (the room's outlook, the outer face of its front wall).
      const out = ndc(new THREE.Vector3(R.cx, R.y + 1.5, zs + 0.3), cam);
      assert.ok(out.z < -1, `${h.name} from ${dist} m: a point on the court's side of the door is drawn (depth ${out.z.toFixed(3)})`);
    }
  }
});
test("the room drawn live is off unless the address asks for it; the larger face waits for its pictures", () => {
  assert.deepEqual(doors.report().modes, []);
  for (const o of Object.values(doors.halls)) { assert.equal(o.mat.uniforms.uLive.value, 0); assert.equal(o.mat.uniforms.uHi.value, 0); }
});
