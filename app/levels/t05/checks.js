// What the checks that walk T05 need beyond its plan (docs/t05/LEVEL-SPLIT.md S6; read only in Node, by tests/unit/level-plan.mjs
// and the tools, never by the page, as bake.js is). So far: the routes the near plane is walked along (tests/slow/nearplane.test.mjs).
// Each route is a run of [x, z] points, walked at his pace with the following eye behind him and from his own eyes.
import { AXIS, FOOT, LANE, SECOND } from "./axis.js";

/** @type {Record<string, any>} */
export default {
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
