// The address of a view: `?cam=x,z,yaw,pitch&view=…&season=…&time=…&in=…&up=…`. `?devpose` writes it into the
// page's own address while a place is being worked on; `__debugURL()` hands the same address out from the console on
// the published site, so a view seen there can be opened again here.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import { poseQuery, readEye } from "../../app/src/link.js";

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

test("up on a balcony the address names it, and the console's link asks the dev server to follow him", () => {
  const s = poseQuery("?q=low", { ...court, up: "lingxiao", devpose: true });
  assert.equal(read(s).up, "lingxiao"); assert.ok("devpose" in read(s));
  assert.equal(s, "?q=low&cam=1.23,29,0.123,-0.05&view=third&season=autumn&time=dusk&up=lingxiao&devpose", "the bare flag stays bare");
  assert.equal(read(poseQuery(s, court)).up, undefined, "down from it, the address does not keep it");
});

test("a head turned round and round is kept within one turn", () => {
  const yaw = +read(poseQuery("", { ...court, yaw: 0.5 + 6 * Math.PI })).cam.split(",")[2];
  assert.ok(Math.abs(yaw - 0.5) < 1e-3, "got " + yaw);
  const back = +read(poseQuery("", { ...court, yaw: -Math.PI - 0.2 })).cam.split(",")[2];
  assert.ok(Math.abs(back - (Math.PI - 0.2)) < 1e-3, "got " + back);
});

// Beside the stair of the Guanyin terrace he may stand at x 2.096 on the treads; the cheek's stop begins at 2.099. Cut to
// two places that became 2.1, inside the stop, where the ground reads as the terrace below and he came back sunk into the
// steps. The address keeps as many places as it takes for the point to stand where he stood.
test("the place written down is one he can stand on, at the height he stood, however near an edge he was", () => {
  const stair = { x: 2.0962, z: -63.3712, yaw: -0.582, pitch: -0.204 }, ok = (x, z) => x <= 2.099;   // the stop's edge, as the walker draws it
  const cam = read(poseQuery("?devpose", { ...stair, ok })).cam.split(",").map(Number);
  assert.ok(ok(cam[0], cam[1]), `written as ${cam[0]}, inside the stop`);
  assert.ok(Math.abs(cam[0] - stair.x) < 0.001);
  assert.equal(read(poseQuery("?devpose", court)).cam, "1.23,29,0.123,-0.05", "away from any edge two places are enough");
});

// The console's link is the same function on the published page: it must not pull in devpose.js, which the publication
// leaves out, nor write anything into the address.
test("the console's link is built without the dev server's module", () => {
  const yard = fs.readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(yard, /import \{ poseQuery, readEye \} from "\.\/src\/link\.js"/, "the address is built by link.js, which ships");
  assert.match(yard, /window\.__debugURL = \(\) =>/, "the console hook is on the published page");
  assert.ok(!/^import .*devpose/m.test(yard), "a static import would put the dev module in the published build");
});

test("the address names the eye as one parameter, to the centimetre, and reads it back (#623)", () => {
  const s = poseQuery("?devpose", { ...court, eye: [-5.6812, 3.4549, 55.1, 4.2049] });
  assert.equal(read(s).eye, "-5.68,3.45,55.1,4.2");
  assert.deepEqual(readEye(s), { at: [-5.68, 3.45, 55.1], dist: 4.2 });
  assert.equal(read(poseQuery(s, court)).eye, undefined, "an address without an eye drops the old one");
  assert.equal(read(poseQuery("?q=low", court)).eye, undefined, "no eye, no parameter");
  assert.equal(read(poseQuery("?q=low", { ...court, eye: [1, 2, NaN, 3] })).eye, undefined);
});

test("an eye that is not four sane numbers is not read", () => {
  for (const bad of ["", "?eye=", "?eye=1,2,3", "?eye=1,2,3,x", "?eye=1,,3,4", "?eye=1,2,3,4,5", "?eye=1,2,99999,4", "?eye=1,2,3,-1", "?eye=1,2,3,21"]) assert.equal(readEye(bad), null, bad);
  assert.deepEqual(readEye("?cam=0,0,0,0&eye=0,1.5,2,0"), { at: [0, 1.5, 2], dist: 0 });
});

test("production does not read the eye", () => {
  const yard = fs.readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(yard, /if \(!PRODUCTION && [^\n]*readEye\(location\.search\)/);
});
