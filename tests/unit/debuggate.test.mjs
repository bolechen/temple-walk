import test from "node:test";
import assert from "node:assert/strict";
import { debugGate } from "../../app/src/debuggate.js";

const at = (hostname, search = "", dev = false) => debugGate({ dev, hostname, search });

test("the dev server and a preview open the panel by themselves, and ?debug=0 shuts it", () => {
  assert.equal(at("127.0.0.1", "", true), true);
  assert.equal(at("127.0.0.1", "?debug=0", true), false);
  assert.equal(at("pr-12-temple-walk-preview.bole-chen.workers.dev"), true);
  assert.equal(at("ab12cd34-temple-walk-preview.bole-chen.workers.dev", "?debug=0"), false);
});

test("the canary opens it only when the address asks with ?debug=1", () => {
  assert.equal(at("temple-walk-canary.bole-chen.workers.dev"), false);
  assert.equal(at("temple-walk-canary.bole-chen.workers.dev", "?debug"), false);
  assert.equal(at("temple-walk-canary.bole-chen.workers.dev", "?cam=1,2,0,0&debug=1"), true);
});

test("the public page never opens it, whatever the address says", () => {
  for (const q of ["", "?debug", "?debug=1", "?debug=true"]) assert.equal(at("temple.rushiwowen.co", q), false, q);
});

test("a film is drawn with no panel over it, on the dev server and a preview too (#610)", () => {
  assert.equal(at("127.0.0.1", "?trailer=1", true), false);
  assert.equal(at("pr-12-temple-walk-preview.bole-chen.workers.dev", "?trailer"), false);
});
