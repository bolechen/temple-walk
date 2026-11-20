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

/** Paints the code with its quiet zone at (x, y) on a canvas context: `paper` under all of it, `ink` for each dark module.
 * @param {CanvasRenderingContext2D} g @param {boolean[][]} m @param {number} x @param {number} y @param {number} px @param {string} ink @param {string} paper */
export function paintQr(g, m, x, y, px, ink, paper) {
  const n = m.length; g.fillStyle = paper; g.fillRect(x, y, qrSide(n, px), qrSide(n, px)); g.fillStyle = ink;
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (m[r][c]) g.fillRect(x + (QUIET + c) * px, y + (QUIET + r) * px, px, px);
}
