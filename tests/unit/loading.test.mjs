import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function loader(hostname = "") {
  const elements = new Map(), handlers = new Map(), tracked = [], said = []; let reloads = 0, paints = 0;
  const document = { getElementById(id) { if (!elements.has(id)) elements.set(id, { hidden: false, disabled: true, textContent: '', addEventListener(name, fn) { handlers.set(id + ':' + name, fn); } }); return elements.get(id); } };
  const context = vm.createContext({ document, window: { __events: undefined, umami: { track(name, data) { tracked.push(name); said.push(data); } } }, location: { hostname, reload() { reloads++; } }, addEventListener(name, fn) { handlers.set(name, fn); }, requestAnimationFrame(fn) { paints++; queueMicrotask(fn); } });
  vm.runInContext(fs.readFileSync(new URL('../../app/loading.js', import.meta.url), 'utf8'), context);
  return { api: context.window.templeLoading, log: () => JSON.parse(JSON.stringify(context.window.__events || [])), el: id => elements.get(id), event: (name, ev) => handlers.get(name)(ev), reloads: () => reloads, paints: () => paints, tracked, said };
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

// A browser that cannot draw the temple at all (#190): the title says why in words, offers no "try again" (it would fail the
// same way), and the count says it was this and not a broken load.
test('a browser without WebGL is told why, is offered no retry, and is counted apart', () => {
  const live = loader('temple.rushiwowen.co');
  live.api.fail({ reason: 'webgl' });
  assert.equal(live.el('loadLabel').textContent, '浏览器不支持 WebGL 或未开启硬件加速');
  assert.equal(live.el('loadRetry').hidden, true, 'no retry for a browser that cannot draw');
  assert.equal(live.el('enterBtn').disabled, true);
  assert.deepEqual(live.tracked, ['demo.load_error']); assert.deepEqual(JSON.parse(JSON.stringify(live.said)), [{ lang: 'zh', reason: 'webgl', stage: 'boot', percent: '0', kind: 'webgl' }]);
  const broken = loader('temple.rushiwowen.co'); broken.event('error');
  assert.equal(broken.el('loadRetry').hidden, false, 'a load that broke may be tried again');
  assert.deepEqual(JSON.parse(JSON.stringify(broken.said)), [{ lang: 'zh', reason: 'error', stage: 'boot', percent: '0', kind: 'script-error' }]);
});

// #328: what a failed load says about itself. Four kinds, each with the step it stood at; nothing of the visitor in it.
const said = (t) => JSON.parse(JSON.stringify(t.said[0]));
const clean = (data) => { for (const [k, v] of Object.entries(data)) assert.ok(!/[?]|http/i.test(String(v)), `${k} carries a query or an address: ${v}`); };
const img = (src) => ({ target: { tagName: 'IMG', src } });
test('a script error says where it was thrown, in which step, and keeps the old reason', async () => {
  const t = loader('temple.rushiwowen.co'); await t.api.step('山门'); await t.api.step('殿堂');
  t.event('error', { message: 'x is not a function (https://temple.rushiwowen.co/assets/index-ab12.js?v=3&token=secret)', filename: 'https://temple.rushiwowen.co/assets/index-ab12.js?v=3', lineno: 42 });
  const d = said(t);
  assert.deepEqual([d.reason, d.kind, d.stage, d.where, d.percent], ['error', 'script-error', '殿堂', 'index-ab12.js:42', '14']);
  assert.equal(d.message, 'x is not a function (/assets/index-ab12.js)'); clean(d);
});
test('a resource that fails to load is named by its path on the site, or only by its host elsewhere', () => {
  const t = loader('temple.rushiwowen.co');
  t.event('error', img('https://temple.rushiwowen.co/shared/textures/stone_a.webp?cache=1#x'));
  const d = said(t); assert.deepEqual([d.kind, d.resource, d.stage, d.percent, d.reason], ['resource', '/shared/textures/stone_a.webp', 'boot', '0', 'error']); clean(d);
  const far = loader('temple.rushiwowen.co'); far.event('error', { target: { tagName: 'LINK', href: 'https://cdn.example.com/a/b.css?k=1' } });
  assert.equal(said(far).resource, 'cdn.example.com');
  const long = loader('temple.rushiwowen.co'); long.event('error', img('/' + 'a'.repeat(300) + '.png')); assert.equal(said(long).resource.length, 120);
});
test('a picture that fails is reported but does not end the walk; a script that fails does', () => {
  const t = loader('temple.rushiwowen.co'); t.event('error', img('/x.png')); assert.equal(t.el('loadRetry').hidden, false); assert.equal(t.el('enterBtn').disabled, true, 'not enabled by the report');
  assert.equal(t.el('loadLabel').textContent, ''); assert.equal(t.tracked.length, 1);
  const s = loader('temple.rushiwowen.co'); s.event('error', { target: { tagName: 'SCRIPT', src: '/assets/a.js' } });
  assert.equal(s.el('loadLabel').textContent, '山路 · 请再来一次'); assert.equal(said(s).kind, 'resource');
});
test('an unhandled rejection carries its message with any address cut to a path', () => {
  const t = loader('temple.rushiwowen.co');
  t.event('unhandledrejection', { reason: new Error('fetch failed for https://temple.rushiwowen.co/shared/walk/t00.bin?x=1 and https://other.example/y?z=2') });
  const d = said(t); assert.equal(d.kind, 'rejection'); assert.equal(d.message, 'fetch failed for /shared/walk/t00.bin and other.example'); clean(d);
  const plain = loader('temple.rushiwowen.co'); plain.event('unhandledrejection', { reason: 'boom?' }); assert.equal(said(plain).message, 'boom'); 
});
test('a surface that does not arrive is reported as a resource, once, with its path', () => {
  const t = loader('temple.rushiwowen.co');
  t.api.textures({ total: 4, loaded: 3, failed: ['a.webp'], failedUrls: ['https://temple.rushiwowen.co/shared/textures/a.webp'] });
  t.api.textures({ total: 4, loaded: 3, failed: ['a.webp', 'b.jpg'], failedUrls: ['https://temple.rushiwowen.co/shared/textures/a.webp', '/shared/textures/b.jpg'] });
  assert.equal(t.tracked.length, 1); assert.equal(said(t).resource, '/shared/textures/a.webp'); assert.equal(said(t).kind, 'resource');
});
test('only the first failure of a page is told, however many follow, and the log keeps it for the tests', () => {
  const t = loader('temple.rushiwowen.co');
  t.event('error', { message: 'first', filename: '/a.js', lineno: 1 }); t.event('error', { message: 'second' }); t.event('unhandledrejection', { reason: 'third' }); t.event('error', img('/z.png'));
  assert.equal(t.tracked.length, 1); assert.equal(said(t).message, 'first');
  assert.deepEqual(t.log().map((e) => e.name), ['demo.load_error']);
  const local = loader('127.0.0.1'); local.event('error', { message: 'm' }); assert.deepEqual(local.tracked, [], 'nothing sent from here'); assert.equal(local.log().length, 1, 'but the test can read it');
});
test('nothing after the page is ready is a failed load, resources included', () => {
  const t = loader('temple.rushiwowen.co'); t.api.finish(); t.event('error', img('/late.png')); assert.deepEqual(t.tracked, []);
});
