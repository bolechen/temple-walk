// The breeze over the courts: one way it blows and how hard, which the censer's smoke leans with and the petals,
// leaves and snow in the air are carried by (drift.js), and whose gusts are the ones heard in the bamboo (audio.js).
//
// It comes up the valley from the south-west, as the day's breeze climbs a mountain (by common sense, our own choice:
// no record of Jingshan's winds was looked for), and so blows toward the north-east: +x, -z.
export const WIND_DIR = Object.freeze([0.8, -0.6]);
// Gusts: two slow waves that sometimes meet, 0.2 to 1.0 (t in seconds).
export const gust = (t) => 0.5 + 0.3 * Math.sin(t * 0.11) + 0.2 * Math.sin(t * 0.043 + 1.7);
// The breeze's strength in metres a second for a mood's `wind`, at time t: never quite still.
export const windAt = (strength, t) => strength * (0.35 + 0.65 * gust(t));
// How readily the trees let go of their leaves and petals at time t, 0 to 1 (#267: the owner, 2026-11-19, "落叶速度可以不那么多，
// 真实世界中也不会一直落"): in still air only a few come down; when a gust comes through (the breeze over SHED[1] m/s, full at
// SHED[2]) a flurry goes, and it thins again as the gust passes. Decided once for each leaf as it leaves the tree, so none
// appears or vanishes in the air. SHED[0] is the share that falls with no wind at all, SHED[3] the share of the old
// steady fall (before #267) that a full gust brings down.
export const SHED = Object.freeze([0.03, 0.5, 1.0, 0.55]);
const smooth = (a, b, x) => { const k = Math.min(1, Math.max(0, (x - a) / (b - a))); return k * k * (3 - 2 * k); };
export const shedAt = (strength, t) => SHED[3] * (SHED[0] + (1 - SHED[0]) * smooth(SHED[1], SHED[2], windAt(strength, t)));
// The same in a shader (`uWS` the mood's strength).
export const SHED_GLSL = /* glsl */`
float shedAt(float ws, float t){ float g=.5+.3*sin(t*.11)+.2*sin(t*.043+1.7); return ${SHED[3].toFixed(3)}*(${SHED[0].toFixed(3)}+${(1 - SHED[0]).toFixed(3)}*smoothstep(${SHED[1].toFixed(2)},${SHED[2].toFixed(2)},ws*(.35+.65*g))); }`;
