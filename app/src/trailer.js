// The player of trailer mode (#610): given a script (trailer-path.js's shape), it draws any frame of the film by moving the
// page's fixed clock (trailer-clock.js) and nothing else. A frame of the film is `__trailer.frame(i)`: the shot it belongs
// to is cued if it is not the shot just drawn (the place, the hour, who stands where, a warm-up of frames on the shot's own
// stretch of the clock so that every frame of a shot is the same whenever it is drawn, and from any shot), then the shot is
// told its time, the paper and the words are laid over, and the clock moves on by one frame. The renderer (tools/trailer.mjs)
// takes the picture. It speaks only through the page's own hooks (`__mood`, `__pose`, `__walk`, `__inside`, `__up`,
// `__openingAt`, `__strike`, `__flock`), so it knows no temple.
import { shotAt, eyeAt, coverAt, captionAt, cardAt, framesOf } from "./trailer-path.js";

export const SHOT_BASE = 10_000_000, SHOT_SPAN = 1_000_000;   // ms of the clock between one shot's stretch and the next's: a shot is the same whatever came before it
const WARM = 1.5;                      // seconds of the game run on before a shot's first frame, unseen

/** @param {any} win */
export function createTrailerPlayer(win) {
  const doc = win.document, clock = win.__trailerClock;
  /** @type {any} */ let script = null; let fps = clock.fps, cued = -1, local = 0, fx = null, fired = new Set();
  const doorsReady = () => { const r = win.__doorways?.(); return !r || !r.halls || Object.values(r.halls).every((/** @type {any} */ h) => !h.want || (h.source === "baked" && h.fade === 1) || h.source === "none" || h.source === "failed"); };
  const sleep = (/** @type {number} */ ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => { for (let k = 0; k < 4; k++) await sleep(0); };

  function mountFx() {
    const root = doc.createElement("div"); root.id = "trailerFx";
    root.innerHTML = `<div class="tr-cap"><div class="zh"></div><div class="en"></div></div>
      <div class="tr-cover"></div>
      <div class="tr-card"><div class="t"></div><div class="s"></div><div class="e"></div><div class="w"><span class="wz"></span><span class="we"></span></div></div>`;
    const css = doc.createElement("style");
    css.textContent = `
      #trailerFx{position:fixed;inset:0;z-index:100000;pointer-events:none;font-family:"Yunjing Kai",serif;color:#f4efe2}
      #trailerFx .tr-cap{position:absolute;left:0;right:0;bottom:15%;text-align:center;opacity:0;text-shadow:0 0 .35em rgba(20,16,10,.65),0 .05em .2em rgba(20,16,10,.5)}
      #trailerFx .zh{font-size:3.6vh;letter-spacing:.18em}
      #trailerFx .en{font-size:2.1vh;letter-spacing:.06em;margin-top:.7vh;opacity:.92;font-style:italic}
      #trailerFx .tr-cover{position:absolute;inset:0;background:#e8e0cd;opacity:0}
      #trailerFx .tr-card{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;opacity:0;color:#2b2620}
      #trailerFx .tr-card .t{font-family:"Yunjing Brush","Yunjing Kai",serif;font-size:13vh;letter-spacing:.14em;margin-bottom:1.6vh}
      #trailerFx .tr-card .s{font-size:3.2vh;letter-spacing:.3em;margin-bottom:5.5vh}
      #trailerFx .tr-card .e{font-size:3vh;letter-spacing:.12em;font-style:italic;opacity:.85}
      #trailerFx .tr-card .w{position:absolute;bottom:9%;font-size:2.3vh;letter-spacing:.2em;opacity:.78}
      #trailerFx .tr-card .w .we{margin-left:1.2em;font-size:2vh;letter-spacing:.1em}
      body.trailer *{cursor:none!important}`;
    doc.head.appendChild(css); doc.body.appendChild(root);
    return { cap: root.querySelector(".tr-cap"), zh: root.querySelector(".zh"), en: root.querySelector(".en"), cover: root.querySelector(".tr-cover"), card: root.querySelector(".tr-card"), root };
  }

  function lay(sec) {
    const c = coverAt(script, sec), cap = captionAt(script, sec), card = cardAt(script, sec);
    fx.cover.style.opacity = String(+c.toFixed(4));
    if (cap) { if (fx.zh.textContent !== cap.zh) { fx.zh.textContent = cap.zh; fx.en.textContent = cap.en; } fx.cap.style.opacity = String(+(cap.alpha * (1 - c)).toFixed(4)); } else fx.cap.style.opacity = "0";
    const k = script.card;
    if (k) { const [t, s, e, w] = [".t", ".s", ".e", ".w"].map((q) => fx.card.querySelector(q)); t.textContent = k.title; s.textContent = k.sub; e.textContent = k.en; w.querySelector(".wz").textContent = k.wish; w.querySelector(".we").textContent = k.wishEn; }
    fx.card.style.opacity = String(+card.toFixed(4));
  }

  // The state of the page for a shot: the hour, where he stands, which room, which storey, what the eye does.
  async function cue(index) {
    const shot = script.shots[index];
    win.__trailerEye(null); win.__openingAt(null); win.__look?.();
    if (win.__up() && !shot.up) await win.__up(null);
    const indoors = doc.body.classList.contains("indoors");   // (he may have walked out of the room himself, in the shot before)
    if (shot.hall) await win.__inside(shot.hall); else if (indoors) await win.__inside(null);   // (leaving a room is only asked of one he is in)
    win.__mood(shot.season, shot.time);
    clock.jump(SHOT_BASE + (index + 1) * SHOT_SPAN);
    const at = shot.at, view = shot.view || "first";
    win.__view(view);
    if (shot.kind === "follow") { win.__pose(at[0], at[1], at[2], at[3]); }
    else if (shot.kind === "eye") { const s = shot.stand || [shot.keys[0].p[0], shot.keys[0].p[2], 0]; if (!shot.up && !shot.hall) win.__pose(s[0], s[1], s[2], 0.05); else if (shot.hall) win.__pose(shot.keys[0].p[0], shot.keys[0].p[2] + 3, 0, 0); }
    if (shot.up) { await win.__show("loft"); }
    win.__trailerReset();
    local = 0; fired = new Set();
    await settle();
    // Everything the shot shows has arrived before its first frame, so that nothing is fetched into it: the rooms' figures, and
    // the pictures of the halls seen through their doors (their fades run on the clock, so they are stepped, not waited for).
    for (let k = 0; k < 600 && (win.__figures?.() === "loading" || !doorsReady()); k++) { clock.step(); await sleep(50); }
    drive(shot, 0);
    // Warm-up: the shot's own game seconds before the first frame, with the first pose held, so that the eye's springs, the
    // leaves in the air and the wind are where they would be a moment into the shot; then he sets off.
    const n = Math.round(WARM * fps);
    for (let k = 0; k < n; k++) { clock.step(); if (k % 15 === 14) await sleep(0); }
    if (shot.kind === "follow" && shot.walk) win.__walk(shot.walk);
    cued = index;
  }

  // What a shot does with the time `t` into it: the free eye, the opening's second, the events (strokes of the bell, the flock).
  function drive(shot, t) {
    if (shot.kind === "eye") { const e = eyeAt(shot, t); win.__trailerEye({ p: e.p.toArray(), look: e.look.toArray(), fov: e.fov }); }
    if (shot.kind === "opening") win.__openingAt((shot.opening || 0) + t);
    for (const [i, ev] of (shot.events || []).entries()) if (t >= ev.at && !fired.has(i)) { fired.add(i); if (ev.strike) win.__strike(ev.strike, false); if (ev.flock) win.__flock(true); }
  }

  const api = {
    /** Hands the player the script (as JSON) and the page's fonts; resolves when the words can be drawn. */
    async load(s, o = {}) {
      clock.hold?.(); script = s; fps = o.fps || clock.fps; fx ||= mountFx();
      await Promise.all(["Yunjing Kai", "Yunjing Brush"].map((f) => doc.fonts.load(`32px "${f}"`, "山门之外一步一阶入山门在雾后灯人就在序章云径禅寺加入愿望单OneCity,Temple")));
      lay(0); return { frames: framesOf(script, fps), fps };
    },
    /** Draws frame `i` of the film (the page's frame loop runs once). Resolves to what it drew. */
    async frame(i) {
      const sec = i / fps, hit = shotAt(script, Math.min(sec, script.length - 1e-6));
      if (!hit) throw new Error(`frame ${i} is outside the film`);
      if (hit.index !== cued) {
        await cue(hit.index);
        // Asked for in the middle of a shot (a part rendered again, a still): the shot is run on to that frame, unseen.
        for (let k = Math.round(hit.shot.from * fps); k < i; k++) { drive(hit.shot, k / fps - hit.shot.from); lay(k / fps); clock.step(); }
      }
      local = sec - hit.shot.from; drive(hit.shot, local); lay(sec); clock.step();
      return { shot: hit.shot.id, t: +sec.toFixed(4), clock: clock.now() };
    },
    state: () => ({ cued, local, fps, loaded: !!script, now: clock.now(), frame: clock.frame() }),
  };
  win.__trailer = api;
  return api;
}
