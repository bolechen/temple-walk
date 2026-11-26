// In the built site the seven figures' code (app/levels/t05/figures/: the paint and its loaders) is a chunk of its own that nothing loads by itself (#763's review,
// 「门关的生产构建里 figures chunk 不被页面加载」). Built here into scratch folders as the two sites that list T05 are published: the production build carries no T05 at
// all (so no figures code, nor any file of theirs), and the canary's has the figures' chunks apart: index.html does not preload them, no chunk imports them
// statically, and the only reference to them is the dynamic import in the level's chunk that site.js makes when the doors are open (the workbench's `?hall=open`).
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { execFileSync } from "node:child_process"; import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const build = (target) => {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), `temple-figures-${target}-`));
  execFileSync(process.execPath, [path.join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--logLevel", "warn", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env: { ...process.env, VITE_DEPLOY: target }, stdio: ["ignore", "inherit", "inherit"] });
  const js = fs.readdirSync(path.join(out, "assets")).filter((f) => f.endsWith(".js")), read = (f) => fs.readFileSync(path.join(out, "assets", f), "utf8");
  return { out, js, read, html: fs.readFileSync(path.join(out, "index.html"), "utf8") };
};
const prod = build("production"), canary = build("canary");
test.after(() => { for (const b of [prod, canary]) fs.rmSync(b.out, { recursive: true, force: true }); });

test("the production build carries no figures code and no dataset address, and neither it nor the canary carries the files (even where they were fetched)", () => {
  for (const f of prod.js) { const text = prod.read(f); assert.ok(!text.includes("t05paint:"), `${f} holds the figures' paint`); assert.ok(!/figures-[\w-]+\.js/.test(text), `${f} names a figures chunk`); assert.ok(!/huggingface\.co\/datasets\/[^"'`]*t05-figures/.test(text), `${f} names a dataset`); }
  for (const [n, b] of [["production", prod], ["canary", canary]]) assert.ok(!fs.existsSync(path.join(b.out, "shared/models/t05")), `${n} holds the figures' files`);
});

test("the canary has the paint and the loaders as chunks of their own", () => {
  const load = canary.js.filter((f) => canary.read(f).includes("t05paint:")), entry = canary.js.filter((f) => /^figures-/.test(f));
  assert.equal(load.length, 1, `one chunk holds the paint: ${load}`); assert.equal(entry.length, 1, `one chunk is the entry: ${entry}`);
});

test("index.html does not mention them, no chunk imports either statically, and one chunk asks for the entry by import(…): the level's, where site.js asks", () => {
  const load = canary.js.find((f) => canary.read(f).includes("t05paint:")), entry = canary.js.find((f) => /^figures-/.test(f));
  for (const f of [load, entry]) {
    assert.ok(!canary.html.includes(f), `index.html names ${f}`);
    const name = f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const g of canary.js) assert.ok(!new RegExp(`(?:from|import)\\s*["'\`]\\./${name}`).test(canary.read(g)), `${g} imports ${f} statically`);
  }
  const asker = canary.js.filter((g) => canary.read(g).includes(`import(\`./${entry}\`)`) || canary.read(g).includes(`import("./${entry}")`));
  assert.equal(asker.length, 1, `exactly one chunk asks for the figures' entry: ${asker}`);
  assert.ok(/^level-/.test(asker[0]), `it is the level's chunk (${asker[0]})`);
  assert.ok(canary.read(asker[0]).includes("benchFigures") || /altar-/.test(canary.read(asker[0])), "and that is T05's");
});
