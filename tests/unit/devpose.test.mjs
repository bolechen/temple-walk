// `?devpose`: the address follows him on the dev server, so a reload puts him back where he stood.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import { poseQuery, createDevPose } from "../../app/src/devpose.js";

const read = (s) => Object.fromEntries(new URLSearchParams(s));
const court = { x: 1.23456, z: 29.004, yaw: 0.12345, pitch: -0.0504, view: "third", season: "autumn", time: "dusk", room: null };

test("the address says where he stands, as the page reads it back", () => {
  const s = poseQuery("?devpose&q=low", court);
  assert.equal(s, "?devpose&q=low&cam=1.23,29,0.123,-0.05&view=third&season=autumn&time=dusk");
  // yard.js reads `cam` as Number(…) of each comma-separated part: x, z, yaw, pitch.
  assert.deepEqual(read(s).cam.split(",").map(Number), [1.23, 29, 0.123, -0.05]);
});

test("a named view gives way to the exact place, and other parameters are kept", () => {
  const s = read(poseQuery("?show=court&devpose&q=high&off=bloom&fast=1", court));
  assert.equal(s.show, undefined); assert.equal(s.q, "high"); assert.equal(s.off, "bloom"); assert.equal(s.fast, "1"); assert.ok("devpose" in s);
});

test("inside a hall the address names it; outside it does not", () => {
  const inside = poseQuery("?devpose", { ...court, room: "main" });
  assert.equal(read(inside).in, "main");
  assert.equal(read(poseQuery(inside, court)).in, undefined);
});

test("a head turned round and round is kept within one turn", () => {
  const yaw = +read(poseQuery("", { ...court, yaw: 0.5 + 6 * Math.PI })).cam.split(",")[2];
  assert.ok(Math.abs(yaw - 0.5) < 1e-3, "got " + yaw);
  const back = +read(poseQuery("", { ...court, yaw: -Math.PI - 0.2 })).cam.split(",")[2];
  assert.ok(Math.abs(back - (Math.PI - 0.2)) < 1e-3, "got " + back);
});

function page(search = "?devpose") {
  const where = { origin: "http://127.0.0.1:8000", pathname: "/", search, hash: "" }, writes = [];
  const history = { state: null, replaceState(_s, _t, url) { writes.push(url); where.search = url.slice(url.indexOf("?"), url.includes("#") ? url.indexOf("#") : undefined); } };
  return { where, history, writes };
}

test("the address is replaced, not pushed, at most every so often and only when he has moved", () => {
  const p = page(); let pose = { ...court };
  const d = createDevPose({ read: () => pose, where: p.where, history: p.history, every: 400 });
  assert.equal(d.tick(0), true); assert.equal(p.writes.length, 1);
  pose = { ...pose, x: 5 };
  assert.equal(d.tick(100), false, "written again too soon");
  assert.equal(d.tick(450), true); assert.equal(read(p.where.search).cam.split(",")[0], "5");
  assert.equal(d.tick(900), false, "nothing changed, nothing should be written");
  assert.equal(p.writes.length, 2);
});

test("nothing is written while he passes through a door, and the next frame may write at once", () => {
  const p = page(); let pose = null;
  const d = createDevPose({ read: () => pose, where: p.where, history: p.history });
  assert.equal(d.tick(0), false); assert.equal(p.writes.length, 0);
  pose = { ...court, room: "chan" };
  assert.equal(d.tick(16), true); assert.equal(read(p.where.search).in, "chan");
});

test("the link to copy is the whole address of this view", () => {
  const p = page("?devpose&q=low");
  const d = createDevPose({ read: () => court, where: p.where, history: p.history });
  assert.equal(d.link(), "http://127.0.0.1:8000/?devpose&q=low&cam=1.23,29,0.123,-0.05&view=third&season=autumn&time=dusk");
});

test("the page loads it only on the dev server, so the published build carries none of it", () => {
  const yard = fs.readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(yard, /const DEVPOSE = import\.meta\.env\.DEV && Q\.has\("devpose"\)/);
  assert.match(yard, /if \(DEVPOSE\) \{\s*const \{ createDevPose \} = await import\("\.\/src\/devpose\.js"\)/, "the module must be imported only inside the dev branch");
  assert.ok(!/^import .*devpose/m.test(yard), "a static import would put it in the published build");
});

// Beside the stair of the Guanyin terrace he may stand at x 2.096 on the treads; the cheek's stop begins at 2.099. Cut to
// two places that became 2.1, inside the stop, where the ground reads as the terrace below and he came back sunk into
// the steps. The address keeps as many places as it takes for the point to stand where he stood.
test("the place written down is one he can stand on, at the height he stood, however near an edge he was", () => {
  const stair = { x: 2.0962, z: -63.3712, yaw: -0.582, pitch: -0.204 }, ok = (x, z) => x <= 2.099;   // the stop's edge, as the walker draws it
  const cam = read(poseQuery("?devpose", { ...stair, ok })).cam.split(",").map(Number);
  assert.ok(ok(cam[0], cam[1]), `written as ${cam[0]}, inside the stop`);
  assert.ok(Math.abs(cam[0] - stair.x) < 0.001);
  assert.equal(read(poseQuery("?devpose", court)).cam, "1.23,29,0.123,-0.05", "away from any edge two places are enough");
});
