import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../../app/vendor/three/build/three.module.js';

// Exercise the actual event registrations without constructing/rendering the temple.
function controls(view = 'first', photoMode = false, set = { sens: 1, invertY: false }) {
  const source = fs.readFileSync(new URL('../../app/yard.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const canvas = { style: {}, setPointerCapture() {}, addEventListener(name, fn) { handlers.set('canvas:' + name, fn); } };
  const document = { pointerLockElement: null, addEventListener(name, fn) { handlers.set('document:' + name, fn); } };
  const c = vm.createContext({ THREE, canvas, document, performance, view, photo: { on: photoMode, dist: 4.6 }, yaw: 0, pitch: 0, down: null, settings: { get: () => set } });
  vm.runInContext(source.slice(source.indexOf('const touches = new Map()'), source.indexOf('const lift = (e)')), c);
  return {
    send(target, name, values = {}) { handlers.get(target + ':' + name)({ pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, ...values }); },
    lock() { document.pointerLockElement = canvas; },
    state() { return { yaw: c.yaw, pitch: c.pitch }; },
  };
}

for (const [view, photo] of [['first', false], ['third', false], ['third', true]]) {
  test(`${view}${photo ? ' photo' : ''}: trackpad click-drag looks right/down, matching locked mouse`, () => {
    const drag = controls(view, photo), locked = controls(view, photo);
    drag.send('canvas', 'pointerdown');
    drag.send('canvas', 'pointermove', { clientX: 120, clientY: 120 });
    locked.lock(); locked.send('document', 'mousemove', { movementX: 20, movementY: 20 });
    for (const input of [drag, locked]) {
      const s = input.state();
      const camera = new THREE.PerspectiveCamera(); camera.rotation.set(s.pitch, -s.yaw, 0, 'YXZ');
      const forward = camera.getWorldDirection(new THREE.Vector3());
      assert.ok(forward.x > 0, 'rightward pointer movement should look right');
      assert.ok(forward.y < 0, 'downward pointer movement should look down');
    }
  });
}
test('locked mouse button drag is applied only once', () => {
  const c = controls(); c.lock(); c.send('canvas', 'pointerdown');
  c.send('document', 'mousemove', { movementX: 20, movementY: 20 });
  const before = c.state();
  c.send('canvas', 'pointermove', { clientX: 120, clientY: 120 });
  assert.deepEqual(c.state(), before);
});
test('touch drag has the same camera direction and small taps do not rotate', () => {
  const c = controls(); c.send('canvas', 'pointerdown', { pointerType: 'touch' });
  c.send('canvas', 'pointermove', { pointerType: 'touch', clientX: 103, clientY: 102 });
  assert.deepEqual(c.state(), { yaw: 0, pitch: 0 });
  c.send('canvas', 'pointermove', { pointerType: 'touch', clientX: 120, clientY: 120 });
  assert.ok(c.state().yaw > 0 && c.state().pitch < 0);
});

test('the visitor\'s own settings turn the head faster and, if asked, the other way up', () => {
  const plain = controls(), fast = controls('first', false, { sens: 2, invertY: false }), flipped = controls('first', false, { sens: 1, invertY: true });
  for (const c of [plain, fast, flipped]) { c.lock(); c.send('document', 'mousemove', { movementX: 20, movementY: 20 }); }
  assert.ok(Math.abs(fast.state().yaw - 2 * plain.state().yaw) < 1e-9, 'twice the sensitivity should turn twice as far');
  assert.ok(Math.abs(flipped.state().pitch + plain.state().pitch) < 1e-9 && flipped.state().yaw === plain.state().yaw, 'inverted look reverses up and down only');
  const drag = controls('first', false, { sens: 1, invertY: true }); drag.send('canvas', 'pointerdown'); drag.send('canvas', 'pointermove', { clientX: 120, clientY: 120 });
  assert.ok(Math.sign(drag.state().pitch) === Math.sign(flipped.state().pitch), 'a drag follows the same setting');
});
