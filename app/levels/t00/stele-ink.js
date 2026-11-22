// What is cut into the imperial stele (#520, third pass): the body's text, weathered until it cannot be read, and the title in the head's frame.
//
// The body is NOT any real inscription. The real stele at the temple reads 径山兴圣万寿禅寺 and none of its words may appear here, so the text is
// made of invented glyph-shaped marks, not of any writing: each cell of a grid of columns holds a few strokes in the way a small regular-script
// character is built (a left half and a right half, or a top and a bottom, each of a few horizontals, verticals, falling strokes and dots).
// They are drawn once, in Node or in the page, from a seed. Then the stone's weather is applied to them: an erosion field in patches
// (a wide one and a fine one) takes out most of the strokes, so that the lines can be counted but almost no character is whole.
// What stays is two numbers a pixel (`R`: the cut that is left, `G`: the faint trace where it was cut and has worn away), which the stone's
// shader reads (materials.js, `steleStone`). `inkStats` says how much was lost and how many cells are still whole; the unit tests hold both.
//
// The title in the frame at the head is two characters (yu shu, "the emperor's writing"), from a bitmap (stele-title-data.js, made from public-domain originals by
// tools/stele-title.py) and nothing else.

/** The field the text fills, in the stele's own frame (metres from its middle across, from the platform up), and the grid it is set in. */
export const INK = Object.freeze({
  x0: -0.425, x1: 0.425, y0: 0.58, y1: 2.28,   // the body's field below the title's frame
  cols: 14, rows: 26,
  W: 768, H: 1536,
  title: Object.freeze({ x0: -0.23, x1: 0.23, y0: 2.34, y1: 2.74, W: 512, H: 448 }),
  /** how much of the cut is gone, at the least and at the most; the cells left whole, at the most; the columns that still show ink, at the least */
  lossMin: 0.6, lossMax: 0.76, wholeMax: 3, colsMin: 10,
});

function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Value noise on a lattice, from the seed, and two octaves of it. */
function noiser(seed) {
  const r = rng(seed), N = 64, g = new Float32Array(N * N); for (let i = 0; i < g.length; i++) g[i] = r();
  const at = (x, y) => g[((y & (N - 1)) * N) + (x & (N - 1))];
  const n = (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
    return (at(xi, yi) * (1 - u) + at(xi + 1, yi) * u) * (1 - v) + (at(xi, yi + 1) * (1 - u) + at(xi + 1, yi + 1) * u) * v; };
  return (x, y) => 0.6 * n(x, y) + 0.4 * n(x * 2.3 + 11, y * 2.3 + 5);
}

/** How wide a stroke is at each sixty-fourth of its length, as a share of its full width: a point at each end, full a third of the way along. */
const TAPER = Array.from({ length: 64 }, (_, i) => 0.18 + 0.82 * Math.pow(Math.sin(Math.PI * (0.08 + 0.84 * ((i + 0.5) / 64))), 0.7));

/** What kinds of stroke were drawn, so that a test can count them (the falling strokes and dots together make up well over a third of a small regular hand's strokes). */
const KINDS = { horizontal: 0, vertical: 0, left: 0, right: 0, dot: 0, turn: 0 };

/**
 * Cut one stroke into the depth buffer: a polyline of points (pixels, y up) that the knife follows, as a V-shaped groove whose width swells from a point at the
 * entry to the full width a third of the way along and thins to a point at the exit; the depth is 1 on the line and falls to 0 at the groove's edge.
 */
function stroke(buf, W, H, pts, w) {
  let len = 0; const segs = [];
  for (let i = 1; i < pts.length; i++) { const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); segs.push({ a: pts[i - 1], b: pts[i], l, at: len }); len += l; }
  if (len < 1) return;
  const half = (t) => (w / 2) * TAPER[Math.min(63, Math.max(0, Math.floor(t * 64)))];
  for (const sg of segs) {   // (each segment over its own small box)
    const dx = sg.b[0] - sg.a[0], dy = sg.b[1] - sg.a[1], pad = w / 2 + 1;
    const minx = Math.max(0, Math.floor(Math.min(sg.a[0], sg.b[0]) - pad)), maxx = Math.min(W - 1, Math.ceil(Math.max(sg.a[0], sg.b[0]) + pad));
    const miny = Math.max(0, Math.floor(Math.min(sg.a[1], sg.b[1]) - pad)), maxy = Math.min(H - 1, Math.ceil(Math.max(sg.a[1], sg.b[1]) + pad));
    for (let y = miny; y <= maxy; y++) for (let x = minx; x <= maxx; x++) {
      let u = ((x + 0.5 - sg.a[0]) * dx + (y + 0.5 - sg.a[1]) * dy) / (sg.l * sg.l); u = Math.min(1, Math.max(0, u));
      const px = sg.a[0] + u * dx - (x + 0.5), py = sg.a[1] + u * dy - (y + 0.5), d = Math.sqrt(px * px + py * py), hw = half((sg.at + u * sg.l) / len);
      const v = 1 - d / hw; if (v > buf[y * W + x]) buf[y * W + x] = v;
    }
  }
}

