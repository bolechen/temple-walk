// The two ends of a carried save in the page (#338, src/carry.js holds the rules): opening a link that carries one,
// and making one. Opening asks first, on a sheet of its own over the title, says how many seals and where he was and
// that it will replace what this browser keeps, and only then writes it; either way the save is taken out of the
// address at once (history.replaceState), so a reload never asks again. Nothing is sent anywhere but the two counts
// (save.export, save.import), which carry no part of the save (docs/t00/ANALYTICS.md).
import { t, lang } from "./i18n.js";
import { templeNow } from "./temple.js";
import { track } from "./analytics.js";
import { decode, check, apply, summary, saveIn, linkFor, encode, gather, SITES, SAVE_KEYS } from "./carry.js";
import { DEPLOY } from "./deploy.js";

const $ = (id) => /** @type {any} */ (document.getElementById(id));
const strip = () => { try { history.replaceState(history.state, "", location.pathname + location.search); } catch {} };

/** What a refusal says, in the visitor's language. @param {string} reason */
export const refusalLine = (reason) => (reason === "newer" ? t("这本朱印帐来自更新的版本，这里还读不了。请先在这里刷新到最新版本再试。") : reason === "empty" ? t("这条链接里没有朱印帐，也没有走到的地方。") : t("这条链接不完整或已损坏，什么也没有写入。"));

/** A page opened by a carried save's link: ask, then write and begin again from it. */
export async function carryIn(given = null) {
  const text = given ?? saveIn(location.hash);
  if (text == null) return false;
  if (given == null) strip();   // out of the address before anything else: a reload, a bookmark or a shared screenshot never carries it on
  const sheet = $("carryIn"); if (!sheet) return false;
  let writes = null, reason = "";
  try { writes = check(await decode(text)); } catch (e) { reason = (e && e.reason) || "damaged"; }
  const body = $("carryInText"), yes = $("carryInYes"), no = $("carryInNo"), warn = $("carryInWarn");
  if (writes) {
    const s = summary(writes);
    // (the count in words where the page writes it so: 两枚 in Chinese, as one counts things, 二つ in Japanese; digits elsewhere)
    const n = lang === "zh" ? "〇一两三四五六七"[s.seals] : lang === "ja" ? "〇一二三四五六七"[s.seals] : String(s.seals);
    body.textContent = (s.seals ? t("这本朱印帐有{n}枚印", { n, k: s.seals }) : t("这本朱印帐还没有印")) + (s.label ? t("，上回走到{place}。", { place: t(s.label) }) : "。");
    // What it replaces is said only when there is something here to replace: a book with a seal, or a place he reached.
    warn.hidden = !keepsSomething(); yes.hidden = false; no.textContent = t("不用了");
  } else { body.textContent = refusalLine(reason); warn.hidden = true; yes.hidden = true; no.textContent = t("知道了"); }
  // Opened as every other sheet is (ui.js): the focus on the sheet itself, so that no button is ringed until Tab is pressed.
  sheet.hidden = false; try { sheet.showModal(); sheet.focus({ preventScroll: true }); } catch {}
  return new Promise((done) => {
    const close = (ok) => { try { sheet.close(); } catch {} sheet.hidden = true; done(ok); };
    yes.onclick = () => { try { apply(localStorage, writes); } catch { body.textContent = refusalLine("damaged"); yes.hidden = true; return; } track("save.import", { result: "ok" }); close(true); setTimeout(() => location.reload(), 250); };
    no.onclick = () => { track("save.import", { result: writes ? "declined" : reason }); close(false); };
    sheet.addEventListener("cancel", () => no.onclick(), { once: true });
  });
}

/** Whether this browser keeps a pilgrimage a carried save would replace: a seal in the book, or a place he reached. */
function keepsSomething() {
  try {
    const j = JSON.parse(localStorage.getItem(SAVE_KEYS.journey) || "null");
    if (j && j.seals && Object.values(j.seals).some((v) => v > 0)) return true;
    return localStorage.getItem(SAVE_KEYS.place) != null;
  } catch { return false; }
}

/** The addresses a save may be taken to from this build: this page, and from the public page the testers' canary, or back. */
export function destinations() {
  const here = location.origin + location.pathname;
  // (a table looked up by the build's target, not a branch on it: the canary's code stays production's but for that one word, tests/unit/deploy.test.mjs)
  const other = /** @type {Record<string, { id: string, label: string, base: string }>} */ ({ production: { id: "canary", label: t("带去内测版"), base: SITES.canary }, canary: { id: "production", label: t("带回正式版"), base: SITES.production } })[DEPLOY];
  return [{ id: "here", label: t("本站"), base: here }, ...(other ? [other] : [])];
}
/** The link for one of those, made from what this browser keeps now. */
export const linkTo = (base) => linkFor(localStorage, base);
/** Count a link made (only that it was made, and for where). */
export const counted = (to) => track("save.export", { to });

/** The sheet that makes a link (the entry that opens it calls `open`). @param {ReturnType<typeof import("./ui.js").createUI>} ui */
export function createCarryOut(ui) {
  const sheet = $("carryOut"); if (!sheet) return { open() {} };
  ui.layer("carryOut", { kind: "modal", confirm: "carryClose" });
  const places = destinations(); let to = places[0];
  const draw = async () => {
    $("carryTo").replaceChildren(...(places.length > 1 ? places.map((p) => { const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = p.label; b.setAttribute("aria-pressed", String(p === to)); b.onclick = () => { to = p; draw(); }; return b; }) : []));
    $("carryTo").hidden = places.length < 2;
    const link = await linkTo(to.base);
    $("carryLink").value = link; $("carryLinkShown").textContent = link.replace(/^https?:\/\//, "");
    $("carryShare").hidden = !navigator.share;
  };
  // Copied, nothing is left selected or ringed on the sheet: the button says so, and that is all.
  $("carryCopy").onclick = async () => {
    const el = $("carryLink");
    try { await navigator.clipboard.writeText(el.value); } catch { el.select(); document.execCommand?.("copy"); }
    try { getSelection()?.removeAllRanges(); } catch {} el.blur();
    $("carryCopy").textContent = t("已复制"); counted(to.id);
  };
  $("carryShare").onclick = async () => { try { await navigator.share({ title: templeNow(), url: $("carryLink").value }); counted(to.id); } catch {} };
  $("carryClose").onclick = () => ui.close("carryOut");
  window.__carry = () => ({ open: ui.isOpen("carryOut"), to: to.id, places: places.map((p) => p.id), link: $("carryLink").value });
  return { async open() { $("carryCopy").textContent = t("复制链接"); await draw(); ui.open("carryOut"); } };
}

// For the phone audit (tools/mobile-audit.cjs): the sheet a link brings, raised from what this browser keeps now.
if (typeof window !== "undefined") window.__carryAsk = async (text) => carryIn(text ?? (await encode(gather(localStorage))));
