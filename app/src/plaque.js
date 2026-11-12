// A hanging name board: gold calligraphy on a dark lacquered plank, drawn on a canvas.
// Read right to left, as these boards are.
import * as THREE from "../v/build/three.module.js";

const FONT = '"Ma Shan Zheng", "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif';

// `vertical`: characters stacked top to bottom, as on the board between the eaves of a gate.
// `gold`: dark characters on a gilded ground, as on the boards of the great halls.
export function makePlaque(text, { vertical = false, gold = false } = {}) {
  const chars = [...text], n = chars.length, cell = 256, pad = 96, long = cell * n + pad * 2, short = 352;
  const W = vertical ? short : long, H = vertical ? long : short;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, H);
    if (gold) { g.addColorStop(0, "#b08a35"); g.addColorStop(1, "#8f6c26"); } else { g.addColorStop(0, "#0f141b"); g.addColorStop(1, "#1b222c"); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = gold ? "#3a2416" : "#a8873c"; x.lineWidth = 16; x.strokeRect(14, 14, W - 28, H - 28);
    x.strokeStyle = gold ? "#5a3a1e" : "#6f5a2a"; x.lineWidth = 3; x.strokeRect(34, 34, W - 68, H - 68);
    x.font = `${Math.round(cell * 0.84)}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = gold ? "rgba(255,230,150,.35)" : "rgba(0,0,0,.6)"; x.shadowBlur = 6; x.shadowOffsetY = 3; x.fillStyle = gold ? "#17110c" : "#cfa850";
    chars.forEach((ch, i) => (vertical ? x.fillText(ch, W / 2, pad + cell * (i + 0.5) + 6) : x.fillText(ch, W - pad - cell * (i + 0.5), H / 2 + 6)));
    x.shadowColor = "transparent";
    // Wear: the gilding thins and the lacquer dulls in patches.
    let s = n * 7919 + 13; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 260; i++) { x.fillStyle = gold ? `rgba(60,40,18,${0.04 + rnd() * 0.16})` : `rgba(12,14,18,${0.05 + rnd() * 0.22})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * H, 2 + rnd() * 16, 1 + rnd() * 5, rnd() * 3, 0, 7); x.fill(); }
    tex.needsUpdate = true;
  }
  draw();
  // The brush face arrives over the network; redraw once it is there.
  if (document.fonts && document.fonts.load) document.fonts.load(`200px "Ma Shan Zheng"`, text).then(draw, () => {});
  const a = n * 0.6 + 0.45, b = (a * short) / long, w = vertical ? b : a, h = vertical ? a : b;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, metalness: gold ? 0.35 : 0.15, envMapIntensity: 0.5 }));
  m.castShadow = true; m.userData.height = h;
  return m;
}
