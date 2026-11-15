// The paper and the ink the interface is made of. Nothing here is a picture fetched from anywhere: like the ring on
// the ground and the page of seals, each surface is drawn once, in a canvas, when the page opens, and handed to the
// stylesheet as a custom property on the root (src/ui.css reads them):
//   --paper-tile   a square of paper grain and fibre, laid under every sheet
//   --brush-ink    one dry stroke of ink, for a rule on paper or a word's underline there
//   --brush-light  the same stroke in the colour of paper, for a word over the picture
//   --enso-light   a ring in one breath, not quite closed, in the colour of paper: the mark of what can be done here
//   --enso-red     the same ring in vermilion: what is chosen
//   --stamp        a block of vermilion pressed unevenly, for a seal or the one button that matters on a sheet
// and each element with the class `paper` (and each slip at the edge) is given its own torn edge (`--deckle`), drawn to its size whenever its size
// changes, so a sheet never shows a straight cut. Every stroke comes from a seeded generator, so a screenshot taken
// twice is the same picture.
export const SEAL = "#a8321f";

function rng(seed) {   // mulberry32
  let s = seed >>> 0;
  return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** @returns {[HTMLCanvasElement, CanvasRenderingContext2D]} */
const canvas = (w, h) => { const c = document.createElement("canvas"); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return [c, c.getContext("2d")]; };
const url = (c) => `url("${c.toDataURL("image/png")}")`;

// Paper: speckled grain, and fibres lying mostly one way, faint enough that the sheet's own colour stays in charge.
let tileCanvas = null;
function tile(seed = 7) {
  const N = 256, [c, x] = canvas(N, N), r = rng(seed), img = x.createImageData(N, N), d = img.data;
  for (let i = 0; i < d.length; i += 4) { const v = r(); d[i] = 70; d[i + 1] = 58; d[i + 2] = 42; d[i + 3] = v < 0.5 ? v * 22 : v > 0.985 ? 60 : 0; }
  x.putImageData(img, 0, 0);
  x.lineCap = "round";
  for (let i = 0; i < 55; i++) {
    const px = r() * N, py = r() * N, a = (r() - 0.5) * 0.9, len = 4 + r() * 12;
    x.strokeStyle = `rgba(110,92,66,${0.03 + r() * 0.05})`; x.lineWidth = 0.3 + r() * 0.4;
    x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + (r() - 0.5) * 4, py + Math.sin(a) * len * 0.5 + (r() - 0.5) * 4, px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke();
    for (const [ox, oy] of [[-N, 0], [N, 0], [0, -N], [0, N]]) { x.save(); x.translate(ox, oy); x.stroke(); x.restore(); }   // so the tile repeats without a seam
  }
  tileCanvas = c;
  return url(c);
}

// One stroke of a nearly dry brush, laid left to right: heavy where it lands, breaking up into hairs where it lifts.
function stroke(rgb, seed = 3, W = 480, H = 24) {
  const [c, x] = canvas(W, H), r = rng(seed), hairs = 26;
  for (let h = 0; h < hairs; h++) {
    const off = (h / (hairs - 1) - 0.5) * H * 0.42, lift = 0.55 + r() * 0.4;
    x.beginPath();
    for (let i = 0; i <= 80; i++) {
      const t = i / 80, px = 4 + t * (W - 8), sag = Math.sin(t * Math.PI) * -H * 0.08 + Math.sin(t * 7 + seed) * 0.6;
      const width = (1 - Math.abs(t - 0.32) * 1.1) * (1 - t * 0.45), py = H / 2 + off * Math.max(0.25, width) + sag;
      if (t > lift && r() < (t - lift) * 2.4) { x.moveTo(px, py); continue; }   // the hair runs dry
      if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
    }
    x.strokeStyle = `rgba(${rgb},${0.28 + r() * 0.5})`; x.lineWidth = 0.7 + r() * 1.1; x.lineCap = "round"; x.stroke();
  }
  return url(c);
}

// A ring drawn in one breath, beginning heavy at the upper right and running dry before it closes.
function enso(rgb, seed = 11, N = 192) {
  const [c, x] = canvas(N, N), r = rng(seed), steps = 900, R = N * 0.4;
  for (let i = 0; i < steps; i++) {
    const t = i / steps, a = -0.9 + t * 5.6, rr = R + Math.sin(t * 8) * N * 0.008 + (r() - 0.5) * N * 0.006;
    const w = (N * 0.06 - t * N * 0.035) * (0.75 + r() * 0.5), dry = t > 0.6 ? r() * (t - 0.6) * 2.4 : 0;
    if (r() < dry) continue;
    x.fillStyle = `rgba(${rgb},${0.25 + r() * 0.5})`;
    x.beginPath(); x.ellipse(N / 2 + Math.cos(a) * rr, N / 2 + Math.sin(a) * rr, Math.max(0.6, w * 0.5), 0.8 + r() * 1.6, a + Math.PI / 2, 0, Math.PI * 2); x.fill();
  }
  return url(c);
}

// Vermilion pressed by hand: the block, with the edge a little ragged and the paper showing through in specks.
function stamp(seed = 5, N = 128) {
  const [c, x] = canvas(N, N), r = rng(seed), m = N * 0.04;
  x.fillStyle = SEAL; x.beginPath();
  const edge = (ax, ay, bx, by, nx, ny) => { for (let i = 0; i <= 16; i++) { const t = i / 16, j = (r() - 0.5) * N * 0.025; x.lineTo(ax + (bx - ax) * t + nx * j, ay + (by - ay) * t + ny * j); } };
  x.moveTo(m, m); edge(m, m, N - m, m, 0, 1); edge(N - m, m, N - m, N - m, 1, 0); edge(N - m, N - m, m, N - m, 0, 1); edge(m, N - m, m, m, 1, 0); x.fill();
  x.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${0.15 + r() * 0.6})`; x.beginPath(); x.arc(r() * N, r() * N, 0.3 + r() * 1.3, 0, Math.PI * 2); x.fill(); }
  return url(c);
}

// The torn edge of a sheet of this size: opaque inside, the border wandering a few pixels in and out with a few loose
// fibres beyond it. Drawn at twice the size for sharp screens, kept for each size once made.
const deckles = new Map();
function deckle(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}`; if (deckles.has(key)) return deckles.get(key);
  const k = 2, W = w * k, H = h * k, [c, x] = canvas(W, H), r = rng(Math.round(w * 31 + h * 17)), m = 4 * k, amp = 1.7 * k;
  // The edge wanders by a smoothed random walk (knots every few millimetres, eased between), with a fine tremble on
  // top and now and then a small bite out of it: never the regular scallop of a stamp's perforation.
  const knots = (len) => { const n = Math.ceil(len / (11 * k)) + 2, v = []; for (let i = 0; i < n; i++) v.push((r() - 0.5) * 2 * amp); return (s) => { const f = s / (11 * k), i = Math.floor(f), t = f - i, e = (1 - Math.cos(t * Math.PI)) / 2; return v[i] * (1 - e) + v[i + 1] * e; }; };
  x.fillStyle = "#fff"; x.beginPath();
  const side = (len, at) => { const walk = knots(len); let bite = 0; for (let s = 0; s <= len; s += 2 * k) { if (bite <= 0 && r() < 0.012) bite = (2 + r() * 4) * k; const o = walk(s) + (r() - 0.5) * 0.5 * k + (bite > 0 ? 1.4 * k : 0); bite -= 2 * k; at(s, o); } };
  side(W - 2 * m, (s, o) => x.lineTo(m + s, m + o));
  side(H - 2 * m, (s, o) => x.lineTo(W - m - o, m + s));
  side(W - 2 * m, (s, o) => x.lineTo(W - m - s, H - m - o));
  side(H - 2 * m, (s, o) => x.lineTo(m + o, H - m - s));
  x.closePath(); x.fill();
  x.strokeStyle = "rgba(255,255,255,0.55)"; x.lineWidth = 0.6 * k;
  for (let i = 0; i < (w + h) / 9; i++) {   // fibres pulled out past the edge
    const along = r(), onX = r() < w / (w + h), px = onX ? m + along * (W - 2 * m) : r() < 0.5 ? m : W - m, py = onX ? (r() < 0.5 ? m : H - m) : m + along * (H - 2 * m);
    const ox = onX ? (r() - 0.5) * 3 * k : (px < W / 2 ? -1 : 1) * (1 + r() * 3) * k, oy = onX ? (py < H / 2 ? -1 : 1) * (1 + r() * 3) * k : (r() - 0.5) * 3 * k;
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + ox, py + oy); x.stroke();
  }
  deckles.set(key + ":c", c); const u = url(c); deckles.set(key, u); return u;
}
// A slip of paper of this size drawn whole, edge and all, for a button: a mask on a button is not drawn by every
// browser, so the slips at the edge carry their torn paper as a picture instead.
const sheets = new Map();
function sheet(w, h) {
  const key = `${Math.round(w)}x${Math.round(h)}`; if (sheets.has(key)) return sheets.get(key);
  deckle(w, h); const edge = deckles.get(key + ":c");
  const k = 2, [c, x] = canvas(w * k, h * k), g = x.createLinearGradient(0, 0, w * k * 0.15, h * k);
  g.addColorStop(0, "#f2ece0"); g.addColorStop(1, "#e4dccb"); x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
  if (tileCanvas) { x.fillStyle = x.createPattern(tileCanvas, "repeat"); x.fillRect(0, 0, c.width, c.height); }
  x.globalCompositeOperation = "destination-in"; x.drawImage(edge, 0, 0);
  const u = url(c); sheets.set(key, u); return u;
}

