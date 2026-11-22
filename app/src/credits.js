// The page of thanks and sources, opened from the pause menu: who made what the temple is made of, as the licences ask
// it to be said (docs/t00/LICENSING-AUDIT.md, §六). The words are data here and go through t() as the page is drawn, so
// they follow the visitor's language; the names of people, typefaces and museums, the copyright lines and the museums'
// own source lines are written as their owners write them and are not translated.
import { t } from "./i18n.js";
import { asset } from "./assets.js";
import { WORKS } from "../levels/t00/works.js";
import { workIn } from "../levels/t00/works-local.js";

export const COLBASE = "https://colbase.nich.go.jp/";
// The plaque's four characters are cut from this one ColBase item (tools/boards.py).
export const PLAQUE_ITEM = "https://colbase.nich.go.jp/collection_items/tnm/TB-1446";
export const NOTICES = "shared/licenses/THIRD-PARTY-NOTICES.txt";
export const FONT_LICENCE = "shared/fonts/OFL.txt";

/** What ColBase's terms ask to be said of a picture that was edited, apart from its source line: their own example
 *  says "created by processing ColBase (the page's address)". Empty for a museum that asks nothing. @param {{ url: string, processed?: string }} w */
export function processedLine(w) {
  if (!w.processed) return "";
  return w.processed === "crop"
    ? t("「ColBase」（{url}）加工而成：裁切、缩小并转为 WebP。", { url: w.url })
    : t("「ColBase」（{url}）加工而成：缩小并转为 WebP。", { url: w.url });
}

// Typefaces: name, the copyright line as the original gives it, and what the project did to it. Not translated.
export const FONTS = [
  ["Ma Shan Zheng", "© 2018 The Ma Shan Zheng Project Authors"],
  ["LXGW WenKai", "© 2021–2026 LXGW", "Yunjing Kai"],
  ["Zhi Mang Xing", "© 2018 The Zhi Mang Xing Project Authors"],
  ["Noto Serif SC, Noto Serif JP", "© 2017–2024 Adobe"],
  ["Klee One", "© 2020 The Klee Project Authors"],
  ["Yuji Boku, Yuji Syuku", "© 2021 The Yuji Project Authors"],
  ["EB Garamond", "© 2017 The EB Garamond Project Authors"],
  ["Gowun Batang", "© 2021 The Gowun Batang Project Authors"],
  ["Song Myung", "© 2018 The SongMyung Project Authors"],
  ["Nanum Brush Script", "© 2010 NHN Corporation", "Yunjing Hand KO"],
];

/** @typedef {{ text: string, href: string, link?: string }} Linked */
/** @typedef {{ text: string, href?: string, note?: string }} Entry */
/** @typedef {{ head: string, paras: (string | Linked)[], list?: Entry[] }} Section */

