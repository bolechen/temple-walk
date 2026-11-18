// The observances' clock stops while the page is hidden (a phone's screen off, another tab): the visitor who comes back
// finds the passage where they left it, not one that finished behind a dark screen. A photograph's pause and a hidden
// page are the same time, counted once.
import test from "node:test"; import assert from "node:assert/strict";
import { riteNow, setHidden, pauseRites, resetClock } from "../../app/src/rites.js";

test("hidden time is not kept; the clock takes up where it stopped", () => {
  resetClock();
  assert.equal(riteNow(1000), 1000);
  setHidden(true, 1200);
  assert.equal(riteNow(5000), 1200, "the clock ran on behind a dark screen");
  setHidden(false, 5000);
  assert.equal(riteNow(5000), 1200);
  assert.equal(riteNow(6000), 2200);
});

test("a pause and a hidden page do not count the same time twice", () => {
  resetClock();
  pauseRites(true, 7000);                              // the print is raised and holds the clock
  setHidden(true, 7100); setHidden(false, 8000);       // the screen goes off inside the pause
  pauseRites(false, 9000);                             // the print is put away: the clock starts again
  assert.equal(riteNow(9000), 7000, "the hidden time was counted twice");
  assert.equal(riteNow(9500), 7500);
});
