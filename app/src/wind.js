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
