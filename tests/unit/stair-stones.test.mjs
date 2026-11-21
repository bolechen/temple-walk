// #460: a flight's stones are laid by the stone shader from numbers stairGeo writes into every vertex (the attribute
// `stair`, geo.js). The shader cannot be run in Node, so this holds what it is given: the numbers are there, whole and
// finite, mean what geo.js says they mean, survive being merged and batched, and are the same every time.
import test from 'node:test';
import assert from 'node:assert/strict';
import './dom-stub.mjs';
import * as THREE from 'three';
import { stairGeo, stairProfile, stairCode, stairDecode, merge, mergeStatic, CHEEK_STONE } from '../../app/src/geo.js';

const turn = (y) => new THREE.Matrix4().makeTranslation(3, 0, -7).multiply(new THREE.Matrix4().makeRotationY(y));

test('every vertex of a flight carries four finite numbers, treads and cheeks told apart', () => {
  for (const [w, rise] of [[1.2, 0.36], [2.6, 1.5], [3.9, 1.44], [4.4, 3.6]]) {
    const { geo } = stairGeo(w, rise), a = geo.attributes.stair, { count } = stairProfile(rise);
    assert.equal(a.itemSize, 4); assert.equal(a.count, geo.attributes.position.count);
    let treads = 0, cheeks = 0;
    for (let i = 0; i < a.count; i++) {
      const [x, along, h, code] = [a.getX(i), a.getY(i), a.getZ(i), a.getW(i)];
      assert.ok([x, along, h, code].every(Number.isFinite), `${w} x ${rise}: vertex ${i}`);
      if (along >= 0) { treads++; assert.ok(along >= 0.03 - 1e-6 && along <= count - 1 + 0.97 + 1e-6, `tread coordinate ${along}`); assert.ok(Math.abs(x) <= w / 2 + 1e-6, 'a tread stays between the cheeks'); }
      else { cheeks++; assert.ok(x >= -1e-6 && x <= CHEEK_STONE.width + 1e-6, `a cheek's part lies within its width, got ${x}`); }
      if (count > 2) assert.equal(code, stairCode(count, 1, 0, w), 'with no place a flight is taken side-on');
    }
    assert.ok(treads > 0); assert.equal(cheeks > 0, count > 2, 'cheeks only where the flight has them');
  }
});

test('the flight-wide code reads back as what was put in', () => {
  for (const count of [1, 3, 17, 63]) for (const shade of [0, 1, 2]) for (const seed of [0, 7, 15]) for (const w of [1.2, 2.6, 3.9, 6]) {
    assert.deepEqual(stairDecode(stairCode(count, shade, seed, w)), { count, shade, seed, w });
  }
  // The shader takes it from a float that has been interpolated, so a code must be far from where rounding would tip it.
  assert.ok(stairCode(63, 3, 15, 6) < 2 ** 20, 'small enough to be interpolated with an error well under a half');
});

test('how little sun a flight sees follows from the way it comes down; where it stands only seeds it', () => {
  const shade = (y) => stairDecode(stairGeo(2.6, 1.5, { place: turn(y) }).geo.attributes.stair.getW(0)).shade;
  assert.equal(shade(0), 0, 'down toward the south: in the sun');
  assert.equal(shade(Math.PI / 2), 1, 'down toward the east: side-on');
  assert.equal(shade(-Math.PI / 2), 1, 'down toward the west: side-on');
  assert.equal(shade(Math.PI), 2, 'down toward the north: turned from the sun');
  const seed = (x, z) => stairDecode(stairGeo(2.6, 1.5, { place: new THREE.Matrix4().makeTranslation(x, 0, z) }).geo.attributes.stair.getW(0)).seed;
  assert.equal(seed(3, -7), seed(3, -7), 'the same place, the same stones');
  assert.ok(new Set([[0, 0], [5, 3], [-9, 40], [12, -22], [30, 8], [-4, -60]].map(([x, z]) => seed(x, z))).size > 2, 'flights in different places are not cut alike');
});

