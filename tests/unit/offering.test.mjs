// The 功德箱 (issue #202): a chest in the great hall that takes a free coin in every build; the address of the sponsor page
// is written once, in the web build's own file, in the shape the owner settled (standard UTM tags, the language as content).
import test from "node:test"; import assert from "node:assert/strict";
import "./dom-stub.mjs";
import * as THREE from "three";
const { donateURL, DONATE_ORIGIN } = await import("../../app/src/donate.js");
const { channelOf, CHANNELS, CHANNEL, WEB } = await import("../../app/src/channel.js");
const { buildSite, createWalker } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { BODY } = await import("../../app/src/geo.js");
const M = new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= new THREE.MeshBasicMaterial()) : (t[k] ||= new THREE.MeshBasicMaterial())) });

test("the sponsor page's address, per language, carries the standard campaign tags and the language as content", () => {
  const want = { zh: "/donate", en: "/en/donate", ja: "/ja/donate", ko: "/en/donate" };   // the sponsor page has no Korean page; the English one stands in
  for (const [lang, path] of Object.entries(want)) {
    const u = new URL(donateURL(lang));
    assert.equal(u.origin, DONATE_ORIGIN); assert.equal(u.protocol, "https:"); assert.equal(u.pathname, path, lang);
    assert.deepEqual(Object.fromEntries(u.searchParams), { utm_source: "temple-walk", utm_medium: "game", utm_campaign: "offering-box", utm_content: lang }, lang);
  }
  assert.equal(new URL(donateURL("fr")).pathname, "/en/donate", "an unknown language gets the English page");
});

test("the channel is one of three, the public page by default, and a wrong name fails the build", () => {
  assert.deepEqual([...CHANNELS], ["web", "steam", "platform"]);
  for (const c of CHANNELS) assert.equal(channelOf(c), c);
  assert.equal(channelOf(undefined), "web"); assert.equal(channelOf(""), "web");
  assert.throws(() => channelOf("itch"), /VITE_CHANNEL/);
  assert.equal(CHANNEL, "web", "sources run in Node are the public page"); assert.equal(WEB, true);
});

test("the great hall has a 功德箱 beside the offering table, standable before, with a slot above the floor, and it blocks nothing it should not", () => {
  const site = buildSite(M), built = buildInteriors(M, site.halls), main = built.rooms.main, box = built.spots["main-box"];
  assert.ok(box && box.item.offering, "no offering box in the great hall");
  for (const id of Object.keys(built.rooms)) if (id !== "main") assert.ok(!built.spots[`${id}-box`], `${id} has a box`);
  const w = createWalker(site); w.setRoom(main.room);
  assert.ok(box.slot[1] > main.room.y + 0.7 && box.slot[1] < main.room.y + 1.1, "the slot is not about waist high");
  assert.ok(!w.blocked(box.at[0], box.at[1]), "he cannot stand where it is offered");
  assert.ok(w.blocked(box.slot[0], box.slot[2]), "the box itself is open floor");
  const dx = box.slot[0] - box.at[0], dz = box.slot[2] - box.at[1];
  assert.ok(Math.hypot(dx, dz) < 1.0 + BODY, `the slot is ${Math.hypot(dx, dz).toFixed(2)} m from where he stands`);
  assert.ok(Math.abs(box.at[0] - main.room.cx) < 6, "it stands within the dais's width");
});
