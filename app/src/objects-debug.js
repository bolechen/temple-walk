// The debug panel's 「物件」 group (#684): pick one parametric thing in the scene, see its parameters, drag them and have only
// that one rebuilt on the spot, then copy the numbers as a snippet written the way the level's own file writes them and
// paste it back. Nothing here is the visitor's: the module is a chunk loaded by src/debug.js only where the panel is
// (the dev server, a pull request's preview, the canary with ?debug=1) and left out of the production build altogether
// (`PRODUCTION` is folded there, tests/unit/deploy.test.mjs looks for OBJECTS_DEBUG_MARK in every build). It does
// nothing per frame: a control moves, one rebuild runs.
//
// A level says what can be dragged in `app/levels/<id>/debug-objects.js`, which exports `OBJECT_KINDS(ctx)` (found here
// by a glob, as the rooms' views are): a list of kinds, each
//   { kind, label, schema, items() → [{ id, label }], read(id) → params, rebuild(id, params), near?(x, z) → id, focus?(id) }
// where `schema` is a list of parameter declarations (see `normalize`). docs/LEVEL-PLAYBOOK.md, 附录丁, has an example.

/** Left in the bundle so that a build can be searched for this module. */
export const OBJECTS_DEBUG_MARK = "objects-debug@684";

/**
 * One parameter of a thing.
 * @typedef {object} Param
 * @property {string} key the field's name in the level's data, which is also its name in the snippet
 * @property {string} [label] what the panel calls it
 * @property {"number" | "choice" | "bool"} type
 * @property {number} [min] number: the least the panel offers
 * @property {number} [max] number: the most
 * @property {number} [step] number: the panel's step, and (as its decimals) how many places the snippet keeps
 * @property {(string | number | { value: string | number, label?: string })[]} [options] choice: what it may be
 * @property {any} default what it is when a snippet leaves it out
 * @property {(v: any) => string} [fmt] how the value is written into a snippet, when the level's file writes it other than as a literal
 * @property {(n: number) => number} [parse] number: the way back from `fmt`: what a snippet's value comes to once worked out (a number, or an expression of numbers, `*`, `/`, parentheses and Math.PI) is turned into the parameter's own unit; `fmt` and `parse` must undo each other (the test holds it)
 */

const digitsOf = (step) => { const s = String(step ?? 0.01); const i = s.indexOf("."); return i < 0 ? 0 : s.length - i - 1; };
const optionValues = (p) => (p.options || []).map((o) => (o !== null && typeof o === "object" ? o.value : o));

/** One value held to what its parameter allows: numbers clamped and rounded to the step's decimals, choices checked, flags made flags. Throws on what no clamp can mend. @param {Param} p */
export function normalize(p, v) {
  if (p.type === "bool") return !!v;
  if (p.type === "choice") {
    const have = optionValues(p);
    if (!have.includes(v)) throw new Error(`${p.key}: ${JSON.stringify(v)} is not one of ${JSON.stringify(have)}`);
    return v;
  }
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`${p.key}: ${JSON.stringify(v)} is not a number`);
  const d = digitsOf(p.step), lo = p.min ?? -Infinity, hi = p.max ?? Infinity;
  return +Math.min(hi, Math.max(lo, n)).toFixed(d);
}

/** A whole set of parameters held to its schema; a key left out takes its default. @param {Param[]} schema @param {Record<string, any>} [params] */
export function normalizeAll(schema, params = {}) {
  const out = {};
  for (const p of schema) out[p.key] = normalize(p, params[p.key] === undefined ? p.default : params[p.key]);
  return out;
}

const literal = (p, v) => (p.fmt ? p.fmt(v) : typeof v === "string" ? JSON.stringify(v) : String(v));

/** The snippet for one set of parameters, an object literal in the order of the schema, written as the level's files write their data. @param {Param[]} schema */
export function toSnippet(schema, params) {
  const v = normalizeAll(schema, params);
  return `{ ${schema.map((p) => `${p.key}: ${literal(p, v[p.key])}`).join(", ")} }`;
}

// A snippet is read by a small scanner, not evaluated: nothing pasted into the panel runs.
const TOKEN = /\s*(?:(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)|([{}:,()*/.])|([A-Za-z_$][\w$]*))/y;
function tokens(text) {
  const out = []; TOKEN.lastIndex = 0; let end = 0;
  for (;;) {
    const m = TOKEN.exec(text);
    if (!m) break;
    end = TOKEN.lastIndex;
    if (m[1]) continue;
    out.push(m[4] ? { t: m[4] } : m[2] ? { t: "str", v: m[2][0] === "'" ? JSON.parse('"' + m[2].slice(1, -1).replace(/\\'/g, "'").replace(/"/g, '\\"') + '"') : JSON.parse(m[2]) } : m[3] ? { t: "num", v: Number(m[3]) } : { t: "id", v: m[5] });
  }
  if (text.slice(end).trim()) throw new Error(`cannot read the snippet from "${text.slice(end).trim().slice(0, 20)}"`);
  return out;
}