/** A gentle curve from (x0, y0) through a bulge to (x1, y1), as a few points. */
const curve = (x0, y0, x1, y1, bx, by) => [0, 0.2, 0.4, 0.6, 0.8, 1].map((t) => [(1 - t) * (1 - t) * x0 + 2 * (1 - t) * t * bx + t * t * x1, (1 - t) * (1 - t) * y0 + 2 * (1 - t) * t * by + t * t * y1]);

/** One invented glyph in the box [bx, bx+bw] x [by, by+bh] (pixels, y up): two halves or one body, each of a few strokes. */
function glyph(buf, W, H, r, bx, by, bw, bh, sw) {
  const mx = bw * 0.1, my = bh * 0.09, x0 = bx + mx, y0 = by + my, w = bw - 2 * mx, h = bh - 2 * my, split = r();
  /** @type {Array<[number, number, number, number]>} */
  const boxes = split < 0.4 ? [[x0, y0, w, h]] : split < 0.7 ? [[x0, y0, w * 0.42, h], [x0 + w * 0.5, y0, w * 0.5, h]] : [[x0, y0 + h * 0.5, w, h * 0.5], [x0, y0, w, h * 0.46]];
  for (const [ax, ay, aw, ah] of boxes) {
    const n = 4 + Math.floor(r() * 3);
    for (let i = 0; i < n; i++) {
      const k = r(), jx = (r() - 0.5) * aw * 0.12, jy = (r() - 0.5) * ah * 0.12;
      if (k < 0.2) { KINDS.horizontal++; const yy = ay + ah * (0.15 + 0.7 * r()) + jy, tilt = (r() - 0.3) * ah * 0.08; stroke(buf, W, H, [[ax + jx, yy], [ax + aw * 0.5 + jx, yy + tilt * 0.6], [ax + aw + jx, yy + tilt]], sw); }
      else if (k < 0.4) { KINDS.vertical++; const xx = ax + aw * (0.2 + 0.6 * r()) + jx, lean = (r() - 0.5) * aw * 0.1; stroke(buf, W, H, [[xx, ay + ah + jy], [xx + lean * 0.5, ay + ah * 0.5], [xx + lean, ay + jy]], sw); }
      else if (k < 0.62) { KINDS.left++; const xx = ax + aw * (0.4 + 0.5 * r()), ex = ax + aw * (0.02 + 0.3 * r()), top = ay + ah * (0.9 + 0.08 * r()), bot = ay + ah * (0.04 + 0.2 * r()); stroke(buf, W, H, curve(xx, top, ex, bot, xx - aw * 0.05, (top + bot) / 2 - ah * 0.12), sw * 1.1); }
      else if (k < 0.78) { KINDS.right++; const xx = ax + aw * (0.1 + 0.3 * r()), ex = ax + aw * (0.88 + 0.12 * r()), top = ay + ah * (0.88 - 0.25 * r()), bot = ay + ah * (0.04 + 0.2 * r()); stroke(buf, W, H, curve(xx, top, ex, bot, xx + aw * 0.1, bot + ah * 0.18), sw * 1.15); }
      else if (k < 0.9) { KINDS.dot++; const xx = ax + aw * (0.25 + 0.5 * r()), yy = ay + ah * (0.25 + 0.6 * r()); stroke(buf, W, H, [[xx, yy], [xx + aw * 0.12, yy - ah * 0.09], [xx + aw * 0.18, yy - ah * 0.16]], sw * 1.2); }
      else { KINDS.turn++; const xx = ax + aw * (0.15 + 0.3 * r()), yy = ay + ah * (0.55 + 0.3 * r()); stroke(buf, W, H, [[xx, yy], [xx + aw * 0.55, yy], [xx + aw * 0.55, yy - ah * 0.4], [xx + aw * 0.48, yy - ah * 0.5]], sw); }
    }
  }
}

