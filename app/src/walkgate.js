// Whether the walk is the visitor's yet (#462). Under the title, the opening, the one line a change of language puts up while the
// page opens again, and the ink a crossing from another temple is made behind (#449), the keys, the arrows and the stick do
// nothing: the page is drawn under the layer, and a key held there once walked him out of a hall. A page that skips the title
// (`?enter`, `?shot`, `?cam`…) has the `entered` mark from the start, so it is not held.
/**
 * @param {{ body: { contains(c: string): boolean }, html: { contains(c: string): boolean }, openingActive: boolean }} s
 * the classes of <body> and <html>, and whether the opening after 入山 is playing
 */
export function walkIsHis({ body, html, openingActive }) {
  return body.contains("entered") && !openingActive && !html.contains("relang") && !html.contains("crossing");
}

/**
 * What the keys and the stick hand the walk while a layer may cover the picture: nothing, not even a turn (A and D turn him and the
 * view, keyturn.js), so he neither walks nor turns under it.
 * @template {{ f: number, s: number, turn: number }} A @param {boolean} open @param {A} axes @returns {A | { f: 0, s: 0, turn: 0 }}
 */
export const heldUnder = (open, axes) => (open ? axes : { f: 0, s: 0, turn: 0 });

/** The keys that change the view (R turns it back behind him, V changes it) are not heard under a layer either. @param {boolean} open @param {string} key */
export const viewKeyHeard = (open, key) => open || (key !== "r" && key !== "v");
