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
 * @property {string} [name] the temple's name, in Chinese, as a photograph, a saved file and a share sheet say it (temple.js; translated by the page's tables for the prologue and by the level's own `tr` for any other); the prologue's when left out
 * @property {boolean} [cardLink] false: a photograph's card, a film's mark and the picture handed to the share sheet carry no address or code of the public page (T05: that page has no T05 yet, so a scan would walk the reader into the prologue). Left out, they carry it, as the prologue's always did
 * @property {boolean} [ownVerse] true: a photograph prints only the verse this level itself gives its season and hour (`moodFor`'s `line`), and none where it gives none; left out, the hours' own verse (T05: no bamboo, no summer rain)
 * @property {boolean} [book] the level keeps the book of seals (the small seal at the top left, the way to the next place, the key B): the prologue. Left out, those are hidden (`body.nobook`), not drawn for this level (T05's first release has no seals)
 * @property {string} [seal] the two characters its seal is cut with, as PLACES has them
 * @property {(M: any) => any} build builds the place (buildSite)
 * @property {(site: any) => any} createWalker the walker of the written plan, which the baked floor's walker wraps
 * @property {(x: number, z: number) => number} land the height of the land outside the walls (the plan's terrain)
 * @property {{ site: any, terraces: any[] } | null} backdrop the frame the far hills are laid round, or null for none (#409: T05 stands in a flat town)
 * @property {{ areas: any, keep: any, clearUnder?: (x: number, z: number) => boolean, clearCulm?: (x: number, z: number) => boolean, extraCulms?: number[][] } | null} grove where bamboo grows and where it is kept clear (and, `clearUnder`, where only its undergrowth is), or null for none
 * @property {(x: number, y: number, z: number, r: number) => boolean} [eyeKeepOut] where the eye that follows him may not stand though nothing drawn there stops it (the prologue's bamboo, #515): asked with the eye's sphere's radius
 * @property {boolean} [eyeThickWalls] the following eye is kept from sweeping through a wall thicker than a column when the view swings (eyespace.js `thick`, eye.js `look`; #562). Off for the prologue, whose camera is walked as it was; T05 asks for it
 * @property {number} propsAt where along the axis the mist and props are gathered
 * @property {any} zones the bounds score.js's zoneOf divides the walk by, or null: the prologue's music is not played there
 * @property {(x: number, z: number) => number} groveSound how deep in the bamboo the place is heard, 0 to 1
 * @property {{ x0: number, x1: number, y0: number, y1: number, z0: number, z1: number }} eyeBox what the eye's space gathers
 * @property {number} hallTapZ a tap on the great hall from south of this line is not a walk to its door
 * @property {boolean} [writtenPlan] false: its written plan (site.walk) is not kept up to what is drawn, so `?walker=old` is refused and it is walked on the baked floor (T05; its plan serves only the eye before its hierarchy is built and the sound of his steps)
 * @property {boolean} [keepsPlace] keeps where he was under yunjing.place.v1 (the prologue only, until each level keeps its own; #385)
 * @property {boolean} [opening] plays the opening after 入山 (opening.js, which knows only the prologue's way)
 * @property {boolean} [title] raises the prologue's title at its gate
 * @property {string} [intro] one line, in Chinese, said once in the foot line as the walk begins (a level whose first edition has no seals or book says so; src/levelsay.js)
 * @property {Record<string, Record<string, string>>} [tr] the level's own words in `ja`, `en`, `ko`, each a table from the Chinese line to that language, kept with the level and not in app/locales/ (a build that holds no such level holds none of its words)
 * @property {{ place: string, line: string }} [how] the line at the foot of the title page: "region · road" (a region's name, never a real city's) and one sentence of this temple's own (#445); none, none shown
 * @property {(season: string, time: string, mood: Record<string, any>) => (Record<string, any> | null | undefined)} [moodFor] fields of mood.js's table this level replaces for a season and hour (given the table so far), or nothing: the hours' own numbers stand for a level that gives none (#488)
 * @property {any} [page] its own page (src/levelpage.js; T05: app/levels/t05/page.js): the looks that put the observation's stroke on it, the stele's lines that may be copied, and the places and shots where each is written; kept under yunjing.levels.v1, never in the prologue's book
 * @property {boolean} [keepsOwnPlace] keeps where he was under its own record in yunjing.levels.v1 (src/levelsave.js, S4), never the prologue's yunjing.place.v1, and stands him there on opening; no book, no seal, no title with it
 * @property {(mood: Record<string, any>) => boolean} [mirror] whether the paving's planar mirror is drawn in this mood (asked each frame, after `mirrorAt`'s place test). Left out, as the prologue: drawn wherever the place allows. T05: only when the paving is wet, since on J01's dry stone it shows nothing and costs a millisecond and more (#722)
 * @property {{ season: string, time: string }} [firstMood] the season and hour a page opens in the first time, when the address names none (T05: early winter by day, J01; docs/t05/DECISIONS.md, 2026-11-25). Nothing, and the prologue goes on as it was: the visitor's own season, by day until the book is filled once; a level that keeps no book of its own (`keepsPlace` false) is always on its first look
 * @property {[number, number]} [skyAt] where the sky's dome stands (x, z), so that its far side stays within the eye's 800 m from everywhere walked (#409; the origin by default)
 *
 * What the floor's bake needs beyond what a level builds is in app/levels/<id>/bake.js, which only the Node tools read
 * (tools/walk/scene.mjs; #405), so that the page's bundle does not carry it.
 */

/**
 * Whether this build is one testers see: the dev server, a pull request's preview and the canary (and Node, where the
 * tests run). A level still being made (T05's white box, #409) is listed only there, so that the public page neither
 * offers it nor carries its code: the owner's rule of 2026-11-20 kept it to the workbench, and on 2026-11-21 the owner
 * opened it to the canary too (「t05 改成 canary 可以测」). Written out in full, so that the bundler folds it and
 * leaves the level's chunk out of a production build altogether (tests/unit/level-bench.test.mjs scans each). Which
 * levels these are is BENCH_LEVELS in app/src/bench.js, which the build's configuration also reads; the test holds the
 * entries below to it.
 */
const TESTING = typeof __DEPLOY__ === "undefined" || __DEPLOY__ === "preview" || __DEPLOY__ === "canary";

/**
 * Whether this build is the workbench's alone: the dev server and a pull request's preview (and Node), not the canary. The
 * probe level (docs/t05/LEVEL-SPLIT.md S7) is listed only there, so that no published address, the canary's included, offers
 * it or carries its code. The build says it (vite.config.mjs: a preview, unless VITE_NO_WORKBENCH=1), folded in like TESTING above; WORKBENCH_LEVELS in app/src/bench.js
 * says which levels, and tests/unit/level-bench.test.mjs holds the entries below to it.
 */
const WORKBENCH = typeof __WORKBENCH__ === "undefined" || __WORKBENCH__;

/** @type {Record<string, () => Promise<Level>>} */
export const LEVELS = {
  t00: () => Promise.resolve(t00),
  ...(TESTING ? { t05: () => import("../levels/t05/level.js").then((m) => m.default) } : {}),
  ...(WORKBENCH ? { _probe: () => import("../levels/_probe/level.js").then((m) => m.default) } : {}),
};
export const DEFAULT_LEVEL = "t00";

/**
 * How the map of temples walked (行脚图, #449) names a temple: the region and nothing finer, never a town (the owner's rule
 * of 2026-11-21, as the title's line says where in #445), and the two characters its seal is cut with. Behind the same test
 * of the build as LEVELS, so that the public page neither names nor carries a temple it does not list.
 * @type {Record<string, { region: string, seal: string }>}
 */
export const PLACES = {
  t00: { region: "江南", seal: "云径" },
  ...(TESTING ? { t05: { region: "关外", seal: "奉明" } } : {}),
};

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
