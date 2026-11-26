// The seven Buddhas of the great hall as the page loads them (issue #701, the second version: docs/t05/FIGURES-IN-HALL.md): which file is which figure, the
// numbers its paint was judged with, and when they are wanted. Pure data, read by the page and by the unit tests alike; nothing here touches three.js,
// so a page whose doors are shut (HALL_DOORS in ../hall.js) never costs more than this table, and in fact does not even import it (../site.js).
//
// Each file is the figure's baked mesh (`tools/t05-pack-figures.mjs`: positions, normals and uvs quantised, meshopt-compressed, the normal maps UASTC KTX2
// at 1024 px) beside the figure's anchors (./anchors/<id>.json) and the two masks its paint reads (./masks/<id>-front.webp, <id>-hair.webp). `sha256` is the
// file's, the same as its row in docs/t05/asset-register.csv; tests/unit/t05-figures.test.mjs holds the two together.

/** How near the eye must come to the hall's door, in metres, before the figures are asked for. */
export const NEAR = 60;
/** The plinth each figure stands on in the hall (the statue session's stage had it: the figure brings its own lotus). */
export const PLINTH = Object.freeze({ h: 0.4, w: 5.39, d: 4.12 });
/** Where the hall's door is, in the hall's frame: the front column line's middle (the altar's front lies 14.5 m behind it). */
export const DOOR = Object.freeze({ x: 0, z: 0 });
/** The figure's frame stands this far toward the visitor of the altar's middle (the stage's pivot: the altar's own middle, 0.3 m forward). */
export const PIVOT_DZ = 0.3;

/**
 * East to west as the visitor sees them from the door. `stageH` is the whole height (plinth included) the figure was painted at on the stage, which is the
 * frame its anchors are written in; the page scales that frame to the game's own height for the figure (`FIGURES[].h` in ../altar.js) as a whole. `inner` and
 * `lotus` are the two per-figure gains the stage's spec carried for the end figures, where the hall's light is weaker.
 * @type {readonly { id: string, file: string, sha256: string, stageH: number, inner?: number[], lotus?: number, halo?: number }[]}
 */
export const FIGURE_FILES = Object.freeze([
  { id: "kasyapa", file: "kasyapa.glb", sha256: "03a2cb334a9dd03c54b1026e62726840e1ae2197b4cd5a3175232fb9b47b2102", stageH: 8.6, inner: [0.97, 1, 1.03], lotus: 1.25, halo: 1.5 },
  { id: "krakucchanda", file: "krakucchanda.glb", sha256: "c92c4da2f644fbbcb6d4a24893cbdd248564a6972e7b9feb496d52eb8cc3334e", stageH: 8.75 },
  { id: "sikhin", file: "sikhin.glb", sha256: "8112799fb9c79c3fb636250c494f884f878fb6c27b93ea2f6c105bb6139b91d7", stageH: 8.9 },
  { id: "vipasyin", file: "vipasyin.glb", sha256: "1421c0abc563ea3782a83e433687f60f419e39870f19f32003c0904784bcd97f", stageH: 9.0 },
  { id: "visvabhu", file: "visvabhu.glb", sha256: "011abb1a09e6d264d7ca73f6880be8f0c6e297f357cf6afddadc1a7f06aebc7d", stageH: 8.9 },
  { id: "kanakamuni", file: "kanakamuni.glb", sha256: "d05629685149e510a33295e62129e8f25769eb850f5698faccf5253592252997", stageH: 8.75 },
  { id: "sakyamuni", file: "sakyamuni.glb", sha256: "589ac283bde1b1e2f77edd3fbf957c6e0974bd448b26f33f976cd1f4be50ddd4", stageH: 8.6, inner: [0.96, 1, 1.05], lotus: 1.25, halo: 1.5 },
].map((f) => Object.freeze(f)));

/** The order they are fetched in: the middle one first, then outward (east before west). */
export const LOAD_ORDER = Object.freeze(["vipasyin", "sikhin", "visvabhu", "krakucchanda", "kanakamuni", "kasyapa", "sakyamuni"]);
/** Paint's reflection of the hall, as the pictures were judged (`paint: { envIntensity: 0.6 }`). */
export const ENV_INTENSITY = 0.6;
/** The boat-shaped halo's colour, the stage's (the painted halo, ../altar.js keeps the shape). */
export const HALO_COLOR = 0x6c5641;