export function createPaper(root = document.documentElement) {
  const set = (k, v) => root.style.setProperty(k, v);
  try {
    set("--paper-tile", tile());
    set("--brush-ink", stroke("38,32,26"));
    set("--brush-light", stroke("237,232,220", 9));
    set("--enso-light", enso("242,237,226"));
    set("--enso-red", enso("168,50,31", 23));
    set("--stamp", stamp());
  } catch (e) { console.warn("paper: drawn plain", e); return { observe() {} }; }   // no canvas: the sheets are plain, nothing else changes
  // Every sheet gets its own edge as soon as it has a size, and again when the size changes.
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    for (const e of entries) {
      const b = e.borderBoxSize?.[0], w = b ? b.inlineSize : e.contentRect.width, h = b ? b.blockSize : e.contentRect.height;
      const vertical = getComputedStyle(e.target).writingMode.startsWith("vertical");   // the box's inline size runs down the page
      const [ww, hh] = b && vertical ? [h, w] : [w, h];
      if (ww > 4 && hh > 4) { const el = /** @type {HTMLElement} */ (e.target); if (el.matches(".rail .chip")) el.style.setProperty("--sheet", sheet(ww, hh)); else el.style.setProperty("--deckle", deckle(ww, hh)); }
    }
  }) : null;
  const observe = (el) => { if (ro && el && !el.dataset.paper) { el.dataset.paper = "1"; ro.observe(el); } };
  document.querySelectorAll(".paper, .rail .chip").forEach(observe);
  return { observe };
}
