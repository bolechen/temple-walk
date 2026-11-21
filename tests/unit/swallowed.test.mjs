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
  for (const ok of [`  // the court, the terrace and the flight;`, `const a = 1;   // a note (see b.c) and more;`, `go();   // the way there;`, `// levels.push(x);`, `const u = "http://a/b"; // a link`])
    assert.deepEqual(swallowed(ok), [], ok);
});

test("nothing in app/ is swallowed by a comment", () => {
  const hits = swallowedIn(new URL("../../app/", import.meta.url).pathname);
  assert.deepEqual(hits.map((h) => `${h.file}:${h.line}: ${h.comment.slice(-60)}`), []);
});
