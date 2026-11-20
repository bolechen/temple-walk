// The picture's QR code: the matrix comes from the qrcode-generator library (MIT, Kazuhiko Arase), never from a hand-written
// encoder, and is painted here as square modules inside the quiet zone the standard asks for (four modules of light all round).
import qrcode from "qrcode-generator";

/** The modules of the code for `text` (error correction M, the smallest version that holds it): true is dark.
 * @param {string} text @returns {boolean[][]} */
export function qrMatrix(text) {
  const q = qrcode(0, "M"); q.addData(text, "Byte"); q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

/** Modules of quiet zone on each side. */
export const QUIET = 4;

/** The code's whole square in pixels (modules and quiet zone), for `n` modules a side drawn `px` pixels a module.
 * @param {number} n @param {number} px */
export const qrSide = (n, px) => (n + 2 * QUIET) * px;


/** How a code looks on the paper. `plain`: square black modules, as a decoder's test picture; `ink`: modules a little rounded, in the page's ink; `seal`: modules a little rounded in vermilion, with a seal's frame round the whole, as if one more seal had been pressed.
 * @typedef {{ ink: string, round: number, frame: string | null }} Look */
/** @type {Record<"plain" | "ink" | "seal", Look>} */
export const LOOKS = {
  plain: { ink: "#1b1815", round: 0, frame: null },
  ink: { ink: "#1b1815", round: 0.3, frame: null },
  seal: { ink: "#9c2217", round: 0.3, frame: "#9c2217" },
};

/** Paints the code in a look: paper under the whole square (quiet zone included), each dark module rounded by `look.round` of its side,
 * and for a framed look a thin rounded rule just inside the square's edge, four modules or more from the nearest module (so a decoder meets nothing like a finder pattern in it).
 * @param {CanvasRenderingContext2D} g @param {boolean[][]} m @param {number} x @param {number} y @param {number} px @param {Look} look @param {string} paper */
export function paintQrLook(g, m, x, y, px, look, paper) {
  const n = m.length, side = qrSide(n, px);
  g.fillStyle = paper; g.fillRect(x, y, side, side); g.fillStyle = look.ink;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) {
    const mx = x + (QUIET + c) * px, my = y + (QUIET + r) * px;
    if (look.round > 0) { g.beginPath(); g.roundRect(mx, my, px, px, px * look.round); g.fill(); } else g.fillRect(mx, my, px, px);
  }
  if (look.frame) { g.strokeStyle = look.frame; g.lineWidth = Math.max(2, px * 0.6); const e = g.lineWidth / 2 + px * 0.2; g.beginPath(); g.roundRect(x + e, y + e, side - 2 * e, side - 2 * e, px * 2.2); g.stroke(); }
}
