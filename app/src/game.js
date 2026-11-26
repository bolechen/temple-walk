// The visit as something to do: a title to step in from, seven small observances up the mountain, a seal for each,
// and a book that fills. journey.js keeps the book; this file puts it on the page and in the place: the rings drawn
// on the ground where an observance is made, the button that offers it, how each one unfolds, the seal that
// answers it, and the page of seals at the end. yard.js lends it the walker, the novice and the clock (`y`).
import * as THREE from "three";
import { asset } from "./assets.js";
import { workIn } from "../levels/t00/works-local.js";
import { incenseHall, readIncense, writeIncense } from "./incense.js";
import { SEAL, SEALS, VERSES, createJourney, browserStore, placeAt, pickVerse, bookFrom, visitLine } from "./journey.js";
import { drawGoshuin, sealStamp, sealBoxes } from "./goshuin.js";
import { chime, coin, coinsHeard, drop, setSeals, hush, farBell, mountainBell, prologueNote, holdMusic, closeMusic, passClose, awaitTitle } from "./audio.js";
import { openingFor, atGate } from "./opening.js";
import { shareOrSave, countDownload } from "./share.js";
import { fromOf } from "./sharelink.js";
import { createRites } from "./rites.js";
import { createPresence, presenceOn, readDay } from "./presence.js";
import { traceStubCount } from "./censer.js";
import { createAwake } from "./awake.js";
import { placeLift } from "./site.js";
import { readPlace, writePlace, clearPlace, labelOf, titleOffer, placeKept } from "./resume.js";
import { readLevelPlace, writeLevelPlace, clearLevelPlace, clearLevelPage } from "./levelsave.js";
import { createLevelPage } from "./levelpage.js";
import { drawStroke, seeded as seededRun } from "./pagework.js";
import { track } from "./analytics.js";
import { titleHow } from "./titlehow.js";
import { t, lang, glyphs, FONT, numeral, sealCount } from "./i18n.js";
import { saidNow, stemNow } from "./temple.js";
import { moodOf } from "./mood.js";
import { WEB } from "./channel.js";
import { WISHES, decodeLamp, lampLink } from "./wishes.js";
import { drawLampCard, fitLines } from "./lampcard.js";
import { processedLine } from "./credits.js";
import { createJoya } from "./joya-ui.js";
import { createPilgrimageUI } from "./pilgrimage-ui.js";
import { createHoldRing } from "./holdring.js";

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
  const awake = createAwake();   // the screen is asked to stay on while the close is played (src/awake.js)
  // `yunjing.ending.v1` was the page's own note that the close had been seen, before the book kept it (journey.closed).
  const ENDED = "yunjing.ending.v1", seenBefore = (() => { try { return localStorage.getItem(ENDED) === "1"; } catch { return false; } })();
  // The workbench (the dev server and a pull request's preview, as for the debug panel) may open straight onto a moment:
  // ?seals=all|none|bell,tea… a book for this visit only, kept in memory, never stored; ?at=<place> stands him there;
  // ?play=ending|<observance> begins it there. The published site ignores all three.
  const BENCH = import.meta.env.DEV || /-temple-walk-preview\./.test(location.hostname);
  const seeded = BENCH ? bookFrom(Q.get("seals")) : null;
  const memoryStore = (v) => ({ get: () => v, set: (x) => { v = x; } });
  // The book, the visit's metres and the close's old note under yunjing.* are the prologue's. Another level (T05, which
  // testers walk on the canary since the owner's change of 2026-11-21) neither reads nor writes them: it holds an empty
  // book in memory for the visit and keeps no metres, so that walking it neither shows the prologue's seals nor adds to
  // its walk. A level says it is the prologue's by keeping the prologue's place (keepsPlace, #385), until each level
  // keeps records of its own.
  const ours = !y.level || !!y.level.keepsPlace;
  const journey = createJourney(seeded ? memoryStore(seeded) : ours ? browserStore() : memoryStore(null), undefined, { closedBefore: seeded || !ours ? false : seenBefore });
  if (seenBefore && ours) { try { localStorage.removeItem(ENDED); } catch {} }   // the book holds it now, and forgets it on 重新朝山
  // The three sheets the visit holds out (src/ui.js): a slip of paper, a work read closely, the book. Each is put away
  // by its own button, by Esc, or by E once it has been read; the slip by Esc is still taken.
  const ui = y.ui;
  // 行脚图 (#449): the temples whose close has been played, and the three ways to the map of them (the pause menu, the book, a
  // hold on Q). The record is the visitor's, apart from every book: 从头走起 empties a book and never this. A book seeded
  // from ?seals= is for that visit only, and so is what it closes.
  const levelId = y.level?.id || "t00";
  const pilgrims = createPilgrimageUI({
    ui, level: { id: levelId }, memory: !!seeded, visit: y.visit, stand: () => y.leave(),
    canHold: () => entered && !closing && !completing && !y.openingActive() && !ui.isOpen("photo"),
  });
  ui.layer("slip", { confirm: "slipTake" }).layer("bless", { kind: "modal" }).layer("piece", { confirm: "pieceClose" }).layer("book", { keys: { b: "bookClose" } }).layer("bookMore", { kind: "modal", confirm: "bookMoreClose" });
  $("slipTake")?.addEventListener("click", () => ui.close("slip"));
  // A slip is written down the page, and a long line in a short window (a phone on its side) would run to more columns than the
  // screen is wide. It is fitted when it opens (#203): the same layout with smaller writing, down to 14 px, and only if that
  // will not do, laid flat as English is, with smaller writing again; the first that lies whole on the screen is taken.
  function fitSlip() {
    const sheet = $("slip"), paper = sheet.querySelector(".paper"), take = $("slipTake");
    const fits = () => { const W = innerWidth, H = innerHeight, p = paper.getBoundingClientRect(), b = take.getBoundingClientRect();
      return p.left >= 0 && p.right <= W && p.top >= 0 && p.bottom <= H && b.bottom <= H && document.documentElement.scrollWidth <= W; };
    for (const flat of [false, true]) {
      sheet.classList.toggle("flat", flat);
      for (const px of [null, 24, 21, 18, 16, 14]) {
        if (px) { sheet.style.setProperty("--slip-fs", px + "px"); sheet.style.setProperty("--slip-from", Math.min(19, px) + "px"); } else { sheet.style.removeProperty("--slip-fs"); sheet.style.removeProperty("--slip-from"); }
        if (fits()) return;
      }
    }
  }
  // The paper is fitted again if the screen changes while it is open (a phone turned over); put away, it is not minded.
  addEventListener("resize", () => { if (ui.isOpen("slip")) fitSlip(); });
  const holdOut = (text, from, take, onClose) => { $("slipText").textContent = text; $("slipFrom").textContent = from; $("slipTake").textContent = take; ui.open("slip", { onClose }); fitSlip(); };
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000 * fast));
  let sat = 0, ended = 0, went = 0;
  let rite = null, near = null, entered = Q.has("shot") || Q.has("show") || Q.has("cam") || Q.has("enter") || !!y.relang || !!y.crossing;   // (a page opened by a change of language goes on where it was, #140; one opened by a crossing from another temple is already in, at its start, #449)
  // How long this page has been open, for the leave event: not the visit, which is kept between sittings.
  const openedAt = performance.now();

  // The visit so far: metres walked and time on the mountain, kept between sittings like the seals.
  const VISIT = "yunjing.visit.v1", visit = { metres: 0, seconds: 0, at: null, save: 0 };
  try { const v = ours ? JSON.parse(localStorage.getItem(VISIT) || "null") : null; if (v && Number.isFinite(v.metres) && Number.isFinite(v.seconds)) { visit.metres = Math.max(0, v.metres); visit.seconds = Math.max(0, v.seconds); } } catch {}
  const keep = () => { if (!ours) return; try { localStorage.setItem(VISIT, JSON.stringify({ metres: Math.round(visit.metres), seconds: Math.round(visit.seconds) })); } catch {} };
  const told = () => { const l = visitLine(visit.metres, visit.seconds); return !l ? "" : l.under ? t("这一趟走了 {m} 步，在山上不到一分钟。", { m: l.m }) : t("这一趟走了 {m} 步，在山上 {min} 分钟。", { m: l.m, min: l.min }); };
  // ---- On the ground: a ring at every place whose seal is still to be earned ----
  // The summit keeps its ring until the prologue has closed there, whatever else the book holds.
  // A change of season lets it close there again, once in that season (journey.closedIn).
  const season = () => y.season(), closedHere = () => journey.closedIn(season());
  journey.adopt(season());   // a close kept before seasons were belongs to the season the visitor is in now
  // A close played before the record was kept is carried into it, at the time it was (a seeded book closes nothing for good).
  if (ours && !seeded && journey.closed && !pilgrims.record.has(levelId)) { pilgrims.record.mark(levelId, { season: journey.closedSeason, at: journey.closed }); pilgrims.refresh(); }
  const owed = (id) => !!SEAL[id] && (!journey.has(id)) || (id === "sit" && !closedHere());
  // The bell and the tea may be gone back to after their seals: the bell rung again, another bowl drunk.
  const offered = (id) => !!lp?.offers(id) || owed(id) || (id === "lamp" && journey.has("lamp")) || id === "bell" || id === "tea" || (incenseHall(id) !== null && !rites.incenseLit(/** @type {string} */ (incenseHall(id))));
  const tex = ensoTexture(), rings = {};
  for (const id in places) {
    const p = places[id], w = id === "sutra" || id === "sit" ? 0.9 : 1.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    m.position.set(p.at[0], p.y ?? y.walker.heightAt(p.at[0], p.at[1]) + (p.sit && !p.lift ? 0.14 : 0.03), p.at[1]); m.rotation.y = id.length; m.renderOrder = 2; y.scene.add(m); rings[id] = m;
  }
  // The lamp the visitor lights stays lit.
  const mine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1, 2.1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }));
  if (places.lamp) { mine.position.fromArray(places.lamp.flame); y.scene.add(mine); }   // (a level with no lamp to light has none, #409)
  const refresh = () => {
    for (const id in rings) rings[id].userData.want = owed(id) && (places[id].room || null) === y.room();   // shown unless the eye is on a shot (below)
    mine.visible = journey.has("lamp");
    const n = journey.count(), next = journey.next(); setSeals(n); if (n > 0) y.hints?.say.stamped();   // the music knows how much of its theme has been earned
    // The book is the small seal at the top left: the first character of the next place, or 圆 once the book is full;
    // how many seals are held is said to a screen reader, and to the tests.
    // In Japanese the seal is cut in Japanese forms; in English it stays the temple's own character.
    const word = next ? `下一处 · ${next.place}` : "七印圆满", mark = glyphs(next ? next.place : "圆")[0], b = $("bookBtn");
    // Beside it, small, in ink: how many seals are held out of seven ("三 / 七", #651). The visible line is hidden from a screen
    // reader, which hears the same once, in words, from the span after it.
    if (b && b.dataset.word !== `${mark}${n}${lang}`) { b.dataset.word = `${mark}${n}${lang}`; b.innerHTML = `<i class="seal-mark">${mark}</i><span class="seal-count" aria-hidden="true">${sealCount(n, SEALS.length)}</span><span class="sr">${t("朱印 {n}枚，共{total}枚", { n: numeral(n), total: numeral(SEALS.length) })}</span>`; }
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
  // The year-end bell (#341): on the last night of the year every stroke of the bell tower's bell counts toward the mountain's.
  createJoya({ y, ui, say, query: Q, bench: BENCH });
  function earned(id) {
    if (rite && rite.id === id) rite.done = true;
    track("demo.seal", { id, count: journey.count() });
    if (presence.on) presence.report(id, "seal");
    chime(1, journey.count()); refresh();
    const el = $("toast"), d = SEAL[id]; if (!el) return;
    $("toastSeal").src = sealStamp(glyphs(d.seal), 220, { seed: SEALS.indexOf(d) + 11 }).toDataURL(); $("toastLine").textContent = id === "sutra" && journey.verse ? t(journey.verse.text) : t(d.line); $("toastName").textContent = `${t(d.place)} · ${t(d.seal)}`;
    // The seal's own line is the observance's line (d.line), which the foot of the picture has been saying while it was made:
    // the same words are not shown twice, so the foot lets go of them and the seal keeps them (#403). A revisit earns no
    // seal and so keeps its line at the foot.
    const said = $("say"); if (said && said.classList.contains("on") && said.textContent === $("toastLine").textContent) { clearTimeout(sayTimer); said.classList.remove("on"); }
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    // The seventh seal: the book is full. On the summit, when the prologue is about to close, that comes first and
    // the full book after it (finale); anywhere else, it is marked at once.
    const full = journey.done(), closing = id === "sit" && !closedHere();
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; if (full && !closing) complete(); }, 900); if (!full) y.hints?.say.seal(); }, 4200 * Math.max(fast, 0.3));
  }
  // ---- A full book: its own seal, while the music plays the whole theme once (score.js), then the page of seals ----
  let completing = false, completed = false;   // (the book filled on the summit owes its seal until the book is opened after the close: journey.owed)
  function complete() {
    journey.stamp();   // the full book's own seal is shown once (journey.owed)
    if (!completed) { completed = true; track("demo.complete", { count: journey.count(), seconds: Math.round(visit.seconds) }); }
    const el = $("toast"); if (completing || !el) { openBook(); return; }
    completing = true;
    $("toastSeal").src = sealStamp(glyphs("七印圆满"), 220, { seed: 29 }).toDataURL(); $("toastName").textContent = saidNow("云径禅寺 · 七印圆满");
    $("toastLine").textContent = t("钟、香、茶、句、井、灯、坐，帐上七处都盖了印。");
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; completing = false; openBook(); }, 900); }, 6400 * Math.max(fast, 0.3));
  }

  // ---- Each observance ----
  // The incense burns for five minutes by the wall clock (`?burn=` seconds for a test), and when it was set in the ash is
  // kept, so that a reload finds it as far burnt as it would be. Burnt out, it may be offered again.
  const INCENSE = "yunjing.incense.v1", burn = Q.has("burn") ? Math.max(5, +Q.get("burn") || 300) : 300;
  const rites = createRites(y, fast, { enso: tex, burn, onPlant: (at, hall) => { try { localStorage.setItem(INCENSE, writeIncense(localStorage.getItem(INCENSE), hall, at)); } catch {} } });
  // A temple's own page (T05: the observation's stroke and the copy of the stele; src/levelpage.js, app/levels/t05/page.js), kept
  // under yunjing.levels.v1 and never in the prologue's book. A page opened by a tool that names its own place keeps nothing.
  const pageStore = (() => { try { return y.level?.page && placeKept(Q, BENCH, y.level) ? localStorage : null; } catch { return null; } })();
  const lp = y.level?.page ? createLevelPage({ level: y.level, page: y.level.page, places, storage: pageStore, rites, y, wait, say: (text, secs) => say(text, secs), track }) : null;
  // ---- 同修留痕 (#340, presence.js): that others have been here today, said once at each place, and their stubs in the censer ----
  // Anything that goes wrong is silent. The visitor who has asked not to be tracked is read for but not counted.
  const presence = createPresence({ on: presenceOn(location.search), quiet: navigator.doNotTrack === "1" || /** @type {any} */ (navigator).globalPrivacyControl === true });
  const INCENSE_PLACES = ["incense", "incense-yaoshi", "incense-guanyin"];
  const showStubs = () => y.traceStubs?.(traceStubCount(INCENSE_PLACES.reduce((n, p) => n + presence.count(p), 0)));
  // The day is read once the walk has begun (not while the place is built, when the main thread is too busy to answer in time: a read once came
  // back at 6.9 s against the 6 s limit and the censer never had its stubs, #367), and asked for again if that answer is late.
  let dayRead = false;
  y.onTick(() => { if (!dayRead && presence.on && entered && !y.openingActive()) { dayRead = true; readDay(presence, showStubs); } });
  /** An observance done at `id` (a place's id): counted once in this page. */
  const did = (id) => { if (presence.on) presence.report(id, "rite").then((ok) => { if (ok) showStubs(); }); };
  const end = () => { if (rite?.t0) track("demo.rite", { id: rite.id, phase: "end", seconds: Math.round((performance.now() - rite.t0) / 1000), done: rite.done ? 1 : 0 }); rite = null; y.direct(null); y.stage(null); rites.rest(); hush(false); $("breathWord")?.setAttribute("hidden", ""); };
  // How one sits on the seat at a spot: on a stool as on a chair, on a cushion cross-legged (`kind` in site.seats).
  const seatPose = (at, room = null) => { const k = y.site.seats.find((s) => (s.room || null) === room && Math.hypot(s.at[0] - at[0], s.at[1] - at[1]) < 0.3); return k && k.kind === "stool" ? "chair" : "sit"; };
  // ---- A temple's own page: the copy of the stele and the observation's stroke (src/levelpage.js) ----
  // He walks to the place, the eye goes to its shot, he writes (src/writing.js), and once the eye is home the page is shown.
  async function beginPage(id) {
    if (rite || !places[id] || !lp) return;
    const p = places[id], stroke = lp.isStroke(id); $("act")?.setAttribute("hidden", "");
    const mineRite = (rite = /** @type {any} */ ({ id })), on = () => rite === mineRite;
    if (!(await new Promise((r) => y.walkTo([p.at], r))) || !on()) { if (on()) rite = null; return; }
    y.stage({ face: p.face, pose: false, lift: 0, act: rites.act, leave: () => { if (on()) end(); } });
    mineRite.t0 = performance.now(); track("demo.rite", { id, phase: "start" });
    y.direct(id);
    const ok = stroke ? await lp.stroke(on, id) : await lp.copy(on);
    if (!on()) return;
    mineRite.done = ok;
    await wait(0.4); if (!on()) return;
    end();
    if (ok) showPage();
  }
  // The page as it now stands, on a slip of paper written down the page (the library's slip, #203's fitting): the copied line
  // as cut, or the observation's line, and under it where it is from. Put away by its button, Esc or E.
  function showPage(whole = false) {
    if (!lp) return; const v = lp.view(), last = whole ? (v.copy ? "stele" : "p1") : lp.state().last;
    // The line copied from the stone is written as cut, in the regular hand (the running hand has no traditional forms);
    // his own note is laid a phrase to a column, so that no word is split between two, beside the copy as on its own.
    const phrases = (/** @type {string} */ s) => s.replace(/([，。、；！？])(?=\S)/g, "$1\n");
    const cut = last === "stele", text = cut ? v.copy : v.note, from = cut ? (v.note ? `${v.from}\n${phrases(v.note)}` : v.from) : "";
    if (!text) return;
    const lines = cut ? text.replace(/[，、。；]/g, "") : phrases(text);   // the stone has no stops: the copy is as cut, as on the leaf
    // The stroke of ink across the top of the page, as on the leaf he held: there once the observation has put it there.
    const sheet = $("slip")?.querySelector(".paper");
    if (sheet && !sheet.querySelector(".page-stroke")) {
      // Drawn with the leaf's own brush (pagework.js, drawStroke): pressed down at its start, dry and broken at its end.
      const c = document.createElement("canvas"), g = c.getContext("2d"), W = 480, H = 48; c.width = W; c.height = H; c.className = "page-stroke"; c.setAttribute("aria-hidden", "true");
      if (g) drawStroke(g, W * 0.02, W * 0.98, H / 2, H * 0.36, 1, seededRun(11));
      sheet.prepend(c);
    }
    $("slip")?.classList.add("own-page"); $("slip")?.classList.toggle("cut", cut); $("slip")?.classList.toggle("stroke", !!v.stroke);
    holdOut(lines, from, t("收下"), () => $("slip")?.classList.remove("own-page", "cut", "stroke"));
    pageRow();
  }
  // The pause menu's 这一页 (only in a temple with a page of its own, once something is on it): the page shown again.
  const pageRow = () => document.body.classList.toggle("page", !!lp && Object.keys(lp.marks()).length > 0);
  pageRow();
  $("menuPage")?.addEventListener("click", () => { ui.close("menu"); showPage(true); });
  async function begin(id) {
    if (lp && (lp.offers(id) || lp.isStroke(id))) return beginPage(id);
    if (rite || !places[id]) return;
    if (id === "lamp" && journey.has("lamp")) return openBless();   // the lamp is lit: what is left to do there is to light one for someone
    const p = places[id], d = SEAL[id] || SEAL.incense, hall = incenseHall(id); $("act")?.setAttribute("hidden", "");
    const mineRite = (rite = /** @type {any} */ ({ id })), on = () => rite === mineRite;
    if (!(await new Promise((r) => y.walkTo([p.at], r))) || !on()) { if (on()) rite = null; return; }
    // What his hands do is rites.js's: it writes into `act`, and may move him a step (`seat`, `speed`).
    const st = { face: p.face, pose: p.sit ? seatPose(p.seat || p.at, p.room || null) : id === "well" || id === "bell" ? false : "pray", lift: p.sit ? placeLift(p, y.site.seats, y.walker.heightAt) : 0, seat: p.seat, act: rites.act, leave: () => { if (on()) end(); } };
    y.stage(st);
    mineRite.t0 = performance.now();
    track("demo.rite", { id, phase: "start" });
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
      did("tea");
      if (journey.earn("tea")) earned("tea");
      // And he sits on, the bowl steaming beside him, until the visitor stands him up.
      mineRite.word = "起身"; mineRite.press = () => y.leave(); hush(true); lingering = true;
      y.hints?.tip("linger", y.hints.coarse ? t("点「起身」或推圆盘，就站起来走　·　也可以一直坐着") : t("<kbd>E</kbd>起身　·　也可以一直坐着，看看院子"), 8);
      await rites.linger(on); lingering = false; return;
    }
    else if (hall) { await wait(1.2); if (!on()) return; if (!(await rites.offerIncense(on, st, () => say(t(d.line), 6), hall))) { if (!on()) return; say(t(d.line), 6); await wait(3); } }
    else if (id === "well") { say(t(d.line), 6); if (!(await rites.watchWell(on, () => drop()))) return; }
    else if (id === "lamp") { if (!(await rites.lightLamp(on, () => { mine.visible = true; say(t(d.line), 5); }))) return; }
    else if (id === "sit") {
      // The ring on the ground (rites.js) breathes with him; the word for it is a small line at the foot of the picture.
      const b = $("breathWord"); b?.removeAttribute("hidden");
      const word = (w) => { if (b) b.textContent = w; };
      for (let i = 0; i < 3; i++) { word(t("吸")); if (!(await rites.breathe(1, 4, on))) return; word(t("呼")); if (!(await rites.breathe(-1, 5, on, i === 2 && closedHere()))) return; }
      b?.setAttribute("hidden", ""); say(t(d.line), 6);
    } else if (id === "sutra") {
      await wait(1.6); if (!on()) return;
      const day = Math.floor(Date.now() / 864e5), verse = pickVerse(Q.has("seed") ? +Q.get("seed") : day + (journey.born % 97));
      await new Promise((r) => { mineRite.take = () => ui.close("slip"); holdOut(t(verse.text), t(verse.from), t("收下"), r); }); if (!on()) return;
      did("sutra");
      if (journey.earn("sutra", { verse })) earned("sutra"); end(); return;
    }
    if (!on()) return;
    did(id);
    const fresh = SEAL[id] ? journey.earn(id) : false; if (fresh) earned(id);   // the seal for the incense is the great hall's; the other halls' offerings earn none (#146)
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
    if (s.place) y.direct(s.place);   // the half-way pavilion's bench: the eye turns slowly to the valley (#479)
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
  const TITLE_AT = 25.5;   // seconds into the close when the title of what has ended comes
  let closing = false, skip = false, /** @type {string | null} */ skipHow = null, /** @type {() => object} */ passState = () => ({}), /** @type {string[]} */ words = [];
  async function finale(on = () => true, replay = false) {
    const el = $("ending"); if (closing || !el) { openBook(); return; }
    closing = true; skip = false; skipHow = null; document.body.classList.add("ending"); el.hidden = false; $("endingTitle").classList.remove("on");
    const line = $("endingLine"), CLOSING = closingWords(); let shown = -1; words = CLOSING.map((c) => c[1]);
    // The close has its own music, written to these words: the far bell's line and the title (audio.js, score.js).
    closeMusic({ bell: CLOSING[bellLine][0], title: TITLE_AT });
    // Passing the close over (#473). A tap that wakes a sleeping phone must never do it, so: a press is never a skip the
    // first time the close is watched unless it is held for HOLD; a visitor who has seen it may tap. And the first press
    // after the page was frozen (hidden, or no frame for FROZEN ms: some in-app browsers send no visibilitychange) is
    // taken for the wake and ignored, however late after the screen came on it lands.
    const HOLD = 1500, FROZEN = 2000, seenBefore = replay || !!journey.closed;
    const host = $("endingHold"), word = $("endingHoldWord"), ring = createHoldRing(host);
    word.textContent = seenBefore ? t("轻点略过") : t("按住略过"); host.setAttribute("aria-label", word.textContent);
    // (once it has been seen a tap is enough, and a tap needs no ring: it is drawn only for the hold)
    let frozen = false, lastFrame = performance.now(), ignored = 0, held = null, pressed = null, raf = 0;
    const letGo = () => { held = null; pressed = null; ring.release(); };
    const give = (how) => { if (!skip) { skip = true; skipHow = how; letGo(); } };
    const freeze = () => { frozen = true; letGo(); };
    const seen = () => freeze();
    const frame = () => { const now = performance.now(); if (now - lastFrame > FROZEN) freeze(); lastFrame = now; if (held !== null) { const k = Math.min(1, (now - held) / HOLD); ring.progress(k); if (k >= 1) give("hold"); } raf = requestAnimationFrame(frame); };
    raf = requestAnimationFrame(frame); document.addEventListener("visibilitychange", seen);
    const down = (id) => {
      if (pressed !== null) return;
      // A frame may not have run since the page came back: ask the clock too, not only the loop.
      if (performance.now() - lastFrame > FROZEN) frozen = true;
      if (frozen) { frozen = false; ignored++; pressed = id; held = null; return; }   // the wake: this press, its release and its holding count for nothing
      pressed = id; held = performance.now(); if (!seenBefore) ring.press();
    };
    const up = (id) => {
      if (pressed !== id) return;
      const was = held, wake = was === null; letGo();
      if (!wake && seenBefore && performance.now() - was < HOLD) give("tap");
    };
    // The pointer is captured on the press, so a finger slid off the window still ends here; and a press that is lost any other way (capture taken, focus gone) is let go, not left held.
    const pd = (e) => { down("p" + e.pointerId); try { el.setPointerCapture(e.pointerId); } catch {} }, pu = (e) => up("p" + e.pointerId), lost = (e) => { if (pressed === "p" + e.pointerId) letGo(); }, blur = () => letGo();
    el.addEventListener("pointerdown", pd); el.addEventListener("pointerup", pu); el.addEventListener("pointercancel", pu); el.addEventListener("lostpointercapture", lost); window.addEventListener("blur", blur);
    const key = (e) => { if (e.key !== "Escape" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault(); e.stopPropagation(); if (!e.repeat) down("k" + e.key); };
    const keyUp = (e) => { if (e.key === "Escape" || e.key === "Enter" || e.key === " ") up("k" + e.key); };
    window.addEventListener("keydown", key, true); window.addEventListener("keyup", keyUp, true);
    passState = () => ({ seenBefore, frozen, holding: held !== null, ignored, how: skipHow, progress: ring.value / 100, ring: ring.held });
    awake.hold();   // the screen stays on while it is played, where the browser allows (src/awake.js)
    try {
      await rites.close(() => on() && !skip, (t) => {
        let k = -1; for (let i = 0; i < CLOSING.length; i++) if (t >= CLOSING[i][0]) k = i;
        if (t > TITLE_AT) { line.classList.remove("on"); $("endingTitle").classList.add("on"); }
        else if (k !== shown) {
          shown = k; line.classList.remove("on"); setTimeout(() => { line.textContent = CLOSING[k][1]; line.classList.add("on"); }, 500 * fast);
          // When it is said that a bell answers in the far hills, it is heard (audio.js).
          if (k >= 0 && k === bellLine) farBell();
        }
      });
    } finally { awake.free(); }
    cancelAnimationFrame(raf); el.removeEventListener("pointerdown", pd); el.removeEventListener("pointerup", pu); el.removeEventListener("pointercancel", pu); el.removeEventListener("lostpointercapture", lost); window.removeEventListener("blur", blur);
    window.removeEventListener("keydown", key, true); window.removeEventListener("keyup", keyUp, true); document.removeEventListener("visibilitychange", seen); letGo();
    if (skip || !on()) { passClose(); y.direct(null); }   // passed over, or walked away: the eye comes home by the usual swing (rites.close left it where it was)
    line.classList.remove("on"); $("endingTitle").classList.remove("on"); el.hidden = true; document.body.classList.remove("ending"); closing = false; if (!replay) ended++;
    // How it ended, for the analytics: held, tapped, or played out (with how many wake presses the guard let by unseen).
    const gone = /** @type {any} */ (passState()).ignored, how = skipHow || (gone ? "wake-ignored" : "played");
    if (replay) { track("demo.ending.replay", { skipped: skip, how, ignored: gone }); if (!skip && on()) farBegin(); return; }
    // Seen, or passed over: either way it is not shown again in this season. The seals left over can still be earned.
    // When it is seen again in another season, the full book's seal is not shown again: only the book opens.
    if (journey.close(season())) track("demo.ending", { skipped: skip, how, ignored: gone, count: journey.count(), seconds: Math.round(visit.seconds) });
    // The close has been played, or passed over: the temple is closed, and the way back to it opens from the other temples (#449).
    if (ours) { pilgrims.record.mark(levelId, { season: season() }); pilgrims.refresh(); }
    refresh();
    // Nothing opens by itself: the eye stays on the far view of the pavilion (rites.close, y.holdEye) and the music plays out;
    // the book is the visitor's to open (a line at the foot, B), and any step, tap on the ground or Esc brings the eye home.
    if (!skip && on()) farBegin();
  }
  // ---- The far view: the chapter's last picture, held until the visitor moves ----
  let far = 0;
  const farHint = () => (y.hints?.coarse ? t("点这一行，翻开朱印帐") : t("{b}翻开朱印帐", { b: "<kbd>B</kbd>" }));
  async function farBegin() {
    const mine = ++far; document.body.classList.add("far");
    await wait(8);   // the title has gone and the music is coming to its end: not the moment it stops
    if (far === mine && !ui.modal?.()) y.hints?.hold(farHint());
  }
  const farEnd = () => { if (!far) return; far = 0; document.body.classList.remove("far"); y.hints?.release(); };
  $("hint")?.addEventListener("click", () => { if (far) openBookOwed(); });
  window.addEventListener("struck", (e) => { if (/** @type {CustomEvent} */ (e).detail === "bell") did("bell"); });   // the first stroke of the bell is the offering
  window.addEventListener("struck", (e) => {
    if (/** @type {CustomEvent} */ (e).detail !== "bell" || journey.has("bell")) return;
    const r = journey.strike(); say(["", t("一下"), t("两下"), t("三下")][r.strikes] || "", 3);
    // The third stroke, the first time on this walk: the birds in the old trees beyond the wall go up (yard.js, flock.js).
    if (r.earned) { earned("bell"); window.dispatchEvent(new CustomEvent("flush")); } else refresh();
  });
  window.addEventListener("incense-offered", () => { if (journey.earn("incense")) earned("incense"); });

  // ---- The button that offers what can be done here ----
  let presenceAt = null, acc = 0, look = null, seatHere = null, climb = null, wasIndoors = false, lingering = false, summitSaid = false; const seen = new Set();
  y.onTick((dt) => {
    // The looks that put the observation's stroke on a temple's own page are counted while he walks freely (src/levelpage.js).
    if (lp && entered && !rite && !y.busy() && !y.staged() && !y.openingActive() && !closing && !y.inside()) { const w = y.where(); lp.tick(dt, w, w.yaw); }
    if (far && !y.directArrived()) farEnd();   // the eye has gone home (a step, a tap on the ground, Esc, or a door): the far view is over
    // The marker toward the next place rides the picture every frame, but only while the goal is being shown.
    // A place made indoors (the great hall's incense, the first goal of an empty book, #436) is pointed at from outside by
    // its hall's door; inside, by the place itself.
    { const el = $("way"), g = $("goal"), next = journey.next(), q = next && places[next.id], door = q && q.room && y.room() === null && y.site.halls.find((h) => h.id === q.room),
        p = door ? { at: door.out, room: null } : q;
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
    if (!near && free && lp && !indoors) near = lp.pendingAt(w);   // both looks met: 记下 is offered where they were met
    // Standing where an observance is made, the day's count of those who have made it, once, if anyone has (presence.js).
    if (near !== presenceAt) { presenceAt = near; const line = near && presence.line(near); if (line) y.hints?.tip("presence-" + near, line, 6); else if (near && presence.on) readDay(presence, showStubs, { tries: 2 }); }
    if (near === "sit" && !closedHere() && !summitSaid) { summitSaid = true; say(t("凌霄阁前这只蒲团，朝着来时的路。"), 6); }
    // Indoors, standing before a frame on the wall offers a look at what hangs there.
    look = free && indoors && !near ? placeAt(Object.fromEntries(Object.entries(y.gallery).filter(([, p]) => p.room === room)), w.x, w.z) : null;
    // A cushion or a stool within a step or two, when nothing else is offered here and he is not already seated.
    seatHere = null;
    if (free && !near && !look && !y.staged()) { let best = 1.5; for (const s of y.site.seats) { if ((s.room || null) !== room) continue; const d = Math.hypot(s.at[0] - w.x, s.at[1] - w.z); if (d < best) { best = d; seatHere = s; } } }
    // At the foot of a stair up to a storey that is walked round, it goes up; up there, at its door, back down (issue #101).
    climb = null;
    if (free && !near && !look && !y.staged()) {
      const st = y.stair(), up = y.up(), L = up && y.lofts[up];
      if (st && Math.hypot(st.at[0] - w.x, st.at[1] - w.z) < st.r) climb = "登楼";
      else if (L && Math.hypot(L.door[0] - w.x, L.door[1] - w.z) < 0.9) climb = "下楼";
      if (climb) seatHere = null;
    }
    const b = $("act"); if (!b) return;
    // While he holds the rope or sits on over his tea the button is what he may do next; seated anywhere, it stands him up.
    const held = rite && rite.press && entered && !y.busy() ? rite.word : null, rise = !held && !near && !look && !seatHere && !climb && free && y.seated();
    if (held || near || look || seatHere || climb || rise) {
      const w = held || (near ? (lp?.word(near) || (near === "lamp" && journey.has("lamp") ? "为人点灯" : (SEAL[near] || SEAL.incense).act)) : look ? (y.gallery[look].item.offering ? "合掌" : "观看") : climb || (seatHere ? "坐下" : "起身"));
      if (b.dataset.word !== w || !b.firstChild) { b.dataset.word = w; b.innerHTML = `<i class="enso"><kbd>E</kbd></i><span>${t(w)}</span>`; }
      b.classList.toggle("wait", held === "撞钟" && !rites.ready()); b.hidden = false;
    } else b.hidden = true;
    if (indoors !== wasIndoors) { wasIndoors = indoors; refresh(); if (indoors) say(room === "main" && !journey.has("incense") ? t("走到佛前的圆相里，上一炷香。") : t(y.hallName()), 5); }
  });
  const b0 = () => /** @type {HTMLElement} */ ($("act"));
  $("act")?.addEventListener("click", () => {
    if (rite && rite.press) return rite.press();
    if (near) return begin(near);
    if (climb) { const c = climb; climb = null; b0().hidden = true; return c === "登楼" ? y.climb(y.stair().up) : y.descend(); }
    if (!look) { if (seatHere) sitDown(seatHere); else if (y.seated()) y.leave(); return; }
    if (y.gallery[look].item.offering) return offerCoin(y.gallery[look]);
    const it = y.gallery[look].item; y.stage({ face: y.gallery[look].face, pose: false, lift: 0, leave() {} });
    if (it.work) return showWork(it.work, look);
    const spot = look; holdOut(t(it.title), t(it.text), t("看过了"), () => { y.stage(null); seen.add(spot); });
  });

  // ---- The 功德箱: a coin, in every build; and in the web build only, the sheet that follows it ----
  // He puts his palms together and lets one coin fall (a made sound; nothing is paid, nothing is written in the book, no
  // seal, no reward). Only the public web page then opens a sheet of paper with the link to 如是我闻's sponsor page
  // (src/donate.js, imported here only when `WEB`, so the other builds hold neither the code nor the address).
  let sheet = null;
  if (WEB) import("./donate.js").then((d) => { sheet = d.mountOffering({ ui, lang, onOpen: () => { track("offering.open"); keepPlace(); }, onQr: () => track("offering.qr") }); });
  async function offerCoin(spot) {
    if (rite) return; $("act")?.setAttribute("hidden", "");
    const mineRite = (rite = /** @type {any} */ ({ id: "offering" })), on = () => rite === mineRite;
    if (!(await new Promise((r) => y.walkTo([spot.at], r))) || !on()) { if (on()) rite = null; return; }
    // He stands where his arm reaches the slot, exactly, as at the incense stand; the eye goes to the box's own shot (src/director.js).
    y.put(spot.at[0], spot.at[1]);
    y.stage({ face: spot.face, pose: "pray", lift: 0, seat: spot.at, act: rites.act, leave: () => { if (on()) end(); } });
    y.direct(spot.item.id);
    await wait(1.6); if (!on()) return;   // the eye is on its shot (about two seconds) before his hands begin, as at the incense and the tea
    if (!(await rites.dropCoin(on, spot.slot, () => { coin(); track("offering.coin"); })) || !on()) return;
    // The sheet comes once the eye is back on his shoulder (a sheet over a swing half made would freeze it there) and the
    // last bow is over, and never before the coin is in. In the other builds the coin is all there is.
    for (let i = 0; i < 40 && y.directed() && on(); i++) await wait(0.1);
    if (!on()) return;
    if (WEB && sheet) { await wait(0.4); if (!on()) return; track("offering.sheet"); ui.open("offering", { onClose: () => { if (on()) end(); } }); sheet.opened(); return; }
    await wait(0.3); if (on()) end();
  }

  // ---- A work on the wall, read closely: the picture, and beside it what an encyclopedia would say ----
  function showWork(slug, spot) {
    const w = workIn(slug), el = $("piece"); if (!w || !el) return;
    $("pieceImg").src = asset(`levels/t00/gallery/${slug}.webp`); $("pieceImg").alt = w.title;
    $("pieceTitle").textContent = w.title; $("pieceBy").textContent = [w.by, w.dates].filter(Boolean).join(lang === "en" ? " · " : "　");
    // The facts and the note in the visitor's language (levels/t00/works-local.js); the museum's source line stays as published.
    $("pieceFacts").innerHTML = [["年代", w.period], ["质地", w.medium], ["尺寸", w.size && t("{size} 厘米", { size: w.size })], ["收藏", w.holder], ["等级", w.rank]].filter(([, v]) => v).map(([k, v]) => `<dt>${t(k)}</dt><dd>${v}</dd>`).join("");
    // Japan's designation, said plainly once under the facts: the word alone (“重要文化财”) reads as a phrase dropped from a sentence.
    $("pieceRank").textContent = w.rank ? t("“重要文化财”“国宝”是日本文化财保护法下的指定等级，国宝由重要文化财中特别指定。") : ""; $("pieceRank").hidden = !w.rank;
    $("pieceNote").textContent = w.note; $("pieceLink").textContent = w.link; $("pieceCredit").textContent = w.credit;
    // ColBase's terms ask that a picture that was edited say so, apart from the source line (src/credits.js).
    const edited = processedLine(w); $("pieceProcessed").textContent = edited; $("pieceProcessed").hidden = !edited;
    ui.open("piece", { onClose: () => { y.stage(null); seen.add(spot); } });
  }
  $("pieceClose")?.addEventListener("click", () => ui.close("piece"));
  window.__work = (slug) => (slug ? showWork(slug, null) : { open: ui.isOpen("piece"), title: $("pieceTitle")?.textContent, loaded: !!$("pieceImg")?.naturalWidth });

  // ---- A lamp lit for someone (#343): a line from the list, the link that carries its number, and, for whoever opens it, the lamp ----
  const mood0 = () => { const m = y.mood(); return { season: m.season, time: m.time, label: m.label.split(" · ").map((w) => t(w)).join(" · ") }; };
  let blessed = null;   // the picture and link of the line chosen now
  function openBless() {
    const el = $("bless"), list = $("blessList"); if (!el || !list || ui.isOpen("bless")) return;
    list.textContent = ""; blessed = null;
    WISHES.forEach((w, i) => { const b = document.createElement("button"); b.type = "button"; b.className = "wish"; b.dataset.wish = String(i); b.setAttribute("aria-pressed", "false"); b.textContent = t(w); list.append(b); });
    for (const id of ["blessCard", "blessLink", "blessActs"]) $(id).hidden = true;
    $("blessCopy").textContent = t("复制链接");
    ui.open("bless", { onClose: () => { if (blessed) URL.revokeObjectURL(blessed.pic); blessed = null; } });
  }
  // The link is carried, not read (#639): the sheet shows only where it goes, cut short; the whole address is kept in `data-link`,
  // and is what the copy and share buttons hand on. It is written out in full only where the clipboard cannot be written to,
  // so that it can be selected by hand.
  const showLink = (url, full = false) => { const el = $("blessLink"); el.dataset.link = url; el.classList.toggle("full", full); el.textContent = full ? url : new URL(url).host + "/…"; };
  $("blessList")?.addEventListener("click", async (e) => {
    const b = /** @type {HTMLElement} */ (e.target).closest("[data-wish]"); if (!b) return;
    const i = +b.getAttribute("data-wish"), m = mood0(), url = lampLink({ wish: i, season: m.season, time: m.time }, lang); if (!url) return;
    for (const c of $("blessList").children) c.setAttribute("aria-pressed", String(c === b));
    const card = await drawLampCard({ wish: t(WISHES[i]), label: m.label, url });
    const blob = /** @type {Blob} */ (await new Promise((r) => card.toBlob(r, "image/jpeg", 0.92))); if (!ui.isOpen("bless")) return;
    if (blessed) URL.revokeObjectURL(blessed.pic);
    const pic = URL.createObjectURL(blob), file = new File([blob], "yunjing-lamp.jpg", { type: "image/jpeg" }); blessed = { url, pic, file };
    $("blessImg").src = pic; $("blessImg").alt = t(WISHES[i]); showLink(url); $("blessSave").href = pic; $("blessSave").download = saidNow("云径禅寺-点灯.jpg");
    for (const id of ["blessCard", "blessLink", "blessActs", "blessSave"]) $(id).hidden = false;
    $("blessShare").hidden = !navigator.share; $("blessCopy").textContent = t("复制链接");
    $("blessCard").scrollIntoView?.({ block: "nearest", behavior: "smooth" });   // the card and its buttons are below the list: bring them into the paper
    track("lamp.link", { wish: i, season: m.season, time: m.time });
  });
  $("blessCopy")?.addEventListener("click", async () => { if (!blessed) return; try { await navigator.clipboard.writeText(blessed.url); $("blessCopy").textContent = t("已复制"); } catch { showLink(blessed.url, true); const r = document.createRange(); r.selectNodeContents($("blessLink")); const sel = getSelection(); sel?.removeAllRanges(); sel?.addRange(r); } });
  $("blessShare")?.addEventListener("click", async () => {
    if (!blessed) return; const data = /** @type {ShareData} */ ({ title: saidNow("云径禅寺 · 点灯"), text: t("有人在此为你点了一盏灯。"), url: blessed.url });
    if (navigator.canShare && navigator.canShare({ files: [blessed.file] })) data.files = [blessed.file];
    try { await navigator.share(data); } catch {}
  });
  $("blessClose")?.addEventListener("click", () => ui.close("bless"));
  // Opened from a link: the number in its fragment is looked up in the list (decodeLamp ignores anything else), and the address is
  // cleared of it so that a reload does not do it twice. Another kind of fragment (a saved walk, #338) is left where it is.
  let arrival = decodeLamp(location.hash);
  if (/^#lamp=/.test(location.hash)) { try { history.replaceState(null, "", location.pathname + location.search); } catch {} }
  /** The other lamp on the stand and the small slip leaning by it, with the line (from the list) and the hour it was lit in. The slip is part of the place, not the message: on a phone held upright it is a few pixels of writing (the line is also said at the foot of the picture, where it can be read), and a larger one would lie off the screen's edge. */
  let theirs = null;
  async function showTheirs(l) {
    if (theirs) return; const f = places.lamp.flame, m = moodOf(l.season, l.time);
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.02, 10, 8).scale(1, 2.4, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.9, 1), fog: false }));
    flame.position.set(f[0] + 0.5, f[1] + 0.012, f[2]);
    const cv = document.createElement("canvas"); cv.width = 320; cv.height = 200; const x = cv.getContext("2d");
    try { await document.fonts.load(`40px ${FONT.xing}`, t(WISHES[l.wish])); } catch {}
    x.fillStyle = "#f1ead9"; x.fillRect(0, 0, 320, 200); x.strokeStyle = "rgba(60,50,40,.45)"; x.lineWidth = 4; x.strokeRect(6, 6, 308, 188); x.fillStyle = "#26221e"; x.textAlign = "center"; x.textBaseline = "middle";
    const text = t(WISHES[l.wish]), { size: fs, rows } = fitLines(x, text, 270, (n) => `${n}px ${FONT.xing}`, 38, 26); x.font = `${fs}px ${FONT.xing}`;
    rows.forEach((r, i) => x.fillText(r, 160, 78 - ((rows.length - 1) * fs * 1.3) / 2 + i * fs * 1.3));
    x.fillStyle = "#7a6f5e"; x.font = `22px ${FONT.serif}`; x.fillText(m.label.split(" · ").map((w) => t(w)).join(" · "), 160, 168);
    const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
    const slip = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.2), new THREE.MeshBasicMaterial({ map: tex, fog: true }));
    slip.position.set(f[0] + 0.5, f[1] - 0.02, f[2] + 0.2); slip.rotation.x = -0.35;
    y.scene.add(flame, slip); theirs = { flame, slip, lamp: l };
  }
  async function arrive() {
    const l = arrival; arrival = null; if (!l) return;
    track("lamp.open", { wish: l.wish, season: l.season, time: l.time });
    await showTheirs(l); const p = places.lamp;
    await y.travel(p.at[0], p.at[1], Math.PI - p.face, null); await wait(0.8);
    say(t("有人在此为你点了一盏灯。"), 7); await wait(7.5); say(t(WISHES[l.wish]), 9);
  }
  window.__bless = (i) => { openBless(); if (i != null) /** @type {HTMLElement | undefined} */ ($("blessList")?.children[i])?.click(); return ui.isOpen("bless"); };
  window.__lamp = () => ({ arrival, shown: !!theirs, wish: theirs?.lamp.wish ?? null, sheet: ui.isOpen("bless") });

  // ---- The book ----
  // Once the book has been filled, the line at the foot of the view says once, ever, that the seasons are open.
  // The same once turns the hour to the visitor's own (#726), and the line says both in one sentence; a level with no clock to follow says the old one.
  const announce = () => { if (entered && journey.opened() && !journey.told()) { y.hints?.release?.();   /* (the far view's line about opening the book has done its work: the book was just shut) */ const clock = !!y.followHour?.(); if (y.hints?.say.seasons?.(clock)) journey.tell(); } };
  let page = null;
  async function openBook() {
    // The page opens at once, as bare paper, and is written on when drawn: on a slow phone the drawing takes a moment,
    // and a press that seems to do nothing is pressed again.
    const m = y.mood(), next = journey.next(), leaf0 = $("bookPage");
    // What the page says is known before it is drawn, so it is written before the page opens.
    const blank = SEALS.length - journey.count();
    $("bookHint").textContent = next ? `${journey.closed ? t("帐上还空着{n}处。", { n: "〇一二三四五六七"[blank], k: blank }) : ""}${[t(next.hint), told()].filter(Boolean).join("　")}` : `${t("七印圆满。这一页可以存下来，也可以分享。时节已开，留影与歇脚里可选。")}${told()}`;
    // (an empty book has nothing to begin again: 重新朝山 is offered once there is a seal to give up)
    // (the map's line is on the 更多 paper too, so that button shows when the map is there, #449)
    if (!ui.isOpen("book")) { leaf0?.classList.add("drawing"); $("bookReset").textContent = t("重新朝山"); $("bookReset").dataset.asked = ""; $("bookReset").hidden = !journey.count(); $("bookReplay").hidden = !(journey.closed && journey.done()); $("bookMoreBtn").hidden = $("bookReset").hidden && $("bookReplay").hidden && !document.body.classList.contains("pilgrim"); ui.open("book", { onClose: announce }); }
    page = await drawGoshuin({ seals: journey.list(), verse: journey.verse, when: journey.finished || Date.now(), label: m.label.split(" · ").map(glyphs).join(" · ") });
    const blob = await new Promise((r) => page.toBlob(r, "image/jpeg", 0.92)), url = URL.createObjectURL(blob);
    { const im = new Image(); im.src = url; await im.decode().catch(() => {}); }
    $("bookImg").src = url; $("bookSave").href = url; $("bookSave").download = saidNow("云径禅寺-朱印.jpg");
    // Shared from wherever the page is open (src/share.js, #344): the system's sheet, or a sheet to press and hold the page on.
    $("bookShare").onclick = () => shareOrSave({ blob, url, name: `${stemNow()}-seals.jpg`, title: saidNow("云径禅寺 · 朱印"), from: "goshuin", content: "book" });
    $("bookSave").onclick = () => countDownload("book", "goshuin");
    // A seal that has been earned is also the way back to where it was earned: a button lies over each on the page.
    const leaf = $("bookPage"), boxes = sealBoxes(SEALS.length);
    if (leaf) { leaf.querySelectorAll(".seal-go").forEach((b) => b.remove());
      SEALS.forEach((d, i) => { if (!journey.has(d.id) || !places[d.id]) return; const b = document.createElement("button"), [l, top, w, h] = boxes[i];
        b.type = "button"; b.className = "seal-go"; b.dataset.id = d.id; b.setAttribute("aria-label", t("回到{place}", { place: t(d.place) })); b.title = t("回到{place}", { place: t(d.place) });
        // The row of seals was shortened to leave the foot's end to the code (#337), so a seal's share of the page is 38 px wide at 388, not 51: the button is never narrower than a thumb (44 px), centred on its seal; the drawn seals are 30 px apart, so neighbours' buttons overlap by 3 px at the least.
        b.style.cssText = `left:calc(${((l + w / 2) * 100).toFixed(2)}% - max(${(w * 100).toFixed(2)}%, 44px) / 2);top:${(top * 100).toFixed(2)}%;width:max(${(w * 100).toFixed(2)}%, 44px);height:max(${(h * 100).toFixed(2)}%, 44px)`;
        b.addEventListener("click", () => goBack(d.id)); leaf.appendChild(b); });
      if ($("bookGo")) $("bookGo").hidden = !journey.count(); }
    leaf0?.classList.remove("drawing");
  }
  // Back to where a seal was earned: the book closes, the eyes close, and he stands there again.
  async function goBack(id) {
    const p = places[id], d = SEAL[id]; if (!p || !journey.has(id) || rite || closing) return;
    ui.close("book"); if (await y.travel(p.at[0], p.at[1], Math.PI - p.face, p.room || null)) { went++; say(t("回到{place}。", { place: t(d.place) }), 4); }
  }
  window.__goBack = (id) => goBack(id);
  // The book, opened by the visitor: a full book that has not been shown its own seal is shown it now (once), then the page.
  function openBookOwed() { if (journey.owed() && !closing && !completing && !rite) complete(); else openBook(); }
  $("bookBtn")?.addEventListener("click", () => { track("demo.book", { seals: journey.count() }); openBookOwed(); });
  $("bookClose")?.addEventListener("click", () => ui.close("book"));
  // 山顶再坐一回 (#473): the close again from the start, from the summit mat. It stamps nothing, keeps nothing in the book and is not a new season's.
  async function replayEnding() {
    const p = places.sit; if (!p || closing || completing || rite || !journey.closed) return;
    ui.close("book"); farEnd();
    if (!(await y.travel(p.at[0], p.at[1], Math.PI - p.face, p.room || null))) return;
    await wait(0.6);
    const s = y.site.seats.find((k) => k.room === null && Math.hypot(k.at[0] - p.at[0], k.at[1] - p.at[1]) < 0.3);
    if (s) await sitDown(s);
    await wait(1); await finale(() => true, true);
  }
  // 更多 (#473, the art review's one way of laying out the foot of the book): a small paper of what is seldom wanted, one to a line.
  // Whatever is pressed on it, the paper goes first and then the thing is done.
  $("bookMoreBtn")?.addEventListener("click", () => ui.open("bookMore", { onClose: () => { const b = $("bookReset"); b.dataset.asked = ""; b.textContent = t("重新朝山"); } }));
  $("bookMoreClose")?.addEventListener("click", () => ui.close("bookMore"));
  $("bookReplay")?.addEventListener("click", () => { ui.close("bookMore"); track("demo.ending.replay", { phase: "start" }); replayEnding(); });
  window.__replayEnding = () => replayEnding(); window.__endingPass = () => passState(); window.__closeRoute = (step) => rites.closeRoute(step); window.__closeFrame = () => rites.closeFrame();
  $("bookReset")?.addEventListener("click", (e) => { const b = /** @type {HTMLElement} */ (e.currentTarget); if (b.dataset.asked !== "1") { b.dataset.asked = "1"; b.textContent = t("再点一次，清空朱印"); return; } track("demo.restart", { from: "book", seals: journey.count() }); journey.reset(); forgetTitle(); visit.metres = visit.seconds = 0; keep(); refresh(); ui.close("book"); });

  // ---- The prologue's title, at the gate ----
  // The first time he comes round the screen wall with the gate whole before him, 序章 云径禅寺 rises at the side of the
  // picture with one note of the qin (the theme's first) and fades; it takes nothing from the visitor. Once in each
  // pilgrimage: kept until the book is emptied (从头走起, 重新朝山). Not on a page that names its own place.
  const TITLED = "yunjing.prologue.v1";
  let titled = (() => { try { return localStorage.getItem(TITLED) === "1"; } catch { return false; } })(), titleShown = 0;
  const forgetTitle = () => { titled = false; awaitTitle(free); try { localStorage.removeItem(TITLED); } catch {} };
  const prologueTitle = (hold = false) => {
    const el = $("prologue"); if (!el) return;
    titled = true; titleShown++; if (free) { try { localStorage.setItem(TITLED, "1"); } catch {} }
    // Written in the brush, in the temple's own characters (Japanese forms in Japanese, glyphs()); in English and Korean the
    // line is also said under it in words the visitor reads, as the title page does.
    const read = lang === "en" || lang === "ko" ? `<small>${t("序章　云径禅寺")}</small>` : "";
    el.innerHTML = `<b><span>${glyphs("序章")}</span><span>${glyphs("云径禅寺")}</span></b>${read}`;
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on"); prologueNote(); track("opening.title", {});
    if (!hold) setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; }, 1300); }, 4000 * Math.max(fast, 0.5));
  };
  // A page opened by a change of language is not a visitor coming in (#140): if he stood before the gate then, the title
  // waits until he has walked away from it and comes round again.
  let relangHold = !!y.relang;
  y.onTick(() => { const g = atGate(y.where()); if (relangHold && !g) relangHold = false; if (!titled && entered && titleOn && !relangHold && !y.inside() && !y.openingActive() && g) prologueTitle(); });
  // What the title has done (and, for the picture tools, `__prologue(true)` raises it now, wherever he stands; "hold" keeps it up).
  window.__prologue = (show) => { if (show === true || show === "hold") prologueTitle(show === "hold"); return { titled, shown: titleShown, on: !!$("prologue")?.classList.contains("on"), text: $("prologue")?.textContent || "" }; };

  // ---- The title ----
  const title = $("title");
  // ---- Coming back: where he was is kept from moment to moment, and the title offers to go on from there ----
  // A first visit is offered only 入山. A visitor who has a seal, or left from somewhere up the mountain, is offered to
  // go on (接着走) from where they were, or to begin again (从头走起, asked twice: it empties the book).
  const named = SEALS.filter((d) => places[d.id] && !places[d.id].room).map((d) => ({ place: d.place, at: places[d.id].at }));
  // A tool or a test that names its own place is left where it asked to be; a level that keeps no place (any but the
  // prologue, until levels keep their own, #385) neither reads the prologue's nor writes its own over it.
  const free = placeKept(Q, BENCH, y.level);
  const titleOn = free && (!y.level || !!y.level.title);   // the prologue's title rises in the prologue only
  awaitTitle(titleOn && !titled);   // the gate's first phrase is kept for the prologue's title (audio.js)
  // The prologue's place is yunjing.place.v1; a level with a place of its own keeps it in yunjing.levels.v1 and the prologue's key is never read or written from there.
  // (First edition: only a place out of doors, which is all T05 has: no room, no balcony; an older or tampered record is read by the same checks and settled below.)
  const ownPlace = !!y.level && !y.level.keepsPlace && !!y.level.keepsOwnPlace;
  let left = free ? (ownPlace ? (readLevelPlace(localStorage, levelId) && { ...readLevelPlace(localStorage, levelId), label: "", up: null, hall: null }) : readPlace(localStorage)) : null, kept = 0;
  if (left && left.up && !y.lofts[left.up]) left = null;
  if (left && left.hall && !y.hallIds?.includes(left.hall)) left = null;   // a hall this level does not have
  // A place is kept to the centimetre, which against a railing or a wall can fall just past the edge of the floor: it
  // steps out to the nearest free point a few centimetres off. A place kept up on a balcony is tested on its floor.
  if (left && !left.hall) {   // (a place in a hall's room is tested on the room's floor when he is stood there: y.place)
    y.walker.setLoft(left.up);
    if (y.walker.blocked(left.x, left.z)) { let got = null; out: for (let r = 0.01; r <= 0.06; r += 0.01) for (let k = 0; k < 16; k++) { const x = left.x + r * Math.cos((k * Math.PI) / 8), z = left.z + r * Math.sin((k * Math.PI) / 8); if (!y.walker.blocked(x, z)) { got = { x, z }; break out; } } left = got ? { ...left, ...got } : null; }
    y.walker.setLoft(null);
  }
  // The line at the foot of the title is this level's own, or nothing (#445).
  const how = /** @type {HTMLElement | null} */ (document.querySelector("#title .how")), says = titleHow(y.level);
  if (how && says) { how.querySelector("b").textContent = t(says.place); how.querySelector("span").textContent = t(says.line); how.hidden = false; }
  const offer = () => {
    const o = titleOffer(journey.count(), SEALS.length, left, y.start), b = $("enterBtn"), again = $("againBtn");
    $("titleSeals").textContent = o.line || (journey.count() === SEALS.length ? t("七印圆满 · 山门常开") : "");
    if (b && !b.disabled) b.textContent = o.enter;
    if (again) { again.hidden = !o.going || b.disabled; if (again.dataset.asked !== "1") again.textContent = o.again; }
    return o;
  };
  if (left && !y.relang && !y.crossing && titleOffer(journey.count(), SEALS.length, left, y.start).going) y.place(left.x, left.z, left.yaw, left.up, left.hall);   // the title is shown over where they were (after a change of language yard.js has already stood him where he was)
  const keepPlace = () => { if (!entered || !free || closing) return; const w = y.where(); if (!y.inside() && !w.up && y.walker.blocked(w.x, w.z)) return; if (ownPlace) { writeLevelPlace(localStorage, levelId, w); return; } writePlace(localStorage, { ...w, label: w.up ? "凌霄阁上" : labelOf(w, y.inside() ? y.hallName() : null, named) }); };
  // Where the visit ends (#326): the first time the page is hidden after he has stepped in, named from the same source
  // as the place "接着走" offers, so the two always agree. A second hide of the same page says nothing.
  let leftNamed = false;
  const noteLeave = () => {
    if (leftNamed || !entered) return;
    leftNamed = true;
    const w = y.where(), room = y.room();
    track("demo.leave", {
      seconds: Math.round((performance.now() - openedAt) / 1000),
      seals: journey.count(),
      metres: Math.round(visit.metres),
      place: room || w.up || labelOf(w, y.inside() ? y.hallName() : null, named),
      inside: y.inside() ? 1 : 0,
      up: w.up ? 1 : 0,
    });
  };
  y.onTick((dt) => { if ((kept += dt) > 2) { kept = 0; keepPlace(); } });
  window.addEventListener("pagehide", keepPlace); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") { noteLeave(); keepPlace(); } });
  $("againBtn")?.addEventListener("click", (e) => {
    const b = /** @type {HTMLElement} */ (e.currentTarget);
    if (b.dataset.asked !== "1") { b.dataset.asked = "1"; b.textContent = titleOffer(journey.count(), SEALS.length, left, y.start).confirm; return; }
    track("demo.restart", { from: "title", seals: journey.count() });
    // Another level's start empties nothing of the prologue's.
    journey.reset(); visit.metres = visit.seconds = 0; keep(); if (ours) { clearPlace(localStorage); forgetTitle(); } else if (ownPlace) { clearLevelPlace(localStorage, levelId); clearLevelPage(localStorage, levelId); } left = null; b.dataset.asked = "";
    const [x, z, turn] = y.start; y.place(x, z, turn); refresh(); rites.rest(); enter(true);
  });
  // Stepping in. A first visit (and a visit begun again from the foot of the path) is shown where it is going first
  // (src/opening.js): the bell up on the mountain, the eye coming down to him; the first lines (where to go, how to walk)
  // wait until the walk is his, and so does the music. A visitor who goes on from where they were steps straight in.
  const enter = (again = false) => {
    if (entered) return;
    const resumed = !!(left && titleOffer(journey.count(), SEALS.length, left, y.start).going);
    track("demo.enter", { resumed, seals: journey.count(), tier: y.tier || "" });
    const o = openingFor({ seals: journey.count(), place: left, start: y.start, params: Q, again: again === true, autocam: y.autocam(), reduced: y.reduced(), level: y.level });
    if (o.eye !== "none") holdMusic(true);
    if (o.bell) mountainBell();   // inside the click that stepped in, so the browser lets it sound
    entered = true; title?.classList.add("gone"); setTimeout(() => title && (title.hidden = true), 1600); y.listen(); document.body.classList.add("entered");
    // Where to go is said after how to walk has gone (he has taken a few steps, or the line has faded), so that a
    // visitor arriving is given one thing to read at a time.
    // (named apart from `begin`, which starts an observance, and `arrive`, which brings a lamp lit for him: a name used
    // again inside this function hides the one outside it, and a lamp link once went round and round for it,
    // tests/unit/shadow.test.mjs)
    const showWay = () => {
      if (arrival) { arrive(); return; }   // a lamp lit for him: that is where he is taken first
      let waited = 0;
      const filledAtEntry = journey.opened();   // (a book filled on this walk is told of when it is shut, with the hour, not by this timer, #726)
      const go = () => { const n = journey.next(); if (n) say(t(n.hint), 8); setTimeout(() => filledAtEntry && announce(), 14000 * fast); };
      const until = setInterval(() => { waited += 0.25; if (waited > 0.5 && (y.hints?.state().tip !== "walk" || waited > 13)) { clearInterval(until); go(); } }, 250 * fast);
    };
    // A friend's shared link names a scene (?from=, src/sharelink.js, #344): a first visit is shown the mountain as ever,
    // and then taken to that place behind the veil; one who goes on from where they were is not moved.
    const scene = !resumed ? fromOf(location.search) : null, land = scene && places[scene] ? places[scene] : null;
    const toScene = async () => { if (land) await y.travel(land.at[0], land.at[1], Math.PI - land.face, land.room || null); showWay(); };
    if (o.eye === "none") { toScene(); return; }
    track("opening.played", { eye: o.eye, again: again === true });
    y.opening(o.eye).then((s) => { holdMusic(false); if (s.skipped) track("opening.skipped", { eye: o.eye, at: Math.round(((s.skippedAt ?? s.s) / (s.length || 1)) * 100) }); toScene(); });
  };
  // After a change of language the title's place is kept by the sheet that says the words are being changed, until
  // the page is ready; then it fades as the title does when he steps in (#140).
  if (title && y.relang) { document.body.classList.add("entered"); const ready = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(ready); title.classList.add("gone"); setTimeout(() => { title.hidden = true; document.documentElement.classList.remove("relang"); }, 1600); } }, 100); }
  else if (title) { if (entered) { title.hidden = true; document.body.classList.add("entered"); } else { $("enterBtn").addEventListener("click", enter); const ready = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(ready); $("enterBtn").disabled = false; offer(); } }, 200); } }
  // ?show=shot-<id>: the observance begun where he stands, with the eye already on its shot (tools/shots.js).
  // He is put as the observance has him (seated for the tea and the summit, at the rope for the bell, his palms together
  // elsewhere), not taken through it, so that the picture is the same however slowly the page draws.
  function pose(id) {
    const p = places[id] || y.gallery[id]; if (!p || rite) return false;   // a place, or the 功德箱's spot
    const mineRite = (rite = /** @type {any} */ ({ id, posed: true })), on = () => rite === mineRite;
    y.stage({ face: p.face, pose: p.sit ? seatPose(p.seat || p.at, p.room || null) : id === "well" || id === "bell" ? false : "pray", lift: p.sit ? placeLift(p, y.site.seats, y.walker.heightAt) : 0, seat: p.seat, act: rites.act, leave: () => { if (on()) end(); } });
    if (id === "bell") rites.takeRope(on);
    if (id === "lamp") mine.visible = true;
    if (p.offering) rites.poseCoin(p.slot, p.at, p.face, y.walker.heightAt(p.at[0], p.at[1]));   // the moment the coin is held over the slot
    if (lp && (p.rite === "copy" || lp.isStroke(id))) { y.stage({ face: p.face, pose: false, lift: 0, act: rites.act, leave: () => { if (on()) end(); } }); rites.writing.pose({ text: lp.nextLine().text }); }   // the brush on the paper
    return y.direct(id, { now: true });
  }
  window.__poseRite = (id) => pose(id);
  // For the tests: a temple's own page (src/levelpage.js): what is on it, the looks held, what is being written; `meet` takes the looks as met.
  window.__page = (/** @type {{ meet?: boolean, show?: boolean } | undefined} */ o) => { if (!lp) return null; if (o?.meet) lp.meet(); if (o?.show) showPage(); return { ...lp.state(), view: lp.view(), writing: rites.state().writing, near, rite: rite && rite.id }; };
  window.__coin = () => ({ ...coinsHeard(), ...rites.state().coin, directed: y.directed() });   // the coin's own state and when its sound was asked for (a test compares them)
  { const want = (Q.get("show") || "").replace(/^shot-/, ""); if (want && want !== Q.get("show") && (places[want] || y.gallery[want])) { const go = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(go); pose(want); } }, 100); } }
  refresh(); rites.restore({ incense: (() => { try { return readIncense(localStorage.getItem(INCENSE)); } catch { return {}; } })() });

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
    } else if (play && (SEAL[play] || incenseHall(play) || lp?.offers(play))) begin(play);
    else if (play && lp?.isStroke(play)) { lp.meet(); begin(play); }   // ?play=p1a|p1b: the two looks taken as met, and the stroke written there
  })();

  // For the tests.
  window.__journey = () => { const n = journey.next(); return { rings: Object.values(rings).filter((m) => m.visible).length, look, seen: [...seen], ...journey.snapshot(), count: journey.count(), total: journey.total, done: journey.done(), earned: journey.list().filter((d) => d.got).map((d) => d.seal), near, rite: rite && rite.id, entered, next: n?.id || null, nextPlace: n?.place || null, nextSeal: n?.seal || null, lampLit: mine.visible, book: page ? [page.width, page.height] : null }; };
  window.__hush = (on) => { hush(on); };   // the music held back as when he sits on after tea, or let back
  window.__rites = () => ({ ...rites.state(), seat: seatHere ? { at: seatHere.at, room: seatHere.room } : null, sat, ended, went, closing, words, him: y.monk.group.position.toArray().map((v) => +v.toFixed(3)), line: $("endingLine")?.textContent || "" });
  window.__seats = y.site.seats; window.__sit = (i) => sitDown(y.site.seats[i]); window.__ending = () => finale();
  window.__left = () => ({ place: readPlace(localStorage), offer: titleOffer(journey.count(), SEALS.length, left, y.start), again: !!$("againBtn") && !$("againBtn").hidden });
  window.__visit = () => ({ metres: visit.metres, seconds: visit.seconds });
  // For the tests: the slip of paper with the i-th of the library's lines on it (`__slip(null)` puts it away).
  window.__verses = VERSES.length; window.__slip = (i) => { if (i == null) { ui.close("slip"); return null; } const v = pickVerse(i); holdOut(t(v.text), t(v.from), t("收下"), () => {}); return v.text; };
  window.__presence = () => ({ ...presence.state(), line: presence.line(near || ""), near });
  window.__places = places; window.__rite = (id) => begin(id); window.__enter = enter; window.__book = openBook;
  // For the phone audit and pictures: the offering sheet as it opens after a coin, without the coin (web build only; null when there is none).
  window.__offeringSheet = () => { if (!(WEB && sheet)) return false; ui.open("offering"); sheet.opened(); return true; };
  window.__take = () => rite && rite.take && rite.take();
  return { near: () => near, rite: () => rite && rite.id };
}
