// DRAFT (#684, second half; not wired, not for merge as it is): what the debug panel's 「物件」 group would register for the
// great hall's seven figures. It reads only what `W.__t05Objects` offers, which site.js does not yet set (see the message
// that came with this draft: altar.js needs a `buildFigure`, site.js a hook, and the figures' meshes must survive mergeStatic
// on a workbench page). Without the hook this returns nothing, so the panel says 「本关还没有登记」 and nothing breaks.
//
// Kind "figure": one of the seven Buddhas with his base, halo and two attendants, `{ id, x, h, yaw }` as altar.js's FIGURES
// writes it (yaw in radians there; the panel works in degrees and the snippet is written in degrees too, `fmt` turns it back).
const DEG = Math.PI / 180;

export const FIGURE_SCHEMA = [
  { key: "x", label: "位置 x (m)", type: "number", min: -19, max: 19, step: 0.01, default: 0 },
  { key: "h", label: "通高 (m，自坛面)", type: "number", min: 6, max: 11, step: 0.01, default: 8.6 },
  { key: "yaw", label: "转向 (°，+ 朝西)", type: "number", min: -20, max: 20, step: 0.5, default: 0,
    fmt: (v) => `(${v} * Math.PI) / 180` },   // altar.js writes the seventh's turn as `(-7 * Math.PI) / 180`
];
// (The snippet then reads `{ x: -16.45, h: 8.6, yaw: (-7 * Math.PI) / 180 }`; parseSnippet does not run it, so the panel's own
// copy-and-paste keeps yaw in degrees as a plain number and `fmt` is only for the line pasted into altar.js; to be settled with the first half's `parseSnippet`, which today reads a literal.)

/** @param {{ W: any }} o */
export function OBJECT_KINDS({ W }) {
  const hook = W.__t05Objects;   // { figures: Map id → { f, mesh }, rebuildFigure(id, { x, h, yaw }) }, set by site.js on a workbench page
  if (!hook) return [];
  return [{
    kind: "figure", label: "殿内造像",
    schema: FIGURE_SCHEMA,
    items: () => [...hook.figures.keys()].map((id) => ({ id, label: id })),
    read: (id) => { const f = hook.figures.get(id).f; return { x: f.x, h: f.h, yaw: +((f.yaw || 0) / DEG).toFixed(1) }; },
    rebuild: (id, p) => hook.rebuildFigure(id, { x: p.x, h: p.h, yaw: p.yaw * DEG }),
    near: (x) => [...hook.figures.values()].reduce((a, b) => (Math.abs(b.f.x - x) < Math.abs(a.f.x - x) ? b : a)).f.id,   // (the hall's own frame: x across)
  }];
}
