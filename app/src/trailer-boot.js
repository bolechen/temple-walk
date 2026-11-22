// Imported first by yard.js, so that the fixed clock is in place before anything reads the time (#610, trailer-clock.js).
// `?trailer` on the workbench only (trailer-gate.js); everywhere else this module does nothing.
import { DEPLOY } from "./deploy.js";
import { trailerGate } from "./trailer-gate.js";
import { createFixedClock, installClock } from "./trailer-clock.js";

export const TRAILER = typeof location !== "undefined" && trailerGate({ dev: !!import.meta.env.DEV, deploy: DEPLOY, search: location.search });
if (TRAILER) {
  const fps = Number(new URLSearchParams(location.search).get("fps")) || 60;
  // The film's time starts well after anything the page's loading can use up, so that a shot can be set at its own time by a jump forward.
  const clock = createFixedClock({ fps, start: 1000 });
  const realRaf = window.requestAnimationFrame.bind(window);
  installClock(window, clock);
  // While the page loads its frames are the display's (the loading screen waits on two of them between its steps): the
  // clock is pumped from the real frame loop until the player takes it (`hold()`), after which only a tool moves it.
  /** @type {any} */ const c = clock; c.auto = true; c.hold = () => { c.auto = false; };
  const pump = () => { if (!c.auto) return; clock.step(); realRaf(pump); };
  realRaf(pump);
  /** @type {any} */ (window).__trailerClock = c;
}
