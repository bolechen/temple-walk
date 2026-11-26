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
/**
 * How far toward the visitor of the altar's middle the figure's frame stands. The stage had it 0.3 m forward, which kept the rim of every lotus clear of
 * the halo board behind; but a lotus is 4.4 to 5.0 m through at its foot on an altar 4.8 m deep (5.1 with its cap), and 0.3 m forward the seven hung 0.1
 * to 0.4 m out over the altar's front, a shadow under each (the art director on #763, 2026-11-26: the seats read as hanging). On the altar's middle every
 * foot stands on the altar; the back of each lotus's rim then goes 0.1 to 0.35 m into the foot of its halo board, behind the figure.
 */
export const PIVOT_DZ = 0;

/**
 * East to west as the visitor sees them from the door. `stageH` is the whole height (plinth included) the figure was painted at on the stage, which is the
 * frame its anchors are written in; the page scales that frame to the game's own height for the figure (`FIGURES[].h` in ../altar.js) as a whole. `inner` and
 * `lotus` are the two per-figure gains the stage's spec carried for the end figures, where the hall's light is weaker; the middle figure's `lotus` is the hall's own
 * (2026-11-26): its seat stands in a beam's shadow under the brightest face of the seven, and without it reads under half as light as that face. A `lotus` of
 * three numbers is red, green and blue: under that beam the middle seat also read grey beside its neighbours' (C* 3.0 to 3.4 from the nave on the T4 of
 * 2026-11-26, theirs 5.2 to 5.5, the art director's line 4, his aim 5 to 7 at a hue of 54°), which a gain of one number cannot mend, so its 1.6 is tinted,
 * the red up a sixth and the blue down an eighth. `lotusGain` hands any of them on as three. `twoSided` draws a figure's triangles from both sides: Sakyamuni's
 * knee has no underside beside his right palm, and through that slot the page drew the dark hall behind him (a black scrap at the wrist from the nave, the
 * final review of 18b2024); drawn from both sides, the slot shows the inside of his own knee in its own paint (tests/unit/t05-figure-mend.test.mjs).
 * @type {readonly { id: string, file: string, sha256: string, stageH: number, inner?: number[], lotus?: number | number[], halo?: number, twoSided?: boolean }[]}
 */
export const FIGURE_FILES = Object.freeze([
  { id: "kasyapa", file: "kasyapa.glb", sha256: "03a2cb334a9dd03c54b1026e62726840e1ae2197b4cd5a3175232fb9b47b2102", stageH: 8.6, inner: [0.97, 1, 1.03], lotus: 1.25 },
  { id: "krakucchanda", file: "krakucchanda.glb", sha256: "c92c4da2f644fbbcb6d4a24893cbdd248564a6972e7b9feb496d52eb8cc3334e", stageH: 8.75 },
  { id: "sikhin", file: "sikhin.glb", sha256: "8112799fb9c79c3fb636250c494f884f878fb6c27b93ea2f6c105bb6139b91d7", stageH: 8.9 },
  { id: "vipasyin", file: "vipasyin.glb", sha256: "1421c0abc563ea3782a83e433687f60f419e39870f19f32003c0904784bcd97f", stageH: 9.0, lotus: [1.86, 1.6, 1.41] },
  { id: "visvabhu", file: "visvabhu.glb", sha256: "011abb1a09e6d264d7ca73f6880be8f0c6e297f357cf6afddadc1a7f06aebc7d", stageH: 8.9 },
  { id: "kanakamuni", file: "kanakamuni.glb", sha256: "d05629685149e510a33295e62129e8f25769eb850f5698faccf5253592252997", stageH: 8.75 },
  { id: "sakyamuni", file: "sakyamuni.glb", sha256: "c7b394601979c1dbcfcf1e81dc4186d9a98ab9a931b2d4793865e85844dac859", stageH: 8.6, inner: [0.96, 1, 1.05], lotus: 1.25, twoSided: true },
].map((f) => Object.freeze(f)));

/** The order they are fetched in: the middle one first, then outward (east before west). */
/** A figure's lotus gain as red, green and blue. @param {{ lotus?: number | number[] }} d @returns {number[]} */
export const lotusGain = (d) => (Array.isArray(d.lotus) ? [...d.lotus] : [d.lotus ?? 1, d.lotus ?? 1, d.lotus ?? 1]);

