// The grove's leaves let the overcast sky through (#758): a spray says how open to the sky it is, the knee-high clumps under the
// culms in their shade take none, and every other crown is drawn exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import * as THREE from 'three';

const { createBamboo } = await import('../../app/src/bamboo.js');
const { crownMaterial } = await import('../../app/src/trees.js');
const compiled = (m) => { const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <map_fragment>\n#include <normal_fragment_begin>\n#include <emissivemap_fragment>' }; m.onBeforeCompile(sh); return sh; };

test('a spray high on its culm sees more sky than a low one; the clumps under the culms see none', () => {
  const scene = new THREE.Scene();
  createBamboo(scene, [{ x0: 0, x1: 6, z0: 0, z1: 6, n: 12 }], () => 0, () => true, { fine: true });
  const leaves = scene.children.find((o) => o.material?.customProgramCacheKey?.().startsWith('crown'));
  const g = leaves.geometry, thru = g.getAttribute('thru'), pos = g.getAttribute('position');
  assert.ok(thru, 'every leaf card carries how open it is');
  let low = 0, high = [];
  for (let i = 0; i < thru.count; i++) {
    const t = thru.getX(i), y = pos.getY(i);
    assert.ok(t >= 0 && t <= 1);
    if (y < 1.4) { low++; assert.equal(t, 0, 'a clump at knee height takes no sky through'); }
    else high.push([y, t]);
  }
  assert.ok(low > 0 && high.length > 0);
  assert.ok(high.every(([, t]) => t >= 0.25), 'a spray deep in the plume still takes a quarter');
  const top = high.filter(([y]) => y > 9).map(([, t]) => t), mid = high.filter(([y]) => y < 6).map(([, t]) => t);
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  assert.ok(mean(top) > mean(mid), 'the top of the plume is more open than its lower sprays');
});

test('a crown that asks for no sky through is drawn as before: no attribute, no term, the same program', () => {
  const m = crownMaterial(null, {}), sh = compiled(m);
  assert.doesNotMatch(sh.vertexShader, /thru/);
  assert.doesNotMatch(sh.fragmentShader, /uAmb\*/);
  assert.doesNotMatch(m.customProgramCacheKey(), /t0/);
  const b = compiled(crownMaterial(null, { skyThru: 0.6 }));
  assert.match(b.vertexShader, /attribute float thru;/);
  assert.match(b.fragmentShader, /uAmb\*0\.60\*vThru/);
});
