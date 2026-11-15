// The visit as something to do: a title to step in from, seven small observances up the mountain, a seal for each,
// and a book that fills. journey.js keeps the book; this file puts it on the page and in the place: the rings drawn
// on the ground where an observance is made, the button that offers it, how each one unfolds, the seal that
// answers it, and the page of seals at the end. yard.js lends it the walker, the novice and the clock (`y`).
import * as THREE from "three";
import { asset } from "./assets.js";
import { WORKS } from "./works.js";
import { SEAL, SEALS, createJourney, browserStore, placeAt, pickVerse } from "./journey.js";
import { drawGoshuin, sealStamp } from "./goshuin.js";
import { chime, drop, setSeals } from "./audio.js";

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
  const journey = createJourney(browserStore());
  // The three sheets the visit holds out (src/ui.js): a slip of paper, a work read closely, the book. Each is put away
  // by its own button, by Esc, or by E once it has been read; the slip by Esc is still taken.
  const ui = y.ui;
  ui.layer("slip", { confirm: "slipTake" }).layer("piece", { confirm: "pieceClose" }).layer("book", { keys: { b: "bookClose" } });
  $("slipTake")?.addEventListener("click", () => ui.close("slip"));
  const holdOut = (text, from, take, onClose) => { $("slipText").textContent = text; $("slipFrom").textContent = from; $("slipTake").textContent = take; ui.open("slip", { onClose }); };
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000 * fast));
  let rite = null, near = null, entered = Q.has("shot") || Q.has("show") || Q.has("cam") || Q.has("enter");

  // The visit so far: metres walked and time on the mountain, kept between sittings like the seals.
  const VISIT = "yunjing.visit.v1", visit = { metres: 0, seconds: 0, at: null, save: 0 };
  try { const v = JSON.parse(localStorage.getItem(VISIT) || "null"); if (v && Number.isFinite(v.metres) && Number.isFinite(v.seconds)) { visit.metres = Math.max(0, v.metres); visit.seconds = Math.max(0, v.seconds); } } catch {}
  const keep = () => { try { localStorage.setItem(VISIT, JSON.stringify({ metres: Math.round(visit.metres), seconds: Math.round(visit.seconds) })); } catch {} };
  const told = () => `这一趟走了 ${Math.round(visit.metres)} 步，在山上 ${Math.max(1, Math.round(visit.seconds / 60))} 分钟。`;
  // ---- On the ground: a ring at every place whose seal is still to be earned ----
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
    for (const id in rings) rings[id].visible = !journey.has(id) && (places[id].room || null) === y.room();
    mine.visible = journey.has("lamp");
    const n = journey.count(), next = journey.next(); setSeals(n);   // the music knows how much of its theme has been earned
    if ($("bookBtn")) $("bookBtn").innerHTML = n ? `朱印<span class="count">${"〇一二三四五六七"[n]}</span>` : "朱印";   // the count is a small seal on the slip
    // The next place: a small seal with its first character, the words 下一处 above its name.
    const g = $("goal"), word = next ? `下一处 · ${next.place}` : "七印圆满";
    if (g && g.dataset.word !== word) { if (g.dataset.word) y.hints?.say.goal(); g.dataset.word = word; g.innerHTML = next ? `<i class="seal-mark">${next.place[0]}</i><span><small>下一处</small>${next.place}</span>` : `<i class="seal-mark">圆</i><span>七印圆满</span>`; }
    if ($("titleSeals")) $("titleSeals").textContent = n ? (n === 7 ? "七印圆满 · 山门常开" : `已得${"〇一二三四五六七"[n]}印`) : "";
  };

  // ---- Words on the page ----
  let sayTimer = 0;
  const say = (text, secs = 5) => { const el = $("say"); if (!el) return; el.textContent = text; el.classList.add("on"); clearTimeout(sayTimer); sayTimer = setTimeout(() => el.classList.remove("on"), secs * 1000); };
  function earned(id) {
    chime(1, journey.count()); refresh();
    const el = $("toast"), d = SEAL[id]; if (!el) return;
    $("toastSeal").src = sealStamp(d.seal, 220, { seed: SEALS.indexOf(d) + 11 }).toDataURL(); $("toastLine").textContent = id === "sutra" && journey.verse ? journey.verse.text : d.line; $("toastName").textContent = `${d.place} · ${d.seal}`;
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; }, 900); if (journey.done()) openBook(); else y.hints?.say.seal(); }, 4200 * Math.max(fast, 0.3));
  }

  // ---- Each observance ----
  const end = () => { rite = null; y.stage(null); $("breath")?.setAttribute("hidden", ""); };
  async function begin(id) {
    if (rite || !places[id]) return;
    const p = places[id], d = SEAL[id]; $("act")?.setAttribute("hidden", "");
    if (id === "bell") { y.strike("bell"); return; }                                  // the stroke itself is heard below
    const mineRite = (rite = /** @type {any} */ ({ id })), on = () => rite === mineRite;
    if (!(await new Promise((r) => y.walkTo([p.at], r))) || !on()) { if (on()) rite = null; return; }
    y.stage({ face: p.face, pose: p.sit ? "sit" : id === "well" ? false : "pray", lift: p.sit ? p.lift ?? 0.1 : 0, seat: p.seat, leave: () => { if (on()) end(); } });
    if (id === "tea") { await wait(2); if (!on()) return; say(d.line, 6); await wait(5); }
    else if (id === "incense") { await wait(2.2); if (!on()) return; say(d.line, 6); await wait(3); }
    else if (id === "well") { say(d.line, 6); for (let i = 0; i < 3; i++) { await wait(1.5); if (!on()) return; drop(); } await wait(1.2); }
    else if (id === "lamp") { await wait(1.8); if (!on()) return; mine.visible = true; say(d.line, 5); await wait(2); }
    else if (id === "sit") {
      const b = $("breath"); b?.removeAttribute("hidden");
      for (let i = 0; i < 3; i++) { if (b) { b.dataset.phase = "in"; $("breathWord").textContent = "吸"; } await wait(4); if (!on()) return; if (b) { b.dataset.phase = "out"; $("breathWord").textContent = "呼"; } await wait(5); if (!on()) return; }
      b?.setAttribute("hidden", ""); say(d.line, 6);
    } else if (id === "sutra") {
      await wait(1.6); if (!on()) return;
      const day = Math.floor(Date.now() / 864e5), verse = pickVerse(Q.has("seed") ? +Q.get("seed") : day + (journey.born % 97));
      await new Promise((r) => { mineRite.take = () => ui.close("slip"); holdOut(verse.text, verse.from, "收下", r); }); if (!on()) return;
      if (journey.earn("sutra", { verse })) earned("sutra"); end(); return;
    }
    if (!on()) return;
    if (journey.earn(id)) earned(id);
    if (p.sit) { rite = null; return; }   // he stays seated until he is sent somewhere
    await wait(1.2); if (on()) end();
  }
  window.addEventListener("struck", (e) => {
    if (/** @type {CustomEvent} */ (e).detail !== "bell" || journey.has("bell")) return;
    const r = journey.strike(); say(["", "一下", "两下", "三下"][r.strikes] || "", 2.5); if (r.earned) earned("bell"); else refresh();
  });
  window.addEventListener("incense-offered", () => { if (journey.earn("incense")) earned("incense"); });

  // ---- The button that offers what can be done here ----
  let acc = 0, look = null, wasIndoors = false; const seen = new Set();
  y.onTick((dt) => {
    // The marker toward the next place rides the picture every frame, but only while the goal is being shown.
    { const el = $("way"), g = $("goal"), next = journey.next(), p = next && places[next.id];
      if (el) { const show = !!(p && g && g.classList.contains("on") && entered && (p.room || null) === y.room() && !rite);
        el.classList.toggle("on", show);
        if (show) { const w = y.where(), py = p.y ?? y.walker.heightAt(p.at[0], p.at[1]), sc = y.screenOf(p.at[0], py + 1.6, p.at[1]), m = 46;
          let sx = sc.x, sy = sc.y; if (sc.behind) { sx = sc.w - sx; sy = sc.h - m; }
          sx = Math.min(sc.w - m, Math.max(m, sx)); sy = Math.min(sc.h - m * 2.4, Math.max(m * 1.6, sy));
          el.style.transform = `translate(${sx.toFixed(1)}px, ${sy.toFixed(1)}px) translate(-50%, -50%)`; el.lastChild.textContent = `${Math.max(1, Math.round(Math.hypot(p.at[0] - w.x, p.at[1] - w.z)))} 步`; } } }
    // How long this visit has been and how far it has gone: told on the last page of the book.
    { const w = y.where(); if (entered) { if (visit.at) { const d = Math.hypot(w.x - visit.at[0], w.z - visit.at[1]); if (d < 3) visit.metres += d; } visit.at = [w.x, w.z]; visit.seconds += dt; if ((visit.save += dt) > 10) { visit.save = 0; keep(); } } }
    for (const id in rings) if (rings[id].visible) rings[id].material.opacity = (0.5 + 0.22 * Math.sin(performance.now() / 900 + id.length)) * (y.night() ? 0.9 : 0.75), rings[id].material.color.setScalar(1).multiply(y.night() ? new THREE.Color(1, 0.86, 0.6) : new THREE.Color(0.06, 0.05, 0.045));
    const nowT = performance.now(); if (nowT - acc < 180) return; acc = nowT;   // a few times a second is enough
    const w = y.where(), free = entered && !rite && !y.busy(), indoors = y.inside();
    const room = y.room(), here = free ? placeAt(Object.fromEntries(Object.entries(places).filter(([, p]) => (p.room || null) === room)), w.x, w.z) : null;
    near = here && !journey.has(here) ? here : null;
    // Indoors, standing before a frame on the wall offers a look at what hangs there.
    look = free && indoors && !near ? placeAt(Object.fromEntries(Object.entries(y.gallery).filter(([, p]) => p.room === room)), w.x, w.z) : null;
    const b = $("act"); if (!b) return;
    if (near || look) { const w = near ? SEAL[near].act : "观看"; if (b.dataset.word !== w || !b.firstChild) { b.dataset.word = w; b.innerHTML = `<i class="enso"><kbd>E</kbd></i><span>${w}</span>`; } b.hidden = false; } else b.hidden = true;
    if (indoors !== wasIndoors) { wasIndoors = indoors; refresh(); if (indoors) say(room === "main" && !journey.has("incense") ? "走到佛前的圆相里，上一炷香。" : y.hallName(), 5); }
  });
  $("act")?.addEventListener("click", () => {
    if (near) return begin(near);
    if (!look) return;
    const it = y.gallery[look].item; y.stage({ face: y.gallery[look].face, pose: false, lift: 0, leave() {} });
    if (it.work) return showWork(it.work, look);
    const spot = look; holdOut(it.title, it.text, "看过了", () => { y.stage(null); seen.add(spot); });
  });

  // ---- A work on the wall, read closely: the picture, and beside it what an encyclopedia would say ----
  function showWork(slug, spot) {
    const w = WORKS[slug], el = $("piece"); if (!w || !el) return;
    $("pieceImg").src = asset(`levels/t00/gallery/${slug}.webp`); $("pieceImg").alt = w.title;
    $("pieceTitle").textContent = w.title; $("pieceBy").textContent = [w.by, w.dates].filter(Boolean).join("　");
    $("pieceFacts").innerHTML = [["年代", w.period], ["质地", w.medium], ["尺寸", w.size && w.size + " 厘米"], ["收藏", w.holder + (w.rank ? "　" + w.rank : "")]].filter(([, v]) => v).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    $("pieceNote").textContent = w.note; $("pieceLink").textContent = w.link; $("pieceCredit").textContent = w.credit;
    ui.open("piece", { onClose: () => { y.stage(null); seen.add(spot); } });
  }
  $("pieceClose")?.addEventListener("click", () => ui.close("piece"));
  window.__work = (slug) => (slug ? showWork(slug, null) : { open: ui.isOpen("piece"), title: $("pieceTitle")?.textContent, loaded: !!$("pieceImg")?.naturalWidth });

  // ---- The book ----
  let page = null;
  async function openBook() {
    const m = y.mood(), next = journey.next();
    page = await drawGoshuin({ seals: journey.list(), verse: journey.verse, when: journey.finished || Date.now(), label: m.label, url: location.host + location.pathname.replace(/\/$/, "") });
    const blob = await new Promise((r) => page.toBlob(r, "image/jpeg", 0.92)), url = URL.createObjectURL(blob);
    $("bookImg").src = url; $("bookSave").href = url; $("bookSave").download = "云径禅寺-朱印.jpg";
    $("bookHint").textContent = next ? `${next.hint}　${told()}` : `七印圆满。这一页是你的了。${told()}`;
    const file = new File([blob], "yunjing-seals.jpg", { type: "image/jpeg" });
    $("bookShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] })); $("bookShare").onclick = async () => { try { await navigator.share({ files: [file], title: "云径禅寺 · 朱印" }); } catch {} };
    $("bookReset").textContent = "重新朝山"; ui.open("book");
  }
  $("bookBtn")?.addEventListener("click", openBook);
  $("bookClose")?.addEventListener("click", () => ui.close("book"));
  $("bookReset")?.addEventListener("click", (e) => { if (/** @type {HTMLElement} */ (e.currentTarget).textContent === "重新朝山") { /** @type {HTMLElement} */ (e.currentTarget).textContent = "再点一次，清空朱印"; return; } journey.reset(); visit.metres = visit.seconds = 0; keep(); refresh(); ui.close("book"); });

  // ---- The title ----
  const title = $("title");
  const enter = () => { if (entered) return; entered = true; title?.classList.add("gone"); setTimeout(() => title && (title.hidden = true), 1600); y.listen(); document.body.classList.add("entered"); const n = journey.next(); if (n) say(n.hint, 8); };
  if (title) { if (entered) { title.hidden = true; document.body.classList.add("entered"); } else { $("enterBtn").addEventListener("click", enter); const ready = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(ready); $("enterBtn").disabled = false; $("enterBtn").textContent = "入山"; } }, 200); } }
  refresh();

  // For the tests.
  window.__journey = () => ({ look, seen: [...seen], ...journey.snapshot(), count: journey.count(), done: journey.done(), near, rite: rite && rite.id, entered, next: journey.next()?.id || null, lampLit: mine.visible, book: page ? [page.width, page.height] : null });
  window.__visit = () => ({ metres: visit.metres, seconds: visit.seconds });
  window.__places = places; window.__rite = (id) => begin(id); window.__enter = enter; window.__book = openBook;
  window.__take = () => rite && rite.take && rite.take();
  return { near: () => near, rite: () => rite && rite.id };
}
