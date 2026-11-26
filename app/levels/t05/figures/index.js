// What the page asks of the seven figures (./load.js) while a visit is in the hall's court. Called from ../site.js only when the hall's doors are open (HALL_DOORS in
// ../hall.js: the workbench's `?hall=open`); with them shut the page does not import this folder's heavy part at all, nothing is fetched, and nothing is drawn.
/** @param {Parameters<typeof import("./load.js").createFigures>[0]} ctx what site.js has to hand: the level group, the altar figures parts, the materials, the mesh options */
export async function startFigures(ctx) {
  const { createFigures } = await import("./load.js");
  return createFigures(ctx);
}
