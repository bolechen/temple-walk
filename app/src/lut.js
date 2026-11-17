// A colour table for each season and hour: the last word on the picture's colour, after the film curve and the
// screen's encoding, the way a colourist finishes a film. The table is not painted by hand but baked from a few
// numbers the hour gives (`lut` in mood.js), so every one of the sixteen moods has its own and none can go missing:
//   lift, gamma, gain   the classic three-way grade, per channel (the shadows, the middle, the lights)
//   sat                 saturation about the picture's own lightness
//   shadow, light       a tint laid into the darks and into the lights (split toning), as offsets to each channel
// The identity (lift 0, gamma 1, gain 1, sat 1, no tints) leaves the picture as it was: summer by day, J01, keeps it.
export const IDENTITY = { lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1], sat: 1, shadow: [0, 0, 0], light: [0, 0, 0] };
export const LUT_SIZE = 32;

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// One colour (display-referred, 0..1) through the grade.
export function grade(rgb, p = IDENTITY) {
  const c = [0, 1, 2].map((i) => {
    const v = p.gain[i] * (rgb[i] + p.lift[i] * (1 - rgb[i]));
    return Math.pow(clamp01(v), 1 / p.gamma[i]);
  });
  const l = 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2], dark = 1 - smooth(0, 0.5, l), lit = smooth(0.45, 1, l);
  return c.map((v, i) => clamp01(l + (v - l) * p.sat + p.shadow[i] * dark + p.light[i] * lit));
}

// The whole table, as RGBA bytes for a 3D texture: red fastest, then green, then blue.
export function bakeLut(p = IDENTITY, n = LUT_SIZE) {
  const out = new Uint8Array(n * n * n * 4);
  for (let b = 0, k = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++, k += 4) {
    const c = grade([r / (n - 1), g / (n - 1), b / (n - 1)], p);
    out[k] = Math.round(c[0] * 255); out[k + 1] = Math.round(c[1] * 255); out[k + 2] = Math.round(c[2] * 255); out[k + 3] = 255;
  }
  return out;
}

export const isIdentity = (p) => !p || JSON.stringify({ ...IDENTITY, ...p }) === JSON.stringify(IDENTITY);
