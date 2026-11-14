// What the page says about how it is played, and when. The picture is the subject, so nothing about the controls
// stays on it: each thing is said once, at the moment it becomes useful, in one line at the foot of the view, and
// then it leaves. The whole list of keys is a card that H opens. The name of the season and the next place to go
// show when they change, and again when the visitor has stood still for a while and may be wondering.
const $ = (id) => document.getElementById(id);
const K = (...k) => k.map((x) => `<kbd>${x}</kbd>`).join("");

export function createHints({ off = false } = {}) {
  const coarse = matchMedia("(pointer: coarse)").matches, line = $("hint"), said = new Set(), timers = {};
  let now = null, lineT = 0, walked = 0, ran = false, stillFor = 0, calmT = 0;

  // One line at the foot of the view. `id` is said only once in a visit; a later line replaces an earlier one.
  function tip(id, html, secs = 7) {
    if (off || !line || said.has(id)) return false;
    said.add(id); now = id; line.innerHTML = html; line.classList.add("on");
    clearTimeout(lineT); lineT = setTimeout(() => drop(id), secs * 1000); return true;
  }
  function drop(id) { if (!line || (id && now !== id)) return; line.classList.remove("on"); now = null; }
  // A label that shows for a while and fades: the season's name, the next place.
  function flash(id, secs = 6) {
    const el = $(id); if (off || !el) return;
    el.classList.add("on"); clearTimeout(timers[id]); timers[id] = setTimeout(() => el.classList.remove("on"), secs * 1000);
  }
  const card = (open = $("keys")?.hidden) => { const el = $("keys"); if (!el || coarse) return false; el.hidden = !open; if (open) drop(); return open; };

  // The controls at the edge keep out of the way of someone who is walking with the keys: they come back when the mouse moves.
  const stir = () => { document.body.classList.remove("calm"); clearTimeout(calmT); calmT = setTimeout(() => document.body.classList.add("calm"), 4500); };
  addEventListener("mousemove", stir, { passive: true }); addEventListener("touchstart", stir, { passive: true });

  const say = {
    entered() {
      stir(); flash("moodTag", 7); flash("goal", 9);
      tip("walk", coarse ? "推左下的圆盘行走　·　拖动画面环顾　·　右侧「身外」换视角" : `${K("W", "A", "S", "D")}行走　·　点一下画面，以鼠标环顾　·　${K("V")}换视角　·　${K("H")}键位`, 12);
    },
    held() { tip("held", `${K("Esc")}松开鼠标　·　${K("滚轮")}远近　·　单击敲钟击鼓`, 7); },
    indoors() { if (!coarse) tip("view", `${K("V")}换成自己的眼睛看　·　画框前${K("E")}细看`, 7); else tip("view", "走到画框前，可以细看", 6); },
    seal() { tip("book", coarse ? "朱印收在右侧的「朱印」里" : `${K("B")}翻看朱印帐`, 7); },
    photo() { tip("photo", coarse ? "点画面选清晰处　·　双指远近" : `点画面选清晰处　·　${K("滚轮")}远近　·　${K("P")}收起`, 8); },
    mood() { flash("moodTag", 6); },
    goal() { flash("goal", 8); },
  };
  // Called every frame with how far he went and whether he hurried: the first line leaves once he is walking,
  // Shift is mentioned after a long walk at a stroll, and the next place is named again when he has stood a while.
  function step(dt, moved, running, free) {
    if (off) return;
    walked += moved; if (running && moved > 0) ran = true;
    if (now === "walk" && walked > 4) drop("walk");
    if (!coarse && !ran && walked > 40) tip("run", `${K("Shift")}快步`, 6);
    if (moved > 1e-4 || !free) stillFor = 0; else if ((stillFor += dt) > 14) { stillFor = -30; flash("goal", 7); }
  }
  return { tip, drop, flash, card, step, say, coarse, state: () => ({ tip: now, said: [...said], goal: !!$("goal")?.classList.contains("on"), moodTag: !!$("moodTag")?.classList.contains("on"), keys: !!$("keys") && !$("keys").hidden, calm: document.body.classList.contains("calm") }) };
}
