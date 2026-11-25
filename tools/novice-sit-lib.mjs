// The seated novice's outline against the design sheet's (#664): the figure built in code is sat on a cushion as the unit
// tests sit him, drawn as a flat silhouette from the front and from his side with no cushion and no hat, and laid over
// refs/monk-v6-sit/{front,side}.png (tools/novice-sit-ref.mjs) at the same scale. As #642 did standing: the two are
// brought to one height (top of the head to the lowest of the hem), their feet on one line, and centred on the head
// (the mean column of the top 15% of each), and the overlap is intersection over union.
// Shared by tools/novice-sit-iou.mjs (pictures and a report) and tests/unit/monk-sit.test.mjs (the numbers held).
import fs from "node:fs";
import * as THREE from "three";
import sharp from "sharp";

// `across` is the world direction that runs to the picture's right: the front is seen from before him, the side from his right.
export const VIEWS = { front: { across: [1, 0, 0] }, side: { across: [0, 0, 1] } };
const REF = (name) => new URL(`../refs/monk-v6-sit/${name}.png`, import.meta.url);

/** A reference silhouette: `{ w, h, m }`, m one byte a pixel. */
export async function refMask(name) {
  const { data, info } = await sharp(fs.readFileSync(REF(name))).greyscale().raw().toBuffer({ resolveWithObject: true });
  return { w: info.width, h: info.height, m: Uint8Array.from(data, (v) => (v > 127 ? 1 : 0)) };
}

/** Him seated on a cushion whose top is `top` above the floor, settled, as monk.test's `seated`. */
export function seat(createMonk, top = 0.104) {
  const m = createMonk(); m.group.position.set(0, top, 0);
  for (let i = 0; i < 120; i++) m.update(1 / 30, 0, "sit", i / 30, () => 0, { heightAt: () => 0 });
  m.group.updateMatrixWorld(true); m.skeleton.update?.();
  return m;
}

/** Every triangle of him that is drawn, in the world, as a flat array of nine numbers each; the hat, its straps and his shadow left out. */
export function triangles(monk, { leave = [] } = {}) {
  const out = [], v = new THREE.Vector3(), skip = new Set([monk.shadow, monk.parts.hat, monk.parts.straps, ...leave]);
  monk.group.traverse((o) => {
    if (!o.isMesh || !o.visible || skip.has(o)) return;
    const p = o.geometry.attributes.position, pts = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { (o.isSkinnedMesh ? o.getVertexPosition(i, v) : v.fromBufferAttribute(p, i)).applyMatrix4(o.matrixWorld); pts.set([v.x, v.y, v.z], i * 3); }
    const ix = o.geometry.index ? o.geometry.index.array : null, n = ix ? ix.length : p.count;
    for (let k = 0; k < n; k++) { const i = ix ? ix[k] : k; out.push(pts[i * 3], pts[i * 3 + 1], pts[i * 3 + 2]); }
  });
  return out;
}

/** The triangles as a silhouette seen along the level, `across` the world direction that runs to the picture's right, `scale` pixels to the metre. */
export function silhouette(tris, across, scale) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const px = (k) => tris[k] * across[0] + tris[k + 1] * across[1] + tris[k + 2] * across[2];
  for (let k = 0; k < tris.length; k += 3) { const x = px(k), y = tris[k + 1]; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const w = Math.ceil((x1 - x0) * scale) + 2, h = Math.ceil((y1 - y0) * scale) + 2, m = new Uint8Array(w * h);
  for (let k = 0; k < tris.length; k += 9) {
    const ax = (px(k) - x0) * scale + 0.5, ay = (y1 - tris[k + 1]) * scale + 0.5, bx = (px(k + 3) - x0) * scale + 0.5, by = (y1 - tris[k + 4]) * scale + 0.5, cx = (px(k + 6) - x0) * scale + 0.5, cy = (y1 - tris[k + 7]) * scale + 0.5;
    const area = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax); if (Math.abs(area) < 1e-9) continue;
    const xa = Math.max(0, Math.floor(Math.min(ax, bx, cx))), xb = Math.min(w - 1, Math.ceil(Math.max(ax, bx, cx))), ya = Math.max(0, Math.floor(Math.min(ay, by, cy))), yb = Math.min(h - 1, Math.ceil(Math.max(ay, by, cy)));
    for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
      const X = x + 0.5, Y = y + 0.5, u = ((bx - X) * (cy - Y) - (by - Y) * (cx - X)) / area, t = ((cx - X) * (ay - Y) - (cy - Y) * (ax - X)) / area;
      if (u >= -1e-6 && t >= -1e-6 && u + t <= 1 + 1e-6) m[y * w + x] = 1;
    }
  }
  return { w, h, m, x0, y0, y1, scale };
}

const headColumn = ({ w, h, m }) => { let s = 0, n = 0; for (let y = 0; y < Math.round(h * 0.15); y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { s += x; n++; } return s / n; };
const rows = ({ w, h, m }) => { let a = h, b = 0; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (m[y * w + x]) { a = Math.min(a, y); b = Math.max(b, y); break; } return [a, b]; };

/** Ours over the reference: `{ iou, both, ours, ref, w, h, map }`, `map` one byte a pixel (1 only ours, 2 only the sheet's, 3 both), and `scale`, pixels to the metre. */
export function overlay(tris, across, ref) {
  // ours is drawn at the scale that gives it the reference's height
  let y0 = Infinity, y1 = -Infinity; for (let k = 1; k < tris.length; k += 3) { y0 = Math.min(y0, tris[k]); y1 = Math.max(y1, tris[k]); }
  const [ra, rb] = rows(ref), scale = (rb - ra) / (y1 - y0), ours = silhouette(tris, across, scale), [oa, ob] = rows(ours);
  const dx = Math.round(headColumn(ref) - headColumn(ours)), dy = rb - ob, pad = 24, w = ref.w + 2 * pad, h = ref.h + 2 * pad, map = new Uint8Array(w * h);
  for (let y = 0; y < ref.h; y++) for (let x = 0; x < ref.w; x++) if (ref.m[y * ref.w + x]) map[(y + pad) * w + x + pad] |= 2;
  for (let y = 0; y < ours.h; y++) for (let x = 0; x < ours.w; x++) { const X = x + dx + pad, Y = y + dy + pad; if (ours.m[y * ours.w + x] && X >= 0 && Y >= 0 && X < w && Y < h) map[Y * w + X] |= 1; }
  let both = 0, a = 0, b = 0; for (const v of map) { if (v === 3) both++; if (v & 1) a++; if (v & 2) b++; }
  void oa;
  return { iou: both / (a + b - both), both, ours: a, ref: b, w, h, map, scale, pad, dx: dx + pad, dy: dy + pad, x0: ours.x0, yTop: ours.y1 };
}

/** The overlay as a picture: white where both, red where only ours, green where only the sheet's. */
export function overlayPNG(o, file) {
  const rgb = Buffer.alloc(o.w * o.h * 3);
  for (let k = 0; k < o.w * o.h; k++) { const c = o.map[k] === 3 ? [255, 255, 255] : o.map[k] === 1 ? [230, 60, 50] : o.map[k] === 2 ? [60, 200, 90] : [24, 24, 24]; rgb.set(c, k * 3); }
  return sharp(rgb, { raw: { width: o.w, height: o.h, channels: 3 } }).png().toFile(file);
}
