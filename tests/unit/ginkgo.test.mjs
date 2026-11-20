// The four ginkgoes of the courts are young male trees (#162, docs/t00/SOURCES.md): one straight leader to the top, boughs
// in whorls, a cone of a crown. Everything here is measured from the skeleton the tree was grown from, not from its picture.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite } = await import("../../app/src/site.js");
const { createTrees } = await import("../../app/src/trees.js");

const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), spots = site.trees.filter((t) => t[3] === "ginkgo");
const deg = (r) => (r * 180) / Math.PI;

{
  const grown = createTrees(new THREE.Group(), M, spots);
  const trees = grown.ginkgos.map((g) => {
    const h = g.h, [ax, az] = g.at, bs = g.boughs.map((b) => {
      const dx = b.to[0] - b.from[0], dz = b.to[2] - b.from[2], dy = b.to[1] - b.from[1];
      return { y: b.from[1] - g.base, tipY: b.to[1] - g.base, angle: deg(Math.atan2(Math.hypot(dx, dz), dy)), out: Math.hypot(b.to[0] - ax, b.to[2] - az) };
    }).sort((p, q) => p.y - q.y);
    const layers = []; for (const b of bs) { const L = layers[layers.length - 1]; if (L && b.y - L.top < 0.35) { L.boughs.push(b); L.top = b.y; } else layers.push({ boughs: [b], first: b.y, top: b.y }); }
    return { g, h, bs, layers };
  });
  test(`all four ginkgoes are grown, at the heights the plan gives`, () => {
    assert.deepEqual(trees.map((t) => t.h).sort((p, q) => p - q), [8, 9, 9.5, 11]);
    for (const t of trees) assert.ok(t.bs.length >= 15, `the ${t.h} m ginkgo has ${t.bs.length} boughs`);
  });
  test(`the crown is a cone: 0.45-0.65 as wide as the tree is tall, widest in its lower third`, () => {
    for (const t of trees) {
      const ratio = (2 * Math.max(...t.bs.map((b) => b.out))) / t.h; assert.ok(ratio >= 0.45 && ratio <= 0.65, `the ${t.h} m ginkgo is ${ratio.toFixed(2)} as wide as tall`);
      const lo = t.bs[0].y, hi = t.h, widest = t.bs.reduce((a, b) => (b.out > a.out ? b : a));
      assert.ok(widest.tipY <= lo + (hi - lo) / 3, `the ${t.h} m ginkgo is widest at ${widest.tipY.toFixed(1)} m, crown ${lo.toFixed(1)}-${hi.toFixed(1)} m`);
      // and it narrows above: the upper third reaches less than half as far as the widest bough
      const upper = Math.max(...t.bs.filter((b) => b.y > lo + (2 * (hi - lo)) / 3).map((b) => b.out)); assert.ok(upper < 0.5 * widest.out, `the ${t.h} m ginkgo's top third reaches ${upper.toFixed(2)} of ${widest.out.toFixed(2)}`);
    }
  });
  test(`the leader is upright to the top and does not fork`, () => {
    for (const t of trees) {
      const tr = t.g.trunk, top = tr[tr.length - 1], foot = tr[0];
      assert.ok(top[1] - t.g.base >= t.h - 0.45, `the ${t.h} m ginkgo's leader ends at ${(top[1] - t.g.base).toFixed(2)} m`);
      for (const p of tr) assert.ok(Math.hypot(p[0] - top[0], p[2] - top[2]) < 0.12 + 0.1 * Math.abs(p[1] - top[1]) / t.h, `the leader strays ${Math.hypot(p[0] - top[0], p[2] - top[2]).toFixed(2)} m`);
      assert.ok(Math.hypot(top[0] - foot[0], top[2] - foot[2]) < 0.15, "the leader leans");
      // no bough goes higher than the leader, none leaves it above its tip: one leader, and every other limb below it
      for (const b of t.bs) assert.ok(b.tipY < t.h - 0.5, `a bough rises to ${b.tipY.toFixed(2)} m of ${t.h}`);
    }
  });
  test(`boughs come in whorls: 3-5 to a layer, a layer 0.6-1.2 m above the last, one layer's starts within 0.2 m`, () => {
    for (const t of trees) {
      assert.ok(t.layers.length >= 5, `the ${t.h} m ginkgo has ${t.layers.length} layers`);
      t.layers.forEach((L, i) => {
        assert.ok(L.boughs.length >= 3 && L.boughs.length <= 5, `the ${t.h} m ginkgo, layer ${i}: ${L.boughs.length} boughs`);
        assert.ok(L.top - L.first <= 0.2, `the ${t.h} m ginkgo, layer ${i}: starts spread over ${(L.top - L.first).toFixed(2)} m`);
        if (i) { const gap = (L.first + L.top) / 2 - (t.layers[i - 1].first + t.layers[i - 1].top) / 2; assert.ok(gap >= 0.6 && gap <= 1.2, `the ${t.h} m ginkgo, layer ${i}: ${gap.toFixed(2)} m above the one below`); }
      });
      assert.ok(t.layers[0].first >= 2.0 && t.layers[0].first <= 2.8 + 0.1, `the ${t.h} m ginkgo's lowest layer is at ${t.layers[0].first.toFixed(2)} m`);
    }
  });
  test(`boughs climb: 30-45 degrees off the leader in the upper half of the crown, 50-70 in the lower`, () => {
    for (const t of trees) {
      const lo = t.layers[0].first, hi = t.layers[t.layers.length - 1].top, mid = (lo + hi) / 2;
      for (const b of t.bs) { const [a, z] = b.y > mid ? [30, 45] : [50, 70]; assert.ok(b.angle >= a - 1 && b.angle <= z + 1, `the ${t.h} m ginkgo: a bough at ${b.y.toFixed(1)} m leaves at ${b.angle.toFixed(0)} degrees (wanted ${a}-${z})`); }
      const mean = (xs) => xs.reduce((s, v) => s + v.angle, 0) / xs.length, up = t.bs.filter((b) => b.y > mid), low = t.bs.filter((b) => b.y <= mid);
      assert.ok(mean(up) < mean(low) - 8, `the upper boughs (${mean(up).toFixed(0)}) should climb steeper than the lower (${mean(low).toFixed(0)})`);
    }
  });
  test(`a ginkgo bears no fruit and sheds none: nothing but wood and leaves is grown`, () => {
    // a male tree: the plan names no fruit anywhere, and the leaf sheet for a ginkgo is the only thing hung on it
    const kinds = new Set(grown.census.map((c) => c.kind)); assert.ok(kinds.has("ginkgo"));
    assert.ok(!("fruit" in grown) && !grown.census.some((c) => /fruit|nut/.test(c.kind)));
  });
  test(`a ginkgo grown twice is the same ginkgo, point for point`, () => {
    const again = createTrees(new THREE.Group(), M, spots);
    assert.deepEqual(again.ginkgos.map((g) => [g.trunk, g.boughs]), grown.ginkgos.map((g) => [g.trunk, g.boughs]));
    assert.deepEqual(again.census, grown.census);
  });
}
