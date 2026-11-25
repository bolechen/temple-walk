// What the debug panel's 「物件」 group can drag in T05 (#684, src/objects-debug.js; docs/LEVEL-PLAYBOOK.md, 附录丁): the houses outside the
// walls (./surround.js, `house()`) and the seven figures on the great hall's altar (./altar.js, `buildFigure()`). Read only in a page that has the
// panel open (the dev server, a pull request's preview, the canary with ?debug=1), where site.js has put each as a part of its own and set
// `window.__t05Objects`; a page without those hooks gets no kinds. The snippets are written as the plan writes its data: a house as
// planSurround's `{ x, z, w, d, alongX, eave, ridge, roof, tone, wall }`, a figure as altar.js's FIGURES entry `{ x, h, yaw }` (the turn in
// radians there, `(-7 * Math.PI) / 180`, in degrees on the panel).
import { TILE_TONES, WALL_TONES } from "./surround.js";

const DEG = Math.PI / 180;
const names = (list) => list.map((t, value) => ({ value, label: t.name }));

export const HOUSE_SCHEMA = Object.freeze([
  { key: "x", label: "x (m)", type: "number", min: -400, max: 400, step: 0.01, default: 0 },
  { key: "z", label: "z (m)", type: "number", min: -100, max: 400, step: 0.01, default: 0 },
  { key: "w", label: "宽 w (m，沿 x)", type: "number", min: 3, max: 20, step: 0.01, default: 7 },
  { key: "d", label: "深 d (m，沿 z)", type: "number", min: 3, max: 20, step: 0.01, default: 6 },
  { key: "alongX", label: "ridge 沿 x", type: "bool", default: true },
  { key: "eave", label: "檐高 (m)", type: "number", min: 2.4, max: 3.6, step: 0.01, default: 3 },
  { key: "ridge", label: "ridge 高 (m)", type: "number", min: 3.8, max: 6.5, step: 0.01, default: 5 },
  { key: "roof", label: "屋顶", type: "choice", options: ["gable", "hip", "shed"], default: "gable" },
  { key: "tone", label: "tile tone", type: "choice", options: names(TILE_TONES), default: 1 },
  { key: "wall", label: "wall tone", type: "choice", options: names(WALL_TONES), default: 0 },
]);

export const FIGURE_SCHEMA = Object.freeze([
  { key: "x", label: "x (m)", type: "number", min: -19, max: 19, step: 0.01, default: 0 },
  { key: "h", label: "通高 (m，自坛面)", type: "number", min: 6, max: 11, step: 0.01, default: 8.6 },
  { key: "yaw", label: "转向 (°)", type: "number", min: -20, max: 20, step: 0.5, default: 0,
    fmt: (/** @type {number} */ v) => `(${v} * Math.PI) / 180`, parse: (/** @type {number} */ r) => +((r * 180) / Math.PI).toFixed(6) },   // (altar.js writes the seventh's turn so)
]);

/** The shadow map is drawn once for each mood (shadowMap.autoUpdate is off), so a thing that moved has to ask for the mood again to cast its shadow where it now stands. */
const refresh = (W) => { const y = W.__yard(); W.__mood(y.season, y.time); };

/** @param {{ W: any }} o */
export function OBJECT_KINDS({ W }) {
  const hook = W.__t05Objects;
  if (!hook) return [];
  const kinds = [];
  if (hook.houses) {
    const of = (id) => hook.houses.list.find((e) => e.id === id).h;
    kinds.push({
      kind: "house", label: "墙外的屋", schema: HOUSE_SCHEMA,
      items: () => hook.houses.list.map((e) => ({ id: e.id, label: `${e.id} · ${e.h.cast ? "近" : "远"} · ${e.h.x}, ${e.h.z}` })),
      read: (id) => { const { x, z, w, d, alongX, eave, ridge, roof, tone, wall } = of(id); return { x, z, w, d, alongX, eave, ridge, roof, tone, wall }; },
      rebuild: (id, p) => { hook.houses.rebuild(id, p); if (of(id).cast) refresh(W); },
      near: (x, z) => hook.houses.list.reduce((a, b) => (Math.hypot(b.h.x - x, b.h.z - z) < Math.hypot(a.h.x - x, a.h.z - z) ? b : a)).id,
    });
  }
  if (hook.figures) {
    const of = (id) => hook.figures.list.find((e) => e.id === id).f;
    kinds.push({
      kind: "figure", label: "殿内造像", schema: FIGURE_SCHEMA,
      items: () => hook.figures.list.map((e) => ({ id: e.id, label: e.id })),
      read: (id) => { const f = of(id); return { x: f.x, h: f.h, yaw: +((f.yaw || 0) / DEG).toFixed(1) }; },
      rebuild: (id, p) => { hook.figures.rebuild(id, { x: p.x, h: p.h, yaw: p.yaw * DEG }); refresh(W); },
      near: (x) => hook.figures.list.reduce((a, b) => (Math.abs(b.f.x - x) < Math.abs(a.f.x - x) ? b : a)).id,
    });
  }
  return kinds;
}
