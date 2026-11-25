// A temple's own page in the walk (T05 first: app/levels/t05/page.js): watching for the looks that put the observation's
// stroke on it, the copy of the stele by E, and showing the page afterwards. game.js owns when an observance may begin and
// hands this what it needs; what his hands do is rites.js's (src/writing.js), the shot the eye goes to is the place's own
// (`site.places[id].shot`, src/director.js), and the page is kept under yunjing.levels.v1 (src/levelsave.js). The
// prologue's book, keys and seals are never read or written here.
import { readLevelPage, markLevelPage } from "./levelsave.js";
import { levelSay } from "./levelsay.js";

/**
 * How far up the view looks, in radians, worked out from where two far points straight ahead along its heading land on the
 * picture (the page is handed `screenOf`, not the camera): one level with `at`, one 0.5 rad above it. With the picture's
 * middle c and k its focal length in pixels, the first lands at c + k·tanθ and the second at c - k·tan(0.5 - θ).
 * @param {(x: number, y: number, z: number) => { y: number, h: number }} screenOf @param {{ x: number, y: number, z: number }} at @param {number} yaw
 */
export function viewPitch(screenOf, at, yaw) {
  const far = 300, dx = Math.sin(yaw), dz = -Math.cos(yaw), q = Math.tan(0.5);
  const lo = screenOf(at.x + dx * far, at.y, at.z + dz * far), hi = screenOf(at.x + dx * far, at.y + far * q, at.z + dz * far);
  const c = lo.h / 2, a = lo.y - c, b = c - hi.y;   // a = k tanθ, b = k tan(0.5 - θ)
  if (!Number.isFinite(a) || !Number.isFinite(b) || a + b <= 0) return 0;
  // b·T·(1 + qT) = a·(q - T), T = tanθ:  bq·T² + (a + b)·T - aq = 0; the root with T's sign that of a (k > 0).
  const A = b * q, B = a + b, C = -a * q;
  const T = Math.abs(A) < 1e-9 ? -C / B : (-B + Math.sqrt(Math.max(0, B * B - 4 * A * C))) / (2 * A);
  return Math.atan(T);
}

/** Whether he stands where a look counts. */
export const within = (look, x, z) => (look.box ? x > look.box.x0 && x < look.box.x1 && z > look.box.z0 && z < look.box.z1 : Math.hypot(x - look.at[0], z - look.at[1]) < look.r);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * Whether the view looks as a look asks: `yaw` within `off` of its own, raised by at least `pitch`, and where the look names a
 * point to be seen (`see`), that point in the picture, between `band[0]` and `band[1]` of its height down and within its width,
 * unless the view is raised by `raised` or more.
 * `seen(p)` gives where a point falls ({ x, y, w, h, behind }).
 */
export const looking = (look, yaw, pitch, seen = null) => {
  if (!(Math.abs(wrap(yaw - look.yaw)) <= look.off && pitch >= look.pitch)) return false;
  if (!look.see || (look.raised != null && pitch >= look.raised)) return true;   // raised that far, the view is looking up at it wherever it falls (from his own eyes)
  const s = seen?.(look.see); if (!s || s.behind) return false;
  return s.x > 0 && s.x < s.w && s.y >= look.band[0] * s.h && s.y <= look.band[1] * s.h;
};

/**
 * Keeps the time each look has been held, and says when all of them have been: the looks may be met in any order, each held
 * unbroken for its seconds once. @param {any[]} looks
 */
export function createWatch(looks) {
  const held = Object.fromEntries(looks.map((l) => [l.id, 0])), met = new Set();
  return {
    /** One step of `dt` seconds standing at (x, z) with the view at `yaw`, `pitch`. Returns the look just met, if one was. */
    step(dt, x, z, yaw, pitch, seen = null) {
      let now = null;
      for (const l of looks) {
        if (met.has(l.id)) continue;
        if (within(l, x, z) && looking(l, yaw, pitch, seen)) { held[l.id] += dt; if (held[l.id] >= l.hold) { met.add(l.id); now = l; } }
        else held[l.id] = 0;
      }
      return now;
    },
    done: () => looks.every((l) => met.has(l.id)),
    met: () => [...met],
    held: () => ({ ...held }),
    reset() { for (const l of looks) held[l.id] = 0; met.clear(); },
  };
}

/**
 * @param {{ level: any, page: any, places: Record<string, any>, storage: Storage | null, rites: any, y: any, wait: (s: number) => Promise<void>,
 *   say: (text: string, secs?: number) => void, track?: (name: string, data?: any) => void }} o
 */
