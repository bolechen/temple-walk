// The colour of the sky from where the sun stands (#592, trial B).
//
// The hour tables (mood.js) write the sky's zenith and horizon colours, the fog's, the sky-light's and the sun's by hand,
// one set for each of sixteen moods; the hand is the only thing that keeps them agreeing. Here one function gives all of
// them from the sun's height: single scattering in a clear atmosphere (Rayleigh and Mie, after Nishita 1993 and the
// shape of Hillaire 2020's sky-view table), worked out into a small table of the sky's colour over the whole sphere, and
// from it the colour at the zenith, at the horizon, of the mist, of the light the sky gives and of the sun through the air.
//
// What is taken from it is hue and shape, not brightness: the table's own lightness for each field is kept (the film's
// exposure and the light of each mood were tuned by eye against it, and J01 is not to move), the hue and the gradient
// come from the air. Under cloud the sky is the table's own, as it was: the more cloud, the less of the scattering
// shows. Night is left to the table, whose moon is not a sun, and whose blue is a matter of eyes, not of air.
//
// Worked out when the hour changes (a few thousand rays: about 10 ms), not baked to a file: sixteen pictures would be
// 400 KB to save a hundredth of a second at a moment the page already spends a PMREM on.
//
// `?trial=sky` turns it on at load; `__skyTrial(on)` turns it on and off while the page runs. Off, nothing here is called.

/** Whether the trial is asked for (the address); a tool may flip it. */
export const SKY_TRIAL = { on: typeof location !== "undefined" && /[?&]trial=([^&]*,)?sky(,|&|$)/.test(location.search) };

// The planet and its air, in metres and per metre (Earth, clear day).
const R_EARTH = 6360e3, R_ATM = 6420e3, H_R = 8000, H_M = 1200, G_M = 0.76;
const BETA_R = [5.8e-6, 13.5e-6, 33.1e-6], BETA_M = 21e-6, SUN_E = 22;
// Ozone takes the red and the green out of the long paths and leaves the blue (a layer about 25 km up, 15 km either way: Hillaire 2020's numbers); without it a clear horizon goes yellow-green.
const BETA_O = [0.65e-6, 1.881e-6, 0.085e-6], ozone = (h) => Math.max(0, 1 - Math.abs(h - 25000) / 15000);
const LUT_W = 48, LUT_H = 32, EL0 = -0.1;   // across: the angle from the sun's side, 0 to pi; up: the view's height, -0.1 rad to the zenith, more of them near the horizon

const exp = Math.exp, PI = Math.PI;
/** Distance from a point `p` (height above the planet's centre `r`, cosine of the angle to the up there `mu`) along a ray to a sphere of radius `R`, or -1 if the ray misses it going forward. */
function hitSphere(r, mu, R) { const b = r * mu, c = r * r - R * R, d = b * b - c; if (d < 0) return -1; const s = Math.sqrt(d), t0 = -b - s, t1 = -b + s; return t0 > 0 ? t0 : t1 > 0 ? t1 : -1; }

/**
 * The sky's radiance along one direction, for a sun at height angle `es` (radians), the view at height `el` and `az` from the
 * sun's side. Returns [r, g, b] in the units of `SUN_E` (not exposure-matched to anything).
 */
