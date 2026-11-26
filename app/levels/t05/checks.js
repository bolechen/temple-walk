// What the checks that walk T05 need beyond its plan (docs/t05/LEVEL-SPLIT.md S6; read only in Node, by tests/unit/level-plan.mjs
// and the tools, never by the page, as bake.js is). So far: the routes the near plane is walked along (tests/slow/nearplane.test.mjs).
// Each route is a run of [x, z] points, walked at his pace with the following eye behind him and from his own eyes.
import { AXIS, FOOT, LANE, SECOND } from "./axis.js";
import { ARRIVE, PLATFORM, STATION } from "./site.js";
import { HALL_DOORS } from "./hall.js";

const FLIGHT = "up the flight to the terrace and down again", SILL = "over the middle door's sill into the hall";
const AISLE_E = "round the east aisle of the worship band", AISLE_W = "round the west aisle of the worship band", AISLES = "round both aisles, east first";
// The camera is walked up the flight and down again, over the middle door's sill, and round the worship band's two aisles (PRD.md §1.4 route 3;
// #562: turned out of an aisle's end the eye used to be taken through the hall's 1 m side wall and stand outside it).
// While the great hall's doors are shut (HALL_DOORS in hall.js; the first release, DECISIONS.md 先行版关殿门) nothing is walked through them: the sill and aisle routes
// give way to one that stops at the doors (the eye behind him is still taken up to them), and come back with the hall, `shut: false`.
const AT_DOORS = "up to the shut doors";
const ALL_ROUTES = Object.freeze({
  [FLIGHT]: [[0, 26], [0, 12], [0, 26]],
  [SILL]: [[0, 6], [0, -4]],
  [AISLE_E]: [[0, -4], [12, -5], [21.3, -7], [21.3, -13], [12, -11], [0, -9], [0, -4]],
  [AISLE_W]: [[0, -4], [-12, -5], [-21.3, -7], [-21.3, -13], [-12, -11], [0, -9], [0, -4]],
  [AISLES]: [[0, -4], [12, -5], [21.3, -7], [21.3, -13], [12, -11], [0, -9], [-12, -5], [-21.3, -7], [-21.3, -13], [-12, -11], [0, -9], [0, -4]],
  [AT_DOORS]: [[0, 6], [0, 1.2]],
});
const HALL_ROUTES = Object.freeze(Object.fromEntries(Object.entries(ALL_ROUTES).filter(([k]) => (HALL_DOORS.shut ? k === FLIGHT || k === AT_DOORS : k !== AT_DOORS))));

