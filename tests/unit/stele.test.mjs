// #520: the imperial stele in the stele pavilion is measured in its own length L, as the Yingzao Fashi measures it (the structure
// review's reading of juan 3, on the issue). The white model must keep those proportions, stay under the pavilion's columns, put the
// tortoise's head out of the stele's face, and not cost more faces than the issue allows.
import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import * as THREE from 'three';
import { buildStele, STELE, L } from '../../app/levels/t00/stele.js';

const M = { monolith: new THREE.MeshBasicMaterial() };
const tris = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('the measures are the book\'s, in L = 1.60 m', () => {
  near(L, 1.6, 1e-9, 'L');
  near(STELE.bodyW, 0.64, 1e-9, 'body width 0.40 L'); near(STELE.bodyT, 0.24, 1e-9, 'body thickness 0.15 L');
  near(STELE.headW, 0.704, 1e-9, 'head 0.44 L square'); near(STELE.headT, 0.288, 1e-9, 'head 0.18 L thick'); near(STELE.cloudH, 0.096, 1e-9, 'cloud plate 0.06 L');
  near(STELE.turtleLen, 1.28, 1e-9, 'the tortoise is twice the body\'s width long'); near(STELE.turtleH, 0.704, 1e-9, 'the tortoise 0.44 L high');
  near(STELE.plinthH, 0.16, 1e-9, 'plinth 0.1 L thick');
});

test('the whole stands 3.17 m above the platform, under the columns, and is the same whichever the tortoise\'s height', () => {
  const { height, group } = buildStele(M);
  near(height, 3.168, 0.005, 'height by the book: 1.98 L');
  const bb = new THREE.Box3().setFromObject(group);
  assert.ok(bb.max.y <= 3.2, `at most 3.2 m, got ${bb.max.y}`);
  assert.ok(bb.min.y >= -1e-6, 'nothing under the platform');
  const low = buildStele(M, { turtleH: 0.48 });
  assert.ok(low.height < height, 'a lower tortoise makes a lower stone');
});

test('the head is a little wider than the body, the tortoise\'s head is out in front of the face', () => {
  const { parts, S } = buildStele(M);
  const over = (S.headW - S.bodyW) / 2 / S.bodyW;
  assert.ok(over >= 0.04 && over <= 0.08, `the head overhangs by ${(over * 100).toFixed(1)}% of the body\'s width each side (4% to 8%)`);
  const t = new THREE.Box3().setFromObject(parts.turtle);
  assert.ok(t.max.z - S.bodyT / 2 >= 0.3, `the tortoise's head comes out ${(t.max.z - S.bodyT / 2).toFixed(2)} m from the face, 0.3 m at least`);
  const plinth = new THREE.Box3().setFromObject(parts.plinth);
  assert.ok(plinth.max.z >= t.max.z && plinth.min.z <= t.min.z, 'the plinth reaches past the tortoise\'s snout and tail');
  assert.ok(plinth.max.x >= t.max.x && plinth.min.x <= t.min.x, `the tortoise's feet stand inside the plinth (${t.max.x.toFixed(2)} against ${plinth.max.x.toFixed(2)})`);
});

test('what it adds costs under 2000 faces, split as the review asked: tortoise, head, body and plinth', () => {
  const { parts } = buildStele(M);
  const n = Object.fromEntries(Object.entries(parts).map(([k, m]) => [k, tris(m.geometry)]));
  assert.ok(n.turtle <= 900, `tortoise ${n.turtle}`); assert.ok(n.head <= 400, `head ${n.head}`); assert.ok(n.body + n.plinth <= 200, `body and plinth ${n.body + n.plinth}`);
  assert.ok(Object.values(n).reduce((a, b) => a + b, 0) <= 2000);
});

test('the parts are kept apart by merging, and each carries what the shader needs', () => {
  const { parts } = buildStele(M);
  for (const m of Object.values(parts)) { assert.ok(m.geometry.attributes.ao, 'a baked occlusion value'); assert.ok(m.userData.keep, 'kept out of the static merge'); }
});
