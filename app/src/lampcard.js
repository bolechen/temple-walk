// The card that goes with a lamp lit for someone (#343): the line chosen from the list, the temple's name, the season and
// hour it was lit in, and a code that opens the same lamp (the page of seals' own seal-like code, #319). Everything on it
// is a line from the list or from the page's own words; there is nowhere a name or a sentence of anyone's could be written.
import { t as tr, FONT, FACE } from "./i18n.js";
import { templeNow } from "./temple.js";
import { qrMatrix, qrSide, paintQrLook, SEAL_LOOK } from "./qr.js";
import { MAIN } from "./goshuin.js";

/** Breaks a line into rows no wider than `max`, at the marks a sentence is read by (。、，；！？ and their Latin kin) before anywhere else, and never leaving a row of one or two characters alone: the type is made smaller, to `least`, until every clause lies whole on a row; a clause that still will not is broken between words (the segmenter's, so a Japanese or Chinese clause is cut at a word, not in it).
 * @param {CanvasRenderingContext2D} x @param {string} text @param {number} max @param {(size: number) => string} fontOf @param {number} from @param {number} least @returns {{ size: number, rows: string[] }} */
export function fitLines(x, text, max, fontOf, from, least) {
  const clauses = text.split(/(?<=[。、，；！？.,;!?])\s*/).filter(Boolean), at = (size) => { x.font = fontOf(size); };
  const wide = (str) => x.measureText(str).width;
  const rowsOf = (units) => { const rows = [""]; for (const u of units) { const joined = rows[rows.length - 1] ? rows[rows.length - 1] + (/[A-Za-z]$/.test(rows[rows.length - 1]) ? " " : "") + u : u; if (rows[rows.length - 1] && wide(joined) > max) rows.push(u); else rows[rows.length - 1] = joined; } return rows; };
  for (let size = from; size >= least; size -= 2) { at(size); if (clauses.every((c) => wide(c) <= max)) return { size, rows: rowsOf(clauses) }; }
  at(least);
  /** @type {string[]} */ let pieces; try { pieces = [...new Intl.Segmenter(undefined, { granularity: "word" }).segment(text)].map((g) => g.segment); } catch { pieces = [...text]; }
  const rows = [""]; for (const p of pieces) { const t = rows[rows.length - 1] + p; if (rows[rows.length - 1] && wide(t) > max) rows.push(p.trimStart()); else rows[rows.length - 1] = t; }
  return { size: least, rows: rows.map((r) => r.trim()).filter(Boolean) };
}

/** @param {{ wish: string, label: string, url: string }} what `wish` and `label` already in the visitor's language; `url` is the link the code holds. */
export async function drawLampCard({ wish, label, url }) {
  const BRUSH = FONT.brush, XING = FONT.xing, SERIF = FONT.serif, temple = templeNow(), line = tr("有人在此为你点了一盏灯。"), note = tr("扫码入山");
  try { await Promise.all([document.fonts.load(`60px ${FACE.brush}`, temple), document.fonts.load(`60px ${FACE.xing}`, wish), document.fonts.load(`30px ${FACE.serif}`, label + line + note)]); } catch {}
  const W = 1080, H = 1350, c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d");
  let s = 17; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const g = x.createRadialGradient(W / 2, H * 0.42, 60, W / 2, H / 2, H * 0.78); g.addColorStop(0, "#f4efe3"); g.addColorStop(1, "#e4dbc8"); x.fillStyle = g; x.fillRect(0, 0, W, H);
  for (let i = 0; i < 1800; i++) { const px = rnd() * W, py = rnd() * H, a = rnd() * 6.3, l = 6 + rnd() * 22; x.strokeStyle = `rgba(${rnd() < 0.5 ? "120,100,70" : "255,255,250"},${0.03 + rnd() * 0.06})`; x.lineWidth = 0.6 + rnd(); x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke(); }
  x.strokeStyle = "rgba(60,50,40,.28)"; x.lineWidth = 2; x.strokeRect(30, 30, W - 60, H - 60);
  x.textAlign = "center"; x.textBaseline = "middle";
  // The temple's name, small, and under it the one small flame the card is about.
  x.fillStyle = "#2a2622"; x.font = `62px ${BRUSH}`; try { x.letterSpacing = "10px"; } catch {} x.fillText(temple, W / 2 + 5, 130); try { x.letterSpacing = "0px"; } catch {}
  const fy = 330, glow = x.createRadialGradient(W / 2, fy, 4, W / 2, fy, 190); glow.addColorStop(0, "rgba(255,190,90,.55)"); glow.addColorStop(0.45, "rgba(255,160,60,.16)"); glow.addColorStop(1, "rgba(255,160,60,0)"); x.fillStyle = glow; x.fillRect(W / 2 - 200, fy - 200, 400, 400);
  x.fillStyle = "#c9532a"; x.beginPath(); x.ellipse(W / 2, fy, 16, 40, 0, 0, 6.3); x.fill(); x.fillStyle = "#ffc874"; x.beginPath(); x.ellipse(W / 2, fy + 8, 8, 22, 0, 0, 6.3); x.fill();
  x.fillStyle = "#4a3d2c"; x.beginPath(); x.roundRect(W / 2 - 46, fy + 52, 92, 24, 10); x.fill();
  // The line chosen, broken at its clauses (fitLines).
  x.fillStyle = "#26221e"; const { size, rows } = fitLines(x, wish, W - 260, (n) => `${n}px ${XING}`, 66, 44); x.font = `${size}px ${XING}`;
  const top = 640 - ((rows.length - 1) * (size * 1.5)) / 2; rows.forEach((r, i) => x.fillText(r, W / 2, top + i * size * 1.5));
  x.fillStyle = "#6f695e"; x.font = `30px ${SERIF}`; x.fillText(label, W / 2, 800); x.fillText(line, W / 2, 850);
  // The code, pressed as a seal as on the page of seals, and under it what it is for and whose page it is.
  const m = qrMatrix(url), px = 5, side = qrSide(m.length, px), qx = Math.round((W - side) / 2), qy = 900;
  paintQrLook(x, m, qx, qy, px, SEAL_LOOK, "#efe8d8");
  x.fillStyle = "#6b6458"; x.font = `24px ${SERIF}`; x.fillText(note, W / 2, qy + side + 24);
  x.fillStyle = "#a9a293"; x.font = `19px ${SERIF}`; x.fillText(MAIN.host, W / 2, H - 52);
  return c;
}
