// Which temple the page walks. Each level lives in app/levels/<id>/ and hands the engine one object, its level.js
// (#138, #369; docs/t05/LEVEL-SPLIT.md, S2): how its place is built and walked, and the few facts about it that the
// engine's parts need (where the far hills stand, where bamboo grows, where the music changes). The engine asks this
// file for that object and never for a temple by name.
//
// The list below is written out rather than gathered with Vite's import.meta.glob, because the unit tests and the Node
// tools import this file directly and Node has no import.meta.glob; tests/unit/level.test.mjs holds the list to the
// folders under app/levels/ that have a level.js. The prologue is imported at once, so the first visitor's page asks for
// nothing more; any other level is a dynamic import, which Vite builds as a chunk of its own that a visitor to the
// prologue never downloads.
import t00 from "../levels/t00/level.js";

/**
 * What a level hands the engine.
 * @typedef {object} Level
 * @property {string} id the folder's name under app/levels/, and the name of its baked floor (shared/walk/<id>.bin)
 * @property {(M: any) => any} build builds the place (buildSite)
 * @property {(site: any) => any} createWalker the walker of the written plan, which the baked floor's walker wraps
 * @property {(x: number, z: number) => number} land the height of the land outside the walls (the plan's terrain)
 * @property {{ site: any, terraces: any[] } | null} backdrop the frame the far hills are laid round, or null for none (#409: T05 stands in a flat town)
 * @property {{ areas: any, keep: any } | null} grove where bamboo grows and where it is kept clear, or null for none
 * @property {number} propsAt where along the axis the mist and props are gathered
 * @property {any} zones the bounds score.js's zoneOf divides the walk by, or null: the prologue's music is not played there
 * @property {(x: number, z: number) => number} groveSound how deep in the bamboo the place is heard, 0 to 1
 * @property {{ x0: number, x1: number, y0: number, y1: number, z0: number, z1: number }} eyeBox what the eye's space gathers
 * @property {number} hallTapZ a tap on the great hall from south of this line is not a walk to its door
 * @property {boolean} [keepsPlace] keeps where he was under yunjing.place.v1 (the prologue only, until each level keeps its own; #385)
 * @property {boolean} [opening] plays the opening after 入山 (opening.js, which knows only the prologue's way)
 * @property {boolean} [title] raises the prologue's title at its gate
 * @property {[number, number]} [skyAt] where the sky's dome stands (x, z), so that its far side stays within the eye's 800 m from everywhere walked (#409; the origin by default)
 *
 * What the floor's bake needs beyond what a level builds is in app/levels/<id>/bake.js, which only the Node tools read
 * (tools/walk/scene.mjs; #405), so that the page's bundle does not carry it.
 */

/**
 * Whether this build is the workbench's: the dev server and a pull request's preview (and Node, where the tests run). A
 * level still being made (T05's white box, #409) is listed only there: the owner's rule of 2026-11-20, so that the canary
 * and the public page neither offer it nor carry its code. Written out in full, so that the bundler folds it and leaves
 * the level's chunk out of a canary or production build altogether (tests/unit/level-bench.test.mjs scans each). Which
 * levels these are is BENCH_LEVELS in app/src/bench.js, which the build's configuration also reads; the test holds the
 * entries below to it.
 */
const WORKBENCH = typeof __DEPLOY__ === "undefined" || __DEPLOY__ === "preview";

/** @type {Record<string, () => Promise<Level>>} */
export const LEVELS = {
  t00: () => Promise.resolve(t00),
  ...(WORKBENCH ? { t05: () => import("../levels/t05/level.js").then((m) => m.default) } : {}),
};
export const DEFAULT_LEVEL = "t00";

/**
 * The level an address asks for. A name not in the list falls back to the prologue, saying what was asked.
 * @param {string} [search] @returns {{ id: string, asked: string | null, known: boolean }}
 */
export function levelOf(search = globalThis.location?.search || "") {
  const asked = new URLSearchParams(search).get("level");
  if (asked === null || asked === "") return { id: DEFAULT_LEVEL, asked: null, known: true };
  return Object.hasOwn(LEVELS, asked) ? { id: asked, asked, known: true } : { id: DEFAULT_LEVEL, asked, known: false };
}

/** @param {string} id @returns {Promise<Level>} */
export function loadLevel(id) {
  return (LEVELS[id] || LEVELS[DEFAULT_LEVEL])();
}