function radiance(es, el, az) {
  const cosEl = Math.cos(el), sinEl = Math.sin(el);
  const d = [cosEl * Math.cos(az), sinEl, cosEl * Math.sin(az)], s = [Math.cos(es), Math.sin(es), 0];
  const mu = d[0] * s[0] + d[1] * s[1] + d[2] * s[2];
  const pR = (3 / (16 * PI)) * (1 + mu * mu), g2 = G_M * G_M, pM = (3 / (8 * PI)) * ((1 - g2) * (1 + mu * mu)) / ((2 + g2) * Math.pow(1 + g2 - 2 * G_M * mu, 1.5));
  const r0 = R_EARTH + 1;
  let tEnd = hitSphere(r0, sinEl, R_ATM); const tGround = sinEl < 0 ? hitSphere(r0, sinEl, R_EARTH) : -1; if (tGround > 0) tEnd = tGround;
  const N = 16, ds = tEnd / N; let oR = 0, oM = 0, oO = 0; const sum = [0, 0, 0], ms = [0, 0, 0], msK = 0.3 * SUN_E * Math.sqrt(Math.max(Math.sin(es), 0)) / (4 * PI);   // `ms`: the light scattered twice, which a sun's single pass leaves out and which gives the horizon its blue back, taken as an even glow along the way
  for (let i = 0; i < N; i++) {
    const t = (i + 0.5) * ds, px = r0 * 0 + d[0] * t, py = r0 + d[1] * t, pz = d[2] * t, r = Math.hypot(px, py, pz), h = r - R_EARTH;
    const dR = exp(-h / H_R) * ds, dM = exp(-h / H_M) * ds; oR += dR; oM += dM; oO += ozone(h) * ds;
    // The sun's light to here: through the air along the sun's direction, unless the planet is in the way.
    for (let c = 0; c < 3; c++) ms[c] += msK * exp(-(BETA_R[c] * oR + 1.1 * BETA_M * oM + BETA_O[c] * oO)) * BETA_R[c] * dR;
    const muS = (px * s[0] + py * s[1] + pz * s[2]) / r; if (hitSphere(r, muS, R_EARTH) > 0) continue;
    const tS = hitSphere(r, muS, R_ATM), M = 6, dsS = tS / M; let lR = 0, lM = 0, lO = 0;
    for (let j = 0; j < M; j++) { const q = (j + 0.5) * dsS, qx = px + s[0] * q, qy = py + s[1] * q, qz = pz + s[2] * q, hh = Math.hypot(qx, qy, qz) - R_EARTH; lR += exp(-hh / H_R) * dsS; lM += exp(-hh / H_M) * dsS; lO += ozone(hh) * dsS; }
    for (let c = 0; c < 3; c++) { const tau = BETA_R[c] * (oR + lR) + 1.1 * BETA_M * (oM + lM) + BETA_O[c] * (oO + lO); sum[c] += exp(-tau) * (BETA_R[c] * pR * dR + BETA_M * pM * dM) / ds; }
  }
  const out = [0, 0, 0];
  for (let c = 0; c < 3; c++) out[c] = sum[c] * ds * SUN_E + ms[c];
  if (tGround > 0) { const lit = Math.max(es, 0), a = 0.12 * lit; for (let c = 0; c < 3; c++) out[c] += a * SUN_E * 0.2 * exp(-(BETA_R[c] * oR + 1.1 * BETA_M * oM)); }
  return out;
}

const lum = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
/** The colour `c` with the brightness `Y`: its hue, the table's lightness. */
const withY = (c, Y) => { const k = Y / Math.max(lum(c), 1e-9); return [c[0] * k, c[1] * k, c[2] * k]; };

/**
 * The sky for a sun at height angle `es` (radians) and its derived colours.
 * @returns {{ data: Float32Array, W: number, H: number, el0: number, zen: number[], hor: number[], fog: number[], hemi: number[], sun: number[] }}
 *   `data` is the table, RGBA floats, row by row from the horizon's side; the colours are chromaticity only (lightness 1, scale them).
 */
