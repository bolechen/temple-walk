// The visit as something to do: a title to step in from, seven small observances up the mountain, a seal for each,
// and a book that fills. journey.js keeps the book; this file puts it on the page and in the place: the rings drawn
// on the ground where an observance is made, the button that offers it, how each one unfolds, the seal that
// answers it, and the page of seals at the end. yard.js lends it the walker, the novice and the clock (`y`).
import * as THREE from "three";
import { asset } from "./assets.js";
import { workIn } from "../levels/t00/works-local.js";
import { SEAL, SEALS, createJourney, browserStore, placeAt, pickVerse, bookFrom } from "./journey.js";
import { drawGoshuin, sealStamp, sealBoxes } from "./goshuin.js";
import { chime, drop, setSeals, hush, farBell } from "./audio.js";
import { createRites } from "./rites.js";
import { placeLift } from "./site.js";
import { readPlace, writePlace, clearPlace, labelOf, titleOffer } from "./resume.js";
import { track } from "./analytics.js";
import { t, lang, glyphs } from "./i18n.js";

const $ = /** @type {(id: string) => any} */ ((id) => document.getElementById(id));

// A ring drawn in one breath of the brush, not quite closed: the mark on the ground where something may be done.
function ensoTexture() {
  const N = 512, c = document.createElement("canvas"); c.width = c.height = N; const x = c.getContext("2d");
  let s = 77; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1500; i++) {
    const t = i / 1500, a = -1.2 + t * 5.75, r = 196 + Math.sin(t * 9) * 5 + (rnd() - 0.5) * 3, w = (30 - t * 17) * (0.75 + rnd() * 0.5), dry = t > 0.62 ? rnd() * (t - 0.62) * 2.6 : 0;
    if (rnd() < dry) continue;
    x.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.5})`; x.beginPath(); x.ellipse(N / 2 + Math.cos(a) * r, N / 2 + Math.sin(a) * r, w * 0.5, 2 + rnd() * 3, a + 1.57, 0, 6.3); x.fill();
  }
  const t = new THREE.CanvasTexture(c); t.anisotropy = 4; return t;
}

export function createGame(y) {
  const Q = new URLSearchParams(location.search), places = y.site.places, fast = Q.has("fast") ? 0.12 : 1;
  // `yunjing.ending.v1` was the page's own note that the close had been seen, before the book kept it (journey.closed).
  const ENDED = "yunjing.ending.v1", seenBefore = (() => { try { return localStorage.getItem(ENDED) === "1"; } catch { return false; } })();
  // The workbench (the dev server and a pull request's preview, as for the debug panel) may open straight onto a moment:
  // ?seals=all|none|bell,tea… a book for this visit only, kept in memory, never stored; ?at=<place> stands him there;
  // ?play=ending|<observance> begins it there. The published site ignores all three.
  const BENCH = import.meta.env.DEV || /-temple-walk-preview\./.test(location.hostname);
  const seeded = BENCH ? bookFrom(Q.get("seals")) : null;
  const memoryStore = (v) => ({ get: () => v, set: (x) => { v = x; } });
  const journey = createJourney(seeded ? memoryStore(seeded) : browserStore(), undefined, { closedBefore: seeded ? false : seenBefore });
  if (seenBefore) { try { localStorage.removeItem(ENDED); } catch {} }   // the book holds it now, and forgets it on 重新朝山
  // The three sheets the visit holds out (src/ui.js): a slip of paper, a work read closely, the book. Each is put away
  // by its own button, by Esc, or by E once it has been read; the slip by Esc is still taken.
  const ui = y.ui;
  ui.layer("slip", { confirm: "slipTake" }).layer("piece", { confirm: "pieceClose" }).layer("book", { keys: { b: "bookClose" } });
  $("slipTake")?.addEventListener("click", () => ui.close("slip"));
  const holdOut = (text, from, take, onClose) => { $("slipText").textContent = text; $("slipFrom").textContent = from; $("slipTake").textContent = take; ui.open("slip", { onClose }); };
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000 * fast));
  let sat = 0, ended = 0, went = 0;
  let rite = null, near = null, entered = Q.has("shot") || Q.has("show") || Q.has("cam") || Q.has("enter");

  // The visit so far: metres walked and time on the mountain, kept between sittings like the seals.
  const VISIT = "yunjing.visit.v1", visit = { metres: 0, seconds: 0, at: null, save: 0 };
  try { const v = JSON.parse(localStorage.getItem(VISIT) || "null"); if (v && Number.isFinite(v.metres) && Number.isFinite(v.seconds)) { visit.metres = Math.max(0, v.metres); visit.seconds = Math.max(0, v.seconds); } } catch {}
  const keep = () => { try { localStorage.setItem(VISIT, JSON.stringify({ metres: Math.round(visit.metres), seconds: Math.round(visit.seconds) })); } catch {} };
  const told = () => t("这一趟走了 {m} 步，在山上 {min} 分钟。", { m: Math.round(visit.metres), min: Math.max(1, Math.round(visit.seconds / 60)) });
  // ---- On the ground: a ring at every place whose seal is still to be earned ----
  // The summit keeps its ring until the prologue has closed there, whatever else the book holds.
  // A change of season lets it close there again, once in that season (journey.closedIn).
  const season = () => y.season(), closedHere = () => journey.closedIn(season());
  journey.adopt(season());   // a close kept before seasons were belongs to the season the visitor is in now
  const owed = (id) => !journey.has(id) || (id === "sit" && !closedHere());
  // The bell and the tea may be gone back to after their seals: the bell rung again, another bowl drunk.
  const offered = (id) => owed(id) || id === "bell" || id === "tea" || (id === "incense" && !rites.incenseLit());
  const tex = ensoTexture(), rings = {};
  for (const id in places) {
    const p = places[id], w = id === "sutra" || id === "sit" ? 0.9 : 1.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    m.position.set(p.at[0], p.y ?? y.walker.heightAt(p.at[0], p.at[1]) + (p.sit && !p.lift ? 0.14 : 0.03), p.at[1]); m.rotation.y = id.length; m.renderOrder = 2; y.scene.add(m); rings[id] = m;
  }
  // The lamp the visitor lights stays lit.
  const mine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1, 2.1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }));
  mine.position.fromArray(places.lamp.flame); y.scene.add(mine);
  const refresh = () => {
    for (const id in rings) rings[id].userData.want = owed(id) && (places[id].room || null) === y.room();   // shown unless the eye is on a shot (below)
    mine.visible = journey.has("lamp");
    const n = journey.count(), next = journey.next(); setSeals(n);   // the music knows how much of its theme has been earned
    // The book is the small seal at the top left: the first character of the next place, or 圆 once the book is full;
    // how many seals are held is said to a screen reader, and to the tests.
    // In Japanese the seal is cut in Japanese forms; in English it stays the temple's own character.
    const word = next ? `下一处 · ${next.place}` : "七印圆满", mark = glyphs(next ? next.place : "圆")[0], b = $("bookBtn");
    if (b && b.dataset.word !== `${mark}${n}`) { b.dataset.word = `${mark}${n}`; b.innerHTML = `<i class="seal-mark">${mark}</i><span class="sr">${t("朱印 {n}", { n: lang === "zh" ? "〇一二三四五六七"[n] : n })}</span>`; }
    // The next place: 下一处 above its name, beside that seal.
    const g = $("goal");
    if (g && g.dataset.word !== word) { if (g.dataset.word) y.hints?.say.goal(); g.dataset.word = word; g.innerHTML = next ? `<span><small>${t("下一处")}</small>${t(next.place)}</span>` : `<span>${t("七印圆满")}</span>`; }
    // The seasons and the hours are the visitor's once the book has been filled once (src/ui.css shows what needs them).
    document.body.classList.toggle("seasons", journey.opened());
    if ($("titleSeals") && !entered) offer();
  };

  // ---- Words on the page ----
  let sayTimer = 0;
  const say = (text, secs = 5) => { const el = $("say"); if (!el) return; el.textContent = text; el.classList.add("on"); clearTimeout(sayTimer); sayTimer = setTimeout(() => el.classList.remove("on"), secs * 1000); };
  function earned(id) {
    track("demo.seal", { id, count: journey.count() });
    chime(1, journey.count()); refresh();
    const el = $("toast"), d = SEAL[id]; if (!el) return;
    $("toastSeal").src = sealStamp(glyphs(d.seal), 220, { seed: SEALS.indexOf(d) + 11 }).toDataURL(); $("toastLine").textContent = id === "sutra" && journey.verse ? t(journey.verse.text) : t(d.line); $("toastName").textContent = `${t(d.place)} · ${t(d.seal)}`;
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    // The seventh seal: the book is full. On the summit, when the prologue is about to close, that comes first and
    // the full book after it (finale); anywhere else, it is marked at once.
    const full = journey.done(), closing = id === "sit" && !closedHere();
    if (full && closing) fullAfterClose = true;
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; if (full && !closing) complete(); }, 900); if (!full) y.hints?.say.seal(); }, 4200 * Math.max(fast, 0.3));
  }
  // ---- A full book: its own seal, while the music plays the whole theme once (score.js), then the page of seals ----
  let completing = false, completed = false, fullAfterClose = false;   // fullAfterClose: the book was filled on the summit, and its seal follows the close
  function complete() {
    if (!completed) { completed = true; track("demo.complete", { count: journey.count(), seconds: Math.round(visit.seconds) }); }
    const el = $("toast"); if (completing || !el) { openBook(); return; }
    completing = true;
    $("toastSeal").src = sealStamp(glyphs("七印圆满"), 220, { seed: 29 }).toDataURL(); $("toastName").textContent = t("云径禅寺 · 七印圆满");
    $("toastLine").textContent = t("钟、香、茶、句、井、灯、坐，帐上七处都盖了印。");
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; completing = false; openBook(); }, 900); }, 6400 * Math.max(fast, 0.3));
  }

  // ---- Each observance ----
  // The incense burns for five minutes by the wall clock (`?burn=` seconds for a test), and when it was set in the ash is
  // kept, so that a reload finds it as far burnt as it would be. Burnt out, it may be offered again.
  const INCENSE = "yunjing.incense.v1", burn = Q.has("burn") ? Math.max(5, +Q.get("burn") || 300) : 300;
  const rites = createRites(y, fast, { burn, onPlant: (at) => { try { localStorage.setItem(INCENSE, String(at)); } catch {} } });
  const end = () => { rite = null; y.direct(null); y.stage(null); rites.rest(); hush(false); $("breath")?.setAttribute("hidden", ""); };
  // How one sits on the seat at a spot: on a stool as on a chair, on a cushion cross-legged (`kind` in site.seats).
  const seatPose = (at, room = null) => { const k = y.site.seats.find((s) => (s.room || null) === room && Math.hypot(s.at[0] - at[0], s.at[1] - at[1]) < 0.3); return k && k.kind === "stool" ? "chair" : "sit"; };
  async function begin(id) {
    if (rite || !places[id]) return;
    const p = places[id], d = SEAL[id]; $("act")?.setAttribute("hidden", "");
    const mineRite = (rite = /** @type {any} */ ({ id })), on = () => rite === mineRite;
    if (!(await new Promise((r) => y.walkTo([p.at], r))) || !on()) { if (on()) rite = null; return; }
    // What his hands do is rites.js's: it writes into `act`, and may move him a step (`seat`, `speed`).
    const st = { face: p.face, pose: p.sit ? seatPose(p.seat || p.at, p.room || null) : id === "well" || id === "bell" ? false : "pray", lift: p.sit ? placeLift(p, y.site.seats, y.walker.heightAt) : 0, seat: p.seat, act: rites.act, leave: () => { if (on()) end(); } };
    y.stage(st);
    // The eye leaves his shoulder for the place's own shot (src/director.js), and comes back before his hands are done.
    y.direct(id);
    if (id === "bell") {   // he takes the rope; each press after that is one pull, one stroke, counted as it sounds (below)
      await wait(0.3); if (!on()) return;
      if (!(await rites.takeRope(on))) return;
      mineRite.word = "撞钟"; mineRite.press = () => { if (rites.ready()) rites.pull(on); };
      rites.pull(on);   // the press that brought him here is the first stroke
      y.hints?.tip("rope", y.hints.coarse ? t("再点「撞钟」撞下一下　·　推圆盘走开，就松了绳") : t("<kbd>E</kbd>再撞一下，钟槌荡回来才拉得动　·　走开或<kbd>Esc</kbd>松手"), 9);
      return;   // he holds the rope until the visitor walks him away
    }
    if (id === "tea") {
      await wait(1.6); if (!on()) return; if (!(await rites.drinkTea(on, () => say(t(d.line), 6)))) { if (!on()) return; say(t(d.line), 6); await wait(3); } await wait(0.8); if (!on()) return;
      if (journey.earn("tea")) earned("tea");
      // And he sits on, the bowl steaming beside him, until the visitor stands him up.
      mineRite.word = "起身"; mineRite.press = () => y.leave(); hush(true); lingering = true;
      y.hints?.tip("linger", y.hints.coarse ? t("点「起身」或推圆盘，就站起来走　·　也可以一直坐着") : t("<kbd>E</kbd>起身　·　也可以一直坐着，看看院子"), 8);
      await rites.linger(on); lingering = false; return;
    }
    else if (id === "incense") { await wait(1.2); if (!on()) return; if (!(await rites.offerIncense(on, st, () => say(t(d.line), 6)))) { if (!on()) return; say(t(d.line), 6); await wait(3); } }
    else if (id === "well") { say(t(d.line), 6); if (!(await rites.watchWell(on, () => drop()))) return; }
    else if (id === "lamp") { if (!(await rites.lightLamp(on, () => { mine.visible = true; say(t(d.line), 5); }))) return; }
    else if (id === "sit") {
      const b = $("breath"); b?.removeAttribute("hidden");
      for (let i = 0; i < 3; i++) { if (b) { b.dataset.phase = "in"; $("breathWord").textContent = t("吸"); } if (!(await rites.breathe(1, 4, on))) return; if (b) { b.dataset.phase = "out"; $("breathWord").textContent = t("呼"); } if (!(await rites.breathe(-1, 5, on, i === 2 && closedHere()))) return; }
      b?.setAttribute("hidden", ""); say(t(d.line), 6);
    } else if (id === "sutra") {
      await wait(1.6); if (!on()) return;
      const day = Math.floor(Date.now() / 864e5), verse = pickVerse(Q.has("seed") ? +Q.get("seed") : day + (journey.born % 97));
      await new Promise((r) => { mineRite.take = () => ui.close("slip"); holdOut(t(verse.text), t(verse.from), t("收下"), r); }); if (!on()) return;
      if (journey.earn("sutra", { verse })) earned("sutra"); end(); return;
    }
    if (!on()) return;
    const fresh = journey.earn(id); if (fresh) earned(id);
    // The prologue closes here the first time he has sat and breathed on the summit, whatever else is in the book.
    if (id === "sit" && !closedHere()) { await wait(fresh ? 4.6 : 1.5); if (on()) await finale(on); if (on()) rite = null; return; }
    if (p.sit) { rite = null; return; }   // he stays seated until he is sent somewhere
    await wait(1.2); if (on()) end();
  }
  // ---- A seat: any cushion or stool may be sat on. He goes over to it and stays until he is sent elsewhere. ----
  async function sitDown(s) {
    if (rite) return; $("act")?.setAttribute("hidden", "");
    const mine = (rite = /** @type {any} */ ({ id: "seat" })), on = () => rite === mine;
    // He walks up to it first: to the nearest ground he can stand on, on his own side of it.
    const w = y.where(), dx = w.x - s.at[0], dz = w.z - s.at[1], d = Math.hypot(dx, dz) || 1; let to = null;
    for (let r = 0.25; r <= d && !to; r += 0.05) { const x = s.at[0] + (dx / d) * r, z = s.at[1] + (dz / d) * r; if (!y.walker.blocked(x, z)) to = [x, z]; }
    if (to && Math.hypot(to[0] - w.x, to[1] - w.z) > 0.08) { await Promise.race([new Promise((r) => y.walkTo([to], r)), wait(4)]); if (!on()) return; }
    rite = null; const here = y.where();
    y.stage({ face: s.face, pose: s.kind === "stool" ? "chair" : "sit", lift: Math.max(0.02, s.top - y.walker.heightAt(here.x, here.z)), seat: s.at, act: rites.act, leave() { rites.rest(); } }); sat++;
  }
  // ---- The close of the chapter: shown once, when the last seal is earned on the summit ----
  // The eye leaves him and the closing words are said one at a time (rites.close moves the eye); then the title of what
  // has ended, and the book. This temple is only the prologue, where a visitor learns how the walk goes: the words
  // say so, and leave something unanswered for the chapter that is not yet made. A click, a tap or Esc passes over it.
  // The words answer what this visitor did on the way up, and nothing they did not: the steps from the bamboo, the
  // observances in the order they were made (the bell by its strokes), the library's line if one was taken. Then the
  // road beyond the gate, and a bell in the far hills, for the chapter not yet made.
  // Each clause is a whole line in every language, and how clauses are strung together is a line too (`{a}，{b}。`).
  const DEEDS = { bell: (n) => [t("钟楼的钟，撞过一下"), t("钟楼的钟，撞过两下"), t("钟楼的钟，撞过三下")][n - 1], incense: () => t("大殿的炉里插着三支香"), tea: () => t("茶寮那碗茶喝到了底"), well: () => t("龙井边等过三声滴水"), lamp: () => t("观音殿前多了一盏灯") };
  // Which line carries the far bell: the sound comes with it (audio.js).
  let bellLine = -1;
  function closingWords() {
    const lines = [], steps = Math.round(visit.metres);
    lines.push(steps >= 50 ? t("从竹林到这里，走了 {n} 步。", { n: steps }) : t("从竹林一路走上来。"));
    const done = journey.list().filter((s) => DEEDS[s.id] && (s.got || (s.id === "bell" && journey.strikes > 0))).sort((a, b) => (a.got || Infinity) - (b.got || Infinity));
    const said = done.slice(0, 3).map((s) => DEEDS[s.id](s.id === "bell" ? journey.strikes : 1)), [a, b, c] = said;
    const more = done.length > 3 ? [t("别处也停过一回"), t("别处也停过两回"), t("别处也停过三回"), t("别处也停过四回")][done.length - 4] : "";
    lines.push(!said.length ? t("路上哪里也没停，就到了这里。") : more ? t("{a}，{b}，{c}；{more}。", { a, b, c, more }) : said.length === 3 ? t("{a}，{b}，{c}。", { a, b, c }) : said.length === 2 ? t("{a}，{b}。", { a, b }) : t("{a}。", { a }));
    if (journey.verse) lines.push(t("藏经楼给的那一句，还记着：「{verse}」", { verse: t(journey.verse.text) }));
    lines.push(t("山门之外，还有一条没走过的路。"));
    bellLine = lines.length;
    lines.push(journey.strikes > 0 ? t("远处的山里，好像也有一声钟，应了你那几下。") : t("远处的山里，好像有一声钟，响了一下。"));
    const from = 3.5, to = 23.5, gap = (to - from) / lines.length;
    return /** @type {[number, string][]} */ (lines.map((l, i) => [from + i * gap, l]));
  }
  let closing = false, skip = false, /** @type {string[]} */ words = [];
  async function finale(on = () => true) {
    const el = $("ending"); if (closing || !el) { openBook(); return; }
    closing = true; skip = false; document.body.classList.add("ending"); el.hidden = false; $("endingTitle").classList.remove("on");
    const line = $("endingLine"), CLOSING = closingWords(); let shown = -1; words = CLOSING.map((c) => c[1]);
    const pass = () => { skip = true; }; el.addEventListener("click", pass); const key = (e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); pass(); } }; window.addEventListener("keydown", key, true);
    await rites.close(() => on() && !skip, (t) => {
      let k = -1; for (let i = 0; i < CLOSING.length; i++) if (t >= CLOSING[i][0]) k = i;
      if (t > 25.5) { line.classList.remove("on"); $("endingTitle").classList.add("on"); }
      else if (k !== shown) {
        shown = k; line.classList.remove("on"); setTimeout(() => { line.textContent = CLOSING[k][1]; line.classList.add("on"); }, 500 * fast);
        // When it is said that a bell answers in the far hills, it is heard (audio.js).
        if (k >= 0 && k === bellLine) farBell();
      }
    });
    el.removeEventListener("click", pass); window.removeEventListener("keydown", key, true);
    line.classList.remove("on"); $("endingTitle").classList.remove("on"); el.hidden = true; document.body.classList.remove("ending"); closing = false; ended++;
    // Seen, or passed over: either way it is not shown again in this season. The seals left over can still be earned.
    // When it is seen again in another season, the full book's seal is not shown again: only the book opens.
    if (journey.close(season())) track("demo.ending", { skipped: skip, count: journey.count(), seconds: Math.round(visit.seconds) });
    refresh(); if (fullAfterClose) { fullAfterClose = false; complete(); } else openBook();
  }
  window.addEventListener("struck", (e) => {
    if (/** @type {CustomEvent} */ (e).detail !== "bell" || journey.has("bell")) return;
    const r = journey.strike(); say(["", t("一下"), t("两下"), t("三下")][r.strikes] || "", 3);
    // The third stroke, the first time on this walk: the birds in the old trees beyond the wall go up (yard.js, flock.js).
    if (r.earned) { earned("bell"); window.dispatchEvent(new CustomEvent("flush")); } else refresh();
  });
  window.addEventListener("incense-offered", () => { if (journey.earn("incense")) earned("incense"); });

  // ---- The button that offers what can be done here ----
  let acc = 0, look = null, seatHere = null, wasIndoors = false, lingering = false, summitSaid = false; const seen = new Set();
  y.onTick((dt) => {
    // The marker toward the next place rides the picture every frame, but only while the goal is being shown.
    { const el = $("way"), g = $("goal"), next = journey.next(), p = next && places[next.id];
      if (el) { const show = !!(p && g && g.classList.contains("on") && entered && (p.room || null) === y.room() && !rite);
        el.classList.toggle("on", show);
        if (show) { const w = y.where(), py = p.y ?? y.walker.heightAt(p.at[0], p.at[1]), sc = y.screenOf(p.at[0], py + 1.6, p.at[1]), m = 46;
          let sx = sc.x, sy = sc.y; if (sc.behind) { sx = sc.w - sx; sy = sc.h - m; }
          sx = Math.min(sc.w - m, Math.max(m, sx)); sy = Math.min(sc.h - m * 2.4, Math.max(m * 1.6, sy));
          el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`; el.lastChild.textContent = t("{n} 步", { n: Math.max(1, Math.round(Math.hypot(p.at[0] - w.x, p.at[1] - w.z))) }); } } }
    // How long this visit has been and how far it has gone: told on the last page of the book.
    { const w = y.where(); if (entered) { if (visit.at) { const d = Math.hypot(w.x - visit.at[0], w.z - visit.at[1]); if (d < 3) visit.metres += d; } visit.at = [w.x, w.z]; visit.seconds += dt; if ((visit.save += dt) > 10) { visit.save = 0; keep(); } } }
    // The brush rings on the ground are a mark for the walk, not part of the place: on an observance's own shot they are not drawn.
    { const shot = y.directed(); for (const id in rings) rings[id].visible = !!rings[id].userData.want && !shot; }
    for (const id in rings) if (rings[id].visible) rings[id].material.opacity = (0.5 + 0.22 * Math.sin(performance.now() / 900 + id.length)) * (y.night() ? 0.9 : 0.75), rings[id].material.color.setScalar(1).multiply(y.night() ? new THREE.Color(1, 0.86, 0.6) : new THREE.Color(0.06, 0.05, 0.045));
    const nowT = performance.now(); if (nowT - acc < 180) return; acc = nowT;   // a few times a second is enough
    const w = y.where(), free = entered && !rite && !y.busy(), indoors = y.inside();
    const room = y.room(), here = free ? placeAt(Object.fromEntries(Object.entries(places).filter(([, p]) => (p.room || null) === room)), w.x, w.z) : null;
    near = here && offered(here) && !(here === "sit" && y.staged()) ? here : null;
    if (near === "sit" && !closedHere() && !summitSaid) { summitSaid = true; say(t("凌霄阁前这只蒲团，朝着来时的路。"), 6); }
    // Indoors, standing before a frame on the wall offers a look at what hangs there.
    look = free && indoors && !near ? placeAt(Object.fromEntries(Object.entries(y.gallery).filter(([, p]) => p.room === room)), w.x, w.z) : null;
    // A cushion or a stool within a step or two, when nothing else is offered here and he is not already seated.
    seatHere = null;
    if (free && !near && !look && !y.staged()) { let best = 1.5; for (const s of y.site.seats) { if ((s.room || null) !== room) continue; const d = Math.hypot(s.at[0] - w.x, s.at[1] - w.z); if (d < best) { best = d; seatHere = s; } } }
    const b = $("act"); if (!b) return;
    // While he holds the rope or sits on over his tea the button is what he may do next; seated anywhere, it stands him up.
    const held = rite && rite.press && entered && !y.busy() ? rite.word : null, rise = !held && !near && !look && !seatHere && free && y.seated();
    if (held || near || look || seatHere || rise) {
      const w = held || (near ? SEAL[near].act : look ? "观看" : seatHere ? "坐下" : "起身");
      if (b.dataset.word !== w || !b.firstChild) { b.dataset.word = w; b.innerHTML = `<i class="enso"><kbd>E</kbd></i><span>${t(w)}</span>`; }
      b.classList.toggle("wait", held === "撞钟" && !rites.ready()); b.hidden = false;
    } else b.hidden = true;
    if (indoors !== wasIndoors) { wasIndoors = indoors; refresh(); if (indoors) say(room === "main" && !journey.has("incense") ? t("走到佛前的圆相里，上一炷香。") : t(y.hallName()), 5); }
  });
  $("act")?.addEventListener("click", () => {
    if (rite && rite.press) return rite.press();
    if (near) return begin(near);
    if (!look) { if (seatHere) sitDown(seatHere); else if (y.seated()) y.leave(); return; }
    const it = y.gallery[look].item; y.stage({ face: y.gallery[look].face, pose: false, lift: 0, leave() {} });
    if (it.work) return showWork(it.work, look);
    const spot = look; holdOut(t(it.title), t(it.text), t("看过了"), () => { y.stage(null); seen.add(spot); });
  });

  // ---- A work on the wall, read closely: the picture, and beside it what an encyclopedia would say ----
  function showWork(slug, spot) {
    const w = workIn(slug), el = $("piece"); if (!w || !el) return;
    $("pieceImg").src = asset(`levels/t00/gallery/${slug}.webp`); $("pieceImg").alt = w.title;
    $("pieceTitle").textContent = w.title; $("pieceBy").textContent = [w.by, w.dates].filter(Boolean).join(lang === "en" ? " · " : "　");
    // The facts and the note in the visitor's language (levels/t00/works-local.js); the museum's source line stays as published.
    $("pieceFacts").innerHTML = [["年代", w.period], ["质地", w.medium], ["尺寸", w.size && t("{size} 厘米", { size: w.size })], ["收藏", w.holder + (w.rank ? (lang === "en" ? "; " : "　") + w.rank : "")]].filter(([, v]) => v).map(([k, v]) => `<dt>${t(k)}</dt><dd>${v}</dd>`).join("");
    $("pieceNote").textContent = w.note; $("pieceLink").textContent = w.link; $("pieceCredit").textContent = w.credit;
    ui.open("piece", { onClose: () => { y.stage(null); seen.add(spot); } });
  }
  $("pieceClose")?.addEventListener("click", () => ui.close("piece"));
  window.__work = (slug) => (slug ? showWork(slug, null) : { open: ui.isOpen("piece"), title: $("pieceTitle")?.textContent, loaded: !!$("pieceImg")?.naturalWidth });

  // ---- The book ----
  // Once the book has been filled, the line at the foot of the view says once, ever, that the seasons are open.
  const announce = () => { if (entered && journey.opened() && !journey.told() && y.hints?.say.seasons?.()) journey.tell(); };
  let page = null;
  async function openBook() {
    const m = y.mood(), next = journey.next();
    page = await drawGoshuin({ seals: journey.list(), verse: journey.verse, when: journey.finished || Date.now(), label: m.label.split(" · ").map(glyphs).join(" · "), url: location.host + location.pathname.replace(/\/$/, "") });
    const blob = await new Promise((r) => page.toBlob(r, "image/jpeg", 0.92)), url = URL.createObjectURL(blob);
    $("bookImg").src = url; $("bookSave").href = url; $("bookSave").download = t("云径禅寺-朱印.jpg");
    const blank = SEALS.length - journey.count();
    $("bookHint").textContent = next ? `${journey.closed ? t("帐上还空着{n}处。", { n: "〇一二三四五六七"[blank], k: blank }) : ""}${t(next.hint)}　${told()}` : `${t("七印圆满。这一页可以存下来，也可以分享。时节已开，留影与歇脚里可选。")}${told()}`;
    const file = new File([blob], "yunjing-seals.jpg", { type: "image/jpeg" });
    $("bookShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] })); $("bookShare").onclick = async () => { try { await navigator.share({ files: [file], title: t("云径禅寺 · 朱印") }); } catch {} };
    // A seal that has been earned is also the way back to where it was earned: a button lies over each on the page.
    const leaf = $("bookPage"), boxes = sealBoxes(SEALS.length);
    if (leaf) { leaf.querySelectorAll(".seal-go").forEach((b) => b.remove());
      SEALS.forEach((d, i) => { if (!journey.has(d.id) || !places[d.id]) return; const b = document.createElement("button"), [l, top, w, h] = boxes[i];
        b.type = "button"; b.className = "seal-go"; b.dataset.id = d.id; b.setAttribute("aria-label", t("回到{place}", { place: t(d.place) })); b.title = t("回到{place}", { place: t(d.place) });
        b.style.cssText = `left:${(l * 100).toFixed(2)}%;top:${(top * 100).toFixed(2)}%;width:${(w * 100).toFixed(2)}%;height:${(h * 100).toFixed(2)}%`;
        b.addEventListener("click", () => goBack(d.id)); leaf.appendChild(b); });
      if (journey.count() && $("bookGo")) $("bookGo").hidden = false; }
    $("bookReset").textContent = t("重新朝山"); $("bookReset").dataset.asked = ""; ui.open("book", { onClose: announce });
  }
  // Back to where a seal was earned: the book closes, the eyes close, and he stands there again.
  async function goBack(id) {
    const p = places[id], d = SEAL[id]; if (!p || !journey.has(id) || rite || closing) return;
    ui.close("book"); if (await y.travel(p.at[0], p.at[1], Math.PI - p.face, p.room || null)) { went++; say(t("回到{place}。", { place: t(d.place) }), 4); }
  }
  window.__goBack = (id) => goBack(id);
  $("bookBtn")?.addEventListener("click", openBook);
  $("bookClose")?.addEventListener("click", () => ui.close("book"));
  $("bookReset")?.addEventListener("click", (e) => { const b = /** @type {HTMLElement} */ (e.currentTarget); if (b.dataset.asked !== "1") { b.dataset.asked = "1"; b.textContent = t("再点一次，清空朱印"); return; } track("demo.restart", { from: "book", seals: journey.count() }); journey.reset(); visit.metres = visit.seconds = 0; keep(); refresh(); ui.close("book"); });

  // ---- The title ----
  const title = $("title");
  // ---- Coming back: where he was is kept from moment to moment, and the title offers to go on from there ----
  // A first visit is offered only 入山. A visitor who has a seal, or left from somewhere up the mountain, is offered to
  // go on (接着走) from where they were, or to begin again (从头走起, asked twice: it empties the book).
  const named = SEALS.filter((d) => places[d.id] && !places[d.id].room).map((d) => ({ place: d.place, at: places[d.id].at }));
  const free = !(Q.has("cam") || Q.has("show") || Q.has("shot") || Q.has("in") || Q.has("tour") || Q.has("enter") || (BENCH && (Q.has("at") || Q.has("play") || Q.has("seals"))));   // a tool or a test that names its own place is left where it asked to be
  let left = free ? readPlace(localStorage) : null, kept = 0;
  if (left && y.walker.blocked(left.x, left.z)) left = null;
  const offer = () => {
    const o = titleOffer(journey.count(), SEALS.length, left, y.start), b = $("enterBtn"), again = $("againBtn");
    $("titleSeals").textContent = o.line || (journey.count() === SEALS.length ? t("七印圆满 · 山门常开") : "");
    if (b && !b.disabled) b.textContent = o.enter;
    if (again) { again.hidden = !o.going || b.disabled; if (again.dataset.asked !== "1") again.textContent = o.again; }
    return o;
  };
  if (left && titleOffer(journey.count(), SEALS.length, left, y.start).going) y.place(left.x, left.z, left.yaw);   // the title is shown over where they were
  const keepPlace = () => { if (!entered || !free || closing) return; const w = y.where(); if (!y.inside() && y.walker.blocked(w.x, w.z)) return; writePlace(localStorage, { ...w, label: labelOf(w, y.inside() ? y.hallName() : null, named) }); };
  y.onTick((dt) => { if ((kept += dt) > 2) { kept = 0; keepPlace(); } });
  window.addEventListener("pagehide", keepPlace); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") keepPlace(); });
  $("againBtn")?.addEventListener("click", (e) => {
    const b = /** @type {HTMLElement} */ (e.currentTarget);
    if (b.dataset.asked !== "1") { b.dataset.asked = "1"; b.textContent = titleOffer(journey.count(), SEALS.length, left, y.start).confirm; return; }
    track("demo.restart", { from: "title", seals: journey.count() });
    journey.reset(); visit.metres = visit.seconds = 0; keep(); clearPlace(localStorage); left = null; b.dataset.asked = "";
    const [x, z, turn] = y.start; y.place(x, z, turn); refresh(); rites.rest(); enter();
  });
  const enter = () => {
    if (entered) return;
    track("demo.enter", { resumed: !!(left && titleOffer(journey.count(), SEALS.length, left, y.start).going), seals: journey.count(), tier: y.tier || "" });
    entered = true; title?.classList.add("gone"); setTimeout(() => title && (title.hidden = true), 1600); y.listen(); document.body.classList.add("entered"); const n = journey.next(); if (n) say(t(n.hint), 8); setTimeout(announce, 14000 * fast);   // after the first line about walking has gone
  };
  if (title) { if (entered) { title.hidden = true; document.body.classList.add("entered"); } else { $("enterBtn").addEventListener("click", enter); const ready = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(ready); $("enterBtn").disabled = false; offer(); } }, 200); } }
  // ?show=shot-<id>: the observance begun where he stands, with the eye already on its shot (tools/shots.js).
  // He is put as the observance has him (seated for the tea and the summit, at the rope for the bell, his palms together
  // elsewhere), not taken through it, so that the picture is the same however slowly the page draws.
  function pose(id) {
    const p = places[id]; if (!p || rite) return false;
    const mineRite = (rite = /** @type {any} */ ({ id, posed: true })), on = () => rite === mineRite;
    y.stage({ face: p.face, pose: p.sit ? seatPose(p.seat || p.at, p.room || null) : id === "well" || id === "bell" ? false : "pray", lift: p.sit ? placeLift(p, y.site.seats, y.walker.heightAt) : 0, seat: p.seat, act: rites.act, leave: () => { if (on()) end(); } });
    if (id === "bell") rites.takeRope(on);
    if (id === "lamp") mine.visible = true;
    return y.direct(id, { now: true });
  }
  window.__poseRite = (id) => pose(id);
  { const want = (Q.get("show") || "").replace(/^shot-/, ""); if (want && want !== Q.get("show") && places[want]) { const go = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(go); pose(want); } }, 100); } }
  refresh(); rites.restore({ incenseAt: (() => { try { return Number(localStorage.getItem(INCENSE)) || 0; } catch { return 0; } })() });

  // ---- The workbench: straight to a place, and straight into what happens there (see BENCH above) ----
  const goTo = BENCH ? Q.get("play") === "ending" ? "sit" : Q.get("at") || Q.get("play") : null;
  if (goTo && places[goTo]) (async () => {
    const p = places[goTo];
    while (document.body.dataset.ready !== "1") await wait(0.2);
    enter();
    await y.travel(p.at[0], p.at[1], Math.PI - p.face, p.room || null);
    await wait(0.6);
    const play = Q.get("play");
    if (play === "ending") {   // he sits on the summit mat, and the close plays
      const s = y.site.seats.find((k) => k.room === null && Math.hypot(k.at[0] - p.at[0], k.at[1] - p.at[1]) < 0.3);
      if (s) await sitDown(s); await wait(1); finale();
    } else if (play && SEAL[play]) begin(play);
  })();

  // For the tests.
  window.__journey = () => { const n = journey.next(); return { rings: Object.values(rings).filter((m) => m.visible).length, look, seen: [...seen], ...journey.snapshot(), count: journey.count(), total: journey.total, done: journey.done(), earned: journey.list().filter((d) => d.got).map((d) => d.seal), near, rite: rite && rite.id, entered, next: n?.id || null, nextPlace: n?.place || null, nextSeal: n?.seal || null, lampLit: mine.visible, book: page ? [page.width, page.height] : null }; };
  window.__hush = (on) => { hush(on); };   // the music held back as when he sits on after tea, or let back
  window.__rites = () => ({ ...rites.state(), seat: seatHere ? { at: seatHere.at, room: seatHere.room } : null, sat, ended, went, closing, words, him: y.monk.group.position.toArray().map((v) => +v.toFixed(3)), line: $("endingLine")?.textContent || "" });
  window.__seats = y.site.seats; window.__sit = (i) => sitDown(y.site.seats[i]); window.__ending = () => finale();
  window.__left = () => ({ place: readPlace(localStorage), offer: titleOffer(journey.count(), SEALS.length, left, y.start), again: !!$("againBtn") && !$("againBtn").hidden });
  window.__visit = () => ({ metres: visit.metres, seconds: visit.seconds });
  window.__places = places; window.__rite = (id) => begin(id); window.__enter = enter; window.__book = openBook;
  window.__take = () => rite && rite.take && rite.take();
  return { near: () => near, rite: () => rite && rite.id };
}
