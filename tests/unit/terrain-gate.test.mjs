// #183's spike switch is the workbench's (the T00 lead and the overall lead, 2026-11-21): ?terrain=made|dem draws the far
// land from a heightmap only on the dev server and a pull request's preview, as ?seals and ?at; the canary and the public
// page never read it, so a visitor who types it still gets the hill rings and fetches no heightmap.
import test from "node:test";
import assert from "node:assert/strict";
import "./dom-stub.mjs";
import { terrainAsked } from "../../app/src/terrain-far.js";
import { onBench } from "../../app/src/debuggate.js";

const ask = (hostname, search, dev = false) => terrainAsked({ dev, hostname, search });

test("the public page and the canary never load a heightmap, whatever the address says", () => {
  for (const h of ["temple.rushiwowen.co", "temple-walk-canary.bole-chen.workers.dev"])
    for (const q of ["?terrain=made", "?terrain=dem", "?terrain=made&debug=1", "?show=loft&terrain=made"]) assert.equal(ask(h, q), null, `${h}${q}`);
  assert.equal(onBench({ dev: false, hostname: "temple.rushiwowen.co" }), false);
});

test("the workbench reads ?terrain=made|dem and nothing else", () => {
  assert.equal(ask("127.0.0.1", "?terrain=made", true), "made");
  assert.equal(ask("pr-465-temple-walk-preview.bole-chen.workers.dev", "?terrain=dem"), "dem");
  assert.equal(ask("6b93be10-temple-walk-preview.bole-chen.workers.dev", "?show=loft&terrain=made"), "made");
  assert.equal(ask("127.0.0.1", "?terrain=rings", true), null);
  assert.equal(ask("127.0.0.1", "", true), null);
});

test("yard.js asks the gate, not the address, before fetching a heightmap", async () => {
  const fs = await import("node:fs");
  const src = fs.readFileSync(new URL("../../app/yard.js", import.meta.url), "utf8");
  assert.match(src, /terrainAsked\(\{ dev: !!import\.meta\.env\.DEV, hostname: location\.hostname, search: location\.search \}\)/);
  assert.doesNotMatch(src, /Q\.get\("terrain"\)/);
});
