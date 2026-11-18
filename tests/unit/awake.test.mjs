// Keeping the screen awake while the close of the chapter is played: the browser's Screen Wake Lock API, asked for a
// page that is visible and let go when the passage is over. A browser without it, or one that refuses (a low battery),
// leaves the screen to its own timer; the passage stays whole on its own (rites.js keeps no time behind a dark screen).
import test from "node:test"; import assert from "node:assert/strict";
import { createAwake } from "../../app/src/awake.js";

const tick = () => new Promise((r) => setTimeout(r, 0));

function stage({ refuse = false } = {}) {
  const log = [], sentinels = [];
  const doc = { hidden: false, listeners: [], addEventListener(type, fn) { this.listeners.push([type, fn]); } };
  doc.fire = (type) => { for (const [n, fn] of doc.listeners) if (n === type) fn(); };
  doc.set = (hidden) => { doc.hidden = hidden; doc.fire("visibilitychange"); };
  const nav = { wakeLock: { request: async (type) => { log.push("request:" + type); if (refuse) throw new Error("NotAllowedError");
    const s = { released: 0, release: async () => { s.released++; log.push("release"); }, addEventListener(type2, fn) { if (type2 === "release") s.onrelease = fn; } };
    sentinels.push(s); return s; } } };
  return { doc, nav, log, last: () => sentinels.at(-1) };
}

test("holding asks the screen once, and lets it go when the passage ends", async () => {
  const s = stage(), a = createAwake({ nav: s.nav, doc: s.doc });
  a.hold(); a.hold(); await tick();
  assert.deepEqual(s.log, ["request:screen"]);
  a.free(); await tick();
  assert.equal(s.last().released, 1);
});

test("a lock dropped by the system is asked for again only when the page is seen", async () => {
  const s = stage(), a = createAwake({ nav: s.nav, doc: s.doc });
  a.hold(); await tick();
  s.doc.set(true); s.last().onrelease();   // the system takes it when the page goes away
  s.doc.set(false); await tick();
  assert.equal(s.log.filter((x) => x === "request:screen").length, 2);
  a.free();
});

test("a browser without wake locks, or one that refuses, leaves the screen to itself", async () => {
  const s = stage({ refuse: true }), a = createAwake({ nav: s.nav, doc: s.doc });
  a.hold(); await tick(); a.free(); await tick();   // no throw
  assert.equal(s.log.filter((x) => x.startsWith("request")).length, 1);
  const none = createAwake({ nav: {}, doc: s.doc }); none.hold(); none.free(); await tick();
});

test("freed while the ask is in flight, the lock is let go as it arrives", async () => {
  let resolve; const log = [], doc = { hidden: false, addEventListener() {} };
  const nav = { wakeLock: { request: () => new Promise((r) => (resolve = r)) } };
  const a = createAwake({ nav, doc });
  a.hold(); a.free();
  const sentinel = { released: 0, release: async () => { sentinel.released++; } };
  resolve(sentinel); await tick();
  assert.equal(sentinel.released, 1);
  assert.equal(log.length, 0, "the fake asked nothing");
});