/** A number or an arithmetic expression over numbers, `*`, `/`, parentheses and Math.PI (what `fmt` may write): worked out by hand, never run. */
function number(key, tk) {
  let i = 0;
  const bad = () => { throw new Error(`${key}: "${tk.map((t) => t.v ?? t.t).join(" ")}" is not a number, text or true/false`); };
  const atom = () => {
    const t = tk[i++]; if (!t) return bad();
    if (t.t === "num") return t.v;
    if (t.t === "(") { const v = expr(); if (tk[i++]?.t !== ")") bad(); return v; }
    if (t.t === "id" && t.v === "Math" && tk[i]?.t === "." && tk[i + 1]?.v === "PI") { i += 2; return Math.PI; }
    return bad();
  };
  const expr = () => { let v = atom(); while (tk[i] && (tk[i].t === "*" || tk[i].t === "/")) { const op = tk[i++].t, r = atom(); v = op === "*" ? v * r : v / r; } return v; };
  const v = expr(); if (i < tk.length) bad();
  return v;
}

/**
 * The parameters a snippet says, held to the schema. A key the schema does not know is refused (a snippet for another kind of thing); one left out takes its default.
 * @param {Param[]} schema @param {string} text @returns {Record<string, any>}
 */
export function parseSnippet(schema, text) {
  const tk = tokens(text); let i = 0; const raw = {};
  const need = (t) => { if (tk[i]?.t !== t) throw new Error(`the snippet expects "${t}"${tk[i] ? ` and has "${tk[i].v ?? tk[i].t}"` : " and ends"}`); return tk[i++]; };
  need("{");
  while (tk[i] && tk[i].t !== "}") {
    const k = tk[i++]; if (k.t !== "id" && k.t !== "str") throw new Error(`a key was expected, got "${k.v ?? k.t}"`);
    need(":");
    let depth = 0; const from = i;   // the value runs to the next comma or closing brace outside parentheses
    while (tk[i] && (depth > 0 || (tk[i].t !== "," && tk[i].t !== "}"))) { if (tk[i].t === "(") depth++; else if (tk[i].t === ")") depth--; i++; }
    const v = tk.slice(from, i); if (!v.length) throw new Error(`${k.v}: no value`);
    if (v.length === 1 && v[0].t === "str") raw[k.v] = v[0].v;
    else if (v.length === 1 && v[0].t === "id" && (v[0].v === "true" || v[0].v === "false")) raw[k.v] = v[0].v === "true";
    else raw[k.v] = number(k.v, v);
    if (tk[i]?.t === ",") i++; else break;
  }
  need("}");
  if (i < tk.length) throw new Error("something follows the snippet's closing brace");
  const known = new Set(schema.map((p) => p.key));
  for (const k of Object.keys(raw)) if (!known.has(k)) throw new Error(`${k}: not a parameter of this kind of thing (${[...known].join(", ")})`);
  for (const p of schema) if (p.parse && typeof raw[p.key] === "number") raw[p.key] = p.parse(raw[p.key]);
  return normalizeAll(schema, raw);
}

/**
 * The state of the group, apart from any page: which kind and which one of it is chosen, its parameters, and the
 * rebuild each change causes. The panel only draws this and calls it.
 * @param {any[]} kinds @param {{ now?: () => number }} [o]
 */
export function createObjectsModel(kinds, { now = () => performance.now() } = {}) {
  /** @type {any} */ let kind = null; let id = null; /** @type {Record<string, any>} */ let params = {}, first = {};
  const m = {
    kinds,
    last: /** @type {{ ms: number, kind: string, id: string } | null} */ (null),
    get kind() { return kind; }, get id() { return id; }, get params() { return { ...params }; },
    select(kindName, itemId) {
      kind = kinds.find((k) => k.kind === kindName) || null; id = kind ? itemId : null;
      params = kind ? normalizeAll(kind.schema, kind.read(itemId)) : {}; first = { ...params };
      kind?.focus?.(itemId);
      return m.params;
    },
    /** Change one parameter and rebuild this one thing; the milliseconds that took are kept in `last`. */
    set(key, value) {
      if (!kind) throw new Error("nothing is chosen");
      const p = kind.schema.find((x) => x.key === key); if (!p) throw new Error(`${key}: not a parameter`);
      params[key] = normalize(p, value);
      return m.rebuild();
    },
    rebuild() {
      const t = now(); kind.rebuild(id, { ...params }); const ms = now() - t;
      m.last = { ms, kind: kind.kind, id }; return ms;
    },
    snippet() { return toSnippet(kind.schema, params); },
    /** Take a pasted snippet as the new parameters and rebuild. */
    apply(text) { params = parseSnippet(kind.schema, text); m.rebuild(); return m.params; },
    reset() { params = { ...first }; m.rebuild(); return m.params; },
    /** The cost of one rebuild, taken `n` times at the current parameters: { median, max, min } in ms. */
    time(n = 15) {
      const a = []; for (let k = 0; k < n; k++) a.push(m.rebuild()); a.sort((x, y) => x - y);
      return { n, median: a[a.length >> 1], max: a[a.length - 1], min: a[0] };
    },
  };
  return m;
}