export const LOAD_ORDER = Object.freeze(["vipasyin", "sikhin", "visvabhu", "krakucchanda", "kanakamuni", "kasyapa", "sakyamuni"]);
/** Paint's reflection of the hall, as the pictures were judged (`paint: { envIntensity: 0.6 }`). */
export const ENV_INTENSITY = 0.6;
/** The boat-shaped halo board's colour: darker and greyer than the stage's 0x6c5641 so that in the hall it reads at least 15 L* under the face and with about half its chroma (the art director, 2026-11-26; ../altar.js keeps the shape). */
export const HALO_COLOR = 0x42392d;

/**
 * The masks the paint reads (`masks/<name>` beside the files in app/shared/models/t05/), with their SHA-256. The files are not in git: tools/setup.mjs fetches
 * them with the seven GLBs from the dataset named in `SOURCE` and checks each against these hashes.
 * @type {Readonly<Record<string, string>>}
 */
export const MASK_FILES = Object.freeze({
  "kasyapa-front.webp": "fcaf6f26df76988cb054f40d977871b45594b8fbdcfa5cca09bb12ea693eca63",
  "kasyapa-hair.webp": "e4d1c2c5875da8aad9068ee04416cd9be382aab4255a40c082793e18840be959",
  "krakucchanda-front.webp": "133417ad066017aa563f6d5f85d0d9a96f41fc7de1b228e4189cda8f4c9befa6",
  "krakucchanda-hair.webp": "be39d41e5d711f0d7f430fb6e5c8ae4177a3205f054f0a7aafe2c80edce9b4e4",
  "sikhin-front.webp": "98c5b71335005d57c261e2e6805eeb208adaac8cc90f441bf987bbd8d382f0f7",
  "sikhin-hair.webp": "3284f75c7eee4cfdfd63552e495f16d2b36ea45bb0f9115b98536652ca85e875",
  "vipasyin-front.webp": "b2a005b6ab14a6a2b4dc557ef3f5b08771154313f5af8dcc5e11ee8d025de529",
  "vipasyin-hair.webp": "34fe44fa4859a1fa76e63f674a7aae5c03cc8bae29595a45d48e36ed1791df37",
  "visvabhu-front.webp": "83e620a8599b5225cf15078b299f226c214734e252721230a00b19f08a077928",
  "visvabhu-hair.webp": "9ea3e885624e88e737e84eec9f4b8756cad6b4ac972e888ec8d41d24db401536",
  "kanakamuni-front.webp": "7ea80a71dffbc60880c5ef356ce143076b2159f42b58d3c2008f0588c476d479",
  "kanakamuni-hair.webp": "863bba6bbe21727e76d7c8acc0db235f1a808acaeebaa6c98ade58c0026aec9d",
  "sakyamuni-front.webp": "06dda194df4cc671073f5f911de05069e1f558e29d92e1ab1d61dc9165373d06",
  "sakyamuni-hair.webp": "276a82d317f82a16c5a32715c2def34141b1b26b16019f4741a33e33eef13eb3",
});
/**

 * Where tools/setup.mjs fetches the files from (`<base><path>`): the public dataset the owner published on 2026-11-26 (bolechen/temple-walk-t05-figures, the commit pinned, files never overwritten:
 * a figure mended later goes into a new folder with the rest beside it, as ship-763/ holds Sakyamuni with his right wrist mended and the other six and the masks as ship-701/ had them),
 * or null where there is none (a clone then draws the hall's doors shut, as production does, and the figures tests that need the files are skipped). Pinned by commit, never overwritten. `private`: the dataset is private, and setup sends
 * the HF_TOKEN of the machine as a bearer token (a machine without one cannot fetch, and says so). Whether the files may be published at all is the owner's call (docs/t05/asset-register.csv).
 */
export const SOURCE = Object.freeze({ base: /** @type {string | null} */ ("https://huggingface.co/datasets/bolechen/temple-walk-t05-figures/resolve/5bdba2c44d95a6eb29630e027f0801e4c973fd50/ship-763/"), private: false });
