// Which lattice bays are lit from behind, and how brightly (issue #459, ART-REVIEW.md A2).
//
// The prototypes show a dusk where most paper is dark under the slanting sun and only a few rooms hold a lamp, each
// glowing a little differently (docs/ART-SPEC.md: "local lamplight" #C68C49, "warm colour must come from a believable source").
// So the plan says it, building by building and bay by bay, and nothing is drawn from a hash: the same building,
// season and hour give the same windows every time.
//
// Keys are a building's hall id, else its plaque text, with "#<n>" for storey n of a stack (see `put` in site.js).
// Each value is { front: [...], back: [...] } by bay, west to east in the building's own frame, as [dusk, night]:
// a level from 0 (dark paper) to 7 (the brightest lamp). A bay not listed is dark at both hours. A level differs from
// its neighbour's by at least two, so that two lit bays side by side are never read as one panel.
// `moods` (mood.js) picks the column: `winNight` 0 for dawn and dusk, 1 for night; by day nothing glows (lamp 0).

export const LIT = {
  // The great hall: the lamp before the Buddha shows through its three doors, strongest in the middle.
  main: { front: { 2: [3, 5], 3: [7, 7], 4: [0, 5], 1: [0, 3], 5: [4, 3] } },
  // The Guanyin hall on the second terrace is the one prototype 05 shows lit throughout, the paper deep and pale by turns.
  guanyin: { front: { 0: [2, 3], 1: [4, 5], 2: [7, 7], 3: [5, 5], 4: [3, 3] } },
  // The side buildings of the first court stay dark paper at dusk, as prototypes 03 and 04 have them (the Chan hall and
  // the library each keep one dim lamp); a few more are lit at night.
  chan: { front: { 3: [2, 5], 1: [0, 2] } },
  tea: { front: { 1: [0, 4], 3: [0, 6], 2: [0, 2] } },
  library: { front: { 4: [2, 3], 1: [0, 5] } },
  // The halls on the terraces keep their lamps for the night.
  yaoshi: { front: { 1: [0, 5] } },
  dahui: { front: { 1: [0, 4] } },
  // The gate's upper room and the summit pavilion's top storey: a single lamp at night.
  "云径禅寺#1": { front: { 1: [0, 4] } },
  "凌霄阁#2": { front: { 1: [0, 5] } },
};

// How many bays may be lit at each hour (tests/unit/windows.test.mjs holds the data to them, and mood.js's winNight
// to the hours): "a few" at dusk, more at night, never all.
export const BUDGET = { dusk: 10, night: 22 };
