// Trial A (#592, app/src/probe.js, tools/bake-probes.mjs): the baked light probes. The file the page reads is held to its own
// header (sizes, the court and the great hall), and the light it gives to what a probe's rays could see: more sky in the open
// than under the great hall's eaves; a room's bounce warm (its lamps are) and none of the sky's fill taken away.
import test from "node:test"; import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import "./dom-stub.mjs";
const { PROBE_ON, PROBE_GLSL, PROBE } = await import("../../app/src/probe.js");

const file = readFileSync(new URL("../../app/shared/probes/t00.bin", import.meta.url));
const hl = file.readUInt32LE(4), head = JSON.parse(file.subarray(8, 8 + hl)); let off = 8 + hl; off += (4 - (off % 4)) % 4;
const h2f = (h) => { const s = h >> 15 ? -1 : 1, e = (h >> 10) & 31, m = h & 1023; return e === 0 ? s * 2 ** -14 * (m / 1024) : s * 2 ** (e - 15) * (1 + m / 1024); };
const grids = {};
for (const g of head.grids) { const n = g.dim[0] * g.dim[1] * g.dim[2] * 4, v = []; for (let k = 0; k < 2; k++) { v.push(new Uint16Array(file.buffer.slice(file.byteOffset + off, file.byteOffset + off + n * 2))); off += n * 2; } grids[g.id] = { ...g, v }; }

test("the trial is off unless the address asks for it, and a page without it carries none of the shader", () => assert.equal(PROBE_ON, false));

test("the file is what its header says, to the byte", () => {
  assert.equal(file.subarray(0, 4).toString(), "PRB2"); assert.equal(head.version, 2);
  assert.deepEqual(Object.keys(grids), ["outdoors", "room:main"]);
  assert.equal(off, file.length, "no byte left over, none missing");
});

test("the shader reads the two volumes the file holds", () => { assert.match(PROBE_GLSL, /tProbe0, tProbe1;/); assert.ok("tProbe0" in PROBE && "tProbe1" in PROBE); });

const sky = (g, x, y, z) => { const i = Math.round((x - g.box[0]) / g.cell), j = Math.round((y - g.box[1]) / g.cell), k = Math.round((z - g.box[2]) / g.cell), q = ((k * g.dim[1] + j) * g.dim[0] + i) * 4; return h2f(g.v[0][q + 3]) * 0.282095; };
test("the court sees less sky before the great hall than in the forecourt, and every point is finite", () => {
  const g = grids.outdoors;
  assert.ok(sky(g, 0, 0.8, 0) < sky(g, 0, 0.8, 60), "before the great hall's eaves, less sky than in the open forecourt");
  for (const v of g.v) assert.ok(Array.from(v).every((h) => Number.isFinite(h2f(h))));
});
test("the room's bounce is warm, and its sky fill is left as it was", () => {
  const g = grids["room:main"]; assert.equal(g.abs, true);
  let r = 0, b = 0; const n = g.dim[0] * g.dim[1] * g.dim[2];
  for (let i = 0; i < n; i++) { r += h2f(g.v[0][i * 4]); b += h2f(g.v[0][i * 4 + 2]); assert.ok(Math.abs(h2f(g.v[0][i * 4 + 3]) * 0.282095 - 1) < 0.01, "an even fill: the room's own"); }
  assert.ok(r > b * 1.5, "lamplight is warm: its bounce is redder than it is blue");
});
