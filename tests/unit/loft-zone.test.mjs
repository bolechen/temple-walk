// Up on the summit pavilion's balcony the music is the summit's (#384): the place he stands on while up there is outdoors
// on the summit's terrace, and the zone keeper takes a new place only after two seconds on the audio clock, which is why
// the `loft` scenario must wait for it rather than read the instant the veil lifts.
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { buildSite, createWalker, SITE, LEVELS, APPROACH, SCREEN } = await import("../../app/src/site.js");
const { zoneOf, zoneBounds, createZoneKeeper } = await import("../../app/src/score.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });
const site = buildSite(M), walker = createWalker(site), L = site.lofts?.lingxiao, B = zoneBounds(SITE, LEVELS, APPROACH, SCREEN);

test("every spot he can stand on up on the pavilion's balcony, and its door, is the summit", () => {
  assert.ok(L, "site.lofts.lingxiao is missing");
  assert.equal(zoneOf(L.door[0], L.door[1], false, B), "summit", "the balcony's door");
  assert.equal(zoneOf(L.at[0], L.at[1], false, B), "summit", "the balcony's middle");
  walker.setLoft("lingxiao"); let n = 0;
  for (let i = -30; i <= 30; i++) for (let j = -30; j <= 30; j++) {
    const x = L.at[0] + i * 0.2, z = L.at[1] + j * 0.2;
    if (walker.blocked(x, z)) continue;
    n++; assert.equal(zoneOf(x, z, false, B), "summit", `the balcony at ${x.toFixed(1)}, ${z.toFixed(1)}`);
  }
  walker.setLoft(null); assert.ok(n > 50, "found no balcony to stand on: " + n);
});
test("inside the pavilion's ground floor the music is the hall's, wherever he stands", () => {
  assert.equal(zoneOf(L.at[0], L.at[1], true, B), "hall");
});
test("the keeper takes the summit only after two seconds, so a read at the instant he arrives still says hall", () => {
  const k = createZoneKeeper(2);
  assert.equal(k.update("hall", 100), "hall");
  assert.equal(k.update("summit", 100.25), "hall"); assert.equal(k.candidate, "summit");
  assert.equal(k.update("summit", 101.9), "hall");
  assert.equal(k.update("summit", 102.3), "summit");
});
