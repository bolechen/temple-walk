// The seated novice of the design sheet as two silhouettes (#664): the cross-legged row of
// refs/monk-poses-v6-2026-11-23-sitting.webp, from the front and from his side, cut out of the grey ground with the
// cushion and its shadow taken away, each cropped to the figure → refs/monk-v6-sit/{front,side}.png (white on black).
// tools/novice-sit-iou.mjs lays the figure built in code over them, as #642 did standing with refs/monk-v6-ortho/.
//
//   node tools/novice-sit-ref.mjs
//
// The cushion is told from the robe by its colour: the robe is an orange brown whose red is some four times its blue
// (its darkest fold still 4.5), the cushion a grey brown at about two; below row 330 of the sheet whatever is under 2.7
// is cushion or shadow. The largest piece left is the figure; holes in it are filled.
import fs from "node:fs";
import sharp from "sharp";

const SHEET = new URL("../refs/monk-poses-v6-2026-11-23-sitting.webp", import.meta.url), OUT = new URL("../refs/monk-v6-sit/", import.meta.url);
const BG = [180, 166, 164], PANELS = { front: [200, 660], side: [900, 1300] }, ROWS = 440, CUSHION_FROM = 330, CUSHION_RATIO = 2.7;

/** The pieces of a mask joined edge to edge, as a label for each pixel (0 where the mask is empty) and each piece's size. */
function pieces(m, w, h) {
  const lab = new Int32Array(w * h), sizes = [0], stack = [];
  for (let s = 0; s < w * h; s++) {
    if (!m[s] || lab[s]) continue;
    const id = sizes.length; let n = 0; stack.push(s); lab[s] = id;
    while (stack.length) { const k = stack.pop(), x = k % w, y = (k - x) / w; n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const X = x + dx, Y = y + dy; if (X < 0 || Y < 0 || X >= w || Y >= h) continue; const q = Y * w + X; if (m[q] && !lab[q]) { lab[q] = id; stack.push(q); } } }
    sizes.push(n);
  }
  return { lab, sizes };
}

const { data, info } = await sharp(fs.readFileSync(SHEET)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [name, [x0, x1]] of Object.entries(PANELS)) {
  const w = x1 - x0, h = ROWS, m = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const k = (y * info.width + x + x0) * 3, r = data[k], g = data[k + 1], b = data[k + 2];
    const figure = Math.hypot(r - BG[0], g - BG[1], b - BG[2]) > 30, cushion = y > CUSHION_FROM && r / (b + 1) < CUSHION_RATIO;
    m[y * w + x] = figure && !cushion ? 1 : 0;
  }
  // the figure is the largest piece; a hole is ground that the picture's edge cannot be reached from
  const fig = pieces(m, w, h), most = fig.sizes.indexOf(Math.max(...fig.sizes.slice(1)));
  for (let k = 0; k < w * h; k++) m[k] = fig.lab[k] === most ? 1 : 0;
  const inv = m.map((v) => 1 - v), open = pieces(inv, w, h), outside = new Set();
  for (let x = 0; x < w; x++) { outside.add(open.lab[x]); outside.add(open.lab[(h - 1) * w + x]); }
  for (let y = 0; y < h; y++) { outside.add(open.lab[y * w]); outside.add(open.lab[y * w + w - 1]); }
  for (let k = 0; k < w * h; k++) if (!m[k] && !outside.has(open.lab[k])) m[k] = 1;
  let xa = w, xb = 0, ya = h, yb = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { xa = Math.min(xa, x); xb = Math.max(xb, x); ya = Math.min(ya, y); yb = Math.max(yb, y); }
  const cw = xb - xa + 1, ch = yb - ya + 1, crop = Buffer.alloc(cw * ch);
  for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) crop[y * cw + x] = m[(y + ya) * w + x + xa] ? 255 : 0;
  await sharp(crop, { raw: { width: cw, height: ch, channels: 1 } }).png({ compressionLevel: 9 }).toFile(new URL(`${name}.png`, OUT).pathname);
  console.log(`${name}: ${cw}×${ch} px, from x ${x0 + xa}, y ${ya} of the sheet`);
}