export function createLevelPage(o) {
  const { level, page: P, places, y } = o, id = level?.id;
  const say = (line) => levelSay(level, line);
  for (const [k, p] of Object.entries(P.places || {})) places[k] ??= { ...p, r: 0 };   // the observation's places: shots to go to, offered nowhere (r 0)
  const watch = createWatch(P.p1.looks);
  const read = () => (o.storage ? readLevelPage(o.storage, id) : {});
  const marks = () => read();
  const lineOf = (lid) => P.stele.lines.find((l) => l.id === lid) || null;
  // What the page shows now: the stroke and its line once made, and the copied line (the stone's words, as cut).
  const view = (m = marks()) => ({ stroke: m.p1 ? 1 : 0, note: m.p1 ? say(P.p1.note) : "", copy: m.stele ? lineOf(m.stele.line)?.text || "" : "", from: m.stele ? say(P.stele.from) : "" });
  // The line to copy: the one the stone was copied for last time comes round to the next, so that a second visit copies another.
  const nextLine = () => { const m = marks(), i = P.stele.lines.findIndex((l) => l.id === m.stele?.line); return P.stele.lines[(i + 1) % P.stele.lines.length]; };
  // Every look taken as met (a page that already has the stroke, or a tool that cannot hold a view for seconds).
  const meetAll = () => { for (const l of P.p1.looks) watch.step(l.hold + 1, ...(l.box ? [(l.box.x0 + l.box.x1) / 2, (l.box.z0 + l.box.z1) / 2] : l.at), l.yaw, Math.max(0, l.pitch), () => ({ x: 1, y: (l.band ? (l.band[0] + l.band[1]) / 2 : 0.5) * 2, w: 2, h: 2, behind: false })); };
  if (marks().p1) meetAll();
  const state = { writing: null, last: null, pitch: 0, eave: /** @type {number | null} */ (null) };

  /** The page's own observance at a place (`copy`), begun as game.js begins one. @returns {Promise<boolean>} whether the page was written */
  async function copy(on) {
    const line = nextLine(), m = marks();
    o.track?.("t05.copy", { phase: "start", line: line.id });
    state.writing = "stele";
    const ok = await o.rites.writing.copyLine(on, { text: line.text, from: say(P.stele.from), keep: { stroke: m.p1 ? 1 : 0, note: m.p1 ? say(P.p1.note) : "" } }, () => {});
    state.writing = null;
    if (!ok || !on()) return false;
    if (o.storage) markLevelPage(o.storage, id, "stele", { at: Date.now(), line: line.id }, true);
    state.last = "stele"; o.track?.("t05.copy", { phase: "end", line: line.id });
    return true;
  }
  /** The observation's stroke, once both looks are met: he steps to the nearer of its places and writes. */
  async function stroke(on, placeId) {
    const m = marks(); if (m.p1) return false;
    state.writing = "p1";
    const ok = await o.rites.writing.strokeLine(on, { note: say(P.p1.note), keep: { copy: m.stele ? lineOf(m.stele.line)?.text || "" : "", from: m.stele ? say(P.stele.from) : "" } }, () => {});
    state.writing = null;
    if (!ok || !on()) return false;
    if (o.storage) markLevelPage(o.storage, id, "p1", { at: Date.now() });
    state.last = "p1"; o.track?.("t05.page", { mark: "p1", place: placeId });
    return true;
  }
  return {
    copy, stroke, view, marks, nextLine,
    /** Whether a place is the page's own observance, offered with E, and what the button says. */
    offers: (pid) => places[pid]?.rite === "copy" || (!!P.places?.[pid] && !read().p1 && watch.done()),
    word: (pid) => (places[pid]?.act ? say(places[pid].act) : P.places?.[pid] ? say(P.p1.act) : null),
    /** Once both looks are met and the stroke not yet made: the observation's place to offer where he stands (within a look's ground), else null. */
    pendingAt(w) { if (read().p1 || !watch.done()) return null; const l = P.p1.looks.find((k) => within(k, w.x, w.z)); return l ? l.place : null; },
    /** Whether a place is the observation's (the stroke is written there, not the copy). */
    isStroke: (pid) => !!P.places?.[pid],
    /** A stroke broken off is not lost: the looks stay met, and it is offered again where they were. */
    /**
     * A step of the walk: counts the looks held, and returns the place to write the stroke at when the second of them is met
     * (the place of the look just met). Nothing is said while a look is held: no hint, no counter (CHECKPOINTS.md §2.2).
     */
    tick(dt, w, yaw) {
      if (read().p1 || watch.done()) return null;
      const foot = y.walker.heightAt(w.x, w.z), pitch = viewPitch(y.screenOf, { x: w.x, y: foot + 1.4, z: w.z }, yaw);
      state.pitch = pitch;
      const c02 = P.p1.looks.find((l) => l.see); if (c02) { const e = y.screenOf(c02.see[0], c02.see[1], c02.see[2]); state.eave = e.behind ? null : +(e.y / e.h).toFixed(3); }   // where the eave falls, down the picture (for the tests)
      const now = watch.step(dt, w.x, w.z, yaw, pitch, (p) => y.screenOf(p[0], p[1], p[2]));
      return now && watch.done() ? now.place : null;
    },
    state: () => ({ ...state, held: watch.held(), met: watch.met(), page: marks() }),
    /** For the tests: the looks taken as met (a tool that cannot hold a view for seconds). */
    meet: () => meetAll(),
  };
}
