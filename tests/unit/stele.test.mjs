// #520: the imperial stele in the stele pavilion is a notched-head stone on a stepped base, measured as the Yingzao Fashi measures it (the
// structure review's reading of juan 3: 9.6 chi in all, the body 8 chi with its head, the base 0.2 of the body). The white model keeps those
// measures, stands on its base and in its pavilion, and costs what the issue allows.
import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import * as THREE from 'three';
import { buildStele, STELE } from '../../app/levels/t00/stele.js';

const M = { monolith: new THREE.MeshBasicMaterial() };
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('the measures are the book\'s: 2.98 m in all, the body 2.48 m, the base a fifth of it', () => {
  near(STELE.total, 2.98, 1e-9, 'total'); near(STELE.bodyH, 2.48, 1e-9, 'body'); near(STELE.baseH / STELE.bodyH, 0.2, 0.005, 'base is 0.2 of the body');
  near(STELE.tiers.reduce((a, t) => a + t[2], 0), STELE.baseH, 1e-9, 'the tiers add up to the base');
  const { height, group } = buildStele(M), bb = new THREE.Box3().setFromObject(group);
  near(height, 2.98, 0.005, 'height'); near(bb.max.y, 2.98, 0.01, 'top'); assert.ok(bb.min.y >= -1e-6, 'nothing under the platform');
  assert.ok(bb.max.y < 3.3, 'under the pavilion\'s columns');
});

test('the body is 0.99 by 0.37 m, the base wider and deeper, each tier drawn in from the one under it', () => {
  const { parts } = buildStele(M);
  const body = new THREE.Box3().setFromObject(parts.body), base = new THREE.Box3().setFromObject(parts.base);
  near(body.max.x - body.min.x, 0.99, 0.01, 'body width'); near(body.max.z - body.min.z, 0.37, 0.01, 'body thickness');
  near(base.max.x - base.min.x, 1.24, 0.01, 'base length across the face'); near(base.max.z - base.min.z, 0.77, 0.01, 'base depth');
  assert.ok(base.max.x - base.min.x > body.max.x - body.min.x + 0.2 && base.max.z - base.min.z > body.max.z - body.min.z + 0.3, 'the base carries the body with room to spare');
  assert.ok(base.min.x <= body.min.x && base.max.x >= body.max.x && base.min.z <= body.min.z && base.max.z >= body.max.z, 'the body stands inside the base\'s footprint');
  assert.ok(STELE.tiers.length >= 2 && STELE.tiers.length <= 3, 'two or three corbelled tiers');
  for (let i = 1; i < STELE.tiers.length; i++) assert.ok(STELE.tiers[i][0] < STELE.tiers[i - 1][0] && STELE.tiers[i][1] < STELE.tiers[i - 1][1], `tier ${i} is drawn in`);
});

test('the head is a low arc: it rises over the shoulders by a tenth of a metre, its corners rounded, not a point or a half-circle', () => {
  assert.ok(STELE.rise >= 0.08 && STELE.rise <= 0.16, `rise ${STELE.rise}`);
  assert.ok(STELE.round >= 0.05 && STELE.round <= 0.12, `corner radius ${STELE.round}`);
  // the highest point of the body is on its middle, and the shoulders are lower by about the rise
  const { parts } = buildStele(M), p = parts.body.geometry.attributes.position, top = (lo, hi) => { let m = -1; for (let i = 0; i < p.count; i++) { const x = p.getX(i); if (x >= lo && x <= hi) m = Math.max(m, p.getY(i)); } return m; };
  near(top(-0.02, 0.02), 2.98, 0.01, 'the crown');
  const sh = top(0.44, 0.5);
  assert.ok(2.98 - sh >= 0.1 && 2.98 - sh <= 0.25, `the shoulder is ${(2.98 - sh).toFixed(3)} m under the crown (the rise, and the round of the corner)`);
});

test('a border stands round the face and a title\'s frame is sunk in its top, both shallow', () => {
  assert.ok(STELE.border >= 0.06 && STELE.border <= 0.08, 'a border of 6 to 8 cm');
  assert.ok(STELE.recess > 0.005 && STELE.recess <= 0.03, 'the field lies a little behind the border');
  assert.ok(STELE.title.recess > 0.005 && STELE.title.recess <= 0.03, 'the title\'s frame is shallow');
  assert.ok(STELE.title.w < STELE.bodyW - 2 * STELE.border - 0.1, 'the title\'s frame is narrower than the field');
  assert.ok(STELE.chamfer >= 0.01 && STELE.chamfer <= 0.02, 'a chamfer of 1 to 2 cm');
});

test('it costs under 400 faces, the base and the body split as drawn', () => {
  const { parts } = buildStele(M), n = Object.fromEntries(Object.entries(parts).map(([k, m]) => [k, tris(m.geometry)]));
  assert.ok(n.base + n.body <= 400, `base ${n.base} and body ${n.body}`);
});

test('the parts are kept apart by merging, and each carries what the shader needs', () => {
  const { parts, foot } = buildStele(M);
  for (const m of Object.values(parts)) { assert.ok(m.geometry.attributes.ao, 'a baked occlusion value'); assert.ok(m.userData.keep, 'kept out of the static merge'); }
  near(foot.hx, 0.385, 1e-9, 'half the base\'s depth'); near(foot.hz, 0.62, 1e-9, 'half its length');
});