export function skyTable(es) {
  const data = new Float32Array(LUT_W * LUT_H * 4), elMax = PI / 2;
  for (let j = 0; j < LUT_H; j++) {
    const v = (j + 0.5) / LUT_H, el = EL0 + v * v * (elMax - EL0);   // more rows near the horizon
    for (let i = 0; i < LUT_W; i++) { const az = ((i + 0.5) / LUT_W) * PI, c = radiance(es, el, az), o = (j * LUT_W + i) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2]; data[o + 3] = 1; }
  }
  const at = (el, az) => radiance(es, el, az);
  // The zenith; the horizon and the mist (the first few degrees, all round); what the sky gives (cosine-weighted over the upper half).
  const zen = at(elMax - 0.001, 0), hor = [0, 0, 0], hemi = [0, 0, 0]; let wsum = 0;
  for (let k = 0; k < 6; k++) { const c = at(0.03 + 0.08 * (k / 5), (k + 0.5) * PI / 6); for (let q = 0; q < 3; q++) hor[q] += c[q] / 6; }
  for (const el of [0.2, 0.5, 0.85, 1.2, 1.5]) for (let k = 0; k < 6; k++) { const c = at(el, (k + 0.5) * PI / 6), w = Math.sin(el) * Math.cos(el); for (let q = 0; q < 3; q++) hemi[q] += c[q] * w; wsum += w; }
  for (let q = 0; q < 3; q++) hemi[q] /= wsum;
  // The sun through the air to the ground: the colour left in it (1 at its largest).
  const r0 = R_EARTH + 1, muS = Math.sin(es), tS = hitSphere(r0, muS, R_ATM), M = 12, dsS = tS / M; let lR = 0, lM = 0, lO = 0;
  for (let j = 0; j < M; j++) { const q = (j + 0.5) * dsS, py = r0 + muS * q, px = Math.cos(es) * q, hh = Math.hypot(px, py) - R_EARTH; lR += exp(-hh / H_R) * dsS; lM += exp(-hh / H_M) * dsS; lO += ozone(hh) * dsS; }
  const sun = BETA_R.map((b, c) => exp(-(b * lR + 1.1 * BETA_M * lM + BETA_O[c] * lO))), sm = Math.max(...sun);
  const norm = (c) => withY(c, 1);
  return { data, W: LUT_W, H: LUT_H, el0: EL0, zen: norm(zen), hor: norm(hor), fog: norm(hor), hemi: norm(hemi), sun: sun.map((v) => v / sm) };
}

/** Where the sun is: its height angle from the mood's direction. */
export const sunHeight = (sun) => Math.asin(Math.max(-1, Math.min(1, sun[1] / Math.hypot(sun[0], sun[1], sun[2]))));

/**
 * What the trial changes in a mood table: `zen`, `hor`, `fog`, `hemiS` and `sunCol` take the hue the air gives at this sun, at the
 * table's own lightness, less the more cloud there is; `sky` carries the table for the dome (`k`, its scale so that the zenith is the
 * table's, `over` how much of the sky is the table's own). Night is not touched. Does not change `m`; returns the fields to lay over it.
 */
export function atmosphereMood(m) {
  if (m.time === "night") return null;
  const es = sunHeight(m.sun), a = skyTable(es), over = Math.pow(Math.min(1, Math.max(0, (m.cloud - 0.1) / 0.9)), 1.4);
  // `share`: how much of the air's hue each field takes. The sky and the sun take all of it; the mist and the sky-light take part, for the ground
  // and the haze give light back that a clear atmosphere over bare earth does not (and a temple court is neither).
  const mix = (hand, air, share = 1) => hand.map((v, i) => v * (over + (1 - over) * (1 - share)) + air[i] * (1 - over) * share);
  const lt = (c) => lum(c);
  const zen = mix(m.zen, withY(a.zen, lt(m.zen))), hor = mix(m.hor, withY(a.hor, lt(m.hor))), fog = mix(m.fog, withY(a.fog, lt(m.fog)), 0.6), hemiS = mix(m.hemiS, withY(a.hemi, lt(m.hemiS)), 0.4);
  // The sun's colour through the air, at the table's brightness; cloud puts the table's back.
  const sunCol = mix(m.sunCol, withY(a.sun, lt(m.sunCol)));
  const zl = lum([a.data[0], a.data[1], a.data[2]]);   // (a sentinel; the dome's scale is below)
  void zl;
  // The dome's scale: the table's zenith is, in the units of the sun, a lightness; the hand's zenith is the one to match.
  const row = a.H - 1, o = (row * a.W + 0) * 4, zenLut = lum([a.data[o], a.data[o + 1], a.data[o + 2]]);
  return { zen, hor, fog, hemiS, sunCol, sky: { table: a, k: lum(m.zen) / Math.max(zenLut, 1e-9), over } };
}
