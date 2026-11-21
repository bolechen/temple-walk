// Which temple the page walks (app/src/level.js, #369): the list of levels matches the folders that hold one, an
// address that names none or an unknown one walks the prologue, and the prologue's level says exactly what its plan does.
import "./dom-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { LEVELS as KNOWN, DEFAULT_LEVEL, PLACES, levelOf, loadLevel } from "../../app/src/level.js";
import { SITE, LEVELS, APPROACH, SCREEN, GROVE, terrain, buildSite, createWalker } from "../../app/src/site.js";
import { zoneBounds } from "../../app/src/score.js";

const root = new URL("../../app/levels/", import.meta.url);

test("every level folder with a level.js is in the list, and nothing else is", () => {
  const folders = fs.readdirSync(root).filter((d) => fs.existsSync(new URL(`${d}/level.js`, root))).sort();
  assert.deepEqual(Object.keys(KNOWN).sort(), folders);
  assert.ok(folders.includes(DEFAULT_LEVEL));
});

test("an address names a level, or walks the prologue", () => {
  assert.deepEqual(levelOf(""), { id: "t00", asked: null, known: true });
  assert.deepEqual(levelOf("?level="), { id: "t00", asked: null, known: true });
  assert.deepEqual(levelOf("?level=t00&q=low"), { id: "t00", asked: "t00", known: true });
  assert.deepEqual(levelOf("?level=nope"), { id: "t00", asked: "nope", known: false });
  assert.deepEqual(levelOf("?level=toString"), { id: "t00", asked: "toString", known: false }, "a name the object only inherits is not a level");
});

test("each level loads, and its id is its folder's name", async () => {
  for (const id of Object.keys(KNOWN)) assert.equal((await loadLevel(id)).id, id);
  assert.equal((await loadLevel("nope")).id, DEFAULT_LEVEL);
});

test("the prologue's level says what its plan says", async () => {
  const L = await loadLevel("t00");
  assert.equal(L.build, buildSite);
  assert.equal(L.createWalker, createWalker);
  assert.equal(L.land, terrain);
  assert.equal(L.backdrop.site, SITE);
  assert.deepEqual(L.backdrop.terraces, [LEVELS[0], LEVELS[2]]);
  assert.equal(L.grove.areas, GROVE.areas);
  assert.equal(L.grove.keep, GROVE.keep);
  assert.equal(L.propsAt, (SITE.zN + SITE.zS) / 2);
  assert.deepEqual(L.zones, zoneBounds(SITE, LEVELS, APPROACH, SCREEN));
  assert.deepEqual(L.eyeBox, { x0: -SITE.x - 30, x1: SITE.x + 30, y0: -90, y1: 90, z0: SITE.zN - 30, z1: APPROACH.end + 30 });
  assert.equal(L.hallTapZ, SITE.zS - 4);
  // The bamboo's sound, as yard.js worked it out before (#369): deepest on the way up, a little beyond the tea, faint in the courts.
  const before = (z) => (z > SITE.fore - 6 ? Math.min(1, (z - SITE.fore + 6) / 10) : z < LEVELS[1].zN ? 0.55 : 0.12);
  for (let z = SITE.zN - 10; z <= APPROACH.end + 10; z += 0.5) assert.equal(L.groveSound(0, z), before(z), `z = ${z}`);
});

// 行脚图 (#449): the map names a level by its region only, and cuts its seal with two characters.
test("every level the page lists has a name on the map: a region, never a town, and a seal of two characters", () => {
  assert.deepEqual(Object.keys(PLACES).sort(), Object.keys(KNOWN).sort());
  for (const [id, p] of Object.entries(PLACES)) {
    assert.match(p.region, /^[\u4e00-\u9fff]{2,4}$/, `${id}: a region in a few characters`);
    assert.doesNotMatch(p.region, /杭州|余杭|径山|径山镇|义县|锦州|[市县区镇乡村寺]/, `${id}: a region, not a town or a temple: ${p.region}`);
    assert.match(p.seal, /^[\u4e00-\u9fff]{2}$/, `${id}: a seal of two characters`);
  }
});
