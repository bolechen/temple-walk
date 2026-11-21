// A lamp lit for someone (#343): the link holds a number and a moment, nothing else, and only a line from the list can ever be shown.
import test from "node:test"; import assert from "node:assert/strict";
import { WISHES, KIND, encodeLamp, decodeLamp, lampLink } from "../../app/src/wishes.js";
import { SEASONS, TIMES } from "../../app/src/mood.js";
import { pack, b64u } from "../../app/src/fragment.js";
import { has, LANGS } from "../../app/src/i18n.js";

test("every wish, season and hour round-trips", () => {
  for (let w = 0; w < WISHES.length; w++) for (const season of SEASONS) for (const time of TIMES) assert.deepEqual(decodeLamp("#" + encodeLamp({ wish: w, season, time })), { wish: w, season, time });
});
test("6 to 10 wishes, none empty, none alike, each short enough for a lamp's tag", () => {
  assert.ok(WISHES.length >= 6 && WISHES.length <= 10); assert.equal(new Set(WISHES).size, WISHES.length);
  for (const w of WISHES) assert.ok(w.length >= 4 && w.length <= 16, w);
});
test("the owner's eight lines, in the owner's order (the link means the order, so a change here is a change of what old links say)", () => {
  assert.deepEqual(WISHES, ["一灯为你，愿你平安。", "愿你病苦渐轻，身心安稳。", "愿你今夜好眠。", "愿你前路有光，不必着急。", "愿你放下，也被放过。", "山中一灯，替你照着。", "愿所念之人，皆得安住。", "灯不大，够照见你脚下的路。"]);
});
test("every wish has a Japanese, English and Korean line (the Chinese is the key)", () => { for (const l of LANGS.filter((x) => x !== "zh")) for (const w of WISHES) assert.ok(has(w, l), `${l}: ${w}`); });
test("what cannot be a lamp is not one: a number off the list, a season or hour off theirs, bad bytes, another kind, damage", () => {
  assert.equal(encodeLamp({ wish: WISHES.length, season: "summer", time: "day" }), null); assert.equal(encodeLamp({ wish: -1, season: "summer", time: "day" }), null);
  assert.equal(encodeLamp({ wish: 1.5, season: "summer", time: "day" }), null); assert.equal(encodeLamp({ wish: 0, season: "monsoon", time: "day" }), null); assert.equal(encodeLamp({ wish: 0, season: "summer", time: "noon" }), null);
  assert.equal(decodeLamp("#" + pack(KIND, [WISHES.length, 0])), null); assert.equal(decodeLamp("#" + pack(KIND, [0, 16])), null); assert.equal(decodeLamp("#" + pack(KIND, [0])), null); assert.equal(decodeLamp("#" + pack(KIND, [0, 0, 0])), null);
  assert.equal(decodeLamp("#" + pack("save", [0, 0])), null);
  for (const bad of ["", "#", "#lamp=", "#lamp=AAAA", "#lamp=<img src=x onerror=alert(1)>", "#lamp=%3Cb%3E", "#" + "lamp=" + b64u(new Uint8Array(3000))]) assert.equal(decodeLamp(bad), null, bad);
});
test("the link is the main site's, carries only the number and the moment, and says where it came from", () => {
  const url = lampLink({ wish: 2, season: "autumn", time: "night" }, "ja"), u = new URL(url);
  assert.equal(u.origin, "https://temple.rushiwowen.co"); assert.equal(u.searchParams.get("utm_source"), "lamp"); assert.equal(u.searchParams.get("utm_content"), "ja");
  assert.ok(u.hash.length > 1 && u.hash.length <= 20, "the fragment is " + u.hash); assert.deepEqual(decodeLamp(u.hash), { wish: 2, season: "autumn", time: "night" });
  assert.ok(!/[㐀-鿿]/.test(decodeURIComponent(url)), "no text of a wish is in the link");
  assert.equal(lampLink({ wish: 99, season: "autumn", time: "night" }, "zh"), null);
});
