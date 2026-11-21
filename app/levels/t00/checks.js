// What the checks and picture tools need of the prologue beyond its plan (docs/t05/LEVEL-SPLIT.md S6; read only in Node, by
// tests/unit/level-plan.mjs and tools/, never by the page, as bake.js is): the six fixed views' labels, the places the
// horizon is held from, and the routes the eye and the near plane are walked along. They are the tables that lay in
// follow.test, spring-arm.test, nearplane.test, horizon.test and tools/cameras.mjs before levels had a folder of their
// own, moved here unchanged, so the prologue's checks walk exactly what they walked. A level adds its own file.
import { LEVELS, SITE, APPROACH } from "../../src/site.js";
import { CHEEK, stairProfile } from "../../src/geo.js";
import { ROUTE } from "../../src/tour.js";

const T = LEVELS;
/** @param {{ censer: { x: number, z: number } }} site */
const censerRings = (site) => ({
  "round the censer": [...Array(17)].map((_, i) => [site.censer.x + Math.sin(i * Math.PI / 4) * 1.05, site.censer.z + Math.cos(i * Math.PI / 4) * 1.05]),
  "round the censer the other way, it on his right": [...Array(17)].map((_, i) => [site.censer.x - Math.sin(i * Math.PI / 4) * 1.05, site.censer.z + Math.cos(i * Math.PI / 4) * 1.05]),
  "away from the censer, north and then south": [[site.censer.x, site.censer.z - 1.0], [site.censer.x, site.censer.z - 5], [site.censer.x + 1.2, site.censer.z], [site.censer.x, site.censer.z + 1.0], [site.censer.x, site.censer.z + 6]],
});
// The routes the three eye tests walk in common: the measured walk and the courts.
const common = () => ({
  "the measured route, bamboo to the first court": ROUTE,
  "round the first court, close past the bell and drum towers": [[-10.8, 19], [10.8, 19], [10.8, 6], [-10.8, 6], [-10.8, 19]],
  "up the axis of the first court to the main hall's stair": [[0, 29], [0, 15.4], [1.3, 13], [0, 10.6], [0, -4.5]],
});

