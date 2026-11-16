// The page of seals a visitor carries away: the temple's name in brush, the day, the line the library gave,
// the temple's own seal pressed over the name, and along the foot the seven small seals of the visit, red where
// earned and a faint outline where not. One drawing serves the book on screen and the picture that is shared.
const BRUSH = '"Yunjing Brush", "STKaiti", "KaiTi", serif', SERIF = '"Yunjing Serif", "Songti SC", "STSong", serif', SEAL = '"Yunjing Seal", "Yunjing Serif", "Songti SC", serif';
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
const PAGE = { W: 1200, H: 1600, size: 126, top: 1318 };
export function sealBoxes(n) {
  const { W, H, size, top } = PAGE, gap = (W - 150 - n * size) / (n - 1), pitch = size + gap;
  return Array.from({ length: n }, (_, i) => [(75 + i * pitch - gap / 2) / W, (top - 14) / H, pitch / W, (size + 62) / H]);
}

export async function drawGoshuin({ seals, verse, when, label, temple = "云径禅寺", url = "" }) {
  try { await Promise.all([document.fonts.load(`200px "Yunjing Brush"`, temple), document.fonts.load(`40px "Yunjing Serif"`, "奉拜"), document.fonts.load(`80px "Yunjing Seal"`, temple)]); } catch {}
  const W = 1200, H = 1600, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  let s = 41; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // Paper: warm, uneven, with its fibres showing.
  const g = x.createRadialGradient(W / 2, H * 0.45, 100, W / 2, H / 2, H * 0.75); g.addColorStop(0, "#f4efe3"); g.addColorStop(1, "#e7dfcd"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const px = rnd() * W, py = rnd() * H, a = rnd() * 6.3, l = 6 + rnd() * 26; x.strokeStyle = `rgba(${rnd() < 0.5 ? "120,100,70" : "255,255,250"},${0.03 + rnd() * 0.07})`; x.lineWidth = 0.6 + rnd(); x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.cos(a) * l * 0.5 + rnd() * 6, py + Math.sin(a) * l * 0.5, px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  x.textAlign = "center"; x.textBaseline = "middle";
  // The name, in brush, down the middle.
  x.fillStyle = "#1b1815"; x.font = `250px ${BRUSH}`; vertical(x, temple, W / 2, 250, 262);
  x.globalCompositeOperation = "destination-out";   // the dry brush: streaks where the hair ran out of ink
  for (let i = 0; i < 520; i++) { const px = W / 2 - 150 + rnd() * 300, py = 120 + rnd() * 1060; x.globalAlpha = 0.1 + rnd() * 0.25; x.fillRect(px, py, 1 + rnd() * 2, 8 + rnd() * 46); }
  x.globalCompositeOperation = "destination-over"; x.globalAlpha = 1; x.fillStyle = "#f1ebde"; x.fillRect(0, 0, W, H); x.globalCompositeOperation = "source-over";
  // The temple's seal over the name.
  x.save(); x.translate(W / 2 + 6, 770); x.rotate(-0.03); x.globalCompositeOperation = "multiply"; x.globalAlpha = 0.9; x.drawImage(sealStamp(temple, 360, { seed: 3 }), -180, -180); x.restore();   // pressed over the ink, which shows through
  // To the right: the day. To the left: the line that was given.
  x.fillStyle = "#2a2622"; x.font = `58px ${BRUSH}`; vertical(x, "奉拜", W - 150, 190, 66);
  x.font = `36px ${SERIF}`; x.fillStyle = "#3a352f"; vertical(x, dateLine(when), W - 150, 380, 43);
  x.fillStyle = "#6b6458"; x.font = `28px ${SERIF}`; vertical(x, label.replace(/\s/g, ""), W - 92, 380, 36);
  if (verse) {
    const cols = [], t = [...verse.text]; while (t.length) { const col = t.splice(0, 14); while (t.length && "，。；、？！".includes(t[0])) col.push(t.shift()); cols.push(col.join("")); }   // a column never begins with a stop
    x.fillStyle = "#2a2622"; x.font = `40px ${BRUSH}`; cols.forEach((col, i) => vertical(x, col, 190 - i * 58, 200, 47));
    x.fillStyle = "#6b6458"; x.font = `24px ${SERIF}`; vertical(x, verse.from, Math.max(78, 190 - cols.length * 58 + 6), 200 + 16 * 47 - [...verse.from].length * 28, 28);
  }
  // Along the foot: the seven seals of the visit.
  const n = seals.length, size = 126, gap = (W - 150 - n * size) / (n - 1), y = 1318; let got = 0;
  seals.forEach((sl, i) => {
    const cx = 75 + i * (size + gap) + size / 2;
    if (sl.got) { got++; x.save(); x.translate(cx, y + size / 2); x.rotate(((i * 37) % 9 - 4) * 0.012); x.globalAlpha = 0.9; x.drawImage(sealStamp(sl.seal, size * 2, { seed: i + 11 }), -size / 2, -size / 2, size, size); x.restore(); }
    else { x.save(); x.setLineDash([7, 7]); x.strokeStyle = "rgba(90,80,66,.38)"; x.lineWidth = 2; x.strokeRect(cx - size / 2 + 5, y + 5, size - 10, size - 10); x.restore(); x.fillStyle = "rgba(90,80,66,.34)"; x.font = `40px ${SEAL}`; vertical(x, sl.seal, cx, y + size / 2 - 22, 46); }
    x.fillStyle = sl.got ? "#4a443c" : "rgba(90,80,66,.55)"; x.font = `23px ${SERIF}`; x.fillText(sl.place, cx, y + size + 30);
  });
  x.fillStyle = "#8b8475"; x.font = `22px ${SERIF}`; x.fillText(got === n ? "七印圆满" : `已得${NUM[got]}印 · 共七印`, W / 2, H - 78);
  if (url) { x.fillStyle = "#a9a293"; x.font = `19px ${SERIF}`; x.fillText(url, W / 2, H - 44); }
  x.strokeStyle = "rgba(60,50,40,.28)"; x.lineWidth = 2; x.strokeRect(34, 34, W - 68, H - 68);
  return c;
}
