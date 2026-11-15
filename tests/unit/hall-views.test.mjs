// The indoor cameras: one to see the room's furniture, one to see what is overhead. They are kept apart from the
// six locked acceptance cameras of site.views, and every pose must stand on the room's own free floor.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
import { HALL_VIEWS, hallViewURL } from "../../app/levels/t00/hall-views.js";
import { buildSite, createWalker } from "../../app/src/site.js";
import { buildInteriors } from "../../app/src/interior.js";
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), rooms = buildInteriors(M, site.halls), walker = createWalker(site);

test("every hall has a camera for its furniture and one for its ceiling", () => {
  const byHall = new Map();
  for (const v of HALL_VIEWS) { if (!byHall.has(v.hall)) byHall.set(v.hall, []); byHall.get(v.hall).push(v); }
  assert.deepEqual([...byHall.keys()], site.halls.map((h) => h.id));
  for (const [hall, views] of byHall) {
    assert.equal(views.length, 2, `${hall} should have two views`);
    assert.ok(views[1].abs[3] > views[0].abs[3] + 0.35, `${hall}: the second view should look up at the roof`);
    assert.equal(new Set(views.map((v) => v.name)).size, 2, `${hall}: two views need two names`);
  }
  assert.equal(new Set(HALL_VIEWS.map((v) => v.name)).size, HALL_VIEWS.length, "the names are also the file names");
});

test("every indoor camera stands on open floor in its own room", () => {
  for (const v of HALL_VIEWS) {
    const r = rooms.rooms[v.hall].room; assert.ok(r, `${v.name}: no such hall`);
    walker.setRoom(r);
    const [dx, z, yaw, pitch] = v.abs, x = r.cx + dx;
    assert.ok(!walker.blocked(x, z), `${v.name} stands inside something at ${x}, ${z}`);
    assert.ok(x > r.x0 + 0.38 && x < r.x1 - 0.38 && z > r.z0 + 0.38 && z < r.z1 - 0.38, `${v.name} is against a wall`);
    assert.ok(Number.isFinite(yaw) && Number.isFinite(pitch) && Math.abs(pitch) < 0.9, `${v.name}: an impossible angle`);
  }
  walker.setRoom(null);
});

test("the address of a hall view opens that hall at that pose", () => {
  const q = new URLSearchParams(hallViewURL(HALL_VIEWS[0]).slice(1));
  assert.equal(q.get("in"), HALL_VIEWS[0].hall);
  assert.deepEqual(q.get("cam").split(",").map(Number), HALL_VIEWS[0].abs);
  assert.equal(q.get("view"), "first"); assert.equal(q.get("q"), "high"); assert.ok(q.has("enter"));
});

test("the locked T00 acceptance cameras are untouched", () => {
  for (const v of HALL_VIEWS) assert.ok(!/^cam0[1-6]$/.test(v.name), "a hall view must not take a locked name");
  for (const v of HALL_VIEWS) assert.ok(!(v.name in site.views), `${v.name} would displace an outdoor view`);
});

// tools/inside.cjs --views [level]: each level reads its own table, and nothing else.
import { createRequire } from "node:module";
const tool = createRequire(import.meta.url)("../../tools/hall-views.cjs");

test("the tool finds the level's own table, T00 by default, with each room's offset added", () => {
  assert.ok(tool.levels().includes("t00"));
  const jobs = tool.views();
  assert.equal(jobs.length, HALL_VIEWS.length);
  assert.deepEqual(tool.views("t00"), jobs);
  for (const j of jobs) { const v = HALL_VIEWS.find((h) => h.name === j.name); assert.equal(j.abs[0], v.abs[0] + rooms.rooms[j.hall].room.cx, j.name); }
});

test("a level without a table, or a name that is not a plain folder, is refused with the levels that have one", () => {
  for (const bad of ["t01", "../t00", "t00/..", "T00", ""]) assert.throws(() => tool.tableOf(bad), /no indoor views for level .*levels with .*t00/, JSON.stringify(bad));
  assert.equal(tool.tableOf("t00"), "./app/levels/t00/hall-views.js");
});