/** The body's text, weathered: `{ data, stats }`, `data` two bytes a pixel (R: the cut that is left, G: its worn trace), rows from the bottom up. */
export function makeInk(seed = 520) {
  for (const k of Object.keys(KINDS)) KINDS[k] = 0;
  const { cols, rows, W, H } = INK, r = rng(seed), cw = W / cols, ch = H / rows, sw = cw * 0.21;
  const cut = new Float32Array(W * H);
  const blank = new Set(); for (let c = 0; c < cols; c++) if (r() < 0.12) blank.add(c);   // a column left unwritten here and there
  for (let c = 0; c < cols; c++) for (let row = 0; row < rows; row++) {
    if (blank.has(c) && row > 3) continue;
    if (r() < 0.04) continue;                                                             // a space
    glyph(cut, W, H, r, c * cw, row * ch, cw, ch, sw);
  }
  // Erosion, in patches: a wide field (a hand's breadth) and a fine one (a character's stroke), so that the cut goes in blotches and in chips,
  // and a little more of it from the stone's foot, where it stays damp. The threshold is found for the share to lose.
  // (worked out on a grid a fifth of the size and read back smoothly: the patches are never finer than a third of a cell)
  const e1 = noiser(seed + 1), e2 = noiser(seed + 2), field = new Float32Array(W * H), D = 5, gw = Math.ceil(W / D) + 2, gh = Math.ceil(H / D) + 2, coarse = new Float32Array(gw * gh);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) { const x = i * D, y = j * D; coarse[j * gw + i] = 0.62 * e1(x / (cw * 2.6), y / (ch * 2.4)) + 0.38 * e2(x / (cw * 0.55), y / (ch * 0.55)) + 0.12 * (1 - y / H) * (1 - y / H) * 2; }
  for (let y = 0; y < H; y++) { const fy = y / D, j = Math.floor(fy), ty = fy - j; for (let x = 0; x < W; x++) { const fx = x / D, i = Math.floor(fx), tx = fx - i, o = j * gw + i;
    field[y * W + x] = (coarse[o] * (1 - tx) + coarse[o + 1] * tx) * (1 - ty) + (coarse[o + gw] * (1 - tx) + coarse[o + gw + 1] * tx) * ty; } }
  let total = 0; for (let i = 0; i < cut.length; i++) total += cut[i];
  const lossOf = (thr) => { let gone = 0, all = 0; for (let i = 0; i < cut.length; i += 5) { all += cut[i]; if (field[i] > thr) gone += cut[i]; } return gone / (all || 1); };   // (every fifth pixel: it need only be near)
  let lo = 0, hi = 1.5, thr = 0.5; const target = 0.62;
  for (let i = 0; i < 24; i++) { thr = (lo + hi) / 2; if (lossOf(thr) > target) lo = thr; else hi = thr; }
  const keep = (i) => 1 - smooth(thr - 0.015, thr + 0.015, field[i]);   // (1 where the cut stays)
  const alive = new Float32Array(W * H); for (let i = 0; i < alive.length; i++) alive[i] = keep(i);
  // A cell still whole is a character a visitor could read: leave two, and bite chips out of the rest until they are not whole.
  const cellStat = () => { const out = []; for (let c = 0; c < cols; c++) for (let row = 0; row < rows; row++) { let a = 0, b = 0;
    for (let y = Math.floor(row * ch); y < Math.floor((row + 1) * ch); y++) for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x++) { const i = y * W + x; a += cut[i]; b += cut[i] * alive[i]; }
    if (a > 0) out.push({ c, row, keep: b / a, ink: a }); } return out; };
  let cells = cellStat(); const whole = cells.filter((s) => s.keep >= 0.8).sort((a, b) => b.keep - a.keep);
  for (const s of whole.slice(2)) for (let n = 0; n < 12; n++) {
    const cx = (s.c + 0.15 + 0.7 * r()) * cw, cy = (s.row + 0.15 + 0.7 * r()) * ch, rr = cw * (0.16 + 0.12 * r());
    for (let y = Math.max(0, Math.floor(cy - rr)); y < Math.min(H, Math.ceil(cy + rr)); y++) for (let x = Math.max(0, Math.floor(cx - rr)); x < Math.min(W, Math.ceil(cx + rr)); x++) if ((x - cx) ** 2 + (y - cy) ** 2 < rr * rr) alive[y * W + x] = 0;
    let a = 0, b = 0; for (let y = Math.floor(s.row * ch); y < Math.floor((s.row + 1) * ch); y++) for (let x = Math.floor(s.c * cw); x < Math.floor((s.c + 1) * cw); x++) { const i = y * W + x; a += cut[i]; b += cut[i] * alive[i]; }
    if (a && b / a < 0.62) break;
  }
  // The columns' ruled lines (as many Song stones are cut between the lines of writing): a shallow groove at each column's side, worn like the rest but less, so that
  // from farther off the writing still reads in columns. They are added after the count of what the weather left (they are not writing).
  const rule = new Float32Array(W * H);
  for (let c = 0; c <= cols; c++) { const x = Math.min(W - 2, Math.round(c * cw)); for (let y = 0; y < H; y++) for (let k = -1; k <= 1; k++) { const xx = x + k; if (xx >= 0 && xx < W) rule[y * W + xx] = Math.max(rule[y * W + xx], k === 0 ? 0.32 : 0.16); } }
  const data = new Uint8Array(W * H * 2);
  for (let i = 0; i < cut.length; i++) { const keepRule = rule[i] * (1 - smooth(thr + 0.02, thr + 0.1, field[i])); if (keepRule > cut[i] * alive[i]) { data[i * 2] = Math.round(255 * keepRule); data[i * 2 + 1] = 0; continue; } const k = cut[i] * alive[i], g = cut[i] * (1 - alive[i]) * 0.5; data[i * 2] = Math.round(255 * k); data[i * 2 + 1] = Math.round(255 * g); }
  return { data, stats: { ...inkStats(cut, alive), kinds: { ...KINDS } } };
}

