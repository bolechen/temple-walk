// The arithmetic behind tools/review-sheet.cjs, kept apart so that tests/unit/review-sheet.test.mjs can hold it without a
// browser: which flat colour is which part, how a height in the world becomes a point on the picture, what the pixel
// counts and the ruler's readings are, and a cheap edge picture of the scene.

/** The id pass's colours (the same as app/src/review.js's REVIEW_COLORS; a unit test keeps the two together). */
export const PALETTE = Object.freeze({
  skin: [255, 0, 255],
  hand: [255, 255, 0],
  robe: [0, 255, 255],
  legs: [0, 255, 0],
  shoes: [0, 0, 255],
  other: [255, 0, 0],
});
export const CLASSES = Object.freeze(Object.keys(PALETTE));
/** How far in RGB a pixel may be from a part's colour and still be that part (the picture was drawn by a GPU: the edges blend). */
export const NEAR = 90;

/** The part a pixel's colour names, or null for scene. @param {ArrayLike<number>} rgb */
export function classify(rgb, near = NEAR) {
  let best = null, bd = near * near;
  for (const k of CLASSES) { const c = PALETTE[k], d = (rgb[0] - c[0]) ** 2 + (rgb[1] - c[1]) ** 2 + (rgb[2] - c[2]) ** 2; if (d < bd) { bd = d; best = k; } }
  return best;
}

/** Pixels of each part in an RGBA/RGB buffer; with `box` ([x0, y0, x1, y1], half open) only those inside it. */
export function countParts(data, w, h, channels = 4, box = null) {
  const n = Object.fromEntries(CLASSES.map((k) => [k, 0])); const [x0, y0, x1, y1] = box || [0, 0, w, h];
  for (let y = Math.max(0, y0 | 0); y < Math.min(h, y1 | 0); y++) for (let x = Math.max(0, x0 | 0); x < Math.min(w, x1 | 0); x++) {
    const o = (y * w + x) * channels, k = classify([data[o], data[o + 1], data[o + 2]]); if (k) n[k]++;
  }
  return n;
}

/** A world point on the picture: view and projection are three's column-major 4×4 matrices. Null behind the eye. */
export function project(view, proj, w, h, p) {
  const m = (M, v) => [0, 1, 2, 3].map((r) => M[r] * v[0] + M[4 + r] * v[1] + M[8 + r] * v[2] + M[12 + r] * v[3]);
  const c = m(proj, m(view, [p[0], p[1], p[2], 1]));
  if (c[3] <= 1e-6) return null;
  return [((c[0] / c[3]) * 0.5 + 0.5) * w, (1 - ((c[1] / c[3]) * 0.5 + 0.5)) * h];
}

/** The right-hand side of him in the world (his local +x, which is his left), flat. @param {number[]} facing */
export const sideOf = (facing) => [facing[2], 0, -facing[0]];

/** The ruler's readings from `__review.measure()`: heights above where he stands (the floor, or the seat's top), in metres. */
export function readings(m) {
  const up = m.origin[1], b = m.bones, avg = (a, k) => (a && b[a] ? b[a][k] : null);
  const mid = (l, r, k) => (b[l] && b[r] ? (b[l][k] + b[r][k]) / 2 : null);
  const knee = mid("leftLowerLeg", "rightLowerLeg", 1), shoulder = mid("leftUpperArm", "rightUpperArm", 1), head = avg("head", 1);
  const x = (l, r) => (b[l] && b[r] ? Math.hypot(b[l][0] - b[r][0], b[l][2] - b[r][2]) : null);
  const shoulderWidth = x("leftUpperArm", "rightUpperArm"), r4 = (v) => (v == null ? null : +v.toFixed(4));
  const rel = (v) => (v == null ? null : r4(v - up));
  const hem = m.hemFront ? m.hemFront.y : null;
  return {
    kneeHeight: rel(knee), shoulderHeight: rel(shoulder), headHeight: rel(head), hemFrontHeight: rel(hem),
    hemAboveKnee: hem == null || knee == null ? null : r4(hem - knee),   // > 0: the cloth's front edge is higher than the knee
    hatWidth: m.hatWidth, shoulderWidth: r4(shoulderWidth), hatOverShoulder: m.hatWidth && shoulderWidth ? +(m.hatWidth / shoulderWidth).toFixed(3) : null,
  };
}

