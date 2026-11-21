// A name declared again inside a function hides the function of that name outside it. In game.js that once broke the
// lamp lit for someone (#429's follow-up): the walk's own `arrive` (to a shared link's scene) hid the lamp's `arrive`, so
// `showWay`, meaning the lamp's, called the walk's, which called `showWay` again, and the lamp never came. Only the nightly
// end-to-end run opened a lamp link, so no pull request saw it. This reads game.js as the bundler does (vite's own parser,
// no new dependency) and fails on any declaration in an inner block that takes the name of a function declared outside it.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs";
import { parseAst } from "vite";

/** Each declaration in an inner block (const, let, var, function, class) named as a function declared in a block around it. @param {string} code */
export function shadowedFunctions(code) {
  const ast = parseAst(code), out = [], lineOf = (pos) => code.slice(0, pos).split("\n").length;
  const declared = (stmts) => {
    const m = new Map();
    for (const s0 of stmts) {
      const s = s0.type === "ExportNamedDeclaration" && s0.declaration ? s0.declaration : s0;
      if (s.type === "FunctionDeclaration" && s.id) m.set(s.id.name, { kind: "function", line: lineOf(s.start) });
      else if (s.type === "ClassDeclaration" && s.id) m.set(s.id.name, { kind: "class", line: lineOf(s.start) });
      else if (s.type === "VariableDeclaration") for (const d of s.declarations) if (d.id.type === "Identifier") m.set(d.id.name, { kind: s.kind, line: lineOf(d.start) });
    }
    return m;
  };
  const visit = (node, around) => {
    if (!node || typeof node.type !== "string") return;
    let here = around;
    if (node.type === "Program" || node.type === "BlockStatement" || node.type === "StaticBlock") {
      const mine = declared(node.body);
      for (const [name, d] of mine) for (const outer of around) { const o = outer.get(name); if (o && o.kind === "function") out.push(`${name}: line ${d.line} (${d.kind}) hides the function at line ${o.line}`); }
      here = [...around, mine];
    }
    for (const v of Object.values(node)) { if (Array.isArray(v)) for (const c of v) visit(c, here); else if (v && typeof v === "object" && typeof v.type === "string") visit(v, here); }
  };
  visit(ast, []);
  return out;
}

test("the check finds the name that broke the lamp: an inner const named as an outer function", () => {
  const broken = `async function arrive() { lamp(); }
const enter = () => { const begin = () => { if (x) { arrive(); return; } }; const arrive = async () => { begin(); }; arrive(); };`;
  assert.deepEqual(shadowedFunctions(broken), ["arrive: line 2 (const) hides the function at line 1"]);
  assert.deepEqual(shadowedFunctions(`function a() {} const b = () => { const c = 1; return a(c); };`), [], "a name of its own hides nothing");
});

test("in game.js no inner declaration takes the name of a function declared around it", () => {
  const found = shadowedFunctions(fs.readFileSync(new URL("../../app/src/game.js", import.meta.url), "utf8"));
  assert.deepEqual(found, [], "rename the inner one:\n" + found.join("\n"));
});
