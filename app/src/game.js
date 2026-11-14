// The visit as something to do: a title to step in from, seven small observances up the mountain, a seal for each,
// and a book that fills. journey.js keeps the book; this file puts it on the page and in the place: the rings drawn
// on the ground where an observance is made, the button that offers it, how each one unfolds, the seal that
// answers it, and the page of seals at the end. yard.js lends it the walker, the novice and the clock (`y`).
import * as THREE from "../v/build/three.module.js";
import { SEAL, SEALS, createJourney, browserStore, placeAt, pickVerse } from "./journey.js";
import { drawGoshuin, sealStamp } from "./goshuin.js";
import { chime, drop } from "./audio.js";

const $ = (id) => document.getElementById(id);

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
  const wait = (s) => new Promise((r) => setTimeout(r, s * 1000 * fast));
  let rite = null, near = null, entered = Q.has("shot") || Q.has("show") || Q.has("cam") || Q.has("enter");

  // ---- On the ground: a ring at every place whose seal is still to be earned ----
  const tex = ensoTexture(), rings = {};
  for (const id in places) {
    const p = places[id], w = id === "sutra" || id === "sit" ? 0.9 : 1.5;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, w).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }));
    m.position.set(p.at[0], y.walker.heightAt(p.at[0], p.at[1]) + (p.sit ? 0.14 : 0.03), p.at[1]); m.rotation.y = id.length; m.renderOrder = 2; y.scene.add(m); rings[id] = m;
  }
  // The lamp the visitor lights stays lit.
  const mine = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8).scale(1, 2.1, 1), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 2.4, 0.7), fog: false }));
  mine.position.set(...places.lamp.flame); y.scene.add(mine);
  const refresh = () => {
    for (const id in rings) rings[id].visible = !journey.has(id);
    mine.visible = journey.has("lamp");
    const n = journey.count(), next = journey.next();
    if ($("bookBtn")) $("bookBtn").textContent = n ? `朱印 ${"〇一二三四五六七"[n]}` : "朱印";
    if ($("goal")) $("goal").textContent = next ? `下一处 · ${next.place}` : "七印圆满";
    if ($("titleSeals")) $("titleSeals").textContent = n ? (n === 7 ? "七印圆满 · 山门常开" : `已得${"〇一二三四五六七"[n]}印`) : "";
  };

  // ---- Words on the page ----
  let sayTimer = 0;
  const say = (text, secs = 5) => { const el = $("say"); if (!el) return; el.textContent = text; el.classList.add("on"); clearTimeout(sayTimer); sayTimer = setTimeout(() => el.classList.remove("on"), secs * 1000); };
  function earned(id) {
    chime(); refresh();
    const el = $("toast"), d = SEAL[id]; if (!el) return;
    $("toastSeal").src = sealStamp(d.seal, 220, { seed: SEALS.indexOf(d) + 11 }).toDataURL(); $("toastLine").textContent = id === "sutra" && journey.verse ? journey.verse.text : d.line; $("toastName").textContent = `${d.place} · ${d.seal}`;
    el.hidden = false; el.classList.remove("on"); void el.offsetWidth; el.classList.add("on");
    setTimeout(() => { el.classList.remove("on"); setTimeout(() => { el.hidden = true; }, 900); if (journey.done()) openBook(); }, 4200 * Math.max(fast, 0.3));
  }

  // ---- Each observance ----
  const end = () => { rite = null; y.stage(null); $("breath")?.setAttribute("hidden", ""); };
  async function begin(id) {
    if (rite || !places[id]) return;
    const p = places[id], d = SEAL[id]; $("act")?.setAttribute("hidden", "");
    if (id === "bell") { y.strike("bell"); return; }                                  // the stroke itself is heard below
    if (id === "incense") { y.walkTo([[y.site.hall.foot.x, y.site.hall.foot.z], [y.site.hall.door.x, y.site.hall.door.z]]); return; }
    const mineRite = (rite = { id }), on = () => rite === mineRite;
    if (!(await new Promise((r) => y.walkTo([p.at], r))) || !on()) { if (on()) rite = null; return; }
    y.stage({ face: p.face, pose: p.sit ? "sit" : id === "well" ? false : "pray", lift: p.sit ? 0.1 : 0, leave: () => { if (on()) end(); } });
    if (id === "tea") { await wait(2); if (!on()) return; say(d.line, 6); await wait(5); }
    else if (id === "well") { say(d.line, 6); for (let i = 0; i < 3; i++) { await wait(1.5); if (!on()) return; drop(); } await wait(1.2); }
    else if (id === "lamp") { await wait(1.8); if (!on()) return; mine.visible = true; say(d.line, 5); await wait(2); }
    else if (id === "sit") {
      const b = $("breath"); b?.removeAttribute("hidden");
      for (let i = 0; i < 3; i++) { if (b) { b.dataset.phase = "in"; $("breathWord").textContent = "吸"; } await wait(4); if (!on()) return; if (b) { b.dataset.phase = "out"; $("breathWord").textContent = "呼"; } await wait(5); if (!on()) return; }
      b?.setAttribute("hidden", ""); say(d.line, 6);
    } else if (id === "sutra") {
      await wait(1.6); if (!on()) return;
      const day = Math.floor(Date.now() / 864e5), verse = pickVerse(Q.has("seed") ? +Q.get("seed") : day + (journey.born % 97));
      $("slipText").textContent = verse.text; $("slipFrom").textContent = verse.from; $("slip").hidden = false;
      await new Promise((r) => { $("slipTake").onclick = r; mineRite.take = r; }); $("slip").hidden = true; if (!on()) return;
      if (journey.earn("sutra", { verse })) earned("sutra"); end(); return;
    }
    if (!on()) return;
    if (journey.earn(id)) earned(id);
    if (p.sit) { rite = null; return; }   // he stays seated until he is sent somewhere
    await wait(1.2); if (on()) end();
  }
  window.addEventListener("struck", (e) => {
    if (e.detail !== "bell" || journey.has("bell")) return;
    const r = journey.strike(); say(["", "一下", "两下", "三下"][r.strikes] || "", 2.5); if (r.earned) earned("bell"); else refresh();
  });
  window.addEventListener("incense-offered", () => { if (journey.earn("incense")) earned("incense"); });

  // ---- The button that offers what can be done here ----
  let acc = 0;
  y.onTick((dt) => {
    for (const id in rings) if (rings[id].visible) rings[id].material.opacity = (0.5 + 0.22 * Math.sin(performance.now() / 900 + id.length)) * (y.night() ? 0.9 : 0.75), rings[id].material.color.setScalar(1).multiply(y.night() ? new THREE.Color(1, 0.86, 0.6) : new THREE.Color(0.06, 0.05, 0.045));
    if ((acc += dt) < 0.2) return; acc = 0;
    const w = y.where(), here = entered && !rite && !y.busy() ? placeAt(places, w.x, w.z) : null;
    near = here && !journey.has(here) ? here : null;
    const b = $("act"); if (!b) return;
    if (near) { b.textContent = near === "incense" ? "进殿" : SEAL[near].act; b.hidden = false; } else b.hidden = true;
  });
  $("act")?.addEventListener("click", () => near && begin(near));

  // ---- The book ----
  let page = null;
  async function openBook() {
    const m = y.mood(), next = journey.next();
    page = await drawGoshuin({ seals: journey.list(), verse: journey.verse, when: journey.finished || Date.now(), label: m.label, url: location.host + location.pathname.replace(/\/$/, "") });
    const blob = await new Promise((r) => page.toBlob(r, "image/jpeg", 0.92)), url = URL.createObjectURL(blob);
    $("bookImg").src = url; $("bookSave").href = url; $("bookSave").download = "云径禅寺-朱印.jpg";
    $("bookHint").textContent = next ? next.hint : "七印圆满。这一页是你的了。";
    const file = new File([blob], "yunjing-seals.jpg", { type: "image/jpeg" });
    $("bookShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] })); $("bookShare").onclick = async () => { try { await navigator.share({ files: [file], title: "云径禅寺 · 朱印" }); } catch {} };
    $("bookReset").textContent = "重新朝山"; $("book").hidden = false;
  }
  $("bookBtn")?.addEventListener("click", openBook);
  $("bookClose")?.addEventListener("click", () => { $("book").hidden = true; });
  $("bookReset")?.addEventListener("click", (e) => { if (e.currentTarget.textContent === "重新朝山") { e.currentTarget.textContent = "再点一次，清空朱印"; return; } journey.reset(); refresh(); $("book").hidden = true; });

  // ---- The title ----
  const title = $("title");
  const enter = () => { if (entered) return; entered = true; title?.classList.add("gone"); setTimeout(() => title && (title.hidden = true), 1600); y.listen(); document.body.classList.add("entered"); const n = journey.next(); if (n) say(n.hint, 8); };
  if (title) { if (entered) { title.hidden = true; document.body.classList.add("entered"); } else { $("enterBtn").addEventListener("click", enter); const ready = setInterval(() => { if (document.body.dataset.ready === "1") { clearInterval(ready); $("enterBtn").disabled = false; $("enterBtn").textContent = "入山"; } }, 200); } }
  refresh();

  // For the tests.
  window.__journey = () => ({ ...journey.snapshot(), count: journey.count(), done: journey.done(), near, rite: rite && rite.id, entered, next: journey.next()?.id || null, lampLit: mine.visible, book: page ? [page.width, page.height] : null });
  window.__places = places; window.__rite = (id) => begin(id); window.__enter = enter; window.__book = openBook;
  window.__take = () => rite && rite.take && rite.take();
  return { near: () => near, rite: () => rite && rite.id };
}
