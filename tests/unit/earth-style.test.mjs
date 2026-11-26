// A level's bare earth outdoors (EARTH_STYLE in materials.js, #758): the shared material only opens a way to read it, the prologue
// sets its own lighter earth, and a level that sets nothing (T05) draws it exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';

const { createMaterials, EARTH_STYLE } = await import('../../app/src/materials.js');
const compiled = (m) => { const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' }; m.onBeforeCompile(sh); return sh; };
const gain = (M) => compiled(M.earth).uniforms.uEarthGain.value;

test('the earth starts as every level had it', () => {
  assert.deepEqual({ ...EARTH_STYLE }, { gain: 1 });
  assert.equal(gain(createMaterials()), 1);
  assert.match(compiled(createMaterials().earth).fragmentShader, /\*uEarthGain;/);
});

test('the prologue sets its own earth; a page that built T05 keeps the old one', async () => {
  const T00 = await import('../../app/levels/t00/site.js');
  assert.deepEqual({ ...T00.EARTH_STYLE }, { gain: 1.35 });
  const M = createMaterials(); T00.buildSite(M);
  assert.equal(gain(M), 1.35);
  const T05 = await import('../../app/levels/t05/site.js');
  const N = createMaterials(); T05.buildSite(N);
  assert.equal(gain(N), 1, 'T05 sets nothing and its earth is as it was');
});
