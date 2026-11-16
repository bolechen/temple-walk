// Coming back to a visit: what is kept of where he was, and what the title offers for it.
import test from "node:test"; import assert from "node:assert/strict";
import { PLACE_KEY, sanitizePlace, readPlace, writePlace, clearPlace, labelOf, hasProgress, titleOffer } from "../../app/src/resume.js";

const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; };
const START = [0, 96];

test("a place is kept and read back, and a damaged or foreign save is ignored", () => {
  const s = store(); assert.equal(readPlace(s), null);
  assert.ok(writePlace(s, { x: 3.14159, z: -20.5, yaw: 1.23456, label: "钟楼", at: 5 }));
  assert.deepEqual(readPlace(s), { x: 3.14, z: -20.5, yaw: 1.235, label: "钟楼", at: 5, up: null });
  for (const bad of ["", "{", "null", "[]", '{"x":"3","z":1}', '{"x":1}', '{"x":1e9,"z":0}', '{"x":null,"z":2}']) { s.setItem(PLACE_KEY, bad); assert.equal(readPlace(s), null, bad); }
  assert.deepEqual(sanitizePlace({ x: 1, z: 2, yaw: "north", label: 7 }), { x: 1, z: 2, yaw: 0, label: "", at: 0, up: null });
  writePlace(s, { x: 1, z: 2 }); clearPlace(s); assert.equal(readPlace(s), null);
  assert.equal(readPlace({ getItem() { throw new Error("no storage"); } }), null, "a browser that refuses storage is not an error");
  assert.equal(writePlace({ setItem() { throw new Error("full"); } }, { x: 1, z: 2 }), false);
});
test("where he was is called by the hall he is in, the nearest place of an observance, or only the way", () => {
  const named = [{ place: "钟楼", at: [15.5, 36.9] }, { place: "茶寮", at: [-10.5, 23.2] }];
  assert.equal(labelOf({ x: 14, z: 30 }, null, named), "钟楼");
  assert.equal(labelOf({ x: -9, z: 20 }, null, named), "茶寮");
  assert.equal(labelOf({ x: 0, z: 90 }, null, named), "山路上");
  assert.equal(labelOf({ x: 14, z: 30 }, "大雄宝殿", named), "大雄宝殿", "indoors, the hall's own name");
});
test("a first visit is offered only the way in; a visit with a seal or a place up the mountain may be gone on with or begun again", () => {
  assert.equal(hasProgress(0, null, START), false);
  assert.equal(hasProgress(0, { x: 0.5, z: 94 }, START), false, "a few steps from the start is not yet a visit to come back to");
  assert.equal(hasProgress(0, { x: 0, z: 30 }, START), true); assert.equal(hasProgress(2, null, START), true);
  let o = titleOffer(0, 7, null, START); assert.deepEqual([o.going, o.enter, o.again, o.line], [false, "入山", "", ""]);
  o = titleOffer(0, 7, { x: 0, z: 30, label: "山路上" }, START); assert.deepEqual([o.going, o.enter, o.again, o.line], [true, "接着走", "从头走起", "上回停在山路上"]);
  assert.ok(!o.confirm.includes("朱印"), "with no seal there is none to lose");
  o = titleOffer(3, 7, { x: 15, z: 37, label: "钟楼" }, START); assert.equal(o.line, "已得三印 · 上回走到钟楼"); assert.ok(o.confirm.includes("朱印清空"));
  o = titleOffer(5, 7, null, START); assert.deepEqual([o.going, o.enter, o.line], [true, "接着走", "已得五印"]);
  o = titleOffer(7, 7, { x: 0, z: -123, label: "凌霄阁" }, START); assert.equal(o.line, "七印圆满 · 上回走到凌霄阁");
});
