// #520, the stele's writing: the body's text is invented marks (no real inscription may appear), weathered until most of it is gone and none of it can be
// read, the lines still countable; and it is the same every time it is drawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import { INK, makeInk, makeTitle } from '../../app/levels/t00/stele-ink.js';

test('most of the cut is gone, two or three cells are whole, and the lines can still be counted', () => {
  const { stats, data } = makeInk();
  assert.ok(stats.loss >= INK.lossMin && stats.loss <= INK.lossMax, `lost ${(stats.loss * 100).toFixed(1)}% of the cut (${INK.lossMin * 100}% to ${INK.lossMax * 100}%)`);
  assert.ok(stats.whole <= INK.wholeMax, `${stats.whole} cells still whole, at most ${INK.wholeMax}`);
  assert.ok(stats.colsShown >= INK.colsMin, `${stats.colsShown} columns still show ink, at least ${INK.colsMin}`);
  assert.equal(data.length, INK.W * INK.H * 2);
  let r = 0, g = 0; for (let i = 0; i < data.length; i += 2) { r += data[i] > 40 ? 1 : 0; g += data[i + 1] > 20 ? 1 : 0; }
  assert.ok(r > 0 && g > 0, 'both the cut that is left and its worn trace are there');
});

test('it is drawn the same way every time, and differently from another seed', () => {
  const a = makeInk(520).data, b = makeInk(520).data, c = makeInk(7).data;
  assert.deepEqual(a, b);
  let diff = 0; for (let i = 0; i < a.length; i += 97) if (a[i] !== c[i]) diff++;
  assert.ok(diff > 100, 'another seed, another text');
});

test('the title is blank until its characters are given, and two characters fill the frame when they are', () => {
  assert.ok(makeTitle({ size: 0, list: [] }).every((v) => v === 0));
  const bits = new Uint8Array(16 * 16).fill(1), t = makeTitle({ size: 16, list: [bits, bits] }), W = INK.title.W;
  let left = 0, right = 0; for (let y = 0; y < INK.title.H; y++) for (let x = 0; x < W; x++) if (t[y * W + x] > 128) { if (x < W / 2) left++; else right++; }
  assert.ok(left > 5000 && right > 5000, `a character on each side (${left}, ${right})`);
});
