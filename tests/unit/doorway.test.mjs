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
