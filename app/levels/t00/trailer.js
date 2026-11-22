// The first Steam trailer, as data (#610; docs/trailer/storyboard.md has the reasons). Seventy seconds of the prologue, shot by
// shot: where the eye is, what season and hour it is, who walks where, which captions are up. The player (src/trailer.js)
// and the renderer (tools/trailer.mjs) read this and know no temple; tests/unit/trailer-script.test.mjs holds every free
// camera to the director's limits (15 m/s, 144°/s) and clear of walls, floors and roofs on this level's own plan.
// Nothing here is a new place: every position is a named view or a shot of the plan (`site.views`, `SHOTS`), or on the
// summit pavilion's balcony (`LOFT` in site.js). Coordinates: 1 unit is 1 m, north is -z, yaw 0 faces north.

const LOFT = { cx: 0, cz: -131.3, floor: 35.03, r: 4.6 };   // the Lingxiao pavilion's balcony: a circle between its wall (3.4 m from the middle) and its rail (5.8 m)

// Half a turn round the balcony from the door on the south side, eastward, looking out over the rail and down at the roofs.
// The balcony is a square ring (its wall 3.4 m out from the middle, its rail 5.8 m), so the way goes round on a rounded square.
const side = (v) => Math.sign(v) * Math.abs(v) ** 0.35;
const round = ([theta, t, fov]) => {
  const dx = LOFT.r * side(Math.sin(theta)), dz = LOFT.r * side(Math.cos(theta)), n = Math.hypot(dx, dz), y = LOFT.floor + 1.55;
  const x = dx, z = LOFT.cz + dz;
  return { t, p: [x, y, z], look: [x + (dx / n) * 14, y - 2.9, z + (dz / n) * 14], fov };
};

export const TRAILER = {
  id: "t00-steam-1",
  length: 70,
  fps: 60,
  dip: 0.4,                 // seconds of paper out of one shot and into the next
  captionFade: 0.8,
  shots: [
    { id: "opening", from: 0, to: 7, kind: "opening", opening: 0, season: "summer", time: "day", zone: "grove" },
    { id: "bamboo", from: 7, to: 16, kind: "follow", view: "third", at: [21.3, 91.5, 0, 0.3], walk: [[20.9, 79.5]], season: "summer", time: "day", zone: "grove" },
    { id: "stair", from: 16, to: 24, kind: "follow", view: "third", at: [20.8, 78.6, -1.35, 0.16], walk: [[10.5, 76.3], [0, 74.6], [0, 66]], season: "summer", time: "day", zone: "stair" },
    { id: "screen", from: 24, to: 32, kind: "follow", view: "third", at: [0, 62, 0, 0.14], walk: [[6.6, 53.4], [0, 50.5]], season: "summer", time: "day", zone: "gate" },
    { id: "court", from: 32, to: 39, kind: "follow", view: "third", at: [0, 33, 0, 0.1], walk: [[0, 20]], season: "autumn", time: "day", zone: "court" },
    { id: "bell", from: 39, to: 46, kind: "eye", season: "autumn", time: "day", zone: "court", stand: [15.5, 36.88, Math.PI],
      keys: [{ t: 0, p: [12.9, 0.5, 33.88], look: [15.5, 1.52, 38.19], fov: 40 }, { t: 7, p: [12.78, 0.5, 33.95], look: [15.5, 1.52, 38.19], fov: 40 }],
      events: [{ at: 1.2, strike: "bell" }, { at: 3.4, strike: "bell" }, { at: 5.6, strike: "bell", flock: true }] },
    { id: "altar", from: 46, to: 50, kind: "eye", hall: "main", season: "autumn", time: "dusk", zone: "hall",
      keys: [{ t: 0, p: [120, -58.4, 3.6], look: [120, -58.2, -4], fov: 55 }, { t: 4, p: [120, -58.4, 1.2], look: [120, -58.2, -4], fov: 52 }] },
    { id: "door", from: 50, to: 54, cut: "hard", kind: "follow", view: "first", hall: "main", at: [120, 4, Math.PI, 0.02], walk: [[120, 8.6]], season: "autumn", time: "dusk", zone: "hall" },
    { id: "loft", from: 54, to: 65, kind: "eye", up: "lingxiao", season: "autumn", time: "dusk", zone: "summit",
      keys: [[0, 0, 55], [0.55, 2.5, 55], [1.1, 5, 55], [1.7, 8, 54], [2.2, 10.2, 50], [2.35, 11, 46]].map(round) },
    { id: "lookback", from: 65, to: 70, kind: "eye", season: "autumn", time: "dusk", zone: "summit",
      keys: [{ t: 0, p: [0, 22.6, -123], look: [0, 18.5, -103], fov: 50 }, { t: 5, p: [0, 22.6, -122.2], look: [0, 18.5, -103], fov: 46 }] },
  ],
  // Four lines, Chinese and English together, in the lower third; only the film's own words.
  captions: [
    { from: 9, to: 14.5, zh: "一步一阶，入山。", en: "One step, one stair." },
    { from: 26, to: 31, zh: "门在雾后。", en: "The gate waits behind the mist." },
    { from: 47.6, to: 53.4, zh: "灯在，人就在。", en: "A lamp is lit; someone is here." },
    { from: 57.5, to: 64, zh: "山门之外，还有山门。", en: "Beyond the gate, another gate." },
  ],
  // The last five seconds: the picture goes to paper and the title stands on it.
  end: { fade: 4 },
  card: { from: 66, fade: 1.2, title: "山门之外", sub: "序章 · 云径禅寺", en: "One City, One Temple", wish: "加入愿望单", wishEn: "Add to Wishlist" },
};
