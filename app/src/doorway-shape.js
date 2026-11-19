// What the baked doorway pictures are (#218), shared by the page that shows them (doorway.js) and the drawing that
// makes them (doorway-capture.js, tools/bake-doorways.mjs, whose fingerprint reads this file): a change here redraws them.
export const EYE = 1.6, INSET = 0.25;   // where the cube is taken: a grown eye's height, a little inside the door
export const DIST = 64;                  // distances are kept as a fraction of this many metres
export const GAIN = [0.18, 0.8];         // how bright the room is drawn in the doorway, by day and with every lamp lit
export const ATLAS = [3, 2];             // the six faces of a cube in one picture, three across and two down