/** What the weather left: the share of the cut that is gone, the cells still whole (most of their cut left), the columns that still show ink. */
function inkStats(cut, alive) {
  const { cols, rows, W, H } = INK, cw = W / cols, ch = H / rows; let total = 0, left = 0; const colInk = new Float64Array(cols), colAll = new Float64Array(cols); let whole = 0;
  for (let c = 0; c < cols; c++) for (let row = 0; row < rows; row++) { let a = 0, b = 0;
    for (let y = Math.floor(row * ch); y < Math.floor((row + 1) * ch); y++) for (let x = Math.floor(c * cw); x < Math.floor((c + 1) * cw); x++) { const i = y * W + x; a += cut[i]; b += cut[i] * alive[i]; }
    total += a; left += b; colAll[c] += a; colInk[c] += b; if (a > 0 && b / a >= 0.8) whole++; }
  let colsShown = 0; for (let c = 0; c < cols; c++) if (colAll[c] > 0 && colInk[c] / colAll[c] >= 0.2) colsShown++;
  return { loss: 1 - left / total, whole, colsShown };
}

/** The title's bytes, one a pixel: the two characters' bitmaps (each `size` x `size`, 1 = cut) set side by side, the first at the right as a title is read. */
export function makeTitle(glyphs) {
  const { W, H } = INK.title, data = new Uint8Array(W * H), gw0 = glyphs?.w || glyphs?.size || 0, gh0 = glyphs?.h || glyphs?.size || 0;
  if (!gw0 || !gh0) return data;
  const gh = H * 0.72, gw = Math.min(W * 0.44, gh * (gw0 / gh0)), y0 = (H - gh) / 2, xs = [W * 0.5 + (W * 0.5 - gw) / 2, (W * 0.5 - gw) / 2];   // (the first glyph in the right half, the second in the left)
  glyphs.list.forEach((raw, k) => {
    // (a glyph is a bitmap of values 0 to 1, or the base64 of its bytes, 255 = cut, as stele-title-data.js keeps them)
    const bits = typeof raw === "string" ? Float32Array.from(Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)), (v) => v / 255) : raw;
    for (let y = 0; y < Math.ceil(gh); y++) for (let x = 0; x < Math.ceil(gw); x++) {
      const u = (x / gw) * (gw0 - 1), v = (1 - y / gh) * (gh0 - 1), i0 = Math.floor(u), j0 = Math.floor(v), fu = u - i0, fv = v - j0;
      const a = (i, j) => bits[Math.min(gh0 - 1, j) * gw0 + Math.min(gw0 - 1, i)];
      const val = (a(i0, j0) * (1 - fu) + a(i0 + 1, j0) * fu) * (1 - fv) + (a(i0, j0 + 1) * (1 - fu) + a(i0 + 1, j0 + 1) * fu) * fv;
      const px = Math.floor(xs[k] + x), py = Math.floor(y0 + y); if (px >= 0 && px < W && py >= 0 && py < H) data[py * W + px] = Math.round(255 * val);
    }
  });
  return data;
}
