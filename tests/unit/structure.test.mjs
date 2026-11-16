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
// Let off, by the owner's decisions of 2026-11-16: the Lingxiao pavilion keeps its mass, so its two upper storeys keep
// their three small bays (too narrow for a set between the columns), and its ground storey, whose inner ring of
// columns now stands under the second storey's corners at 5.4 m, is left an end bay of 2.1 m with no set in it.
// Nothing else is let off, and the list is checked so that it cannot grow unnoticed.
const lingxiao = site.buildings.findIndex((b) => b.name === "凌霄阁" && (b.frame?.storey || 0) === 0);
const WAITING = new Set(built.filter((b) => { const i = site.buildings.indexOf(b); return i >= lingxiao && i <= lingxiao + 2; }));
const due = built.filter((b) => !WAITING.has(b));
const CHI = 0.31;
// The sets along the front of a building, west to east: on the column heads and between them.
const front = (f) => { const Z = f.zs[0]; return f.sets.filter((s) => Math.abs(s.z - Z) < 1e-6 && Math.abs(s.a) < 1e-6 || (Math.abs(s.z - Z) < 1e-6 && s.bay === undefined)).map((s) => s.x).sort((a, b) => a - b).filter((x, i, a) => !i || x - a[i - 1] > 1e-6); };
const side = (f) => { const X = f.xs[f.xs.length - 1]; return f.sets.filter((s) => Math.abs(s.x - X) < 1e-6).map((s) => s.z).sort((a, b) => a - b).filter((z, i, a) => !i || z - a[i - 1] > 1e-6); };
const inBay = (line, a, b) => line.filter((v) => v > a + 1e-6 && v < b - 1e-6).length;

test("every building is found, with its frame; only the Lingxiao pavilion's three storeys are let off the rules for bays", () => {
  assert.ok(built.length >= 18, `only ${built.length} buildings carry bracket sets`);
  assert.equal(WAITING.size, 3);
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

// Storeys (juan 4, 平坐): an upper storey's columns stand over the columns of the storey below, and a storey one can
// walk round stands on a balcony of its own: a ring of bracket sets a step shorter than the storey's, a board hung
// round its edge with the railing inside it, and the skirt roof below coming in under it.
// By the owner's decision (2026-11-16) the Lingxiao pavilion keeps its mass: its second storey answers for its four
// corner columns only, the rest carried on the balcony's beams. Its top storey answers for every column: the second
// storey is set out in five bays so that each of them has a line under it.
const pairs = site.buildings.map((b, i) => [b, site.buildings[i + 1]]).filter(([lo]) => lo.frame && lo.frame.under);
const on = (line, v) => line.some((u) => Math.abs(u - v) < 1e-6);
test("every column of an upper storey stands over a column of the storey below", () => {
  const wrong = []; let lingxiao = 0;
  for (const [lo, up] of pairs) {
    const X = Math.max(...up.frame.xs), Z = Math.max(...up.frame.zs), second = lo.name === "凌霄阁" && up.frame.storey === 1;
    for (const [x, z] of up.frame.cols) {
      const corner = Math.abs(Math.abs(x) - X) < 1e-6 && Math.abs(Math.abs(z) - Z) < 1e-6;
      if (second && !corner) { lingxiao++; continue; }
      if (!on(lo.frame.xs, x) || !on(lo.frame.zs, z)) wrong.push(`${up.name || lo.name} storey ${up.frame.storey + 1}: the column at ${x}, ${z} has nothing under it`);
    }
  }
  assert.deepEqual(wrong, []);
  assert.equal(lingxiao, 16, "only the Lingxiao pavilion's second storey, but for its corners, is let off");
});
const DOUBLE_EAVED = new Set(["释迦宝殿", "御碑亭"]);   // one hall under two roofs: no floor between them, so no balcony
test("a storey over a skirt roof stands on a balcony: bracket sets, a board round its edge, the railing inside, the skirt under it", () => {
  const wrong = []; let n = 0;
  for (const [lo, up] of pairs) { if (DOUBLE_EAVED.has(up.name)) { if (up.frame.ping) wrong.push(`${up.name}: a balcony between two eaves of one hall`); continue; }
    n++; const g = up.frame.ping, who = `${up.name || lo.name} storey ${up.frame.storey + 1}`;
    if (!g) { wrong.push(`${who}: no balcony`); continue; }
    if (g.sets !== up.frame.sets.length) wrong.push(`${who}: ${g.sets} sets under the balcony, ${up.frame.sets.length} under the roof`);
    if (!(g.reach < 0.88 && g.reach > 0.3)) wrong.push(`${who}: the balcony's sets should step out less far than the storey's own (${g.reach})`);
    if (!(g.board >= 0.4 && g.board <= 0.45)) wrong.push(`${who}: the board round the balcony should be two cai tall (${g.board})`);
    if (!(g.rail < g.edge)) wrong.push(`${who}: the railing stands outside the board`);
    const skirt = lo.frame.roof.at(lo.frame.roof.EZ - up.frame.zs[0]);
    if (!(skirt <= g.bottom + 1e-6)) wrong.push(`${who}: the skirt roof (${skirt.toFixed(2)}) comes in above the foot of the balcony's sets (${g.bottom.toFixed(2)})`); }
  assert.deepEqual(wrong, []); assert.equal(n, 4, "the gate, the library and the Lingxiao pavilion's two upper storeys");
});

test("every column of the Lingxiao pavilion's top storey stands on a line of columns of the second", () => {
  const i = site.buildings.findIndex((b) => b.name === "凌霄阁" && b.frame?.storey === 2), up = site.buildings[i].frame, lo = site.buildings[i - 1].frame;
  const hanging = up.cols.filter(([x, z]) => !on(lo.xs, x) || !on(lo.zs, z));
  assert.equal(up.cols.length, 12); assert.deepEqual(hanging, [], `${hanging.length} of its ${up.cols.length} columns stand over nothing`);
});
