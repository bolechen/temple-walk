// The seals earned, written beside the book's small seal (#651): in ink numerals for Chinese and Japanese, digits for
// English and Korean, from one table by language that the owner can change in one place.
import test from "node:test"; import assert from "node:assert/strict";
import { numeral, sealCount, NUMERALS } from "../../app/src/i18n.js";
import EN from "../../app/locales/en.js"; import JA from "../../app/locales/ja.js"; import KO from "../../app/locales/ko.js";

test("numerals: zero is 〇, and each language has its own table", () => {
  assert.equal(numeral(0, "zh"), "〇"); assert.equal(numeral(3, "zh"), "三"); assert.equal(numeral(7, "zh"), "七");
  assert.equal(numeral(0, "ja"), "〇"); assert.equal(numeral(3, "ja"), "三");
  assert.equal(numeral(0, "en"), "0"); assert.equal(numeral(7, "en"), "7");
  assert.equal(numeral(3, "ko"), "3");
  assert.deepEqual(Object.keys(NUMERALS).sort(), ["en", "ja", "ko", "zh"]);
});
test("the count reads 'n / total', never past the total or below none", () => {
  assert.equal(sealCount(0, 7, "zh"), "〇 / 七"); assert.equal(sealCount(3, 7, "zh"), "三 / 七");
  assert.equal(sealCount(7, 7, "zh"), "七 / 七"); assert.equal(sealCount(1, 7, "ja"), "一 / 七");
  assert.equal(sealCount(3, 7, "en"), "3 / 7"); assert.equal(sealCount(0, 7, "ko"), "0 / 7");
  assert.equal(sealCount(9, 7, "zh"), "七 / 七"); assert.equal(sealCount(-1, 7, "zh"), "〇 / 七");
});
test("the line a screen reader gets says it once, with a blank for each number", () => {
  for (const [k, T] of [["en", EN], ["ja", JA], ["ko", KO]]) {
    const s = T["朱印 {n}枚，共{total}枚"]; assert.ok(s && s.includes("{n}") && s.includes("{total}"), `${k} lacks the spoken count`);
  }
});