/** The kinds the walked level declares in its debug-objects.js, none when it has none. */
async function levelKinds(W) {
  const tables = import.meta.glob("../levels/*/debug-objects.js"), id = W.__level().id, load = tables[`../levels/${id}/debug-objects.js`];
  if (!load) return [];
  const mod = /** @type {any} */ (await load());
  return mod.OBJECT_KINDS({ W });
}

/**
 * The 「物件」 folder of the panel. @param {any} gui the panel (lil-gui) @param {any} W the window with the page's hooks
 * @param {any[]} [kindsGiven] kinds to offer instead of the level's (a test's)
 */
export async function mountObjects(gui, W, kindsGiven) {
  const kinds = kindsGiven || (await levelKinds(W)), model = createObjectsModel(kinds);
  const folder = gui.addFolder("物件");
  W.__objects = Object.assign(model, { mark: OBJECTS_DEBUG_MARK });   // (also what keeps the mark in a build)
  if (!kinds.length) { folder.add({ note: "本关还没有登记可调的物件" }, "note").name("提示").disable(); folder.close(); return model; }
  const s = { kind: kinds[0].kind, item: "", ms: "—", frame: "—" };
  let fields = null;
  const items = () => kinds.find((k) => k.kind === s.kind).items();
  const label = (it) => it.label || it.id;
  const timed = () => {   // the rebuild's own time, and the time until the frame that shows it has been drawn
    const t = performance.now(), ms = model.last?.ms ?? 0; s.ms = `${ms.toFixed(1)} ms`;
    requestAnimationFrame(() => requestAnimationFrame(() => { s.frame = `${(performance.now() - t + ms).toFixed(0)} ms（到画面）`; }));
  };
  const draw = () => {
    fields?.destroy();
    fields = folder.addFolder("参数");
    const k = model.kind, vals = { ...model.params }; if (!k) return;
    for (const p of k.schema) {
      const c = p.type === "number" ? fields.add(vals, p.key, p.min, p.max, p.step)
        : p.type === "choice" ? fields.add(vals, p.key, Object.fromEntries((p.options || []).map((o) => (o !== null && typeof o === "object" ? [o.label ?? o.value, o.value] : [String(o), o]))))
          : fields.add(vals, p.key);
      c.name(p.label || p.key).onChange((v) => { model.set(p.key, v); timed(); });
    }
  };
  const choose = (itemId) => { s.item = itemId; model.select(s.kind, itemId); draw(); };
  const pick = folder.addFolder("选中"), kindC = pick.add(s, "kind", kinds.map((k) => k.kind)).name("种类");
  const itemMap = () => Object.fromEntries(items().map((it) => [label(it), it.id]));
  let itemC = pick.add(s, "item", itemMap()).name("哪一件").onChange(choose);   // (lil-gui's options() hands back a new controller)
  const listItems = () => {
    s.item = items()[0]?.id ?? ""; itemC = itemC.options(itemMap()).onChange(choose); itemC.updateDisplay();
    if (s.item) choose(s.item);
  };
  kindC.onChange(listItems);
  pick.add({ near() {
    const k = kinds.find((x) => x.kind === s.kind), y = W.__yard(), id = k.near?.(y.x, y.z);
    if (id != null) { itemC.setValue(id); }
  } }, "near").name("选离他最近的");
  folder.add({ copy() { const t = model.snippet(); console.info("[debug]", t); navigator.clipboard?.writeText(t).catch(() => {}); } }, "copy").name("复制片段");
  folder.add({ paste() { const t = prompt("贴入片段"); if (t) { try { model.apply(t); draw(); timed(); } catch (e) { alert(String(e.message || e)); } } } }, "paste").name("载入片段");
  folder.add({ reset() { model.reset(); draw(); timed(); } }, "reset").name("还原");
  folder.add({ time() { const r = model.time(15); s.ms = `中位 ${r.median.toFixed(1)} · 最大 ${r.max.toFixed(1)} ms（15 次）`; } }, "time").name("量重建用时");
  folder.add(s, "ms").name("重建").listen().disable();
  folder.add(s, "frame").name("见到效果").listen().disable();
  listItems();
  return model;
}
