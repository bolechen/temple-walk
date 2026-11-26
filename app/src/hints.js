// What the page says about how it is played, and when. The picture is the subject, so nothing about the controls
// stays on it: each thing is said once, at the moment it becomes useful, in one line at the foot of the view, and
// then it leaves. The whole list of keys is a card that H opens. The name of the season and the next place to go
// show when they change, and again when the visitor has stood still for a while and may be wondering.
import { t } from "./i18n.js";

const $ = (id) => document.getElementById(id);
const K = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join("");

/** `book`: the level keeps a book of seals; one that does not (T05's first edition) is told nothing of seals, and the line about stamping and the one about the book are never said there. */
export function createHints({ off = false, ui = null, strafeAD = () => false, book = true } = {}) {
  const coarse = matchMedia("(pointer: coarse)").matches, line = $("hint"), said = new Set(book ? [] : ["stamp"]), timers = {};
  let now = null, lineT = 0, walked = 0, ran = false, stillFor = 0, calmT = 0, dragged = false, pinched = false;

  // One line at the foot of the view. `id` is said only once in a visit; a later line replaces an earlier one.
  // A line is a few phrases between middle dots; each is kept whole, so that on a narrow screen the line breaks between
  // them and not in the middle of one (a dot with no space round it, as in a Korean pair of words, belongs to its phrase).
  // The dot between two phrases, with the spaces on both sides of it, is its own span, and a line break waits beside it (`brk`, hidden): where the line breaks there the dot is put
  // away and the break made real (`unhang`), so that the two phrases do not run together on one line if the line later has room: left at
  // the end of the first line the dot reads as one dot too many, and with it gone and no break a line has two phrases and nothing between them.
  const phrases = (html) => html.split(/([\s\u3000]+·[\s\u3000]+)/).map((part, i) => (i % 2 ? `<span class="dot">${part}</span><br class="brk" hidden>` : `<span class="phrase">${part}</span>`)).join("");
  const unhang = () => {
    if (!line || line.getClientRects().length === 0) return;   // not on the page just now (before 入山, the photograph): measured when it shows, nothing is measured at zero
    const ps = [...line.querySelectorAll(".phrase")], dots = /** @type {HTMLElement[]} */ ([...line.querySelectorAll(".dot")]), brs = /** @type {HTMLElement[]} */ ([...line.querySelectorAll(".brk")]);
    for (const d of dots) d.hidden = false;   // (every dot is put back and every break let go first, then the line is measured as it falls)
    for (const r of brs) r.hidden = true;
    for (let i = 1; i < ps.length; i++) if (ps[i].offsetTop >= ps[i - 1].offsetTop + ps[i - 1].offsetHeight - 1 && dots[i - 1]) { dots[i - 1].hidden = true; brs[i - 1].hidden = false; }
  };
  addEventListener("resize", unhang);
  document.fonts?.addEventListener?.("loadingdone", unhang);   // (a face that arrives after the line is set changes where it breaks)
  if (line && typeof ResizeObserver !== "undefined") new ResizeObserver(() => unhang()).observe(line);   // (the line's width changes with the screen, and it is none at all while hidden: it is set right when it shows again)
  function tip(id, html, secs = 7) {
    if (off || !line || said.has(id) || now === "hold") return false;   // (the far view's line is held until it is released: a tip refused is not counted as said)
    said.add(id); now = id; line.innerHTML = phrases(html); line.classList.add("on"); unhang();
    clearTimeout(lineT); lineT = setTimeout(() => drop(id), secs * 1000); return true;
  }
  // A line that stays until it is released (the far view's way to the book): not said once, not faded.
  function hold(html) { if (off || !line) return false; now = "hold"; line.innerHTML = phrases(html); line.classList.add("on"); unhang(); clearTimeout(lineT); return true; }
  // The line set to some words, as it is when said (for a tool that looks at how a line breaks: the page's own words are said only once).
  function set(html) { if (!line) return; line.innerHTML = phrases(html); line.classList.add("on"); unhang(); }
  function release() { drop("hold"); }
  function drop(id) { if (!line || (id && now !== id)) return; line.classList.remove("on"); now = null; }
  // A label that shows for a while and fades: the season's name, the next place.
  function flash(id, secs = 6) {
    const el = $(id); if (off || !el) return;
    el.classList.add("on"); clearTimeout(timers[id]); timers[id] = setTimeout(() => el.classList.remove("on"), secs * 1000);
  }
  // The card of keys is a panel on the stack of what lies over the picture (src/ui.js), so Esc puts it away like anything else.
  const shown = () => (ui ? ui.isOpen("keys") : !!$("keys") && !$("keys").hidden);
  const card = (open = !shown()) => {
    const el = $("keys"); if (!el || coarse) return false;
    if (ui) { if (open) ui.open("keys"); else ui.close("keys"); } else el.hidden = !open;
    if (open) drop(); return open;
  };

  // The controls at the edge keep out of the way of someone who is walking with the keys: they come back when the mouse moves.
  const stir = () => { document.body.classList.remove("calm"); clearTimeout(calmT); calmT = setTimeout(() => document.body.classList.add("calm"), 4500); };
  addEventListener("mousemove", stir, { passive: true }); addEventListener("touchstart", stir, { passive: true });

  const say = {
    entered() {
      stir(); flash("moodTag", 7); flash("goal", 9);
      tip("walk", coarse ? t("推左下的圆盘行走　·　拖动画面环顾") : (strafeAD() ? t("{wasd}行走　·　按住拖动画面环顾，点地面走去　·　{v}换视角　·　{h}键位", { wasd: K("W", "A", "S", "D"), v: K("V"), h: K("H") }) : t("{ws}行走，{ad}转身　·　按住拖动画面环顾，点地面走去　·　{v}换视角　·　{h}键位", { ws: K("W", "S"), ad: K("A", "D"), v: K("V"), h: K("H") })), 12);
    },
    // A level's own line, said once after the one about how to walk has gone (a level whose first edition has no seals or book says so): it waits
    // for the foot line to be free rather than cover another line, and for nothing else open over the picture.
    intro(text, secs = 9) {
      let tries = 0; const wait = () => { if (off) return; if (now === null && !document.querySelector("dialog[open]")) { tip("intro", text, secs); return; } if (++tries < 30) setTimeout(wait, 1500); };
      setTimeout(wait, 1500);
    },
    // On a touch screen the rest is said as the hand comes to it: two fingers once the view has first been dragged, and
    // the way into his own eyes once the eye has first been drawn all the way in to him. A drag made before the line about
    // walking has been said and has gone (a drag that passes over the opening, or one while that line shows) is kept, and
    // two fingers are told as soon as the line is free (`step`); a visitor whose two fingers have already moved the eye is
    // not told what they know.
    dragged() { dragged = true; if (coarse && !pinched && said.has("walk") && now !== "walk") tip("pinch", t("双指开合，拉远拉近"), 6); },
    pinched() { pinched = true; },
    nearest() { if (coarse) tip("eyes", t("再拉近，换成自己的眼睛"), 6); },
    // Once the visitor has turned the view a good way by hand (a half turn), the way to have it turned back for them (#295).
    turned() { tip("recenter", coarse ? t("上方的小圈，镜头转回身后") : t("{r}镜头转回身后", { r: K("R") }), 7); },
    held() { tip("held", t("{esc}松开鼠标　·　{wheel}远近　·　单击敲钟击鼓", { esc: K("Esc"), wheel: K(t("滚轮")) }), 7); },
    indoors() { if (!coarse) tip("view", t("{v}换成自己的眼睛看，可以举头看殿顶　·　画框前{e}细看", { v: K("V"), e: K("E") }), 8); else tip("view", t("走到画框前，可以细看；也可以举头看看殿顶"), 7); },
    // The summit pavilion's room has a stair up to its top storey; up there the view is his own eyes only.
    stair() { tip("stair", t("西北角可以登楼。"), 7); },
    upView() { tip("upView", t("楼上用自己的眼睛看，下楼再换视角。"), 6); },
    // The visitor has a seal already: the line that says a walk can earn one is not for them (#445).
    stamped() { said.add("stamp"); },
    seal() { said.add("stamp"); if (!book) return; tip("book", coarse ? t("点左上角的小印，翻看朱印帐") : t("{b}或左上角的小印，翻看朱印帐", { b: K("B") }), 7); },
    // Said once, the first time the visitor is on the mountain after filling the book (game.js keeps that it was said).
    // (#726: when the hour has just turned to the visitor's own, the same line says so: one sentence, not two)
    seasons(clock) { if (clock) return tip("seasons", coarse ? t("山中时辰已随你此刻　·　季节与时辰，留影与歇脚里可换") : t("山中时辰已随你此刻　·　季节与时辰，留影与歇脚里可换　·　{t}时节", { t: K("T") }), 9); return tip("seasons", coarse ? t("时节已开：留影与歇脚里可选") : t("时节已开：留影与歇脚里可选　·　{t}时节", { t: K("T") }), 9); },
    // A newer build has been put up since the page was opened (src/version.js): said once; nothing reloads by itself.
    update() { return tip("update", t("新的版本已就绪，刷新即可"), 9); },
    photo() { drop(); },
    mood() { flash("moodTag", 6); },
    goal() { flash("goal", 8); },
  };
  // Called every frame with how far he went and whether he hurried: the first line leaves once he is walking,
  // Shift is mentioned after a long walk at a stroll, and the next place is named again when he has stood a while.
  function step(dt, moved, running, free) {
    if (off) return;
    walked += moved; if (running && moved > 0) ran = true;
    if (now === "walk" && walked > 4) drop("walk");
    if (coarse && walked > 40) tip("jump", t("右下角的圈是跳　·　台沿前是上台、下台阶"), 6);
    // A visitor who walks on and never drags the view would never be told about two fingers: after a good stretch
    // of the path (60 m, about half a minute at a walk) it is said anyway, once, when no other line is speaking.
    if (coarse && !dragged && !now && walked > 60) tip("pinch", t("双指开合，拉远拉近"), 6);
    if (coarse && dragged && !pinched && !now && said.has("walk")) tip("pinch", t("双指开合，拉远拉近"), 6);   // a drag kept from before: told now the line is free
    // Once the line about walking has gone, a first visitor is told once that a small thing done at a place is stamped (#445).
    if (!now && said.has("walk") && !said.has("stamp") && walked > 4) tip("stamp", t("每到一处，做一件小事，可以盖一枚朱印"), 7);
    if (!coarse && !ran && walked > 40) tip("run", t("{shift}快步　·　{space}跳", { shift: K("Shift"), space: K("Space") }), 6);
    if (moved > 1e-4 || !free) stillFor = 0; else if ((stillFor += dt) > 14) { stillFor = -30; flash("goal", 7); }
  }
  return { tip, hold, set, release, drop, flash, card, step, say, coarse, state: () => ({ tip: now, said: [...said], goal: !!$("goal")?.classList.contains("on"), moodTag: !!$("moodTag")?.classList.contains("on"), keys: shown(), calm: document.body.classList.contains("calm") }) };
}
