// The page of seals a visitor carries away: the temple's name in brush, the day, the line the library gave,
// the three-treasures seal beside the name and the temple's own small seal below it to the left (as on a Japanese
// goshuin, where the 三宝印 and the temple's seal are two different seals and neither repeats the brush name), and along the foot the seven small seals of the visit, red where
// earned and a faint outline where not. One drawing serves the book on screen and the picture that is shared.
// The page is calligraphy: in Japanese it is written in Japanese forms, in English it keeps the
// temple's own characters, as a seal book from a temple abroad would; only the names under the seals and the line at
// the foot are in the visitor's language.
import { t as tr, glyphs, lang, FONT, FACE } from "./i18n.js";
import { nameNow } from "./temple.js";
import { qrMatrix, qrSide, paintQrLook, SEAL_LOOK } from "./qr.js";
const BRUSH = FONT.brush, SERIF = FONT.serif, SEAL = FONT.seal;
const NUM = "〇一二三四五六七八九";
const digits = (n) => String(n).split("").map((d) => NUM[+d]).join("");
const dayOf = (n) => (n <= 10 ? ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"][n] : n < 20 ? "十" + NUM[n - 10] : (n < 30 ? "二十" : "三十") + (n % 10 ? NUM[n % 10] : ""));
export const dateLine = (ms) => { const d = new Date(ms); return `${digits(d.getFullYear())}年${dayOf(d.getMonth() + 1)}月${dayOf(d.getDate())}日`; };

// A seal cut in white on red: `text` of two or four characters, pressed a little unevenly and worn by use.
export function sealStamp(text, size, { ink = "#b0281c", seed = 7 } = {}) {
  const c = document.createElement("canvas"); c.width = c.height = size; const x = c.getContext("2d");
  let s = seed * 9973 + text.charCodeAt(0); const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  x.fillStyle = ink; x.beginPath(); x.roundRect(size * 0.03, size * 0.03, size * 0.94, size * 0.94, size * 0.07); x.fill();
  x.globalCompositeOperation = "destination-out"; x.textAlign = "center"; x.textBaseline = "middle";
  const ch = [...text], four = ch.length >= 4, fs = size * (four ? 0.4 : 0.43); x.font = `${fs}px ${SEAL}`;
  // read as seals are: top to bottom, right column first
  ch.slice(0, four ? 4 : 2).forEach((c2, i) => { const col = four ? (i < 2 ? 1 : 0) : 0.5, row = four ? i % 2 : i; x.fillText(c2, size * (four ? 0.29 + col * 0.42 : 0.5), size * (0.29 + row * 0.42)); });
  x.lineWidth = size * 0.018; x.strokeRect(size * 0.085, size * 0.085, size * 0.83, size * 0.83);
  for (let i = 0; i < size * 1.2; i++) { x.globalAlpha = 0.3 + rnd() * 0.6; x.fillRect(rnd() * size, rnd() * size, 1 + rnd() * size * 0.012, 1 + rnd() * size * 0.008); }
  for (let i = 0; i < 5; i++) { x.globalAlpha = 0.5; x.beginPath(); x.arc(rnd() < 0.5 ? rnd() * size * 0.1 : size - rnd() * size * 0.1, rnd() * size, size * (0.01 + rnd() * 0.03), 0, 6.3); x.fill(); }
  return c;
}

const vertical = (x, text, cx, top, step) => [...text].forEach((ch, i) => x.fillText(ch, cx, top + i * step));

// `seals`: journey.list(); `verse`: { text, from } or null; `when`: the day shown; `label`: season and hour.
// Where each of the `n` seals along the foot of the page lies, as fractions of the page (left, top, width, height),
// its place name under it included: the book lays a button over each seal that has been earned, to go back there.

// Where the big things lie on the 1200 × 1600 page, so that a test can say none of them lies on another. The brush name
// runs down the middle; the 三宝印 stands to its right, the temple's own seal below it to the left, the code (share picture
// and book alike: one drawing serves both) at the lower right under the day.
export const MAIN = { host: "temple.rushiwowen.co", url: "https://temple.rushiwowen.co/" };
/** What the code says: always the main site, whatever address drew the picture. @param {string} l the page's language */
export const shareUrl = (l) => `${MAIN.url}?utm_source=goshuin&utm_medium=share&utm_content=${l}`;
/** What the code on a photograph's card says: the main site again, told apart from the page of seals by its source. @param {string} l */
export const photoUrl = (l) => `${MAIN.url}?utm_source=photo&utm_medium=share&utm_content=${l}`;
export const NAME = { cx: 600, top: 250, step: 262, fs: 250 };
export const SANBAO = { text: "佛法僧宝", cx: 868, cy: 600, size: 210, turn: 0.03 };
export const TEMPLE_SEAL = { cx: 215, cy: 1190, size: 130, turn: -0.04 };
const QR_PX = 5;
/** Where everything that depends on the code lies: the row of seven seals (as `sealBoxes` needs it, shortened to leave the end of the foot to the code), the code's whole square (quiet zone included) with the dark part's size, the line under it. The code is pressed as one more seal, in vermilion, at the right end of the foot's row (the owner's choice of 2026-11-20 among three; #319). @param {string} l */
export function layout(l = lang) {
  const n = qrMatrix(shareUrl(l)).length, side = qrSide(n, QR_PX), x = 1125 - side;
  return { row: { left: 75, right: x - 24, size: 96, top: 1306 }, temple: { ...TEMPLE_SEAL }, qr: { x, y: 1282, w: side, h: side, px: QR_PX, modules: n, dark: n * QR_PX }, label: { x: x + side / 2, y: 1282 + side + 20, width: side } };
}
/** The code's whole square on the page, as a box. @param {string} l */
export const qrBox = (l) => layout(l).qr;
/** Each character of the brush name as the square it is set in. @param {number} n */
export const nameBoxes = (n = 4) => Array.from({ length: n }, (_, i) => ({ x: NAME.cx - NAME.fs / 2, y: NAME.top + i * NAME.step - NAME.fs / 2, w: NAME.fs, h: NAME.fs }));
/** A seal's square, turned a little: its bounding box. @param {{cx:number,cy:number,size:number,turn:number}} s */
export const sealBox = (s) => { const r = Math.abs(Math.sin(s.turn)) + Math.abs(Math.cos(s.turn)), h = s.size * r / 2; return { x: s.cx - h, y: s.cy - h, w: 2 * h, h: 2 * h }; };
const PAGE = { W: 1200, H: 1600 };
/** Where each of `n` seals lies, as fractions of the page (left, top, width, height), its place name included. @param {number} n */
export function sealBoxes(n) {
  const { W, H } = PAGE, { row } = layout(), gap = (row.right - row.left - n * row.size) / (n - 1), pitch = row.size + gap;
  return Array.from({ length: n }, (_, i) => [(row.left + i * pitch - gap / 2) / W, (row.top - 14) / H, pitch / W, (row.size + 62) / H]);
}

export async function drawGoshuin({ seals, verse, when, label, temple = glyphs(nameNow()) }) {
  const homage = glyphs("奉拜"), names = seals.map((sl) => tr(sl.place));
  if (verse) verse = { text: glyphs(verse.text), from: glyphs(verse.from) };
  try { await Promise.all([document.fonts.load(`200px ${FACE.brush}`, temple + homage + (verse ? verse.text : "")), document.fonts.load(`40px ${FACE.serif}`, homage + names.join("") + label), document.fonts.load(`80px ${FACE.seal}`, temple + SANBAO.text + seals.map((sl) => glyphs(sl.seal)).join(""))]); } catch {}
  const W = 1200, H = 1600, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  let s = 41; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Paper: warm, uneven, with its fibres showing.
  const g = x.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, H * 0.75); g.addColorStop(0, "#f4efe3"); g.addColorStop(1, "#e7dfcd"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const px = rnd() * W, py = rnd() * H, a = rnd() * 6.3, l = 6 + rnd() * 26; x.strokeStyle = `rgba(${rnd() < 0.5 ? "120,100,70" : "255,255,250"},${0.03 + rnd() * 0.07})`; x.lineWidth = 0.6 + rnd(); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + rnd() * 6, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  x.textAlign = "center"; x.textBaseline = "middle";
  // The name, in brush, down the middle.
  x.fillStyle = "#1b1815"; x.font = `250px ${BRUSH}`; vertical(x, temple, NAME.cx, NAME.top, NAME.step);
  x.globalCompositeOperation = "destination-out";   // the dry brush: streaks where the hair ran out of ink
  for (let i = 0; i < 520; i++) { const px = W / 2 - 150 + rnd() * 300, py = 120 + rnd() * 1060; x.globalAlpha = 0.1 + rnd() * 0.25; x.fillRect(px, py, 1 + rnd() * 2, 8 + rnd() * 46); }
  x.globalCompositeOperation = "destination-over"; x.globalAlpha = 1; x.fillStyle = "#f1ebde"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
  // The 三宝印 beside the name (it says nothing the brush has said) and the temple's own small seal below it, to the left.
  const press = (sl, text, seed) => { x.save(); x.translate(sl.cx, sl.cy); x.rotate(sl.turn); x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.9; x.drawImage(sealStamp(text, sl.size * 2, { seed }), -sl.size / 2, -sl.size / 2, sl.size, sl.size); x.restore(); };
  const L = layout(); press(SANBAO, SANBAO.text, 3); press(L.temple, temple, 5);
  // To the right: the day. To the left: the line that was given.
  x.fillStyle = "#2a2622"; x.font = `58px ${BRUSH}`; vertical(x, homage, W - 150, 190, 66);
  x.font = `36px ${SERIF}`; x.fillStyle = "#3a352f"; vertical(x, dateLine(when), W - 150, 380, 43);
  x.fillStyle = "#6b6458"; x.font = `28px ${SERIF}`; vertical(x, label.replace(/\s/g, ""), W - 92, 380, 36);
  if (verse) {
    const cols = [], t = [...verse.text]; while (t.length) { const col = t.splice(0, 14); while (t.length && "，。；、？！".includes(t[0])) col.push(t.shift()); cols.push(col.join("")); }   // a column never begins with a stop
    x.fillStyle = "#2a2622"; x.font = `40px ${BRUSH}`; cols.forEach((col, i) => vertical(x, col, 190 - i * 58, 200, 47));
    x.fillStyle = "#6b6458"; x.font = `24px ${SERIF}`; vertical(x, verse.from, Math.max(78, 190 - cols.length * 58 + 6), 200 + 16 * 47 - [...verse.from].length * 28, 28);
  }
  // Along the foot: the seven seals of the visit.
  const n = seals.length, { size, top: y } = L.row, gap = (L.row.right - L.row.left - n * size) / (n - 1); let got = 0;
  seals.forEach((sl, i) => {
    const cx = L.row.left + i * (size + gap) + size / 2;
    if (sl.got) { got++; x.save(); x.translate(cx, y + size / 2); x.rotate(((i * 37) % 9 - 4) * 0.012); x.globalAlpha = 0.9; x.drawImage(sealStamp(glyphs(sl.seal), size * 2, { seed: i + 11 }), -size / 2, -size / 2, size, size); x.restore(); }
    else { x.save(); x.setLineDash([7, 7]); x.strokeStyle = "rgba(90,80,66,.38)"; x.lineWidth = 2; x.strokeRect(cx - size / 2 + 5, y + 5, size - 10, size - 10); x.restore(); x.fillStyle = "rgba(90,80,66,.34)"; x.font = `${Math.round(size * 0.32)}px ${SEAL}`; vertical(x, glyphs(sl.seal), cx, y + size / 2 - size * 0.17, size * 0.37); }
    // A name longer than the space between seals (in English) is set smaller until it fits.
    x.fillStyle = sl.got ? "#4a443c" : "rgba(90,80,66,.55)"; let fs = 23; x.font = `${fs}px ${SERIF}`; while (fs > 14 && x.measureText(names[i]).width > size + gap - 12) x.font = `${--fs}px ${SERIF}`; x.fillText(names[i], cx, y + size + 30);
  });
  x.fillStyle = "#8b8475"; x.font = `22px ${SERIF}`; x.fillText(got === n ? tr("七印圆满") : tr("已得{n}印 · 共七印", { n: NUM[got], k: got }), W / 2, H - 78);
  x.fillStyle = "#a9a293"; x.font = `19px ${SERIF}`; x.fillText(MAIN.host, W / 2, H - 44);
  paintQrLook(x, qrMatrix(shareUrl(lang)), L.qr.x, L.qr.y, L.qr.px, SEAL_LOOK, "#f1ebde");
  x.fillStyle = "#6b6458"; let fs = 24; const note = tr("扫码入山"); x.font = `${fs}px ${SERIF}`; while (fs > 14 && x.measureText(note).width > L.label.width) x.font = `${--fs}px ${SERIF}`; x.fillText(note, L.label.x, L.label.y);
  x.strokeStyle = "rgba(60,50,40,.28)"; x.lineWidth = 2; x.strokeRect(34, 34, W - 68, H - 68);
  return c;
}
