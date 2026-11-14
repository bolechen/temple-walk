// A hanging name board: gold calligraphy on a dark lacquered plank, drawn on a canvas.
// Read right to left, as these boards are.
import * as THREE from "../v/build/three.module.js";

const FONT = '"Yunjing Kai", "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif';
// A board is written in the old forms, whatever the page calls the place.
const OLD = { 双: "雙", 径: "徑", 归: "歸", 万: "萬", 续: "續", 云: "雲", 禅: "禪", 钟: "鐘", 楼: "樓", 宝: "寶", 经: "經", 阁: "閣", 观: "觀", 药: "藥", 师: "師", 龙: "龍", 砚: "硯", 吃: "喫" };

// `vertical`: characters stacked top to bottom, as on the board between the eaves of a gate.
// `gold`: dark characters on a gilded ground, as on the boards of the great halls.
export function makePlaque(text, { vertical = false, gold = false } = {}) {
  const chars = [...text].map((ch) => OLD[ch] || ch), n = chars.length, cell = 448, pad = 168, long = cell * n + pad * 2, short = 616;   // large enough to read the brush at arm's length
  // A board of four characters hung upright between the eaves is a banded board (huadai pai): five high to four wide, the characters in
  // two columns read from the right, inside a broad raked frame.
  const band = vertical && n === 4;
  const W = band ? cell * 2 + pad * 2 + 120 : vertical ? short : long, H = band ? Math.round((cell * 2 + pad * 2 + 120) * 1.25) : vertical ? long : short;
  const c = document.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  function draw() {
    const g = x.createLinearGradient(0, 0, 0, H);
    if (gold) { g.addColorStop(0, "#9c8050"); g.addColorStop(1, "#7d6438"); } else { g.addColorStop(0, "#1f1b18"); g.addColorStop(1, "#2a2420"); }
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.strokeStyle = gold ? "#3a2416" : "#84703f"; x.lineWidth = band ? 120 : 28; x.strokeRect(band ? 60 : 24, band ? 60 : 24, W - (band ? 120 : 48), H - (band ? 120 : 48));
    x.strokeStyle = gold ? "#5a3a1e" : "#6f5a2a"; x.lineWidth = band ? 8 : 5; x.strokeRect(band ? 134 : 60, band ? 134 : 60, W - (band ? 268 : 120), H - (band ? 268 : 120));
    x.font = `${Math.round(cell * 0.84)}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
    x.shadowColor = gold ? "rgba(255,230,150,.35)" : "rgba(0,0,0,.6)"; x.shadowBlur = 10; x.shadowOffsetY = 5; x.fillStyle = x.strokeStyle = gold ? "#17110c" : "#a88c52"; x.lineWidth = 9; x.lineJoin = "round";   // the kai hand, cut a little heavier, as a carver cuts it
    chars.forEach((ch, i) => { const cx = band ? W / 2 + (i < 2 ? 1 : -1) * cell * 0.5 : vertical ? W / 2 : W - pad - cell * (i + 0.5), cy = band ? H / 2 + ((i % 2) - 0.5) * cell * 1.12 + 6 : vertical ? pad + cell * (i + 0.5) + 6 : H / 2 + 6; x.strokeText(ch, cx, cy); x.fillText(ch, cx, cy); });
    x.shadowColor = "transparent";
    // Wear: the gilding thins and the lacquer dulls in patches.
    let s = n * 7919 + 13; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1100; i++) { x.fillStyle = gold ? `rgba(60,40,18,${0.04 + rnd() * 0.16})` : `rgba(12,14,18,${0.05 + rnd() * 0.22})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * H, 1 + rnd() * 14, 0.6 + rnd() * 4, rnd() * 3, 0, 7); x.fill(); }
    // The grain of the plank shows through the lacquer, and the edges are rubbed.
    for (let y = 0; y < H; y += 3) { x.fillStyle = `rgba(${gold ? "40,26,10" : "160,150,130"},${0.015 + rnd() * 0.035})`; x.fillRect(0, y + Math.sin(y * 0.05) * 2, W, 1); }
    tex.needsUpdate = true;
  }
  draw();
  // The brush face arrives over the network; redraw once it is there.
  if (document.fonts && document.fonts.load) document.fonts.load(`200px "Yunjing Kai"`, chars.join("")).then(draw, () => {});
  const a = band ? 2.3 : n * 0.6 + 0.45, b = band ? 2.3 * 0.8 : (a * short) / long, w = vertical ? b : a, h = vertical ? a : b;
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.07), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.62, metalness: gold ? 0.25 : 0.05, envMapIntensity: 0.3 }));
  m.castShadow = true; m.userData.height = h;
  return m;
}