/** The sections of the page, in the visitor's language. @returns {Section[]} */
export function creditSections() {
  /** @type {Entry[]} */ const colbase = Object.entries(WORKS).filter(([, w]) => /colbase\.nich\.go\.jp/.test(w.url)).map(([slug, w]) => ({ text: workIn(slug).title, href: w.url, note: w.url.replace(/^.*collection_items\//, "") }));
  return [
    { head: t("馆藏图像"), paras: [
      t("馆藏图像出典：ColBase（国立文化财机构所藏品综合检索系统，{url}）。下列各图据 ColBase 的图像缩小并转为 WebP 后使用，并非该机构所制作。", { url: COLBASE }),
    ], list: colbase },
    { head: "", paras: [
      t("克利夫兰艺术博物馆（The Cleveland Museum of Art）与大都会艺术博物馆（The Metropolitan Museum of Art）的开放获取图像（CC0），逐件来源见各作品卡片。"),
      t("使用这些馆藏，不表示任何一家博物馆认可或参与了本游戏。"),
    ] },
    { head: t("名匾"), paras: [
      { text: t("大殿上檐「釋迦寶殿」四字：据 ColBase 所载无准师范《禅院额字「释迦宝殿」》（东京国立博物馆藏，重要文化财）加工，分离墨迹并裁切为四字。"), href: PLAQUE_ITEM },
      { text: t("御碑亭中碑额「御书」二字，取自国家图书馆藏清同治十二年刻本《说文》，由 Wikimedia Commons 刊布，已过版权期，裁切后制成位图。"), href: "https://commons.wikimedia.org/wiki/File:NLC892-312002098744-312890_%E8%AA%AA%E6%96%87%E8%A7%A3%E5%AD%97_%E5%8D%81%E4%BA%94%E5%8D%B7_%E7%AC%AC2%E5%86%8A.pdf" },
    ] },
    { head: t("三维扫描"), paras: [
      t("殿内雕像的三维扫描：Minneapolis Institute of Art（5 件）、The Cleveland Museum of Art（2 件），CC0，经 Sketchfab、Objaverse 取得；本项目减面并烘焙为顶点色。"),
    ] },
    { head: t("贴图"), paras: [
      t("部分材质纹理来自 Poly Haven（CC0）：Rob Tuytel、Dario Barresi、Dimitrios Savva、Amal Kumar、Charlotte Baglioni、colormass、Rico Cilliers。"),
    ] },
    { head: t("字体"), paras: [
      { text: t("字体均以 SIL Open Font License 1.1 授权，本项目切取子集，许可全文见"), href: asset(FONT_LICENCE), link: "OFL.txt" },
      t("LXGW WenKai（霞鹜文楷）与 Nanum Brush Script 的名称受保留，本项目的修改版在文件内以 Yunjing Kai、Yunjing Hand KO 为名。"),
    ], list: FONTS.map(([name, copyright, as]) => ({ text: name, note: as ? `${copyright} · ${as}` : copyright })) },
    { head: t("程序库"), paras: [
      { text: t("three.js、meshoptimizer、qrcode-generator、lil-gui、stats.js（MIT）与 Basis Universal（Apache-2.0）。许可全文见"), href: asset(NOTICES), link: t("第三方许可声明") },
    ] },
  ];
}

/** Draws the sections into `root`. @param {HTMLElement} root */
export function renderCredits(root) {
  const doc = root.ownerDocument; root.textContent = "";
  const a = (href, text) => { const el = doc.createElement("a"); el.href = href; el.textContent = text; el.target = "_blank"; el.rel = "noopener"; return el; };
  for (const s of creditSections()) {
    const sec = doc.createElement("section");
    if (s.head) { const h = doc.createElement("h3"); h.textContent = s.head; sec.append(h); }
    for (const p of s.paras) {
      const el = doc.createElement("p");
      if (typeof p === "string") el.textContent = p;
      else { el.append(p.text); }
      sec.append(el);
      // A link is a line of its own, as tall as a thumb: inside a sentence it would be a sliver on a phone.
      if (typeof p !== "string") { const link = a(p.href, p.link || p.href.replace(/^https:\/\//, "")); link.className = "tap"; sec.append(link); }
    }
    if (s.list) {
      const ul = doc.createElement("ul");
      for (const it of s.list) { const li = doc.createElement("li"); li.append(it.href ? Object.assign(a(it.href, it.text), { className: "tap" }) : it.text); if (it.note) { const n = doc.createElement("span"); n.textContent = it.note; li.append(n); } ul.append(li); }
      sec.append(ul);
    }
    root.append(sec);
  }
}

/** Wires the menu's entry to the page. @param {ReturnType<typeof import("./ui.js").createUI>} ui */
export function createCredits(ui) {
  const el = (id) => document.getElementById(id);
  ui.layer("credits", { kind: "modal", confirm: "creditsClose" });
  el("menuCredits").addEventListener("click", () => { renderCredits(el("creditsBody")); ui.open("credits"); el("creditsBody").scrollTop = 0; });
  el("creditsClose").addEventListener("click", () => ui.close("credits"));
  window.__credits = () => ({ open: ui.isOpen("credits"), sections: el("creditsBody").querySelectorAll("section").length, text: el("creditsBody").textContent });
}
