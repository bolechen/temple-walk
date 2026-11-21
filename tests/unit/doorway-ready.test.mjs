// What shots.js waits for before it takes a picture (#373): every hall wanted through its door shows its baked room,
// faded in, or has given up. The report is in the shape app/src/doorway.js's report() gives today, which no longer has
// the `busy` and `queued` the old wait read (and threw on).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { doorwaysReady } = createRequire(import.meta.url)("../../tools/doorway-ready.cjs");

const hall = (o) => ({ want: false, taken: 0, fade: 0, hi: false, source: "none", ...o });
const report = (halls) => ({ modes: {}, halls, baked: true, failed: 0, steps: 12, keep: 4, dropped: 0, mb: 0, worstFrameMs: 0, spikes: 0 });

test("the old wait threw on the report as it is now", () => {
  const old = (r) => !r || (!r.busy && !r.queued.length && Object.values(r.halls).every((h) => !h.want || h.fade === 1));
  assert.throws(() => old(report({ main: hall({ want: true, source: "baked", fade: 1 }) })), TypeError);
});

test("it waits for every wanted hall to fade in, or to give up", () => {
  assert.equal(doorwaysReady(null), true, "a page with no doorways has nothing to wait for");
  assert.equal(doorwaysReady(report({ main: hall({}) })), true, "nothing wanted yet");
  assert.equal(doorwaysReady(report({ main: hall({ want: true, source: "baked", fade: 0.4 }) })), false, "still fading in");
  assert.equal(doorwaysReady(report({ main: hall({ want: true, source: "baked", fade: 1 }), tea: hall({ want: true, source: "none" }) })), true);
  assert.equal(doorwaysReady(report({ main: hall({ want: true, source: "failed" }) })), true, "a fetch that failed is not waited on for ever");
  assert.equal(doorwaysReady(report({ main: hall({ want: true, source: "drawn", fade: 1 }) })), false, "only the baked pictures count as in place");
});

test("its source runs on its own, as the page is handed it", () => {
  const inPage = new Function("r", `return (${doorwaysReady})(r);`);
  assert.equal(inPage(report({ main: hall({ want: true, source: "baked", fade: 1 }) })), true);
});
