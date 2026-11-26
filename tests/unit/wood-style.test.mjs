// A level's outdoor timber (WOOD_STYLE in materials.js, #758): the shared materials only open a way to read it, the
// prologue sets its own lighter wood and lower damp, and a level that sets nothing (T05) draws its wood exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';

const { createMaterials, WOOD_STYLE } = await import('../../app/src/materials.js');
const compiled = (m) => { const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' }; m.onBeforeCompile(sh); return sh; };
const read = (M) => ['woodV', 'woodX', 'woodZ'].map((k) => { const u = compiled(M[k]).uniforms; return [u.uWoodGain.value, u.uWoodDamp.value]; });

test('the timber starts as every level had it: no gain, the damp to 2.2 m', () => {
  assert.deepEqual({ ...WOOD_STYLE }, { gain: 1, dampTop: 2.2 });
  assert.deepEqual(read(createMaterials()), [[1, 2.2], [1, 2.2], [1, 2.2]]);
  const sh = compiled(createMaterials().woodV);
  assert.match(sh.fragmentShader, /uniform float uWoodGain, uWoodDamp;/);
  assert.match(sh.fragmentShader, /smoothstep\(uWoodDamp,uWoodDamp-1\.3,/, 'the damp fades over the same 1.3 m it always did (2.2 to 0.9 by default)');
});

test('the indoor timber and the other woods are not touched', () => {
  const M = createMaterials(); M.woodStyle({ gain: 3, dampTop: 0 });
  for (const k of ['beamX', 'beamZ', 'pillar']) {
    const sh = compiled(M[k]);
    assert.equal(sh.uniforms.uWoodGain, undefined, `${k} keeps its own colour`);
    assert.match(sh.fragmentShader, /smoothstep\(2\.2,\.9,/, `${k} keeps its damp`);
  }
});

test('the prologue sets its own timber; a page that built T05 keeps the old one', async () => {
  const T00 = await import('../../app/levels/t00/site.js');
  assert.deepEqual({ ...T00.WOOD_STYLE }, { gain: 1.7, dampTop: 1.4 });
  const M = createMaterials(); T00.buildSite(M);
  assert.deepEqual(read(M), [[1.7, 1.4], [1.7, 1.4], [1.7, 1.4]], 'all three outdoor woods take it');
  const T05 = await import('../../app/levels/t05/site.js');
  const N = createMaterials(); T05.buildSite(N);
  assert.deepEqual(read(N), [[1, 2.2], [1, 2.2], [1, 2.2]], 'T05 sets nothing and its wood is as it was');
  assert.deepEqual(read(createMaterials()), [[1, 2.2], [1, 2.2], [1, 2.2]], 'one page\'s style is not another\'s');
});
