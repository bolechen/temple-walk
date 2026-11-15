// The leaves that hang in the halls' frames: small ink paintings, each made of a few brush strokes on paper, with
// its title down the right side and a seal at the foot. They are drawn here, not fetched, so they are as sharp as
// the frame is large and nothing has to be licensed. `paintLeaf(item)` returns the texture for one frame.
import * as THREE from "../vendor/three/build/three.module.js";

const XING = '"Yunjing Xing", "Yunjing Kai", "STKaiti", "KaiTi", serif', SEAL = '"Yunjing Seal", "Yunjing Serif", "Songti SC", serif';
const W = 768, H = 1152, CX = 330, CY = 520;   // the picture sits a little left of centre: the title has the right margin

function tools(x, seed) {
  let s = seed; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  // One stroke of a loaded brush through `pts`: it swells after it touches down, thins as it lifts, and where the
  // hair runs dry (toward the end, by `dry`) the paper shows through.
  const ink = (pts, w, a = 0.86, dry = 0.25, col = "20,18,16") => {
    let total = 0; const seg = []; for (let i = 0; i < pts.length - 1; i++) { const l = Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); seg.push(l); total += l; }
    let run = 0;
    for (let i = 0; i < seg.length; i++) { const n = Math.max(1, Math.ceil(seg[i] / 1.6));
      for (let k = 0; k < n; k++) { const t = (run + (seg[i] * k) / n) / total, px = pts[i][0] + ((pts[i + 1][0] - pts[i][0]) * k) / n, py = pts[i][1] + ((pts[i + 1][1] - pts[i][1]) * k) / n;
        if (rnd() < dry * t * t * 1.6) continue;
        const r = (w / 2) * (0.5 + 0.5 * Math.min(1, t * 6)) * (1 - 0.55 * Math.pow(t, 3)) * (0.9 + 0.2 * rnd());
        x.fillStyle = `rgba(${col},${(a * (0.5 + 0.5 * rnd())).toFixed(3)})`; x.beginPath(); x.arc(px + (rnd() - 0.5) * 1.2, py + (rnd() - 0.5) * 1.2, r, 0, 6.3); x.fill(); }
      run += seg[i]; }
  };
  // Thin ink let into wet paper: a soft patch with no edge.
  const wash = (cx, cy, rx, ry, a = 0.22, col = "40,40,38") => { x.save(); x.translate(cx, cy); x.scale(1, ry / rx); const g = x.createRadialGradient(0, 0, 0, 0, 0, rx); g.addColorStop(0, `rgba(${col},${a})`); g.addColorStop(0.6, `rgba(${col},${a * 0.55})`); g.addColorStop(1, `rgba(${col},0)`); x.fillStyle = g; x.fillRect(-rx, -rx, rx * 2, rx * 2); x.restore(); };
  const arc = (cx, cy, rx, ry, a0, a1, n = 40) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]; });
  return { ink, wash, arc, rnd };
}

