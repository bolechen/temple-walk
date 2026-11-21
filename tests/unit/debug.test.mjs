// `?debug`: the panel's readings and addresses, and the promises that keep it out of the published page.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs";
import "./dom-stub.mjs";
import * as THREE from "three";
import { rate, readout, tierSearch, roomPose, levelOf, levelState, LABELS, KEY, TIERS } from "../../app/src/debug.js";
import { HALL_VIEWS } from "../../app/levels/t00/hall-views.js";
import { buildSite } from "../../app/src/site.js";
import { buildInteriors } from "../../app/src/interior.js";

const yard = fs.readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
const check = fs.readFileSync(new URL("../../tools/check.cjs", import.meta.url), "utf8");

test("frames a second come from the walk's own counter, and nothing odd gives a number", () => {
  assert.equal(rate(100, 160, 1000), 60);
  assert.equal(rate(100, 115, 250), 60);
  assert.equal(rate(100, 100, 0), 0);
  assert.equal(rate(200, 100, 250), 0, "a counter that went back (a reload) is not a negative rate");
});

test("the readings say where he stands, how the frame goes and on what tier", () => {
  const r = readout({ x: 1.234, z: -29.5, yaw: 0.123, pitch: -0.05, h: 1.5, tris: 1234567, calls: 372, tier: "high", scale: 1, governed: 0, planar: 0.5, room: null }, 59.6);
  assert.equal(r.where, "1.23, -29.50"); assert.equal(r.look, "0.12 / -0.05"); assert.equal(r.height, "1.50");
  assert.equal(r.frame, "60 fps · 1235 k 面 · 372 次"); assert.equal(r.tier, "high ×1");
  const inside = readout({ x: 420, z: 2, yaw: 0, pitch: 0, h: -60, tris: 0, calls: 0, tier: "low", scale: 0.6, governed: 2, planar: 0, room: "lingxiao" }, 30);
  assert.match(inside.where, /· lingxiao$/); assert.equal(inside.tier, "low ×0.6 · 降 2 · 无倒影");
});

test("locking a tier loads the page again with q set, keeping every other parameter as written", () => {
  assert.equal(tierSearch("?debug&devpose&cam=0,29,0,0.1", "low"), "?debug&devpose&cam=0,29,0,0.1&q=low");
  assert.equal(tierSearch("?debug&q=low&cam=0,29,0,0.1", "high"), "?debug&q=high&cam=0,29,0,0.1");
  assert.equal(tierSearch("?debug&q=low", "auto"), "?debug");
  assert.equal(tierSearch("?q=low", "auto"), "");
  assert.deepEqual(TIERS, ["auto", "low", "medium", "high"]);
});

test("a room's view is stood at its room's centre line, which is the door he enters at", () => {
  const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
  const site = buildSite(M), rooms = buildInteriors(M, site.halls);
  for (const v of HALL_VIEWS) {
    const room = rooms.rooms[v.hall].room;
    assert.equal(room.door[0], room.cx, `${v.hall}: the door is not on the centre line`);
    assert.deepEqual(roomPose(v, room.door[0]), [room.cx + v.abs[0], v.abs[1], v.abs[2], v.abs[3]]);
  }
});

test("the room views are the level's own: ?level when it has a table, else the prologue", () => {
  assert.equal(levelOf("?debug", ["t00"]), "t00");
  assert.equal(levelOf("?debug&level=t01", ["t00", "t01"]), "t01");
  assert.equal(levelOf("?debug&level=../t00", ["t00"]), "t00");
  assert.equal(levelOf("", []), null);
});

test("every switch the page offers has a name on the panel", () => {
  const made = [...yard.matchAll(/part\("([a-z]+)"/g)].map((m) => m[1]).filter((n) => n !== "monk" && n !== "interior");
  const offered = [...new Set(made), ...JSON.parse(yard.match(/PASSES = (\[[^\]]*\])/)[1])];
  assert.deepEqual(Object.keys(LABELS).sort(), offered.sort());
});

test("the panel opens by itself on the dev server and a preview, on the canary only with ?debug=1, and is fetched nowhere else", () => {
  // The gate is src/debuggate.js (its own test holds every host); yard.js asks it and imports the panel only behind it.
  assert.match(yard, /const DEBUG = debugGate\(\{ dev: !!import\.meta\.env\.DEV, hostname: location\.hostname, search: location\.search \}\);\s*if \(DEBUG\) \{\s*const \{ mountDebug \} = await import\("\.\/src\/debug\.js"\)/);
  const host = /-temple-walk-preview\./;
  assert.ok(!host.test("temple-walk-canary.bole-chen.workers.dev"), "the canary is not a preview: its panel waits for ?debug=1 (2026-11-20)");
  for (const h of ["pr-68-temple-walk-preview.bole-chen.workers.dev", "06c1ed68-temple-walk-preview.bole-chen.workers.dev"]) assert.ok(host.test(h), h);
  for (const h of ["temple.rushiwowen.co", "bolechen.github.io", "127.0.0.1", "temple-walk-preview.example.com"]) assert.ok(!host.test(h), h);
  assert.ok(!/^import .*debug\.js/m.test(yard), "a static import would put it in the published build");
  assert.match(check, /DEV_ONLY = \[path\.join\(root, "src", "debug\.js"\)\]/, "only the dev-only panel is spared the font check");
});

test("its key is one the walk does not use", () => {
  assert.equal(KEY, "Backquote");
  const keys = yard.slice(yard.indexOf('addEventListener("keydown"'), yard.indexOf('addEventListener("blur"'));
  assert.ok(!keys.includes("`") && !keys.includes("Backquote"), "the walk already answers to the key left of 1");
});

// The key must answer with focus on any control of the panel. A bubble-phase listener is answered after the
// control's own handlers, which may stop the event; capture is the phase that cannot be stopped from inside.
test("the panel's key listens in the capture phase, so focus on a control cannot swallow it", () => {
  const dbg = fs.readFileSync(new URL("../../app/src/debug.js", import.meta.url), "utf8");
  assert.match(dbg, /addEventListener\("keydown", \(e\) => \{[^}]*KEY[^}]*\}, true\);/);
});

test("the level's completion is its seals, the next observance and the visit so far", () => {
  const early = levelState({ count: 2, total: 7, done: false, next: "tea", nextPlace: "茶寮", nextSeal: "吃茶", seals: { bell: 1, incense: 2 }, earned: ["闻钟", "上香"] }, { metres: 1234, seconds: 3599 });
  assert.deepEqual(early, { state: "未完成", progress: "2 / 7 枚朱印", next: "茶寮 · 吃茶", seals: "闻钟 · 上香", visit: "1234 步 · 60 分钟" });
  const full = levelState({ count: 7, total: 7, done: true, next: null, seals: { bell: 1, incense: 1, tea: 1, sutra: 1, well: 1, lamp: 1, sit: 1 }, earned: ["闻钟", "上香", "吃茶", "得句", "观水", "燃灯", "静坐"] }, {});
  assert.deepEqual(full, { state: "已完成", progress: "7 / 7 枚朱印", next: "—", seals: "闻钟 · 上香 · 吃茶 · 得句 · 观水 · 燃灯 · 静坐", visit: "0 步 · 1 分钟" });
  assert.equal(levelState({ count: 0, done: false, next: "bell" }).progress, "0 / 0 枚朱印", "a hook without a total still gives a number");
});
