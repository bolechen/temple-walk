// The short film (#342): which container, how large, how long, when the signature shows, what a visitor is told when the
// browser cannot share the file. The recording itself needs a browser: the `clip` scenario in tests/e2e/run.cjs.
import test from "node:test"; import assert from "node:assert/strict";
import { pickMime, clipSize, clipBits, sceneSecs, markAlpha, saveHint, clipName, CLIP, MIMES } from "../../app/src/clip.js";

test("MP4 where the browser writes it, WebM where it does not, nothing where it can do neither", () => {
  assert.equal(pickMime(() => true).ext, "mp4");
  assert.equal(pickMime((m) => m.startsWith("video/webm")).type, "video/webm");
  assert.equal(pickMime((m) => m === "video/webm").mime, "video/webm", "bare webm is the last resort");
  assert.equal(pickMime((m) => m.startsWith("video/mp4") && !m.includes("codecs")).mime, "video/mp4");
  assert.equal(pickMime(() => false), null);
  assert.equal(pickMime(() => { throw new Error("x"); }), null, "a browser that throws is one that cannot");
  assert.ok(MIMES.indexOf("video/mp4") < MIMES.indexOf("video/webm"));
});

test("the film's long side is 960 on every tier, the short side from the frame, both even", () => {
  assert.deepEqual(clipSize(3, 4), { w: 720, h: 960 });
  assert.deepEqual(clipSize(16, 9), { w: 960, h: 540 });
  assert.deepEqual(clipSize(1, 1), { w: 960, h: 960 });
  assert.deepEqual(clipSize(390, 844), { w: 444, h: 960 }, "the whole view of a phone");
  assert.deepEqual(clipSize(3, 4, 1080), { w: 810, h: 1080 }, "a tool may ask for another long side");
  for (const [a, b] of [[390, 844], [1280, 720], [1000, 999]]) { const s = clipSize(a, b); assert.equal(s.w % 2 + s.h % 2, 0); assert.equal(Math.max(s.w, s.h), 960); }
  assert.ok(clipBits(540, 720) < clipBits(720, 960) && clipBits(720, 960) === CLIP.bits);
  assert.equal(CLIP.fps, 24);
});

test("twelve seconds by default, never more than fifteen with the signature's tail in them", () => {
  assert.equal(CLIP.secs, 12); assert.equal(CLIP.max, 15);
  assert.equal(sceneSecs(true), 12); assert.equal(sceneSecs(false), 12);
  assert.ok(sceneSecs(true, 60) + CLIP.tail <= CLIP.max + 1e-9 && sceneSecs(false, 60) === CLIP.max);
  assert.equal(sceneSecs(true, 0), 1, "at least a second");
});

test("the signature is absent until the scene ends, then rises smoothly to full", () => {
  assert.equal(markAlpha(5, 12), 0); assert.equal(markAlpha(12, 12), 0);
  assert.equal(markAlpha(12 + CLIP.tail, 12), 1); assert.equal(markAlpha(99, 12), 1);
  let was = 0; for (let t = 12; t <= 12 + CLIP.tail; t += 0.05) { const a = markAlpha(t, 12); assert.ok(a >= was); was = a; }
  assert.ok(markAlpha(12 + CLIP.tail / 2, 12) > 0.4 && markAlpha(12 + CLIP.tail / 2, 12) < 0.6);
});

test("what is said when the browser cannot share: hold on a touch screen, the button elsewhere, nothing when it can (#344 takes this over)", () => {
  assert.equal(saveHint({ canShare: true, coarse: true }), null);
  assert.equal(saveHint({ canShare: false, coarse: true }), "hold");
  assert.equal(saveHint({ canShare: false, coarse: false }), "save");
});

test("the file's name keeps to what a file system and a share sheet take", () => {
  assert.equal(clipName("mp4", "秋-暮"), "yunjing-clip-秋-暮.mp4");
  assert.equal(clipName("webm", "Autumn / Dusk"), "yunjing-clip-Autumn-Dusk.webm");
});
