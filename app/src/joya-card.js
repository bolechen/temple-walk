// The card a visitor takes away from the year-end bell (#341): upright, 3:4 (1200 × 1600), as Xiaohongshu and X show a
// picture whole. The name of the night in brush across the top, the temple and the day under it; in the middle an ink
// ring with the strokes this visitor rang, and under it how many the whole mountain had rung when the card was made;
// at the foot the temple's seal, and the code that brings whoever reads it to the main site (the look of the page of
// seals' code, #319, with its own source mark, utm_source=joya).
import { t as tr, glyphs, lang, FONT, FACE } from "./i18n.js";
import { templeNow, sealNow } from "./temple.js";
import { qrMatrix, qrSide, paintQrLook, SEAL_LOOK } from "./qr.js";
import { sealStamp, dateLine, MAIN } from "./goshuin.js";
import { countText } from "./joya.js";
const BRUSH = FONT.brush, SERIF = FONT.serif;

/** What the card's code says: the main site, marked as having come from this card. @param {string} l */
export const joyaUrl = (l) => `${MAIN.url}?utm_source=joya&utm_medium=share&utm_content=${l}`;

const W = 1200, H = 1600, QR_PX = 5;
/** Where the things on the card lie, so that a test may say none lies on another and the code may be cut out and read. @param {string} l */
export function joyaLayout(l = lang) {
  const side = qrSide(qrMatrix(joyaUrl(l)).length, QR_PX);
  return {
    W, H,
    title: { x: W / 2, y: 210, fs: 150 },
    sub: { x: W / 2, y: 345 },
    ring: { cx: W / 2, cy: 760, r: 300 },
    mine: { x: W / 2, y: 1150 },
    all: { x: W / 2, y: 1215 },
    seal: { cx: 190, cy: 1420, size: 150, turn: -0.04 },
    qr: { x: W - 90 - side, y: H - 110 - side, w: side, h: side, px: QR_PX },
    host: { x: W / 2, y: 1500 },
  };
}

/** A date as the card writes it: in characters for Chinese and Japanese, in the reader's own words otherwise.
 * @param {number} ms @param {string} l */
export const cardDate = (ms, l) => (l === "zh" || l === "ja" ? dateLine(ms) : new Date(ms).toLocaleDateString(l === "ko" ? "ko-KR" : "en-GB", { year: "numeric", month: "long", day: "numeric" }));

/** The ring drawn in one breath of the brush, not quite closed. @param {CanvasRenderingContext2D} x @param {number} cx @param {number} cy @param {number} r @param {() => number} rnd */
function enso(x, cx, cy, r, rnd) {
  for (let i = 0; i < 2200; i++) {
    const t = i / 2200, a = -1.75 + t * 5.85, rr = r + Math.sin(t * 7) * 6 + (rnd() - 0.5) * 3, w = (44 - t * 26) * (0.75 + rnd() * 0.5), dry = t > 0.6 ? rnd() * (t - 0.6) * 2.4 : 0;
    if (rnd() < dry) continue;
    x.fillStyle = `rgba(27,24,21,${0.18 + rnd() * 0.45})`; x.beginPath(); x.ellipse(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, w * 0.5, 2 + rnd() * 3, a + 1.57, 0, 6.3); x.fill();
  }
}

/** The card. `when` is the moment it was made, `mine` the strokes this visitor rang tonight, `total` the mountain's count
 * as last known (null if the counter never answered: the line is then left out).
 * @param {{ when: number, mine: number, total: number | null, l?: string }} o */
export async function drawJoyaCard({ when, mine, total, l = lang }) {
  const title = tr("除夕撞钟"), temple = templeNow(), sealText = sealNow(), L = joyaLayout(l);
  const mineLine = tr("今夜你撞了 {n} 声", { n: countText(mine, l) }), allLine = total == null ? "" : tr("这一夜，山中同撞 {n} 声", { n: countText(total, l) });
  const sub = `${temple} · ${cardDate(when, l)}`;
  try { await Promise.all([document.fonts.load(`150px ${FACE.brush}`, title), document.fonts.load(`40px ${FACE.serif}`, sub + mineLine + allLine + String(mine)), document.fonts.load(`80px ${FACE.seal}`, sealText)]); } catch {}
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  let s = 108; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Paper, as the page of seals has it.
  const g = x.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, H * 0.75); g.addColorStop(0, "#f4efe3"); g.addColorStop(1, "#e7dfcd"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const px = rnd() * W, py = rnd() * H, a = rnd() * 6.3, len = 6 + rnd() * 26; x.strokeStyle = `rgba(${rnd() < 0.5 ? "120,100,70" : "255,255,250"},${0.03 + rnd() * 0.07})`; x.lineWidth = 0.6 + rnd(); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * len * 0.5 + rnd() * 6, py + Math.sin(a) * len * 0.5, px + Math.cos(a) * len, py + Math.sin(a) * len); x.stroke(); }
  x.textAlign = "center"; x.textBaseline = "middle";
  // The night's name, in brush; a long one (English) set smaller until it fits.
  x.fillStyle = "#1b1815"; let fs = L.title.fs; x.font = `${fs}px ${BRUSH}`; while (fs > 60 && x.measureText(title).width > W - 200) x.font = `${(fs -= 4)}px ${BRUSH}`;
  try { x.letterSpacing = l === "zh" || l === "ja" ? "18px" : "0px"; } catch {}
  x.fillText(title, L.title.x, L.title.y);
  try { x.letterSpacing = "4px"; } catch {}
  x.fillStyle = "#5c564c"; x.font = `34px ${SERIF}`; x.fillText(sub, L.sub.x, L.sub.y);
  try { x.letterSpacing = "0px"; } catch {}
  // The ring, and in it the strokes rung.
  enso(x, L.ring.cx, L.ring.cy, L.ring.r, rnd);
  x.fillStyle = "#1b1815"; x.font = `${mine > 999 ? 170 : 230}px ${SERIF}`; x.fillText(countText(mine, l), L.ring.cx, L.ring.cy + 10);
  x.fillStyle = "#2a2622"; x.font = `44px ${SERIF}`; x.fillText(mineLine, L.mine.x, L.mine.y);
  if (allLine) { x.fillStyle = "#6b6458"; x.font = `32px ${SERIF}`; x.fillText(allLine, L.all.x, L.all.y); }
  // The temple's seal, and the code.
  x.save(); x.translate(L.seal.cx, L.seal.cy); x.rotate(L.seal.turn); x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.9; x.drawImage(sealStamp(sealText, L.seal.size * 2, { seed: 9 }), -L.seal.size / 2, -L.seal.size / 2, L.seal.size, L.seal.size); x.restore();
  paintQrLook(x, qrMatrix(joyaUrl(l)), L.qr.x, L.qr.y, L.qr.px, SEAL_LOOK, "#f1ebde");
  x.fillStyle = "#6b6458"; x.font = `24px ${SERIF}`; x.fillText(tr("扫码入山"), L.qr.x + L.qr.w / 2, L.qr.y + L.qr.h + 24);
  x.fillStyle = "#a9a293"; x.font = `20px ${SERIF}`; x.fillText(MAIN.host, L.host.x, L.host.y);
  x.strokeStyle = "rgba(60,50,40,.28)"; x.lineWidth = 2; x.strokeRect(34, 34, W - 68, H - 68);
  return c;
}
