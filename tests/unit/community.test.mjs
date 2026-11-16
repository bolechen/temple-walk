import test from "node:test";
import assert from "node:assert/strict";
import { readCommunityConfig } from "../../app/src/community.js";

const base = "https://assets.example.com/temple-walk/community/current.json";
const now = Date.parse("2026-11-16T12:00:00+08:00");
const valid = { enabled: true, image: "wechat-20261116.jpg", expiresAt: "2026-11-23T00:00:00+08:00" };

test("community images resolve beside the remote configuration", () => {
  assert.deepEqual(readCommunityConfig(valid, base, now), { state: "ready", image: "https://assets.example.com/temple-walk/community/wechat-20261116.jpg", expiresAt: Date.parse(valid.expiresAt) });
});

test("community invitations stop at the exact expiry and can be disabled without an image", () => {
  assert.equal(readCommunityConfig(valid, base, Date.parse(valid.expiresAt) - 1).state, "ready");
  assert.equal(readCommunityConfig(valid, base, Date.parse(valid.expiresAt)).state, "expired");
  assert.deepEqual(readCommunityConfig({ enabled: false }, base, now), { state: "closed" });
});

test("malformed configuration and unsafe image URLs never produce an invitation", () => {
  for (const data of [null, {}, { ...valid, enabled: "true" }, { ...valid, image: "" }, { ...valid, image: "javascript:alert(1)" }, { ...valid, image: "data:image/png;base64,abc" }, { ...valid, expiresAt: "2026-11-23" }, { ...valid, expiresAt: "unknown" }]) {
    assert.throws(() => readCommunityConfig(data, base, now));
  }
});
