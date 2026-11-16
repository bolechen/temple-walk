// The timber frame against the Yingzao Fashi (docs/t00/structure-review.md). Bays and the bracket sets between the
// columns (juan 4, 總鋪作次序): the middle bay of a front is the widest and carries two sets, every other bay one;
// bays do not widen toward the ends; and the sets stand evenly, no gap differing from the next by more than a Song
// foot (0.31 m).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), built = site.buildings.filter((b) => b.frame && b.frame.brackets && b.frame.xs.length > 1);
const label = (b, i) => `${b.name || "(unnamed)"} #${i}`;
// Left as they were, by the owner's decision on the first pull request (2026-11-16): the two upper storeys of the
// Lingxiao pavilion keep their three even bays until the storeys are set on balconies and over the columns below
// (structure review S-01, S-02). They are the pavilion's storeys above the first; nothing else is let off, and the
// list is checked so that it cannot grow unnoticed.
const lingxiao = site.buildings.findIndex((b) => b.name === "凌霄阁" && (b.frame?.storey || 0) === 0);
const WAITING = new Set(built.filter((b) => { const i = site.buildings.indexOf(b); return i > lingxiao && i <= lingxiao + 2 && b.frame.storey > 0; }));
const due = built.filter((b) => !WAITING.has(b));
const CHI = 0.31;
// The sets along the front of a building, west to east: on the column heads and between them.
const front = (f) => { const Z = f.zs[0]; return f.sets.filter((s) => Math.abs(s.z - Z) < 1e-6 && Math.abs(s.a) < 1e-6 || (Math.abs(s.z - Z) < 1e-6 && s.bay === undefined)).map((s) => s.x).sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > 1e-6); };
const side = (f) => { const X = f.xs[f.xs.length - 1]; return f.sets.filter((s) => Math.abs(s.x - X) < 1e-6).map((s) => s.z).sort((a, b) => a - b).filter((z, i, a) => !i || z - a[i - 1] > 1e-6); };
const inBay = (line, a, b) => line.filter((v) => v > a + 1e-6 && v < b - 1e-6).length;

test("every building is found, with its frame; only the Lingxiao pavilion's two upper storeys wait for the balconies", () => {
  assert.ok(built.length >= 18, `only ${built.length} buildings carry bracket sets`);
  assert.equal(WAITING.size, 2);
});

test("the middle bay of every front of three bays or more carries two sets between its columns, every other bay one", () => {
  const wrong = [];
  due.forEach((b, i) => { const { xs } = b.frame, n = xs.length - 1, line = front(b.frame); if (n < 3) return;
    for (let k = 0; k < n; k++) { const want = k === (n - 1) / 2 ? 2 : 1, got = inBay(line, xs[k], xs[k + 1]); if (got !== want) wrong.push(`${label(b, i)} bay ${k + 1} of ${n} (${(xs[k + 1] - xs[k]).toFixed(2)} m): ${got}, should be ${want}`); } });
  assert.deepEqual(wrong, []);
});

test("a front has an odd number of bays, the middle one the widest, and none wider than the one nearer the middle", () => {
  const wrong = [];
  due.forEach((b, i) => { const { xs } = b.frame, n = xs.length - 1, w = xs.slice(1).map((x, k) => +(x - xs[k]).toFixed(3)), mid = (n - 1) / 2;
    if (n % 2 === 0) { wrong.push(`${label(b, i)}: ${n} bays across the front`); return; }
    for (let k = 0; k < mid; k++) if (w[k] > w[k + 1] + 1e-6 || w[n - 1 - k] > w[n - 2 - k] + 1e-6) wrong.push(`${label(b, i)}: bays ${w.join(" / ")}`);
    if (n >= 3 && !(w[mid] > w[mid - 1])) wrong.push(`${label(b, i)}: the middle bay is not the widest (${w.join(" / ")})`); });
  assert.deepEqual([...new Set(wrong)], []);
});

