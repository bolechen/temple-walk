// 行脚图 on the page (#449, phase one). The map of temples walked, the three ways to it, and the crossing it makes:
//  - the pause menu's row (a press, which is also the way for anyone who cannot hold a key: Xbox's XAG 107 and 115 ask
//    that a hold have another way), the book's chip, and a hold on Q for a second, shown as a ring of ink that fills;
//  - none of them is there until a temple has been closed, and the build lists another to go to (src/pilgrimage.js);
//  - a place on the map that has been closed is one press away: the ink curtain closes, the page opens again for that
//    temple with the visit handed across (src/pilgrimage.js, src/ink.js; yard.js takes it, as it takes a change of
//    language's, src/relang.js), and the curtain draws back once the temple can be drawn.
// The map itself is plain here: paper, a region's name, a seal, a fog. Phase two (#450) draws the real one.
import { t, glyphs, FACE } from "./i18n.js";
import { sealStamp } from "./goshuin.js";
import { LEVELS, PLACES, DEFAULT_LEVEL } from "./level.js";
import { browserStore } from "./journey.js";
import { createPilgrimage, entriesOpen, mapEntries, createHold, keepCrossing, crossingURL, PILGRIMAGE_KEY } from "./pilgrimage.js";
import { inkClose, inkState } from "./ink.js";
import { track } from "./analytics.js";

const $ = (id) => document.getElementById(id);
const SEASON_WORD = { spring: "春", summer: "夏", autumn: "秋", winter: "冬" };

/**
 * @param {object} o
 * @param {any} o.ui the stack of what lies over the picture (src/ui.js)
 * @param {{ id: string }} o.level the temple this page walks
 * @param {boolean} [o.memory] a book seeded from `?seals=` is for that visit only, and so is what it closes: the record is then kept in memory
 * @param {() => { season: string, time: string, follow: boolean }} o.visit the season and hour of this visit, handed across
 * @param {() => void} o.stand lets go of what he is doing, as the pause menu does when it opens
 * @param {() => boolean} o.canHold whether a hold on Q may begin: the walk is his, nothing lies over it
 */
