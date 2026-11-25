// The debug panel's 「物件」 group (#684): a parameter set written as a snippet and read back is the same set, a fake thing
// is rebuilt alone, and what a snippet may not say is refused. The panel's own drawing is lil-gui's; this holds the model.
import test from "node:test"; import assert from "node:assert/strict";
import { normalize, normalizeAll, toSnippet, parseSnippet, createObjectsModel, OBJECTS_DEBUG_MARK } from "../../app/src/objects-debug.js";

// A fake house, written as surround.js writes its data: numbers to the centimetre, a roof by name, a tone by index, a flag.
const SCHEMA = [
  { key: "x", type: "number", min: -300, max: 300, step: 0.01, default: 0 },
  { key: "z", type: "number", min: -300, max: 300, step: 0.01, default: 0 },
  { key: "w", label: "宽", type: "number", min: 4, max: 15, step: 0.1, default: 7 },
  { key: "ridge", type: "number", min: 3.8, max: 6.3, step: 0.01, default: 5 },
  { key: "roof", type: "choice", options: ["gable", "hip", "shed"], default: "gable" },
  { key: "tone", type: "choice", options: [{ value: 0, label: "old" }, { value: 1, label: "grey" }, { value: 2, label: "pale" }], default: 1 },
  { key: "alongX", type: "bool", default: true },
];
const fake = () => {
  const store = { a: { x: 12.34, z: -5.6, w: 8.2, ridge: 5.25, roof: "hip", tone: 2, alongX: false }, b: { x: 0, z: 0 } }, built = [];
  return { store, built, kind: {
    kind: "house", label: "屋", schema: SCHEMA,
    items: () => Object.keys(store).map((id) => ({ id })), read: (id) => store[id],
    rebuild: (id, p) => { built.push([id, p]); store[id] = p; },
    near: () => "a",
  } };
};

test("parameter → snippet → parameter is the same set, for every kind of value and at the edges", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 300; i++) {
    const raw = { x: (rnd() - 0.5) * 700, z: (rnd() - 0.5) * 700, w: 3 + rnd() * 14, ridge: 3 + rnd() * 4, roof: SCHEMA[4].options[i % 3], tone: i % 3, alongX: rnd() < 0.5 };
    const want = normalizeAll(SCHEMA, raw), text = toSnippet(SCHEMA, raw);
    assert.deepEqual(parseSnippet(SCHEMA, text), want, text);
    assert.equal(toSnippet(SCHEMA, parseSnippet(SCHEMA, text)), text, "writing it again changes nothing");
  }
  assert.equal(toSnippet(SCHEMA, { x: 1.5, z: -2, w: 8.2, ridge: 5.25, roof: "hip", tone: 2, alongX: false }), '{ x: 1.5, z: -2, w: 8.2, ridge: 5.25, roof: "hip", tone: 2, alongX: false }');
});

test("a snippet is read as the level's files write it: single quotes, comments, a trailing comma, a key left out", () => {
  const p = parseSnippet(SCHEMA, `{ x: -9.26, // the arrival's row\n  z: 247.76, roof: 'shed', /* c */ tone: 0, "alongX": true, }`);
  assert.deepEqual(p, normalizeAll(SCHEMA, { x: -9.26, z: 247.76, roof: "shed", tone: 0, alongX: true }));
  assert.equal(p.w, 7, "a key left out takes its default");
});

test("what no snippet may say is refused, and nothing pasted is run", () => {
  for (const bad of ["", "{ x: 1", "{ x: 1 } y", "{ nope: 1 }", "{ roof: 'flat' }", "{ x: foo }", "{ x: process.exit(1) }", "{ x: 1 y: 2 }", "x: 1", "{ tone: 5 }"])
    assert.throws(() => parseSnippet(SCHEMA, bad), Error, JSON.stringify(bad));
  globalThis.__ran = false;
  assert.throws(() => parseSnippet(SCHEMA, "{ x: (globalThis.__ran = true) }")); assert.equal(globalThis.__ran, false);
});