test("the sets stand evenly: along any face, no gap between two sets differs from the next gap by more than a Song foot", () => {
  const wrong = [];
  due.forEach((b, i) => { for (const [name, line] of [["front", front(b.frame)], ["side", side(b.frame)]]) {
    const gaps = line.slice(1).map((v, k) => v - line[k]);
    for (let k = 1; k < gaps.length; k++) if (Math.abs(gaps[k] - gaps[k - 1]) > CHI + 1e-6) { wrong.push(`${label(b, i)} ${name}: gaps ${gaps.map((g) => g.toFixed(2)).join(" ")}`); break; } } });
  assert.deepEqual(wrong, []);
});

test("no two sets stand so near that their long arms would run into each other", () => {
  const ARM = 1.32, wrong = [];   // the long arm over the wall (慢栱, 92 fen)
  due.forEach((b, i) => { for (const line of [front(b.frame), side(b.frame)]) for (let k = 1; k < line.length; k++) if (line[k] - line[k - 1] < ARM - 1e-6) { wrong.push(`${label(b, i)}: ${(line[k] - line[k - 1]).toFixed(2)} m apart`); break; } });
  assert.deepEqual(wrong, []);
});

// The pitch of the roofs (juan 5, 舉折): the ridge stands above the eave purlins by a third of the distance between
// the front and back purlins on a hall or a storeyed building, by 0.27 of it on a lesser hall (a quarter, and eight
// parts in a hundred more); a skirt roof under an upper storey rises one in two. Tent roofs are left as they were.
const LESSER = new Set(["禅堂", "茶寮", "药师殿", "大慧院"]);
const roofed = site.buildings.filter((b) => b.frame && b.frame.roof && b.frame.xs.length > 1);
test("the roof over every hall rises by the Fashi's share of its span, within a tenth", () => {
  const wrong = [];
  roofed.forEach((b, i) => { const r = b.frame.roof; if (r.tent || b.frame.under) return;
    const span = 2 * (r.EZ - r.purlin), rise = r.at(r.EZ) - r.at(r.purlin), want = LESSER.has(b.name) ? 0.27 : 1 / 3, got = rise / span;
    if (Math.abs(got / want - 1) > 0.1) wrong.push(`${label(b, i)}: rises ${got.toFixed(2)} of its span, should be ${want.toFixed(2)}`); });
  assert.deepEqual(wrong, []);
});
test("a skirt roof under an upper storey rises one in two from its eave purlin to the storey's wall", () => {
  const wrong = [];
  roofed.forEach((b, i) => { const r = b.frame.roof; if (!b.frame.under) return;
    const next = roofed[i + 1].frame, d = r.EZ - next.zs[0], got = (r.at(d) - r.at(r.purlin)) / (d - r.purlin);
    if (Math.abs(got / 0.5 - 1) > 0.1) wrong.push(`${label(b, i)}: rises ${got.toFixed(2)} in one, should be 0.50`); });
  assert.deepEqual(wrong, []);
});
test("a roof is folded, not bent: straight from purlin to purlin, each fall steeper than the one below, and the eave runs out along the lowest", () => {
  const wrong = [];
  roofed.forEach((b, i) => { const r = b.frame.roof; if (r.tent || b.frame.under) return;
    const slope = (d) => (r.at(d + 0.02) - r.at(d - 0.02)) / 0.04, s = []; for (let d = 0.1; d < r.EZ - 0.05; d += 0.1) s.push(slope(d));
    if (s.some((v, k) => k && v < s[k - 1] - 1e-6)) wrong.push(`${label(b, i)}: the roof grows flatter going up`);
    const kinds = new Set(s.map((v) => v.toFixed(3))).size; if (kinds > 8) wrong.push(`${label(b, i)}: ${kinds} different slopes: a curve, not falls between purlins`);
    if (Math.abs(slope(r.purlin * 0.5) - slope(r.purlin + 0.3)) > 1e-6) wrong.push(`${label(b, i)}: the eave does not run out along the lowest fall`); });
  assert.deepEqual(wrong, []);
});
