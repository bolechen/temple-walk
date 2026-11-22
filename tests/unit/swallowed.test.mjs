// No statement is hidden in a line comment (tools/swallowed.cjs, #414's review): a comment added at the end of a line that
// went on with another statement swallowed it, twice in one change.
import test from "node:test"; import assert from "node:assert/strict";
import { createRequire } from "node:module";
const { swallowed, swallowedIn } = createRequire(import.meta.url)("../../tools/swallowed.cjs");

test("a statement after a comment at a line's end is found; prose and a comment before the code are not", () => {
  // The two the review found, as they were written.
  assert.equal(swallowed(`  const mat = pave(a, true, b);   // (no censer: none marked, as on the terraces) levels.push({ mat, y: 0 });`).length, 1);
  assert.equal(swallowed(`for (const h of H) if (p[h]) s[h] = p[h];   // (a level without that hall has no place for it, #409) site.seats.push(...rooms.seats);`).length, 1);
  assert.equal(swallowed(`x = 1;   // later: y = 2;`).length, 1);
  // #592: a hook line that went on with two more, the last an arrow function whose body has its own semicolons (the guard read only a call or a plain assignment at the comment's end): __view and __photo were lost, and no scenario that CI runs on every push looks for them.
  assert.equal(swallowed(`window.__skyTrial = (on) => { SKY_TRIAL.on = !!on; return SKY_TRIAL.on; };   // the sky from the sun's height, on or off while the page runs window.__view = setView; window.__photo = (open, opts) => { setPhoto(open); Object.assign(photo, opts || {}); resize(); };`).length, 1);
  assert.deepEqual(swallowed(`window.__skyTrial = (on) => { return on; };   // the hook (window.__skyTrial in the console) reports the trial`), [], "prose that names a hook is not a statement");
  for (const ok of [`  // the court, the terrace and the flight;`, `const a = 1;   // a note (see b.c) and more;`, `go();   // the way there;`, `// levels.push(x);`, `const u = "http://a/b"; // a link`])
    assert.deepEqual(swallowed(ok), [], ok);
});

test("nothing in app/ is swallowed by a comment", () => {
  const hits = swallowedIn(new URL("../../app/", import.meta.url).pathname);
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line}: ${h.comment.slice(-60)}`), []);
});