/** The ticks the ruler shows, bottom to top: [height above the floor, label]. 1.18 m is the novice's standing height. */
export function rulerTicks(r) {
  const t = [[0, "0"], [0.5, "0.50"], [1.0, "1.00"], [1.18, "1.18 standing"]];
  if (r.kneeHeight != null) t.push([r.kneeHeight, `knee ${r.kneeHeight.toFixed(2)}`]);
  if (r.shoulderHeight != null) t.push([r.shoulderHeight, `shoulder ${r.shoulderHeight.toFixed(2)}`]);
  if (r.hemFrontHeight != null) t.push([r.hemFrontHeight, `hem ${r.hemFrontHeight.toFixed(2)}`]);
  return t.sort((a, b) => a[0] - b[0]);
}

/** Screen lines of the ruler: a post beside him with its ticks, and across him at knee and hem height. Each is [x0, y0, x1, y1, label?, kind]. */
export function rulerLines(m, w, h) {
  const r = readings(m), cam = m.camera, side = sideOf(m.facing), f = m.facing, o = m.origin, P = (p) => project(cam.view, cam.projection, w, h, p);
  const post = [o[0] + side[0] * 0.55, o[1], o[2] + side[2] * 0.55], at = (hgt, along = 0, across = 0) => [post[0] + f[0] * along + side[0] * across, post[1] + hgt, post[2] + f[2] * along + side[2] * across];
  const out = [], top = Math.max(1.2, ...rulerTicks(r).map((t) => t[0])), seg = (a, b, label, kind) => { const p = P(a), q = P(b); if (p && q) out.push([p[0], p[1], q[0], q[1], label, kind]); };
  seg(at(0), at(top), null, "post");
  for (const [hgt, label] of rulerTicks(r)) seg(at(hgt, 0, -0.06), at(hgt, 0, 0.06), label, "tick");
  // the knee and the hem's front edge carried across in front of him, through where he sits
  const lap = (hgt, kind, label) => seg([o[0] - side[0] * 0.5 + f[0] * 0.0, o[1] + hgt, o[2] - side[2] * 0.5], [o[0] + side[0] * 0.5, o[1] + hgt, o[2] + side[2] * 0.5], label, kind);
  if (r.kneeHeight != null) lap(r.kneeHeight, "knee", null);
  if (r.hemFrontHeight != null) lap(r.hemFrontHeight, "hem", null);
  return out;
}

/** A box on the screen round his lap, where his hands rest when he sits: [x0, y0, x1, y1] from the world box between his knees, hips and a hand's height above. */
export function lapBox(m, w, h) {
  const cam = m.camera, o = m.origin, f = m.facing, s = sideOf(f), b = m.bones;
  const knee = b.leftLowerLeg && b.rightLowerLeg ? (b.leftLowerLeg[1] + b.rightLowerLeg[1]) / 2 : o[1] + 0.2;
  const xs = [b.leftLowerLeg?.[0], b.rightLowerLeg?.[0], b.leftUpperLeg?.[0], b.rightUpperLeg?.[0]].filter((v) => v != null), zs = [b.leftLowerLeg?.[2], b.rightLowerLeg?.[2], b.leftUpperLeg?.[2], b.rightUpperLeg?.[2]].filter((v) => v != null);
  // in his own frame: across from the knees' span, from the hips to the knees (and a hand's breadth beyond), up from a hand below the knee to a forearm above it
  const loc = (x, z) => [(x - o[0]) * s[0] + (z - o[2]) * s[2], (x - o[0]) * f[0] + (z - o[2]) * f[2]];   // [across, along]
  const pts = xs.map((x, i) => loc(x, zs[i])), ax = pts.map((p) => p[0]), al = pts.map((p) => p[1]);
  const x0 = Math.min(...ax) - 0.06, x1 = Math.max(...ax) + 0.06, z0 = Math.min(...al) - 0.04, z1 = Math.max(...al) + 0.08, y0 = knee - 0.08 - o[1], y1 = knee + 0.25 - o[1];
  const corners = []; for (const a of [x0, x1]) for (const z of [z0, z1]) for (const y of [y0, y1]) corners.push([o[0] + s[0] * a + f[0] * z, o[1] + y, o[2] + s[2] * a + f[2] * z]);
  const q = corners.map((c) => project(cam.view, cam.projection, w, h, c)).filter(Boolean);
  if (!q.length) return null;
  return [Math.min(...q.map((p) => p[0])), Math.min(...q.map((p) => p[1])), Math.max(...q.map((p) => p[0])), Math.max(...q.map((p) => p[1]))];
}

