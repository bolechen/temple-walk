import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loader(hostname = "") {
  const elements = new Map(), handlers = new Map(), tracked = [], said = []; let reloads = 0, paints = 0;
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { hidden: false, disabled: true, textContent: '', addEventListener(name, fn) { handlers.set(id + ':' + name, fn); } }); return elements.get(id); } };
  const context = vm.createContext({ document, window: { umami: { track(name, data) { tracked.push(name); said.push(data); } } }, location: { hostname, reload() { reloads++; } }, addEventListener(name, fn, capture) { handlers.set(name + (capture ? ':capture' : ''), fn); }, requestAnimationFrame(fn) { paints++; queueMicrotask(fn); } });
  vm.runInContext(fs.readFileSync(new URL('../../app/loading.js', import.meta.url), 'utf8'), context);
  return { window: context.window, api: context.window.templeLoading, el: id => elements.get(id), event: (name, ...args) => handlers.get(name)(...args), reloads: () => reloads, paints: () => paints, tracked, said };
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

// The failure names what broke (#326): the file that failed, the step the page had reached, and where the code threw.
const sent = (t) => JSON.parse(JSON.stringify(t.said));
test('a failed load names the asset and the step it stopped at', () => {
  const live = loader('temple.rushiwowen.co');
  live.api.step(' surfaces ');
  live.api.fail({ reason: 'error', asset: 'https://example.test/tex/a.webp?x=1', stage: '大殿' });
  assert.deepEqual(sent(live), [{ reason: 'error', asset: 'a.webp', stage: '大殿', where: '' }]);
  const noName = loader('temple.rushiwowen.co');
  noName.event('unhandledrejection');
  assert.deepEqual(sent(noName), [{ reason: 'error', asset: '', stage: '', where: '' }]);
});

// A picture in the page that fails does not bubble to the window: only the capture phase hears it, and it is remembered,
// not taken for the load failing; a later failure names it.
test('a picture that fails without bubbling is remembered, not failed, and named by the next failure', () => {
  const live = loader('temple.rushiwowen.co');
  live.api.step('大殿');
  const img = { src: 'https://example.test/shared/textures/stone_a.webp?v=2' };
  live.event('error:capture', { target: img, bubbles: false });
  assert.deepEqual(live.tracked, [], 'one picture missing is not the load failing');
  assert.notEqual(live.el('loadLabel').textContent, '山路 · 请再来一次', 'the title should not say the load failed');
  live.api.finish(); assert.equal(live.el('loading').hidden, true, 'the load still finishes');
  live.event('error', { filename: 'https://temple.example/assets/late.js', lineno: 3 }); assert.deepEqual(live.tracked, [], 'after finishing nothing is counted');
  // On another page the same missing picture comes before a real failure, which then names it.
  const again = loader('temple.rushiwowen.co'); again.api.step('大殿'); again.event('error:capture', { target: img, bubbles: false });
  again.api.fail({ reason: 'error' });
  assert.deepEqual(sent(again), [{ reason: 'error', asset: 'stone_a.webp', stage: '大殿', where: '' }]);
  // The window itself as a target (a script's ErrorEvent seen in capture) is not a resource.
  const own = loader('temple.rushiwowen.co'); own.event('error:capture', { target: own.window }); own.api.fail({}); assert.equal(sent(own)[0].asset, '');
});

test('a script that throws is named by its file and line, a rejected fetch by the file in its message', () => {
  const thrown = loader('temple.rushiwowen.co');
  thrown.api.step('山门');
  thrown.event('error', { target: undefined, filename: 'https://temple.example/assets/yard-3f9a.js?x=1', lineno: 722, message: 'boom' });
  assert.deepEqual(sent(thrown), [{ reason: 'error', asset: '', stage: '山门', where: 'yard-3f9a.js:722' }]);
  const fetched = loader('temple.rushiwowen.co');
  fetched.event('unhandledrejection', { reason: new Error('fetch for "https://temple.example/shared/models/buddha.glb?v=1" responded with 404: Not Found') });
  assert.deepEqual(sent(fetched), [{ reason: 'error', asset: 'buddha.glb', stage: '', where: 'fetch for "buddha.glb" responded with 404: Not Fou' }]);
  const bare = loader('temple.rushiwowen.co');
  bare.event('unhandledrejection', { reason: 'no gl' });
  assert.deepEqual(sent(bare), [{ reason: 'error', asset: '', stage: '', where: 'no gl' }]);
});

// A browser that cannot draw the temple at all (#190): the title says why in words, offers no "try again" (it would fail the
// same way), and the count says it was this and not a broken load.
test('a browser without WebGL is told why, is offered no retry, and is counted apart', () => {
  const live = loader('temple.rushiwowen.co');
  live.api.fail({ reason: 'webgl' });
  assert.equal(live.el('loadLabel').textContent, '浏览器不支持 WebGL 或未开启硬件加速');
  assert.equal(live.el('loadRetry').hidden, true, 'no retry for a browser that cannot draw');
  assert.equal(live.el('enterBtn').disabled, true);
  assert.deepEqual(live.tracked, ['demo.load_error']); assert.deepEqual(JSON.parse(JSON.stringify(live.said)), [{ reason: 'webgl', asset: '', stage: '', where: '' }]);
  const broken = loader('temple.rushiwowen.co'); broken.event('error');
  assert.equal(broken.el('loadRetry').hidden, false, 'a load that broke may be tried again');
  assert.deepEqual(JSON.parse(JSON.stringify(broken.said)), [{ reason: 'error', asset: '', stage: '', where: '' }]);
});
