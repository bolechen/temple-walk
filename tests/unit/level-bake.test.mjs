// Each level bakes its own floor and its own doorway pictures (#405, docs/t05/LEVEL-SPLIT.md S5): the tools take
// --level=<id> and refuse a name that is no level, the bake's scene is told what to build by the level and knows no
// temple by name, the page asks for its own level's list of pictures, a level's bake leaves another's pictures alone,
// and CI keeps and compares whatever levels there are. The prologue's floor and pictures are what they were: the floor's
// fingerprint is held by walk-bake.test.mjs, and the level's numbers here are the ones the scene worked out before.
import "./dom-stub.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { levelArg, levelIds, isLevel, walkFile, doorwayManifest } from "../../tools/walk/level-arg.mjs";
import { manifestURL } from "../../app/src/doorway.js";
import { loadLevel, LEVELS as KNOWN } from "../../app/src/level.js";
import { SITE, LEVELS, APPROACH } from "../../app/src/site.js";

const top = fileURLToPath(new URL("../../", import.meta.url));
const read = (f) => fs.readFileSync(path.join(top, f), "utf8");

test("a tool's --level names a level, or the prologue, and nothing else", () => {
  assert.deepEqual(levelIds(), Object.keys(KNOWN));
  assert.equal(levelArg(["node", "x"]), "t00");
  assert.equal(levelArg(["node", "x", "--level=t00"]), "t00");
  for (const bad of ["--level=nope", "--level=toString", "--level=", "--level"]) assert.throws(() => levelArg(["node", "x", bad]), /the levels are t00/, bad);
  assert.equal(isLevel("t00"), true); assert.equal(isLevel("constructor"), false);
});

test("a level's floor and its list of pictures are named by the level", () => {
  assert.equal(walkFile("t00"), path.join(top, "app/shared/walk/t00.bin"));
  assert.equal(walkFile("t05"), path.join(top, "app/shared/walk/t05.bin"));
  assert.equal(doorwayManifest("t05"), "t05.json");
  assert.equal(manifestURL("/shared/doorways/", "t00"), "/shared/doorways/t00.json", "the prologue's list where it always was");
  assert.equal(manifestURL("/shared/doorways/", "t05"), "/shared/doorways/t05.json");
  assert.match(read("app/yard.js").split("\n").find((l) => l.includes("createDoorways({")) || "", /\blevel: L\.id\b/, "the page hands the doorways its level");
  assert.doesNotMatch(read("app/src/doorway.js"), /"t00\.json"/);
});

test("the bake's scene builds what the level says, and names no temple", () => {
  const src = read("tools/walk/scene.mjs");
  assert.doesNotMatch(src, /levels\/t00|SITE\.|APPROACH/);
  assert.match(read("tools/check.cjs"), /const BAKE_ONLY = fs\.readdirSync\(path\.join\(root, "levels"\)\)\.map\(\(d\) => path\.join\(root, "levels", d, "bake\.js"\)\);/, "the font check spares a level's bake.js and nothing more");
  // The page never asks for a level's bake.js: only the Node tools read it, so its names stay out of a visitor's bundle.
  for (const f of ["app/yard.js", "app/src/level.js", "app/levels/t00/level.js"]) assert.doesNotMatch(read(f).replace(/^\s*(\/\/|\*).*$/gm, ""), /bake\.js/, f);
  for (const f of ["tools/bake-walk.mjs", "tools/bake-doorways.mjs", "tools/walk-diff.mjs", "tools/walk/grid-node.mjs", "tools/around/plan.mjs"])
    assert.doesNotMatch(read(f).replace(/^\s*\/\/.*$/gm, ""), /walk\/t00\.bin|LEVEL = "t00"|"t00\.json"/, f);
});

