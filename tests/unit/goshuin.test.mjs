// The page of seals that is shared (#319): no seal repeats the brush name or lies on it, the code on it says the main site
// whatever address drew the picture and can be read back by a decoder (jsQR, a test-only dependency), and the foot says the main site too.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import jsQR from "jsqr";
import { qrMatrix, qrSide, QUIET } from "../../app/src/qr.js";
import { NAME, SANBAO, TEMPLE_SEAL, MAIN, shareUrl, nameBoxes, sealBox, qrBox, sealBoxes } from "../../app/src/goshuin.js";
import { has, LANGS } from "../../app/src/i18n.js";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test("the middle seal does not say the temple's name again, and no seal lies on a character of it", () => {
  assert.notEqual(SANBAO.text, "云径禅寺"); assert.equal(SANBAO.text, "佛法僧宝");
  const chars = nameBoxes(4);
  for (const [what, s] of [["三宝印", SANBAO], ["寺印", TEMPLE_SEAL]]) for (const [i, c] of chars.entries()) assert.ok(!hit(sealBox(s), c), `${what} lies on character ${i} of the name`);
});

test("the page's big things lie apart and inside the frame", () => {
  const W = 1200, H = 1600, frame = { x: 34, y: 34, w: W - 68, h: H - 68 };
  const things = { 三宝印: sealBox(SANBAO), 寺印: sealBox(TEMPLE_SEAL), 二维码: qrBox("zh") };
  const [row] = sealBoxes(7), rowTop = row[1] * H;
  for (const [k, b] of Object.entries(things)) { assert.ok(b.x > frame.x && b.y > frame.y && b.x + b.w < frame.x + frame.w && b.y + b.h < frame.y + frame.h, `${k} leaves the frame`); }
  const q = qrBox("zh"); assert.ok(q.label + 8 < rowTop, "the code's line lies on the row of seals"); assert.ok(q.y > NAME.top);
  const names = Object.keys(things); for (const a of names) for (const b of names) if (a < b) assert.ok(!hit(things[a], things[b]), `${a} and ${b} overlap`);
  // the day's columns stand at the right edge, down to about 810; the code is below them
  assert.ok(q.y > 850);
});

test("the code is the main site's address, whichever language, and a decoder reads it back", () => {
  for (const l of LANGS) {
    const url = shareUrl(l); assert.equal(url, `https://temple.rushiwowen.co/?utm_source=goshuin&utm_medium=share&utm_content=${l}`);
    const m = qrMatrix(url), n = m.length, px = qrBox(l).px, side = qrSide(n, px), buf = new Uint8ClampedArray(side * side * 4);
    for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
      const r = Math.floor(y / px) - QUIET, c = Math.floor(x / px) - QUIET, dark = r >= 0 && c >= 0 && r < n && c < n && m[r][c], v = dark ? 27 : 241, i = (y * side + x) * 4;
      buf[i] = v; buf[i + 1] = v; buf[i + 2] = v; buf[i + 3] = 255;
    }
    const got = jsQR(buf, side, side, { inversionAttempts: "dontInvert" });
    assert.ok(got, `${l}: the code cannot be read`); assert.equal(got.data, url);
    assert.ok(n * px >= 160, `${l}: the code is ${n * px} px, under 160`);
  }
});

test("the foot and the code never read the address that drew the picture", () => {
  assert.equal(MAIN.host, "temple.rushiwowen.co");
  for (const f of ["app/src/goshuin.js", "app/src/qr.js"]) assert.ok(!/\blocation\b/.test(fs.readFileSync(path.join(ROOT, f), "utf8")), `${f} reads location`);
  const game = fs.readFileSync(path.join(ROOT, "app/src/game.js"), "utf8"), call = game.slice(game.indexOf("drawGoshuin({"), game.indexOf("drawGoshuin({") + 400);
  assert.ok(!/url\s*:/.test(call.split("});")[0]), "game.js still hands drawGoshuin an address");
});

test("the line under the code is written in every language", () => {
  for (const l of ["ja", "en", "ko"]) assert.ok(has("扫码入山", l), `no ${l} for 扫码入山`);
});