/** @type {Record<string, any>} */
export default {
  // The seven fixed views of the handoff, with what each must and must not show (docs/t05/PRD.md §3; tools/cameras.mjs writes docs/t05/camera-manifest.json from them and the plan's
  // views). A fourth entry says what differs from a still taken from his own eyes: cam03's is taken in third person (DECISIONS.md, 2026-11-21),
  // from the following eye a few steps behind him, measured in the page at (0, 3.66, 6.57), pitched 0.056 (the same DECISIONS.md, 2026-11-21).
  cameras: {
    sceneId: "T05", preset: "summer · day, the page's default for a fixed view; T05's own J01 (初冬晴冷, docs/t05/ART.md §4.2) is not built yet, and the pictures change with it, not the poses",
    what: {
      cam01: ["CAM-01", "院落远望", "必看：九间立面与三门四窗；3 米台基与月台；单檐五脊庑殿顶与青灰瓦；三块竖匾的剪影。忌看：重檐、歇山、琉璃瓦；屋脊被树切断"],
      cam02: ["CAM-02", "台基", "必看：踏道与垂带；台基侧面；檐柱与七铺作斗栱；门洞的暗。忌看：整座屋顶；薄台"],
      cam03: ["CAM-03", "殿门中央", "必看：门框在左右边缘；中间三尊；佛坛与背光；梁架；门到佛坛的光梯度。忌看：一张看全七尊；平顶藻井；七尊相同；追光", { view: "third", eye: [0, 3.66, 6.57], pitch: 0.056 }],
      cam04: ["CAM-04", "侧向观看", "必看：七佛侧面与手印、衣式的差异；胁侍的前后节奏；至少一尊天王；侧壁壁画；内柱列。忌看：佛像背面；七尊同一侧影"],
      cam05: ["CAM-05", "仰视梁架", "必看：八缝梁架、四椽栿、驼峰、斗栱、彩画色带。忌看：平顶；黑成一片"],
      cam06: ["CAM-06", "回到中央", "必看：中间四五尊与两侧各一尊的局部。忌看：硬塞七尊进一张。镜头：第一人称 65°、第三人称 50°（site.js 的 LENS；其余机位 52°/44°）"],
      cam07: ["CAM-07", "内山门望殿", "必看：门洞框住甬道、牌坊、高台上的无量殿和远处大殿的庑殿顶，大殿正脊全长与两端鸱吻露出（FOLLOW-UP.md，美术总监的三条判法）。忌看：牌坊门洞内有树；无量殿吻尖高过大殿鸱吻顶"],
    },
  },
  // Where the horizon is held from (tests/unit/horizon.test.mjs): name, x, z, the eye's height. The county is flat and there are no far hills
  // (SITE.md §4.1), so what must lie below the horizon is the plain outside the walls, the walls and the buildings: the six stations, the arrival
  // and the axis's three passages (PLAN.md item 11, gap 2), each at 1.6 m over its own floor (the outer gate's platform 0.5, the second terrace 1.0, the court 0, the hall 3: t05-plan.test).
  horizon: {
    places: [
      ["arrival", ARRIVE[0], ARRIVE[1], 1.6], ["outer gate's passage", 0, AXIS.outerZ, 0.5 + 1.6], ["inner gate's passage (cam07)", 0, AXIS.innerZ + 1, SECOND.y + 1.6],
      ["Wuliang hall's passage", 0, AXIS.hallZ, SECOND.y + 1.6],
      ...Object.entries(STATION).map(([k, [x, z]]) => [`station ${k}`, x, z, (k === "A" || k === "B" ? 0 : PLATFORM.h) + 1.6]),
    ],
  },
  // The camera's routes inside and up to the great hall (PLAN.md item 12, gap 4): up the flight to the terrace and down again, over the middle door's
  // sill into the hall (and the worship band's aisles, PRD.md §1.4 route 3). tests/unit/follow.test.mjs and
  // spring-arm.test.mjs walk them with WALK_LEVEL=t05.
  // follow.test walks only the sill and the flight going up: it asks the written plan, which in T05 is only the eye's fallback for the half
  // second before the drawn geometry's hierarchy is built (step 6 deletes it), and T00's follow has no flight to come down either; going
  // down the flight that plan pushes the eye 3 m in 8 frames and the aisles force it in 18 frames of 2973 (DECISIONS.md, 2026-11-21).
  // spring-arm.test, which asks what is drawn, walks both whole.
  follow: {
    routes: () => ({ ...(HALL_DOORS.shut ? { [AT_DOORS]: HALL_ROUTES[AT_DOORS] } : { [SILL]: HALL_ROUTES[SILL] }), "up the flight to the terrace": [[0, 26], [0, 12]] }),
    // Where he stands still and the view is swung right round: a grid over the terrace, the flight's foot and the hall's front half.
    spots: { x: [-12, 12], z: [-12, 24], step: 3 },
  },
  springArm: {
    routes: () => HALL_ROUTES,
    lensRoutes: HALL_DOORS.shut ? [AT_DOORS] : [SILL],
    // What the walks of the eye's space are gathered over: the hall, its platform and terrace, and the court before them.
    gather: { x0: -40, x1: 40, z0: -40, z1: 45, bottom: -10, top: 40 },
  },
  nearplane: {
    routes: () => {
      const inner = FOOT.inner, hall = FOOT.hall, edge = LANE.hw - LANE.t / 2 - 0.9, tedge = SECOND.hw - SECOND.wallT / 2 - 0.9;
      return {
        "the forecourt and the way, from the arrival to the foot of the inner gate's steps": [[0, 215], [0, AXIS.outerZ], [0, inner.z1 + 4]],
        "through the outer gate's passage, there and back": [[0, AXIS.outerZ + 9], [0, AXIS.outerZ - 9], [0, AXIS.outerZ + 9]],
        // (A name that begins "along" is walked at three pitches, which the check made for a porch's columns: looking steeply down from behind him the eye rises into a gate's eave, which the written plan has no way to say and the eye's own space, which asks what is drawn, does.)
        // Between the gates, past the reach of the eye behind him from either platform's corner (6 m back from the one he leaves, a gate's wall and the platform's lip beside it): the corners are held by the eye's own space, which asks what is drawn.
        "close along the way's east wall": [[edge, AXIS.outerZ - 13], [edge, inner.z1 + 8]],
        "close along the way's west wall, the other way": [[-edge, inner.z1 + 8], [-edge, AXIS.outerZ - 13]],
        "through the inner gate's passage, there and back": [[0, AXIS.innerZ + 9], [0, AXIS.innerZ - 9], [0, AXIS.innerZ + 9]],
        "through the Wuliang hall's passage and down its back steps, then up again": [[0, hall.z1 + 4], [0, hall.z0 - 5], [0, hall.z1 + 4]],
        "up the inner gate's steps and across its platform onto the second terrace": [[0, inner.z1 + 4], [0, inner.z1 - 0.5], [0, inner.z0 - 3]],
        "the second terrace, from the inner gate to the Wuliang hall's platform": [[0, inner.z0 - 3], [0, AXIS.paifangZ], [0, hall.z1 + 3]],
        // (the archway's three bays: the middle one is the second terrace's route above; each side bay, there and back, is held by the eye's own space)
        "through the archway's east side bay, there and back": [[4.2, AXIS.paifangZ + 9], [4.2, AXIS.paifangZ - 9], [4.2, AXIS.paifangZ + 9]],
        "through the archway's west side bay, there and back": [[-4.2, AXIS.paifangZ + 9], [-4.2, AXIS.paifangZ - 9], [-4.2, AXIS.paifangZ + 9]],
        "close along the terrace's east wall and back along its west": [[tedge, hall.z1 + 3], [tedge, inner.z0 - 3], [-tedge, inner.z0 - 3], [-tedge, hall.z1 + 3]],
        "over the Wuliang hall's platform and down its back steps into the court": [[0, hall.z1 + 3], [0, AXIS.hallZ], [0, hall.z0 + 0.5], [0, hall.z0 - 5]],
        "round the Wuliang hall's platform on the terrace's side": [[hall.x1 + 1.2, hall.z1 + 1.2], [hall.x1 + 1.2, 62.8], [hall.x1 + 3.5, 62.8], [hall.x1 + 3.5, hall.z1 + 1.2]],
      };
    },
  },
};
