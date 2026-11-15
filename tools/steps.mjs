// Render his steps to files, for listening: the same sounds (app/src/steps.js) at the same relative levels the page
// plays them, along four short walks. Writes tools/out/steps/<walk>.mp3 (and .wav) and all.mp3, the four one after
// another with a pause between. What the page adds is left out: the court's or the hall's reverb, the wind and the
// music; and everything is played three times as loud as in the page, so that the steps can be heard on their own.
//
//   node tools/steps.mjs
import fs from "node:fs"; import path from "node:path"; import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { stepSound, LEVEL } from "../app/src/steps.js";

const here = path.dirname(fileURLToPath(import.meta.url)), out = path.join(here, "out", "steps"), SR = 48000;
// Each walk: [kind, speed in metres a second, how many steps]. Kind null is a pause. About two steps a second at a stroll.
const WALKS = {
  "dry-stone": [["stone", 2.1, 10], [null, 0, 2], ["stone", 3.4, 8]],                                   // autumn, or a roofed platform
  "after-rain": [["wet", 2.1, 6], ["puddle", 2.1, 2], ["wet", 2.1, 5], ["puddle", 2.1, 1], ["wet", 2.1, 4]],   // summer, through two puddles
  snow: [["snow", 2.1, 12], [null, 0, 2], ["snow", 3.4, 10], [null, 0, 2], ["stone", 2.1, 6]],           // and onto the swept path
  "hall-floor": [["stone", 1.6, 10]],                                                                   // indoors (the page adds the hall's reverb)
};
const pace = (v) => (v > 0 ? 0.48 * Math.pow(2.1 / v, 0.4) : 0.55);
function render(walk) {
  const total = walk.reduce((a, [, v, n]) => a + n * pace(v), 0) + 1, L = new Float32Array(Math.ceil(total * SR)), R = new Float32Array(L.length);
  let t = 0.3, seed = 1, side = 1;
  for (const [kind, v, n] of walk) for (let k = 0; k < n; k++) {
    if (kind) {
      const x = stepSound(kind, SR, { seed: (seed = (seed * 1103515245 + 12345) >>> 0), speed: v, wet: 1 }), g = LEVEL[kind] * (0.8 + 0.2 * Math.min(1, v / 2.4)) * 3, p = -side * 0.12;
      const at = Math.floor(t * SR), gl = g * Math.cos(((p + 1) * Math.PI) / 4), gr = g * Math.sin(((p + 1) * Math.PI) / 4);
      for (let i = 0; i < x.length && at + i < L.length; i++) { L[at + i] += x[i] * gl; R[at + i] += x[i] * gr; }
    }
    t += pace(v); side = -side;
  }
  return [L, R];
}
function wav(file, [L, R]) {   // 16-bit stereo
  const data = Buffer.alloc(L.length * 4);
  for (let i = 0; i < L.length; i++) { data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i])) * 32767), i * 4); data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i])) * 32767), i * 4 + 2); }
  const head = Buffer.alloc(44); head.write("RIFF", 0); head.writeUInt32LE(36 + data.length, 4); head.write("WAVEfmt ", 8); head.writeUInt32LE(16, 16); head.writeUInt16LE(1, 20); head.writeUInt16LE(2, 22);
  head.writeUInt32LE(SR, 24); head.writeUInt32LE(SR * 4, 28); head.writeUInt16LE(4, 32); head.writeUInt16LE(16, 34); head.write("data", 36); head.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([head, data]));
}
const mp3 = (from, to) => { try { execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", from, "-codec:a", "libmp3lame", "-q:a", "2", to]); return true; } catch { return false; } };

fs.mkdirSync(out, { recursive: true });
const parts = [];
for (const [name, walk] of Object.entries(WALKS)) { const s = render(walk); parts.push(s); const f = path.join(out, name + ".wav"); wav(f, s); mp3(f, f.replace(/\.wav$/, ".mp3")); }
const gap = Math.floor(SR * 1.2), len = parts.reduce((a, [L]) => a + L.length + gap, 0), all = [new Float32Array(len), new Float32Array(len)];
let at = 0; for (const [L, R] of parts) { all[0].set(L, at); all[1].set(R, at); at += L.length + gap; }
const f = path.join(out, "all.wav"); wav(f, all);
console.log(mp3(f, path.join(out, "all.mp3")) ? `wrote ${out}/{${Object.keys(WALKS).join(",")},all}.mp3` : `wrote ${out}/*.wav (no ffmpeg for mp3)`);