export function createPilgrimageUI({ ui, level, memory = false, visit, stand, canHold }) {
  // The temples of the map: the levels this build lists that have a name on it (PLACES). The probe level (S7: the workbench's alone) has
  // none, and is neither on the map nor a place the map is shown from.
  const listed = Object.keys(PLACES).filter((id) => Object.hasOwn(LEVELS, id)), onMap = listed.includes(level.id);
  let mem = null; const store = memory ? { get: () => mem, set: (v) => { mem = v; } } : browserStore(PILGRIMAGE_KEY);
  const rec = createPilgrimage(store, { known: listed });
  const visible = () => onMap && entriesOpen(rec.read(), listed);
  let going = false;

  // ---- what is there, once a temple has been closed ----
  const refresh = () => { document.body.classList.toggle("pilgrim", visible()); };
  addEventListener("storage", (e) => { if (e.key === PILGRIMAGE_KEY) refresh(); });   // another tab closed a temple

  // ---- the map ----
  ui.layer("pilgrim", { kind: "modal" });
  const seals = new Map();   // the seal of each temple as an image, cut when first wanted
  async function sealOf(id, seal) {
    const key = `${id}:${seal}`; if (seals.has(key)) return seals.get(key);
    const text = glyphs(seal);
    try { await document.fonts.load(`80px ${FACE.seal}`, text); } catch {}
    const url = sealStamp(text, 128, { seed: [...id].reduce((n, c) => n + c.charCodeAt(0), 3) }).toDataURL("image/png");
    seals.set(key, url); return url;
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  async function render() {
    const list = $("pilgrimList"), entries = mapEntries(rec.read(), listed, level.id, PLACES), imgs = await Promise.all(entries.map((e) => (e.state === "fog" ? null : sealOf(e.id, e.seal))));
    list.textContent = "";
    entries.forEach((e, i) => {
      const li = el("li");
      if (e.state === "fog") {
        // Not yet visited: a fog in the distance. Nothing of the temple is written here, not in the words and not in any attribute.
        const f = el("div", "fog"); f.setAttribute("role", "img"); f.setAttribute("aria-label", t("远处，雾里，还看不清")); f.append(el("i")); li.append(f);
      } else {
        const region = t(e.region), when = e.season ? t("上回 · {season}", { season: t(SEASON_WORD[e.season]) }) : "";
        const img = el("img"); img.alt = ""; img.src = /** @type {string} */ (imgs[i]); img.width = img.height = 64;
        if (e.go) {
          const b = el("button", "go"); b.type = "button"; b.dataset.to = e.id;
          b.setAttribute("aria-label", when ? t("前往{region}，{when}", { region, when }) : t("前往{region}", { region }));
          b.append(img, el("span", "region", region)); if (when) b.append(el("span", "when", when));
          b.addEventListener("click", () => go(e.id)); li.append(b);
        } else {
          const h = el("div", "here"); h.setAttribute("aria-current", "location"); h.append(img, el("span", "region", region), el("span", "mark", t("此刻在此"))); if (when) h.append(el("span", "when", when)); li.append(h);
        }
      }
      list.append(li);
    });
  }
  /** Open the map. `via` is how: menu, book, hold, hook. */
  async function open(via) {
    if (!visible()) return false;
    if (ui.isOpen("pilgrim")) return true;
    stand();
    $("pilgrimNote").textContent = "";
    ui.open("pilgrim");
    track("pilgrimage.open", { via, closed: rec.count() });
    await render();
    const first = /** @type {HTMLElement | null} */ ($("pilgrimList").querySelector(".go")) || $("pilgrimClose"); first?.focus({ preventScroll: true });
    return true;
  }
  $("pilgrimClose")?.addEventListener("click", () => ui.close("pilgrim"));
  $("menuPilgrim")?.addEventListener("click", () => open("menu"));
  $("bookMap")?.addEventListener("click", () => open("book"));

  // ---- the crossing ----
  /** Go to a temple that has been closed: the ink curtain closes, and the page opens again as that temple's. */
  async function go(to) {
    if (going || !mapEntries(rec.read(), listed, level.id, PLACES).some((e) => e.go && e.id === to)) return false;
    going = true;
    track("pilgrimage.go", { from: level.id, to });
    $("pilgrimNote").textContent = t("正在前往{region}", { region: t(PLACES[to].region) });
    const v = visit();
    keepCrossing(sessionStorage, { from: level.id, to, season: v.season, time: v.time, follow: v.follow, at: Date.now() });   // (a storage that refuses: the page opens as a visit of its own)
    await inkClose();
    while (ui.state().length) ui.close();
    location.assign(crossingURL(location.href, to, DEFAULT_LEVEL));
    return true;
  }

  // ---- a hold on Q ----
  const ring = $("pilgrimHold");
  let clock = null;   // a test holds the clock still (`__pilgrimage({ clock })`); null is the page's own
  let raf = 0;
  const hold = createHold({
    now: () => (clock === null ? performance.now() : clock),
    onProgress(p) { if (!ring) return; ring.hidden = false; ring.style.setProperty("--p", p.toFixed(3)); ring.setAttribute("aria-valuenow", String(Math.round(p * 100))); },
    onFull() { if (ring) ring.hidden = true; open("hold"); },
    onCancel() { if (ring) { ring.hidden = true; ring.style.setProperty("--p", "0"); ring.setAttribute("aria-valuenow", "0"); } },
  });
  const loop = () => { raf = 0; if (!hold.state().active) return; if (!canHold()) { hold.up(); return; } hold.tick(); if (hold.state().active) raf = requestAnimationFrame(loop); };
  addEventListener("keydown", (e) => {
    if (e.key.toLowerCase() !== "q" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    if (!visible() || !canHold() || ui.covered()) return;
    if (hold.down() && !raf) raf = requestAnimationFrame(loop);
  });
  addEventListener("keyup", (e) => { if (e.key.toLowerCase() === "q") hold.up(); });
  addEventListener("blur", () => hold.up());
  document.addEventListener("visibilitychange", () => { if (document.hidden) hold.up(); });

  refresh();

  const state = () => ({
    level: level.id, listed, record: rec.read(), visible: visible(), body: document.body.classList.contains("pilgrim"), open: ui.isOpen("pilgrim"), going,
    entries: mapEntries(rec.read(), listed, level.id, PLACES), hold: { ...hold.state(), shown: !!ring && !ring.hidden, valuenow: ring ? Number(ring.getAttribute("aria-valuenow")) : null, clock },
    ink: inkState(),
  });
  // For the tests and the debug panel: close a temple (or wipe the record), set the hold's clock, open the map, go.
  window.__pilgrimage = (o = {}) => {
    if (o.clock !== undefined) clock = o.clock;
    if (o.wipe) rec.wipe();
    if (o.mark) rec.mark(o.mark, { season: o.season });
    if (o.wipe || o.mark) refresh();
    if (o.open === true) open("hook"); else if (o.open === false) ui.close("pilgrim");
    if (o.go) go(o.go);
    return state();
  };
  return { record: rec, visible, refresh, open, go, state };
}
