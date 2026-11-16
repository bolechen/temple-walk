import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loader(hostname = "") {
  const elements = new Map(), handlers = new Map(), tracked = []; let reloads = 0, paints = 0;
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { hidden: false, disabled: true, textContent: '', addEventListener(name, fn) { handlers.set(id + ':' + name, fn); } }); return elements.get(id); } };
  const context = vm.createContext({ document, window: { umami: { track(name) { tracked.push(name); } } }, location: { hostname, reload() { reloads++; } }, addEventListener(name, fn) { handlers.set(name, fn); }, requestAnimationFrame(fn) { paints++; queueMicrotask(fn); } });
  vm.runInContext(fs.readFileSync(new URL('../../app/loading.js', import.meta.url), 'utf8'), context);
  return { api: context.window.templeLoading, el: id => elements.get(id), event: name => handlers.get(name)(), reloads: () => reloads, paints: () => paints, tracked };
}
test('loading follows completed work, yields to paint and reserves 100 for readiness', async () => {
  const t = loader(); let previous = 0;
  for (let i = 0; i < 10; i++) { await t.api.step('山路'); assert.ok(t.el('loadProgress').value >= previous); previous = t.el('loadProgress').value; }
  assert.equal(previous, 70); assert.equal(t.paints(), 20);
  t.api.textures({ total: 10, loaded: 8, failed: ['fallback-a', 'fallback-b'] });
  assert.equal(t.el('loadProgress').value, 90);
  t.api.frame(3); assert.equal(t.el('loadProgress').value, 99);
  t.api.finish(); assert.equal(t.el('loadProgress').value, 100); assert.equal(t.el('loading').hidden, true);
});
test('late texture callbacks cannot move progress backwards', async () => {
  const t = loader(); await t.api.step('竹林');
  t.api.textures({ total: 10, loaded: 9, failed: [] }); const value = t.el('loadProgress').value;
  t.api.textures({ total: 10, loaded: 1, failed: [] }); assert.equal(t.el('loadProgress').value, value);
});
test('startup errors expose retry and cannot be reported as complete', () => {
  const t = loader(); t.event('unhandledrejection');
  assert.equal(t.el('loadRetry').hidden, false); assert.equal(t.el('enterBtn').disabled, true);
  t.api.finish(); assert.equal(t.el('loading').hidden, false);
  t.event('loadRetry:click'); assert.equal(t.reloads(), 1);
});
test('errors after startup do not reopen the loading screen', () => {
  const t = loader(); t.api.finish(); t.event('error'); assert.equal(t.el('loading').hidden, true);
});

test('a failed public load is counted once and a local failure is not', () => {
  const local = loader('127.0.0.1'); local.event('error'); assert.deepEqual(local.tracked, []);
  const live = loader('temple.rushiwowen.co'); live.event('error'); live.event('unhandledrejection');
  assert.deepEqual(live.tracked, ['demo.load_error']);
});