const MOTIF = {
  // The gate at the top of the steps, half in mist.
  gate({ ink, wash, arc }) {
    wash(CX, CY + 150, 300, 90, 0.2); wash(CX - 60, CY - 150, 240, 110, 0.1);
    ink([[CX - 180, CY - 20], [CX - 90, CY - 78], [CX, CY - 92], [CX + 90, CY - 78], [CX + 180, CY - 20]], 30, 0.9, 0.3);
    ink([[CX - 110, CY - 122], [CX, CY - 176], [CX + 110, CY - 122]], 22, 0.85, 0.35);
    ink([[CX - 104, CY - 20], [CX - 100, CY + 190]], 24, 0.88, 0.5); ink([[CX + 104, CY - 20], [CX + 100, CY + 190]], 24, 0.88, 0.5);
    for (let i = 0; i < 4; i++) ink([[CX - 150 - i * 22, CY + 226 + i * 34], [CX + 150 + i * 22, CY + 226 + i * 34]], 9 - i, 0.4 - i * 0.07, 0.6);
  },
  // One circle, drawn in a breath, and someone sitting inside it.
  sit({ ink, wash, arc }) {
    ink(arc(CX, CY, 190, 190, -1.25, 4.55, 90), 46, 0.9, 0.55);
    wash(CX, CY + 86, 96, 30, 0.3); ink(arc(CX, CY - 22, 24, 26, 0, 6.3, 24), 12, 0.8, 0.1);
    ink([[CX - 46, CY + 78], [CX - 14, CY + 14], [CX + 14, CY + 14], [CX + 46, CY + 78]], 30, 0.82, 0.2);
  },
  // A bowl of tea, and what rises from it.
  tea({ ink, wash, arc }) {
    wash(CX, CY + 140, 230, 40, 0.16);
    ink(arc(CX, CY + 20, 170, 112, 0.04, Math.PI - 0.04, 60), 30, 0.9, 0.3); ink([[CX - 172, CY + 20], [CX + 172, CY + 20]], 12, 0.85, 0.4);
    ink([[CX - 50, CY + 138], [CX + 50, CY + 138]], 18, 0.88, 0.3); wash(CX, CY + 36, 130, 22, 0.32, "70,62,40");
    for (const [dx, k] of [[-40, 1], [34, -1]]) ink(Array.from({ length: 30 }, (_, i) => [CX + dx + Math.sin(i * 0.42) * 26 * k, CY - 10 - i * 9]), 9, 0.22, 0.7);
  },
  // A scroll half unrolled: columns of writing nobody has read for a while.
  scroll({ ink, wash, rnd }) {
    wash(CX, CY + 20, 260, 190, 0.07);
    ink([[CX - 190, CY - 150], [CX + 190, CY - 150]], 12, 0.8, 0.4); ink([[CX - 190, CY + 170], [CX + 150, CY + 170]], 12, 0.8, 0.5);
    ink([[CX - 196, CY - 168], [CX - 196, CY + 188]], 26, 0.9, 0.3); ink([[CX + 196, CY - 168], [CX + 196, CY + 60]], 30, 0.9, 0.4);
    for (let c = 0; c < 7; c++) { const px = CX + 150 - c * 50; for (let r = 0; r < 9 - (c > 4 ? 3 : 0); r++) ink([[px - 6 + rnd() * 6, CY - 120 + r * 30], [px + 8, CY - 108 + r * 30 + rnd() * 6]], 7, 0.5, 0.2); }
  },
  // A gourd on its cord: what the medicine was carried in.
  gourd({ ink, wash, arc }) {
    wash(CX + 10, CY + 60, 150, 190, 0.12, "60,56,40");
    ink(arc(CX, CY + 80, 122, 128, -1.9, 4.4 - 1.9 + 1.35, 70), 26, 0.88, 0.4); ink(arc(CX, CY - 92, 70, 72, 1.1, 2.04 + 6.28, 60), 22, 0.88, 0.35);
    ink([[CX, CY - 164], [CX + 8, CY - 196], [CX + 30, CY - 212]], 12, 0.9, 0.2);
    ink([[CX - 64, CY - 26], [CX, CY - 12], [CX + 64, CY - 26]], 9, 0.7, 0.3); ink([[CX + 60, CY - 24], [CX + 96, CY + 40], [CX + 84, CY + 110]], 6, 0.55, 0.5);
  },
  // A lamp: the one touch of colour on the mountain after dark.
  lamp({ ink, wash, arc }) {
    wash(CX, CY - 60, 210, 210, 0.2, "214,150,70"); wash(CX, CY - 80, 90, 110, 0.3, "226,170,90");
    ink([[CX - 120, CY + 60], [CX - 60, CY + 96], [CX + 60, CY + 96], [CX + 120, CY + 60]], 22, 0.9, 0.3);
    ink([[CX, CY + 100], [CX, CY + 200]], 20, 0.88, 0.3); ink([[CX - 90, CY + 214], [CX + 90, CY + 214]], 20, 0.9, 0.3);
    ink([[CX, CY + 56], [CX - 16, CY + 6], [CX - 4, CY - 50], [CX + 6, CY - 86]], 30, 0.92, 0.05, "176,40,28"); ink([[CX + 2, CY + 50], [CX + 4, CY]], 10, 0.9, 0, "236,190,110");
  },
  // The well: a stone ring, dark water, and the moon in it.
  well({ ink, wash, arc }) {
    wash(CX, CY + 76, 150, 50, 0.6, "22,24,26"); wash(CX + 34, CY + 70, 34, 16, 0.9, "236,232,220");
    ink(arc(CX, CY + 70, 190, 70, 0.2, 6.2, 80), 34, 0.9, 0.35); ink(arc(CX, CY + 150, 196, 60, 0.3, Math.PI - 0.3, 50), 20, 0.7, 0.5);
    ink([[CX - 30, CY - 260], [CX - 24, CY - 60], [CX - 28, CY + 30]], 7, 0.6, 0.3); wash(CX - 40, CY - 200, 200, 120, 0.08);
  },
  // Roof behind roof, seen from the top, and the hills behind those.
  roofs({ ink, wash, arc }) {
    wash(CX - 40, CY - 210, 260, 80, 0.14); wash(CX + 80, CY - 170, 200, 60, 0.1);
    ink([[CX - 230, CY - 150], [CX - 110, CY - 232], [CX, CY - 180], [CX + 120, CY - 250], [CX + 230, CY - 170]], 12, 0.35, 0.5);
    for (let i = 0; i < 4; i++) { const yy = CY - 70 + i * 86, w = 90 + i * 46; ink([[CX - w - 30, yy + 34], [CX - w * 0.5, yy + 4], [CX, yy - 6], [CX + w * 0.5, yy + 4], [CX + w + 30, yy + 34]], 16 + i * 5, 0.5 + i * 0.13, 0.35); ink([[CX - w * 0.6, yy - 12], [CX + w * 0.6, yy - 12]], 7 + i, 0.4 + i * 0.1, 0.4); }
    wash(CX, CY + 250, 280, 50, 0.18);
  },
};

