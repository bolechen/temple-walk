// #524 (ART-REVIEW B1): summer by day (J01) is lifted in light and colour, and nothing else about the sixteen seasons and
// hours moves. fixtures/mood-main-524.json is the table `moodOf` gave on main before that change, for the plain table and
// as the prologue and T05 each have it through their `moodFor`; every entry but summer-day must still equal it to the last number.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { readFileSync, writeFileSync } from "node:fs";
const { moodOf, SEASONS, TIMES } = await import("../../app/src/mood.js");
const t00 = (await import("../../app/levels/t00/level.js")).default, t05 = (await import("../../app/levels/t05/level.js")).default;
const plain = (m) => JSON.parse(JSON.stringify(m));
const take = () => { const o = {}; for (const [k, f] of [["plain", undefined], ["t00", t00.moodFor], ["t05", t05.moodFor]]) for (const s of SEASONS) for (const t of TIMES) o[`${k}:${s}-${t}`] = plain(moodOf(s, t, f)); return o; };
const FIX = new URL("./fixtures/mood-main-524.json", import.meta.url);
if (process.env.WRITE_FIXTURE) writeFileSync(FIX, JSON.stringify(take(), null, 1) + "\n");
const before = JSON.parse(readFileSync(FIX, "utf8"));

test("every mood but summer day is main's, to the last number (lut, sun, sky, mist, grade), plain and through each level", () => {
  const now = take();
  for (const k of Object.keys(before)) { if (k.endsWith(":summer-day")) continue; assert.deepEqual(now[k], before[k], k); }
  assert.equal(Object.keys(before).length, 48);
});
test("summer day keeps its table's shape: the same fields, the colour table still the identity", () => {
  const now = take();
  for (const k of ["plain", "t00"]) { const was = before[`${k}:summer-day`], is = now[`${k}:summer-day`]; assert.deepEqual(Object.keys(is).sort(), Object.keys(was).sort(), k); assert.deepEqual(is.lut, was.lut, `${k}: J01's colour table is the identity (the lift is made in the light)`); }
});