test('a placed flight is the same geometry as one placed after the fact, and the numbers do not move', () => {
  const m = turn(Math.PI / 2), a = stairGeo(2.6, 1.5, { place: m }).geo, b = stairGeo(2.6, 1.5).geo.applyMatrix4(m);
  assert.deepEqual([...a.attributes.position.array.slice(0, 300)], [...b.attributes.position.array.slice(0, 300)]);
  const free = stairGeo(2.6, 1.5).geo.attributes.stair, placed = a.attributes.stair;
  for (let i = 0; i < free.count; i++) for (let k = 0; k < 3; k++) assert.equal(placed.array[i * 4 + k], free.array[i * 4 + k], 'x, along and height are the flight\'s own');
});

test('the same flight twice is the same bytes', () => {
  const a = stairGeo(3.9, 1.44, { place: turn(Math.PI) }).geo.attributes.stair.array, b = stairGeo(3.9, 1.44, { place: turn(Math.PI) }).geo.attributes.stair.array;
  assert.deepEqual([...a], [...b]);
});

test('merging flights and batching them with mergeStatic keep the numbers', () => {
  const g = merge([stairGeo(2.6, 1.5, { place: turn(0) }).geo, stairGeo(3.9, 1.44, { place: turn(Math.PI) }).geo]);
  assert.ok(g.attributes.stair, 'merge keeps them');
  assert.equal(g.attributes.stair.count, g.attributes.position.count);
  const mat = new THREE.MeshBasicMaterial(), root = new THREE.Group(), n = g.attributes.position.count;
  g.setAttribute('ao', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
  root.add(new THREE.Mesh(g, mat));
  mergeStatic(root, [1e9], false);
  const out = root.children[0].geometry;
  assert.ok(out.attributes.stair, 'mergeStatic keeps them');
  assert.equal(out.attributes.stair.count, out.attributes.position.count);
});

// A level may lay its stones otherwise (STAIR_STYLE in materials.js): what it sets on the material while its site is built
// reaches the shader as uniforms when the program is first compiled, and what it leaves alone stays as the prologue has it.
const { createMaterials, STAIR_STYLE } = await import('../../app/src/materials.js');
const compiled = (steps) => { const sh = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>' }; steps.onBeforeCompile(sh); return sh; };
const uniformsOf = (sh) => Object.fromEntries(['uStoneW', 'uCheekL', 'uLeaves', 'uMoss'].map((k) => [k, sh.uniforms[k].value]));

test('the stone style starts as the prologue has it, and a level changes only what it names', () => {
  assert.deepEqual(STAIR_STYLE, { stoneW: 0.8, cheekL: 0.95, leaves: true, moss: true });
  const plain = compiled(createMaterials().steps);
  assert.deepEqual(uniformsOf(plain), { uStoneW: 0.8, uCheekL: 0.95, uLeaves: 1, uMoss: 1 });
  assert.match(plain.fragmentShader, /uniform float uStoneW, uCheekL, uLeaves, uMoss;/);
  const M = createMaterials(); M.steps.userData.stairStyle = { leaves: false, stoneW: 1.2 };
  assert.deepEqual(uniformsOf(compiled(M.steps)), { uStoneW: 1.2, uCheekL: 0.95, uLeaves: 0, uMoss: 1 });
  const again = compiled(createMaterials().steps);
  assert.equal(again.uniforms.uLeaves.value, 1, 'one material\'s style is not another\'s');
});

test('T05 has no bamboo and no moss on its stairs; the prologue\'s default is not touched', async () => {
  const T05 = await import('../../app/levels/t05/site.js');
  assert.deepEqual({ ...T05.STAIR_STYLE }, { leaves: false, moss: false });
  const M = createMaterials(); T05.buildSite(M);
  assert.equal(compiled(M.steps).uniforms.uLeaves.value, 0, 'T05 built its site: leaves off');
  assert.equal(compiled(M.steps).uniforms.uMoss.value, 0, 'and no moss: a clear cold early-winter day, the flight faces south and is dry');
  assert.equal(compiled(M.steps).uniforms.uStoneW.value, 0.8, 'its stones keep the size the art director passed (about 1.8 m a slab on the 9 m flight)');
  assert.equal(compiled(createMaterials().steps).uniforms.uMoss.value, 1, 'a page that never built T05 keeps its moss');
  assert.equal(compiled(createMaterials().steps).uniforms.uLeaves.value, 1, 'a page that never built T05 keeps its leaves');
});