/** Sobel magnitude of a grey picture, 0..255 per pixel: the scene's lines for the silhouette sheet. @param {Float32Array|number[]} g */
export function sobel(g, w, h) {
  const out = new Uint8ClampedArray(w * h), at = (x, y) => g[Math.min(h - 1, Math.max(0, y)) * w + Math.min(w - 1, Math.max(0, x))];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const gx = -at(x - 1, y - 1) - 2 * at(x - 1, y) - at(x - 1, y + 1) + at(x + 1, y - 1) + 2 * at(x + 1, y) + at(x + 1, y + 1);
    const gy = -at(x - 1, y - 1) - 2 * at(x, y - 1) - at(x + 1, y - 1) + at(x - 1, y + 1) + 2 * at(x, y + 1) + at(x + 1, y + 1);
    out[y * w + x] = Math.min(255, Math.hypot(gx, gy) / 2);
  }
  return out;
}

/** Luminance of an RGB(A) buffer. */
export function grey(data, w, h, channels = 4) {
  const g = new Float32Array(w * h); for (let i = 0; i < w * h; i++) { const o = i * channels; g[i] = 0.2126 * data[o] + 0.7152 * data[o + 1] + 0.0722 * data[o + 2]; }
  return g;
}

/**
 * The silhouette picture: white paper, the scene's edges in grey (where the normal picture's Sobel is over `edge`), and him in
 * the flat colours of his parts from the id pass, with a dark line where one part meets another or the paper.
 * @returns {Uint8Array} RGB, w*h*3
 */
export function silhouette(normal, ids, w, h, channels = 4, edge = 28) {
  const e = sobel(grey(normal, w, h, channels), w, h), cls = new Array(w * h);
  for (let i = 0; i < w * h; i++) { const o = i * channels; cls[i] = classify([ids[o], ids[o + 1], ids[o + 2]]); }
  const out = new Uint8Array(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x, c = cls[i], o = i * 3;
    if (c) {
      const col = PALETTE[c]; let rim = false;
      if (x > 0 && cls[i - 1] !== c) rim = true; else if (y > 0 && cls[i - w] !== c) rim = true;
      out[o] = rim ? 20 : col[0]; out[o + 1] = rim ? 20 : col[1]; out[o + 2] = rim ? 20 : col[2];
    } else { const v = 255 - Math.min(255, Math.max(0, (e[i] - edge) * 4) | 0) * 0.75; out[o] = out[o + 1] = out[o + 2] = v; }
  }
  return out;
}

/** What the pixel counts of one camera add up to, for the JSON: per part, and the hand's, in the lap box and as hidden by the robe. */
export function cameraCounts({ all, handAlone, box, w, h, channels = 4 }) {
  const parts = countParts(all, w, h, channels), alone = countParts(handAlone, w, h, channels).hand, lap = box ? countParts(all, w, h, channels, box) : null;
  const hidden = Math.max(0, alone - parts.hand);
  return { parts, handAlone: alone, handVisible: parts.hand, handHidden: hidden, handHiddenFraction: alone ? +(hidden / alone).toFixed(3) : null, lapBox: box && box.map((v) => Math.round(v)), lapHand: lap ? lap.hand : null, lapRobe: lap ? lap.robe : null };
}

/**
 * The review sheet's own reading of the two things #664 turned on. A hand counts as buried when, in the best of the views, less
 * than `handMin` of it (as drawn alone) shows; the hem as high when its front edge is more than `hemTol` above the knee.
 */
export function verdict(r, views, { handMin = 0.2, hemTol = 0.02 } = {}) {
  const best = Math.max(...views.map((v) => (v.handAlone ? v.handVisible / v.handAlone : 0)));
  const handsBuried = best < handMin, hemHigh = r.hemAboveKnee != null && r.hemAboveKnee > hemTol;
  return { bestHandVisibleFraction: +best.toFixed(3), handsBuried, hemAboveKnee: r.hemAboveKnee, hemHigh, ok: !handsBuried && !hemHigh };
}