export function paintLeaf(item) {
  const c = document.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  function draw() {
    const t = tools(x, 17 + [...item.title].reduce((a, ch) => a + ch.charCodeAt(0), 0));
    const g = x.createLinearGradient(0, 0, W, H); g.addColorStop(0, "#ece5d5"); g.addColorStop(1, "#dcd3bf"); x.fillStyle = g; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 2200; i++) { x.fillStyle = `rgba(${t.rnd() < 0.5 ? "110,95,70" : "255,255,250"},${0.03 + t.rnd() * 0.06})`; x.fillRect(t.rnd() * W, t.rnd() * H, 1 + t.rnd() * 7, 1); }   // the fibres of the paper
    (MOTIF[item.paint] || MOTIF.sit)(t);
    // The title, written down the right side, and a seal under it.
    x.fillStyle = "rgba(24,21,18,.9)"; x.textAlign = "center"; x.textBaseline = "middle"; x.font = `104px ${XING}`;
    [...item.title].forEach((ch, i) => x.fillText(ch, W - 104, 150 + i * 96));
    const sy = 150 + [...item.title].length * 96 + 6; x.fillStyle = "rgba(176,40,28,.88)"; x.fillRect(W - 140, sy, 72, 72);
    x.fillStyle = "#efe6d4"; x.font = `50px ${SEAL}`; x.fillText([...item.title][0], W - 104, sy + 38);
    x.strokeStyle = "rgba(60,50,40,.3)"; x.lineWidth = 3; x.strokeRect(34, 34, W - 68, H - 68);
    tex.needsUpdate = true;
  }
  draw();
  if (document.fonts && document.fonts.load) Promise.all([document.fonts.load(`104px "Yunjing Xing"`, item.title), document.fonts.load(`50px "Yunjing Seal"`, item.title)]).then(draw, () => {});
  return tex;
}