/** @type {Record<string, any>} */
export default {
  // The six fixed views of the T00 handoff: id, label and what the picture shows (tools/cameras.mjs).
  cameras: {
    sceneId: "T00", preset: "J01 = summer · day (overcast after rain)",
    what: {
      cam01: ["CAM-01", "竹林起点", "前景竹干、中景石阶与来路方向"], cam02: ["CAM-02", "石阶转折", "折线台阶、挡墙、近远植被"], cam03: ["CAM-03", "照壁之前", "照壁遮挡山门，通行方向仍可读"],
      cam04: ["CAM-04", "绕壁后的山门正面", "重阁轮廓、入口与两侧构件"], cam05: ["CAM-05", "门内回望", "门框、刚走过的路、竹林"], cam06: ["CAM-06", "第一个院落主视点", "近景树或门框、中景院地、远景殿堂"],
    },
  },
  // Where the horizon is held from (tests/unit/horizon.test.mjs): name, x, z, and the height the eye stands at, if not the land's plus 1.6.
  horizon: {
    places: [
      ["bamboo start", 21.3, 91.6], ["start, west", -6, 100], ["river pavilion", 0, 100], ["half-way pavilion", 10.2, 77.4],
      ["forecourt", 0, 58.5], ["first court", 0, 29], ...LEVELS.map((L, i) => [`terrace ${i}`, 0, (L.zS + L.zN) / 2, L.y + 1.6]), ["summit", 0, -125, LEVELS[2].y + 1.6],
    ],
  },
  // tests/unit/follow.test.mjs
  follow: {
    routes: () => ({ ...common(), "up the stair to the second terrace and on to the Guanyin hall's steps": [[0, T[1].zS + 10], [0, T[1].zS - 5.5]] }),
    // Where he stands still and the view is swung right round: a grid over the first court and its towers.
    spots: { x: [-12, 12], z: [-4, 28], step: 3 },
    // The two walks whose eye must never jump at all, put out of something or not (#271).
    neverJump: { "from behind the censer north past it": [[0, 18], [1.3, 13], [0, 9], [0, 3]], "in through the gate's middle bay": [[8.5, 52], [8.5, 49], [0, 46.5], [0, 34]] },
  },
  // tests/unit/spring-arm.test.mjs: the same routes, and the walks round a hall and through the gate (the plan's buildings by name).
  springArm: {
    routes: (/** @type {any} */ site) => {
      const hall = site.buildings.find((/** @type {any} */ b) => b.name === "大雄宝殿"), tea = site.buildings.find((/** @type {any} */ b) => b.name === "茶寮"), [cx, , cz] = site.censer.toArray();
      return {
        "round the great hall's platform": [[hall.x0 + 1.0, hall.z1 - 1.4], [hall.x1 - 1.0, hall.z1 - 1.4], [hall.x1 - 0.95, hall.z0 + 1.4], [hall.x0 + 0.95, hall.z0 + 1.4], [hall.x0 + 1.0, hall.z1 - 1.4]],
        "round the great hall's platform the other way": [[hall.x0 + 1.0, hall.z1 - 1.4], [hall.x0 + 0.95, hall.z0 + 1.4], [hall.x1 - 0.95, hall.z0 + 1.4], [hall.x1 - 1.0, hall.z1 - 1.4], [hall.x0 + 1.0, hall.z1 - 1.4]],
        "behind the tea house": [[tea.x0 + 0.3, tea.z0 + 0.8], [tea.x0 + 0.3, tea.z1 - 0.8]],
        "behind the tea house the other way": [[tea.x0 + 0.3, tea.z1 - 0.8], [tea.x0 + 0.3, tea.z0 + 0.8]],
        "in through the gate": [[0, 48], [0, 33]],
        "out through the gate": [[0, 33], [0, 48]],
        "past the censer, with it behind him": [[cx + 1.3, cz + 8], [cx + 1.3, cz - 0.5], [cx, cz - 3]],
      };
    },
    // The two routes the eye's own sphere is tested along at the widest lenses.
    lensRoutes: ["round the great hall's platform", "in through the gate"],
    // What the walks of the eye's space are gathered over: the courts and the terraces, and the hall of the walks.
    gather: { x0: -60, x1: 60, z0: -140, z1: 100, bottom: -200, top: 200 },
  },
  // tests/slow/nearplane.test.mjs
  // tests/unit/grove-eye.test.mjs (#515): the old path through the bamboo, walked each way, where the eye from behind him
  // must keep out of the grove as it keeps out of a wall. Laid on the open floor of each: across the river-view pavilion's
  // platform, the first two flights from the start up to the half-way pavilion, round the open side of the ink-stone
  // pool's platform (where the tester stood), and the first steps from the bamboo start.
  grove: {
    routes: () => {
      const A = APPROACH;
      return {
        "across the river-view pavilion's platform": [[A.xB0 + 1.0, A.zC1 - 2.2], [A.xB1 + 3.4, A.zC1 - 2.2]],
        "from the lower platform up to the half-way pavilion": [[A.xC, A.zC1 - 1.2], [A.xC, A.zA1 + 0.4], [A.xB0 - 0.4, A.zMid], [A.xTurn - 0.4, A.zMid]],
        "round the ink-stone pool's platform": [[A.xB0 - 2.0, A.zA1 - 1.3], [A.xB0 + 5.0, A.zA1 - 1.3], [A.xB0 + 5.0, A.zA0 + 1.0], [A.xB0 - 2.0, A.zA0 + 1.0]],
        "the first steps from the bamboo start": [[A.xC, A.zC1 - 1.2], [A.xC, A.zC1 - 3.2]],
      };
    },
  },
  nearplane: {
    routes: (/** @type {any} */ site) => ({ ...common(), ...censerRings(site), "up the stair to the second terrace and on to the Guanyin hall's steps": [[0, T[1].zS + 10], [0, T[1].zS - 5.5]] }),
  },
  // tools/edges.mjs: the ground swept (his centre, 5 cm cells), what the buildings are called in its table, the things in it that are
  // no building (a wall, a well, the turns of the path, the terraces' stairs and parapets), and what keeps him off a spot.
  edges: {
    box: () => ({ x0: -36, x1: 36, z0: SITE.zN - 3, z1: APPROACH.end + 3 }),
    names: { "万年正续": "山门", "云径禅寺": "山门", "释迦宝殿": "大雄宝殿" },
    items: () => {
      const Ap = APPROACH;
      return [
        { name: "照壁", x0: -5.75, x1: 5.75, z0: 54.5, z1: 55.5 }, { name: "龙井", x0: 11.6, x1: 14.8, z0: LEVELS[1].zS - 0.5, z1: LEVELS[1].zS + 1.4 },
        { name: "古道转折（上：正对前院的一段与平台）", x0: -Ap.w / 2 - CHEEK, x1: Ap.xTurn, z0: Ap.zA0, z1: Ap.zA1 },
        { name: "古道转折（中：洗砚池旁平台）", x0: Ap.xB0, x1: Ap.xB1, z0: Ap.zA0, z1: Ap.zA1 }, { name: "古道转折（下：起步平台）", x0: Ap.xB0, x1: Ap.xB1 + 2.6, z0: Ap.zC0, z1: Ap.zC1 },
        ...LEVELS.map((L, i) => ({ name: `第${"一二三"[i]}层台地的大台阶`, x0: -L.stair / 2 - CHEEK, x1: L.stair / 2 + CHEEK, z0: L.zS, z1: L.zS + stairProfile(L.y - (i ? LEVELS[i - 1].y : 0)).run })),
        ...LEVELS.map((L, i) => ({ name: `第${"一二三"[i]}层台地南缘护墙`, x0: -L.x, x1: L.x, z0: L.zS - 0.26, z1: L.zS })),
      ];
    },
    // Why he cannot stand at (x, z), once the buildings have been asked (`other`: the one it is the base or body of, if any).
    why: (/** @type {any} */ walker, /** @type {number} */ x, /** @type {number} */ z) => {
      if (Math.abs(x) > SITE.x - 0.6 || z < SITE.zN + 0.6) return "围墙之外";
      return null;
    },
    whyAfter: (/** @type {any} */ walker, /** @type {number} */ x, /** @type {number} */ z) => {
      if (z > SITE.fore + 0.3 && walker.onGround(x, z)) return "路外的竹林与山坡，没有可走的地面";
      for (const L of LEVELS) if (Math.abs(z - L.zS) < 1.2) return "台地边缘的挡土墙与护墙";
      return null;
    },
  },
};
