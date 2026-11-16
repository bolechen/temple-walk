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
