// A photograph, mounted: the picture on a sheet of paper with a line of verse, the name of the place, and a seal.
// The verse is written in a running hand, as a line is added to a picture; the name and the seal keep the brush.
// Each in the visitor's language (src/i18n.js); the seal is cut in the temple's characters (`seal`, two of them).
import { FONT, FACE } from "./i18n.js";
import { qrMatrix, qrSide, paintQrLook, SEAL_LOOK } from "./qr.js";
const BRUSH = FONT.brush, SERIF = FONT.serif, XING = FONT.xing;

/** `qr`: the address the code on the card says, or null for a card without one. */
export async function composeCard(shot, { line, label, temple, url, seal = temple, qr = null }) {
  try { await Promise.all([document.fonts.load(`80px ${FACE.xing}`, line), document.fonts.load(`80px ${FACE.brush}`, seal), document.fonts.load(`30px ${FACE.serif}`, temple + label)]); } catch {}
  const W = shot.width, H = shot.height, m = Math.round(Math.min(W, H) * 0.055), mod = qr ? qrMatrix(qr) : null;
  // The foot is a fifth of the picture's short side, or taller where the code would otherwise have to be drawn with modules under 4 px (a JPEG does not keep a smaller one readable).
  const foot = Math.max(Math.round(Math.min(W, H) * 0.2), mod ? Math.ceil((4 * (mod.length + 8)) / 0.84) : 0);
  const c = document.createElement("canvas"); c.width = W + m * 2; c.height = H + m + foot;
  const x = c.getContext("2d"), u = Math.min(W, H) / 100;
  x.fillStyle = "#f3efe5"; x.fillRect(0, 0, c.width, c.height);
  // The tooth of the paper.
  let s = 9; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "90,80,60" : "255,255,255"},${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * c.width, rnd() * c.height, 1 + rnd() * 3, 1); }
  x.shadowColor = "rgba(40,30,20,.28)"; x.shadowBlur = u * 1.6; x.shadowOffsetY = u * 0.5;
  x.drawImage(shot, m, m); x.shadowColor = "transparent";
  x.strokeStyle = "rgba(30,26,22,.35)"; x.lineWidth = 1; x.strokeRect(m + 0.5, m + 0.5, W - 1, H - 1);

  const y0 = H + m, cy = y0 + foot / 2;
  // The seal stands at the right end of the foot; the code (the page of seals' own look, in vermilion) just left of it, and the words
  // are kept clear of it: each line is set smaller, if it must be, until it fits.
  const z = u * 8.6, sx = c.width - m - u - z, sy = cy - z / 2 - u * 0.4;
  let room = sx - u * 2 - (m + u);
  if (qr) {
    const n = mod.length, px = Math.max(4, Math.floor((foot * 0.84) / (n + 8))), side = qrSide(n, px), qx = sx - u * 1.6 - side;
    paintQrLook(x, mod, qx, cy - side / 2, px, px >= 5 ? SEAL_LOOK : { ...SEAL_LOOK, round: 0 }, "#f3efe5");
    room = qx - u * 1.2 - (m + u);   // (modules under 5 px keep their corners: a rounded one that small is not read reliably from a JPEG)
  }
  const small = (size, text, face) => { x.font = `${size}px ${face}`; const w = x.measureText(text).width; return w > room ? Math.max(Math.floor(size * 0.5), Math.floor(size * room / w)) : size; };
  x.fillStyle = "#26221e"; x.textBaseline = "middle"; x.textAlign = "left";
  const lineSize = small(Math.round(u * 6.6), line, XING); x.font = `${lineSize}px ${XING}`; x.fillText(line, m + u, cy - u * 2.4);
  x.fillStyle = "#6f695e"; try { x.letterSpacing = `${u * 0.7}px`; } catch {}
  // With no verse above it (a level that gives none for this hour) the name is the card's one line: larger, and level with the seal's middle, not left half a figure below it.
  const bare = !line, name = `${temple} · ${label}`, nameSize = small(Math.round(u * (bare ? 2.8 : 2.1)), name, SERIF); x.font = `${nameSize}px ${SERIF}`; x.fillText(name, m + u, bare ? cy : cy + u * 3.4);
  x.fillStyle = "#a39c8e"; try { x.letterSpacing = `${u * 0.15}px`; } catch {}
  const urlSize = small(Math.round(u * 1.5), url, SERIF); x.font = `${urlSize}px ${SERIF}`; x.fillText(url, m + u, cy + u * 6.6);
  // The seal: two characters cut in red, pressed a little unevenly.
  x.save(); x.translate(sx + z / 2, sy + z / 2); x.rotate(-0.025); x.fillStyle = "#b02a1f";
  const r = z * 0.12; x.beginPath(); x.roundRect(-z / 2, -z / 2, z, z, r); x.fill();
  x.fillStyle = "#f6efe2"; x.textAlign = "center"; try { x.letterSpacing = "0px"; } catch {} x.font = `${Math.round(z * 0.46)}px ${BRUSH}`;
  [...seal].slice(0, 2).forEach((ch, i) => x.fillText(ch, 0, (i - 0.5) * z * 0.46 + z * 0.02));
  x.globalCompositeOperation = "destination-out";   // wear in the seal
  for (let i = 0; i < 90; i++) { x.fillStyle = `rgba(0,0,0,${0.25 + rnd() * 0.5})`; x.fillRect((rnd() - 0.5) * z, (rnd() - 0.5) * z, 1 + rnd() * u * 0.4, 1 + rnd() * u * 0.25); }
  x.restore();
  // destination-out cut through to nothing; lay paper back under those specks.
  x.globalCompositeOperation = "destination-over"; x.fillStyle = "#f3efe5"; x.fillRect(0, 0, c.width, c.height); x.globalCompositeOperation = "source-over";
  return c;
}
