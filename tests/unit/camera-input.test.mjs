import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';

// Exercise the actual event registrations without constructing/rendering the temple.
function controls(view = 'first', photoMode = false, set = { sens: 1, invertY: false }, inside = false) {
  const source = fs.readFileSync(new URL('../../app/yard.js', import.meta.url), 'utf8');
  const handlers = new Map();
  const canvas = { style: {}, clientHeight: 800, setPointerCapture() {}, addEventListener(name, fn) { handlers.set('canvas:' + name, fn); } };
  const document = { pointerLockElement: null, addEventListener(name, fn) { handlers.set('document:' + name, fn); } };
  const c = vm.createContext({ THREE, camera: { fov: 50 }, canvas, document, performance, view, photo: { on: photoMode, dist: 4.6 }, yaw: 0, pitch: 0, down: null, inside, settings: { get: () => set }, director: { back() { c.backs = (c.backs || 0) + 1; } }, hints: { say: { dragged() {}, nearest() {} } } });
  vm.runInContext(source.slice(source.indexOf('const touches = new Map()'), source.indexOf('const lift = (e)')), c);
  return {
    send(target, name, values = {}) { handlers.get(target + ':' + name)({ pointerId: 1, pointerType: 'mouse', clientX: 100, clientY: 100, ...values }); },
    lock() { document.pointerLockElement = canvas; },
    state() { return { yaw: c.yaw, pitch: c.pitch }; },
    backs: () => c.backs || 0,
  };
}

for (const [view, photo] of [['first', false], ['third', false]]) {
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
// With the camera raised for a photograph the view is held still: neither a drag nor the held mouse turns it.
test('photo: neither a click-drag nor the locked mouse turns the camera', () => {
  for (const view of ['first', 'third']) {
    const drag = controls(view, true), locked = controls(view, true);
    drag.send('canvas', 'pointerdown'); drag.send('canvas', 'pointermove', { clientX: 160, clientY: 140 });
    locked.lock(); locked.send('document', 'mousemove', { movementX: 40, movementY: 30 });
    for (const input of [drag, locked]) assert.deepEqual(input.state(), { yaw: 0, pitch: 0 }, `${view}: the raised camera turned`);
  }
});
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

test('first person: indoors the eye lifts to the ceiling, outdoors no higher than before; the view from behind is unchanged', () => {
  const up = (view, inside) => { const c = controls(view, false, { sens: 1, invertY: false }, inside); c.lock(); for (let i = 0; i < 50; i++) c.send('document', 'mousemove', { movementX: 0, movementY: -100 }); return c.state().pitch; };
  assert.equal(up('first', false), 0.5);
  assert.equal(up('first', true), 0.9);
  assert.equal(up('third', true), up('third', false));
});

// Visitors said the view swam about when the mouse moved (2026-11-16): the held mouse turned 0.15° a count, about
// 7.7 cm of desk to turn right round at 800 dpi, and a drag turned 0.24° a pixel, five times as fast as the pointer.
test('a held mouse turns about as far as 《小王子》 turns it, and a drag keeps near the pointer', () => {
  const held = controls('third'); held.lock(); held.send('document', 'mousemove', { movementX: 100, movementY: 0 });
  const perCount = held.state().yaw / 100, deskToTurn = (2 * Math.PI / perCount) / 800 * 2.54;
  assert.ok(deskToTurn > 10 && deskToTurn < 16, `a full turn takes ${deskToTurn.toFixed(1)} cm of desk at 800 dpi`);
  const drag = controls('third'); drag.send('canvas', 'pointerdown'); drag.send('canvas', 'pointermove', { clientX: 200, clientY: 100 });
  const pointer = (50 * Math.PI / 180) / 800, ratio = drag.state().yaw / 100 / pointer;   // what moving the picture with the pointer would turn
  assert.ok(ratio > 1.2 && ratio < 2, `a mouse drag turns the picture ${ratio.toFixed(2)} times as fast as the pointer moves`);
});
test('one report larger than any hand gives (the browser re-centring the hidden pointer) does not swing the view', () => {
  const c = controls('third'); c.lock();
  c.send('document', 'mousemove', { movementX: 900, movementY: 0 }); c.send('document', 'mousemove', { movementX: 0, movementY: -700 });
  assert.deepEqual(c.state(), { yaw: 0, pitch: 0 });
  c.send('document', 'mousemove', { movementX: 40, movementY: 0 }); assert.ok(c.state().yaw > 0, 'an ordinary movement still turns it');
});

// While an observance is shown from its place's own shot (src/director.js), a drag of the view or any turn of the held
// mouse is the visitor wanting to look for themselves: the eye goes back to following him at once. A small tap does not.
test('a drag or a held mouse sends the eye back from a place\'s shot; a tap does not', () => {
  for (const view of ['first', 'third']) {
    const drag = controls(view), locked = controls(view), tap = controls(view);
    drag.send('canvas', 'pointerdown'); drag.send('canvas', 'pointermove', { clientX: 130, clientY: 100 });
    locked.lock(); locked.send('document', 'mousemove', { movementX: 4, movementY: 0 });
    tap.send('canvas', 'pointerdown'); tap.send('canvas', 'pointermove', { clientX: 102, clientY: 101 });
    assert.ok(drag.backs() > 0, `${view}: a drag should send the eye back`);
    assert.ok(locked.backs() > 0, `${view}: the held mouse should send the eye back`);
    assert.equal(tap.backs(), 0, `${view}: a tap that hardly moves should not`);
  }
});
