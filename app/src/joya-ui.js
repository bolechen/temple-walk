// The year-end bell on the page (#341): while the night is open, one quiet line at the top of the picture says how many
// strokes the mountain has rung tonight; each stroke of the bell tower's bell (the rope, or a tap on the bell) is one
// more, as many as the visitor's minute allows; when the mountain's count passes a round of 108 a bell answers in the far
// hills; and once the visitor has rung, the line offers a card to take away. Nothing opens by itself, nothing is said
// when the counter cannot be reached: the line is simply not there. joya.js keeps the count; joya-card.js draws the card.
import { JOYA, eventFor, windowOf, createTally, fakeCounter, httpCounter, countText } from "./joya.js";
import { drawJoyaCard } from "./joya-card.js";
import { farBell } from "./audio.js";
import { track } from "./analytics.js";
import { t, lang } from "./i18n.js";
import { saidNow } from "./temple.js";

/** @param {{ y: any, ui: any, say: (text: string, secs?: number) => void, query: URLSearchParams, bench: boolean }} o */
export function createJoya({ y, ui, say, query, bench }) {
  let ev = eventFor({ query, bench });
  // The workbench may ring against a counter kept in the page: ?joya=fake (from nothing), ?joya=fake:105 (from 105),
  // ?joya=fake:105:3 (and a crowd ringing three a second).
  const fake = bench && /^fake/.test(query.get("joya") || "") ? query.get("joya").split(":").map(Number) : null;
  const counter = fake ? fakeCounter({ start: fake[1] || 0, crowd: fake[2] || 0, anyHour: true }) : httpCounter(location.href);
  const S = { answered: 0, heard: 0, missed: 0, lastFar: -Infinity, cards: 0, card: /** @type {string | null} */ (null) };

  // The line, and its one button. Made here, not in index.html: it exists only on that night.
  const view = document.getElementById("yardView") || document.body;
  const line = document.createElement("p"); line.id = "joya"; line.hidden = true; line.setAttribute("aria-live", "polite");
  const words = document.createElement("span"), take = document.createElement("button");
  take.type = "button"; take.className = "chip"; take.id = "joyaTake"; take.hidden = true;
  line.append(words, take); view.append(line);
  const sheet = document.createElement("dialog"); sheet.className = "layer"; sheet.id = "joyaCard"; sheet.hidden = true;
  sheet.innerHTML = `<img id="joyaImg" alt=""><div class="row"><button class="chip" id="joyaShare" type="button" hidden></button><a class="chip" id="joyaSave" href="#"></a><button class="stamp" id="joyaClose" type="button"></button></div>`;
  view.append(sheet); ui.layer("joyaCard", { kind: "modal", confirm: "joyaClose" });
  const $ = (id) => /** @type {any} */ (document.getElementById(id));
  $("joyaClose").addEventListener("click", () => ui.close("joyaCard"));

  const tally = createTally({
    year: ev.year, send: counter.send, ask: counter.ask,
    onTotal: () => paint(),
    onRound: () => answer(),
  });
  // For the phone audit only (tools/mobile-audit.cjs, as __offeringSheet is): the line and its card laid out with given
  // numbers on a page whose night is not open. Nothing is counted or sent.
  let preview = /** @type {{ total: number, mine: number } | null} */ (null);
  function paint() {
    const n = preview ? preview.total : tally.shown, on = !!preview || (ev.open && n != null);
    line.hidden = !on; if (!on) return;
    words.replaceChildren(...[t("除夕撞钟"), "·", t("今夜已撞 {n} 声", { n: countText(n, lang) })].map((w) => Object.assign(document.createElement("span"), { textContent: w })));
    take.hidden = (preview ? preview.mine : tally.snapshot().mine) < 1; take.textContent = t("留一张");
  }
  // Every round of 108 the far hills answer, once in a while however fast the mountain rings; a line says so at the foot.
  // Not over his own bell: the answer waits until three seconds after his last stroke, and is let go after a minute
  // without such a gap. Not heard in a hall (#331 keeps the mountain out of the rooms), during the opening, with the
  // picture held for a photograph, or under ?shot (the music reviewer, 2026-11-20).
  let owed = 0, lastStrike = -Infinity;
  const quiet = () => !(y.inside?.() || y.openingActive?.() || y.busy?.() || query.has("shot"));
  function answer() {
    const now = performance.now(); if (now - S.lastFar < JOYA.farGap * 1000 || owed) return;
    owed = now;
  }
  setInterval(() => {
    if (!owed) return; const now = performance.now();
    if (now - owed > JOYA.answerWait * 1000 || !quiet()) { owed = 0; S.missed++; return; }
    if (now - lastStrike < JOYA.clear * 1000) return;
    owed = 0; S.lastFar = now; S.heard++; farBell({ answer: true }); say(t("满一百零八声，远山回了一声钟"), 5);
  }, 250);
  // A stroke of the bell tower's bell, however it was struck, while the night is open.
  addEventListener("struck", (e) => {
    if (!ev.open || /** @type {CustomEvent} */ (e).detail !== "bell") return;
    lastStrike = performance.now();
    if (tally.strike()) { paint(); if (tally.snapshot().mine === 1) track("joya.ring", { year: ev.year, forced: ev.forced ? 1 : 0 }); }
  });
  async function makeCard() {
    const snap = tally.snapshot();
    const c = await drawJoyaCard({ when: Date.now(), mine: preview ? preview.mine : snap.mine, total: preview ? preview.total : tally.shown });
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.92)), url = URL.createObjectURL(blob);
    S.cards++; S.card = c.toDataURL("image/png");
    return { blob, url };
  }
  take.addEventListener("click", async () => {
    const { blob, url } = await makeCard();
    $("joyaImg").src = url; $("joyaImg").alt = t("除夕撞钟的卡片"); $("joyaSave").href = url; $("joyaSave").download = saidNow("云径禅寺-除夕撞钟.jpg"); $("joyaSave").textContent = t("保存");
    $("joyaClose").textContent = t("合上"); const file = new File([blob], "yunjing-joya.jpg", { type: "image/jpeg" });
    $("joyaShare").textContent = t("分享"); $("joyaShare").hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
    $("joyaShare").onclick = async () => { try { await navigator.share({ files: [file], title: saidNow("云径禅寺 · 除夕撞钟") }); track("demo.share", { from: "joya", method: "share" }); } catch {} };
    ui.open("joyaCard"); track("joya.card", { year: ev.year, mine: tally.snapshot().mine });
  });

  // While the night is open: the count asked for, what was rung sent; what is left sent as the page goes. The window is
  // looked at again every twenty seconds, so a page left open from before eight finds the night when it comes.
  const poll = () => { if (ev.open && !document.hidden) tally.poll().then(paint); };
  let ended = false;   // __joyaEnd(): the window closed, for a test on the workbench, where ?event=joya keeps it open
  const tick = () => {
    const was = ev.open; ev = ended ? { ...ev, open: false } : eventFor({ query, bench });
    if (ev.open !== was) y.setJoya?.(ev.open);
    if (ev.open && !was) { y.eventNight?.(); poll(); }
    if (!ev.open && was) { paint(); y.eventDay?.(); }
    if (ev.open) tally.flush().then(paint);
  };
  setInterval(tick, 5000); setInterval(poll, JOYA.pollSecs * 1000);
  addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "hidden") { poll(); return; }
    const p = tally.snapshot().pending; if (p && !fake && "beacon" in counter) counter.beacon(Math.min(p, JOYA.batch), new Date().getTimezoneOffset());
  });
  y.setJoya?.(ev.open); if (ev.open) poll();

  // The tests' hooks: the count as the page keeps it; the card as a picture (made now, for the code to be read back).
  window.__joya = () => ({ ...tally.snapshot(), count: tally.shown, open: ev.open, forced: ev.forced, year: ev.year, window: windowOf().open, fake: !!fake, shown: !line.hidden, line: line.hidden ? "" : [...words.children].map((e) => e.textContent).join(" "), take: !take.hidden, heard: S.heard, missed: S.missed, owed: !!owed, cards: S.cards });
  window.__joyaPreview = (on = true, o = {}) => { preview = on ? { total: 12345, mine: 3, ...o } : null; paint(); return !line.hidden; };
  window.__joyaEnd = () => { ended = true; tick(); return window.__joya(); };
  window.__joyaCard = async () => { await makeCard(); return S.card; };
  window.__joyaPoll = () => tally.poll().then(() => (paint(), tally.snapshot()));
  window.__joyaFlush = () => tally.flush(true).then((ok) => (paint(), ok));
  return { get open() { return ev.open; } };
}