test("every level tells the bake how far its courts reach and how its place is divided", async () => {
  const bakeOf = async (id) => (await import(`../../app/levels/${id}/bake.js`)).default;
  for (const id of levelIds()) {
    const bake = await bakeOf(id);
    const { x0, x1, z0, z1 } = bake.outdoors;
    assert.ok(x0 < x1 && z0 < z1, id);
    assert.ok(bake.bands.length > 0 && bake.bands.every(([n, a, b]) => typeof n === "string" && a < b), id);
  }
  // The prologue's, exactly as tools/walk/scene.mjs worked them out before #405, so that its floor's fingerprint holds.
  const bake = await bakeOf("t00"), x = SITE.x + 10;
  assert.deepEqual(bake.outdoors, { x0: -x, x1: x, z0: SITE.zN - 1, z1: Math.ceil(APPROACH.end) + 2 });
  assert.deepEqual(bake.bands, [["山路", SITE.fore, 1e9], ["山门前", SITE.zS, SITE.fore], ["首院", LEVELS[0].zS, SITE.zS], ["藏经楼院", LEVELS[1].zS, LEVELS[0].zS], ["观音殿院", LEVELS[1].zN, LEVELS[1].zS], ["茶园坡", LEVELS[2].zS, LEVELS[1].zN], ["山顶", -1e9, LEVELS[2].zS]]);
});

test("the tools stop on a name that is no level, and say which there are", () => {
  for (const tool of ["tools/bake-walk.mjs", "tools/bake-doorways.mjs", "tools/walk-diff.mjs"]) {
    const r = spawnSync(process.execPath, [tool, "--level=nope", "--key"], { cwd: top, encoding: "utf8", timeout: 60000 });
    assert.equal(r.status, 1, `${tool}: ${r.stderr}`);
    assert.match(r.stderr, /unknown level "nope": the levels are t00/, tool);
  }
  const list = spawnSync(process.execPath, ["tools/bake-walk.mjs", "--list"], { cwd: top, encoding: "utf8", timeout: 60000 });
  assert.equal(list.status, 0); assert.deepEqual(list.stdout.trim().split("\n"), levelIds());
});

test("a level's doorway bake makes way only for its own pictures", async () => {
  const { clearLevel } = await import("../../tools/bake-doorways.mjs");
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "doorways-"));
  const hall = (id, fp) => ({ fp, day: `${id}.${fp}.day.webp`, night: `${id}.${fp}.night.webp`, dist: `${id}.${fp}.dist.png`, in: { day: `${id}.${fp}.in.day.webp`, night: `${id}.${fp}.in.night.webp`, dist: `${id}.${fp}.in.dist.png` } });
  const lay = (level, halls) => {
    const m = { level, halls: Object.fromEntries(halls.map(([id, fp]) => [id, hall(id, fp)])) };
    for (const e of Object.values(m.halls)) for (const f of [e.day, e.night, e.dist, e.in.day, e.in.night, e.in.dist]) fs.writeFileSync(path.join(dir, f), "x");
    fs.writeFileSync(path.join(dir, `${level}.json`), JSON.stringify(m));
  };
  lay("t00", [["main", "aaaa"], ["tea", "bbbb"]]);
  lay("t05", [["main", "cccc"]]);   // the same hall name in another level, its own fingerprint
  fs.writeFileSync(path.join(dir, "outside.txt"), "kept");
  clearLevel(dir, "t05");
  const left = fs.readdirSync(dir).sort();
  assert.ok(!left.some((f) => f.includes("cccc")) && !left.includes("t05.json"), "the level's own files go");
  assert.equal(left.filter((f) => /aaaa|bbbb/.test(f)).length, 12, "the prologue's twelve stay");
  assert.ok(left.includes("t00.json") && left.includes("outside.txt"));
  // A list that names a path outside the folder removes nothing there.
  fs.writeFileSync(path.join(dir, "t09.json"), JSON.stringify({ halls: { x: { day: "../outside.txt", night: "t00.json" } } }));
  clearLevel(dir, "t09");
  assert.ok(fs.existsSync(path.join(dir, "outside.txt")));
  fs.rmSync(dir, { recursive: true, force: true });
});

test("CI keeps every level's floor and pictures and compares each level's floor", () => {
  const pages = read(".github/workflows/pages.yml"), e2e = read(".github/workflows/e2e.yml"), tag = read(".github/workflows/deploy-tag.yml");
  for (const [n, y] of [["pages", pages], ["e2e", e2e], ["deploy-tag", tag]]) assert.doesNotMatch(y, /(walk|doorways)-t00-/, n);
  assert.match(pages, /for lv in \$\(node tools\/bake-walk\.mjs --list\); do node tools\/walk-diff\.mjs "\.main\/app\/shared\/walk\/\$lv\.bin" --level="\$lv"/);
  assert.match(read("package.json"), /"build": "node tools\/bake-walk\.mjs && vite build && node tools\/bake-doorways\.mjs"/, "the build bakes every level (no --level)");
});