test("numbers are clamped and rounded to the step; a flag is a flag", () => {
  assert.equal(normalize(SCHEMA[2], 99), 15); assert.equal(normalize(SCHEMA[2], 8.2499), 8.2); assert.equal(normalize(SCHEMA[0], 0.004), 0);
  assert.equal(normalize(SCHEMA[6], 1), true); assert.throws(() => normalize(SCHEMA[2], "wide"));
});

test("the model rebuilds only the chosen thing, once for each change, and times it", () => {
  const { kind, built, store } = fake(); let t = 0;
  const m = createObjectsModel([kind], { now: () => (t += 4) });
  assert.deepEqual(m.select("house", "a"), normalizeAll(SCHEMA, store.a)); assert.equal(built.length, 0, "choosing rebuilds nothing");
  const ms = m.set("ridge", 6); assert.equal(ms, 4); assert.deepEqual(built.map(([id]) => id), ["a"]);
  assert.equal(store.a.ridge, 6); assert.deepEqual(store.b, { x: 0, z: 0 }, "the other is left alone");
  m.set("roof", "shed"); assert.equal(built.length, 2); assert.equal(m.last.id, "a");
  assert.throws(() => m.set("w", NaN)); assert.throws(() => m.set("colour", 1));
  const text = m.snippet(); m.set("w", 4); m.apply(text); assert.equal(m.params.w, 8.2, "pasting the copy brings back what was copied");
  assert.equal(store.a.w, 8.2, "and the thing is drawn so");
  m.reset(); assert.equal(m.params.ridge, 5.25);
  const r = m.time(5); assert.equal(r.n, 5); assert.ok(r.max >= r.median && r.median >= r.min);
});

test("the group's code carries a mark a build can be searched for", () => assert.match(OBJECTS_DEBUG_MARK, /^objects-debug@/));

// A value the level's file writes as an expression (altar.js's `(-7 * Math.PI) / 180`): `fmt` writes it from the panel's unit
// (degrees), `parse` turns what it works out to (radians) back, and nothing is run.
const YAW = [{ key: "x", type: "number", min: -19, max: 19, step: 0.01, default: 0 },
  { key: "yaw", type: "number", min: -20, max: 20, step: 0.5, default: 0, fmt: (v) => `(${v} * Math.PI) / 180`, parse: (r) => +((r * 180) / Math.PI).toFixed(6) }];

test("an expression the file writes round-trips through fmt and parse, for every step of the turn", () => {
  for (let d = -20; d <= 20; d += 0.5) {
    const text = toSnippet(YAW, { x: -16.45, yaw: d }); assert.match(text, /yaw: \(.* \* Math\.PI\) \/ 180/);
    assert.deepEqual(parseSnippet(YAW, text), { x: -16.45, yaw: d }, text);
  }
  assert.equal(toSnippet(YAW, { x: -16.45, yaw: -7 }), "{ x: -16.45, yaw: (-7 * Math.PI) / 180 }", "as altar.js writes the seventh's turn");
  assert.deepEqual(parseSnippet(YAW, "{ x: 1, yaw: (-7 * Math.PI) / 180, }"), { x: 1, yaw: -7 });
  assert.deepEqual(parseSnippet(YAW, "{ x: 2 * 3 / 4, yaw: Math.PI / 18 }"), { x: 1.5, yaw: 10 });
});

test("expressions are worked out by hand: only numbers, * / ( ) and Math.PI, never run", () => {
  for (const bad of ["{ x: 1 + 2 }", "{ x: (1 }", "{ x: 1 ) }", "{ x: Math.pow(2, 3) }", "{ x: Math.E }", "{ x: globalThis }", "{ x: 1 2 }", "{ x: (1) (2) }", "{ x: * }"])
    assert.throws(() => parseSnippet(YAW, bad), Error, bad);
  assert.throws(() => parseSnippet(SCHEMA, "{ roof: 1 * 2 }"), Error, "a choice is not an expression");
});
