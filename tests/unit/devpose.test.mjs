// `?devpose`: the address follows him on the dev server, so a reload puts him back where he stood. The address it
// writes is `link.js`'s (tests/unit/link.test.mjs); here it is the following, and the published build leaving it out.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import { createDevPose } from "../../app/src/devpose.js";

const read = (s) => Object.fromEntries(new URLSearchParams(s));
const court = { x: 1.23456, z: 29.004, yaw: 0.12345, pitch: -0.0504, view: "third", season: "autumn", time: "dusk", room: null };

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
