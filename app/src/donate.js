// The way from the 功德箱 to the sponsor page, in the web build only (src/channel.js: game.js imports this file
// only when `WEB`, so the other builds hold neither this code nor the address). The game takes no money and holds no
// payment code: the page it points to is 如是我闻's own 护持 page, which says what the money is for. The address, its
// language path and its campaign tags are written here and nowhere else (tests/unit/offering.test.mjs holds the shape).
import { t } from "./i18n.js";

export const DONATE_ORIGIN = "https://rushiwowen.co";
// The sponsor page has pages in Chinese (no prefix), English and Japanese; a Korean reader is sent to the English one.
const PATH = { zh: "/donate", en: "/en/donate", ja: "/ja/donate", ko: "/en/donate" };
const UTM = { utm_source: "temple-walk", utm_medium: "game", utm_campaign: "offering-box" };

/** The address of the sponsor page for a language, with the standard campaign tags and the language as content. @param {string} lang */
export function donateURL(lang) {
  const u = new URL(PATH[/** @type {keyof typeof PATH} */ (lang)] || PATH.en, DONATE_ORIGIN);
  for (const [k, v] of Object.entries({ ...UTM, utm_content: lang })) u.searchParams.set(k, v);
  return u.href;
}

/**
 * The sheet of paper that follows a coin: what the coin was, what the link is for, one button. Built here, not in
 * index.html, so that the other builds have no such element. `onOpen` runs when the link is pressed (the visit's place
 * is kept first: a browser that will not open a new tab goes to the page in this one, and he is still standing here when
 * it comes back).
 * @param {{ ui: any, lang: string, onOpen: () => void }} o
 */
export function mountOffering({ ui, lang, onOpen }) {
  const d = document.createElement("dialog");
  d.className = "layer"; d.id = "offering"; d.hidden = true; d.setAttribute("aria-labelledby", "offeringTitle");
  d.innerHTML = `<div class="offering-card paper"><h2 id="offeringTitle"></h2><p id="offeringCoin"></p><p id="offeringAsk"></p>
    <footer><a class="stamp" id="offeringGo" target="_blank" rel="noopener"></a><button class="chip" id="offeringClose" type="button"></button></footer></div>`;
  document.body.appendChild(d);
  const $ = (/** @type {string} */ id) => /** @type {any} */ (d.querySelector("#" + id));
  $("offeringTitle").textContent = t("功德箱");
  $("offeringCoin").textContent = t("一枚钱落进箱里，到这里就够了。游戏里的这一枚不是真钱，不记在朱印帐上，也没有任何回报。");
  $("offeringAsk").textContent = t("若你愿意，也可以去如是我闻的护持页，那里说明了款项的用处。");
  $("offeringGo").textContent = t("支持如是我闻与本游戏的制作");
  $("offeringGo").href = donateURL(lang);
  $("offeringClose").textContent = t("合上");
  $("offeringGo").addEventListener("click", () => onOpen());
  $("offeringClose").addEventListener("click", () => ui.close("offering"));
  ui.layer("offering", { kind: "modal", confirm: "offeringClose" });
}
