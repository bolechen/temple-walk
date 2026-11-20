// The name boards, painted on a canvas after the boards of the temple this place is drawn from (docs/JINGSHAN.md has
// the list, board by board, with where each fact comes from). There the names of the buildings on the main axis hang
// upright between the eaves on banded boards (huadai pai): a dark panel with raised gilt characters inside a broad
// carved band that flares at the head and ends in a scalloped skirt. Under the lower eaves hang long boards read from
// the right: the great ones gilt all over with black characters, a lead-in seal at the upper right and the writer's
// seals at the left; the lesser ones gold on black, on dark blue, or on plain red-brown wood.
import * as THREE from "three";
import { asset } from "./assets.js";
import { mesh } from "./geo.js";

// A heavy brush regular hand for what is written large (Yuji Boku), with the kai behind it.
const FONT = '"Yunjing Bang", "Yunjing Kai", "STKaiti", "KaiTi", "Kaiti SC", "Songti SC", serif', SEAL = '"Yunjing Seal", "Yunjing Serif", "Songti SC", serif';
// A board is written in the old forms, whatever the page calls the place.
const OLD = { 双: "雙", 径: "徑", 归: "歸", 万: "萬", 续: "續", 云: "雲", 禅: "禪", 钟: "鐘", 楼: "樓", 宝: "寶", 经: "經", 阁: "閣", 观: "觀", 药: "藥", 师: "師", 龙: "龍", 砚: "硯", 吃: "喫", 释: "釋" };
// Hands cut from the originals (tools/boards.py): one picture each, the characters one under another, white where the
// brush went. `shijia` is 釋迦寶殿 as Wuzhun Shifan, abbot of Jingshan, wrote it in the 1240s (Tokyo National Museum
// TB-1446, published for free reuse through ColBase); the real hall's board is carved from the same sheet.
const HANDS = { shijia: "levels/t00/boards/shijia.webp" };
const GROUND = {
  gold: { top: "#a3853f", foot: "#86692f", ink: "#15100b", rim: "#33200f", fillet: "#5a3a1e" },
  ink:  { top: "#191613", foot: "#221d19", ink: "#b3964f", rim: "#7c6836", fillet: "#6f5a2a" },
  navy: { top: "#131a27", foot: "#18202e", ink: "#b3964f", rim: "#7c6836", fillet: "#6f5a2a" },
  wood: { top: "#3d2016", foot: "#472619", ink: "#b89a52", rim: "#2a150d", fillet: "#6a4a26" },
  stone: { top: "#8a8880", foot: "#7a7871", ink: "#1d1a17", rim: "#5f5d57", fillet: "#6c6a63" },   // a stele of grey stone, the characters cut and inked
};
let plankMat = null;   // a board made with no material to hand (a test) shares this one
const PLANK = () => (plankMat ||= new THREE.MeshStandardMaterial({ color: 0x2a150d, roughness: 0.85 }));
const doc = typeof document !== "undefined" ? document : null;

// `vertical`: characters stacked top to bottom. `style`: gold | ink | navy | wood | stone (what the ground is). `gold` is the
// old way of asking for a gilt ground. `band`: an upright board inside the flaring carved band (the default for an
// upright board of four characters). `cols`: columns on a banded board, read from the right. `hand`: characters
// taken from a picture of the original instead of a typeface. `notes`: two small columns either side of the name
// [right, left], as the date and the writer are given on the real board. `seals`: a lead-in seal and the writer's.
// `bare`: no board at all, only gilt characters, as they are set into the brick of the screen wall. `back`: the material of
// the plank behind a plain board (its back and four edges), one the scene already has so that the plank joins that material's
// batch; only the front of a board is lettered.
export function makePlaque(text, { vertical = false, gold = false, style = gold ? "gold" : "ink", hand = null, band = vertical && [...text].length === 4, cols = hand ? 1 : 2, notes = null, seals = style === "gold", bare = false, back = null } = {}) {
  const chars = [...text].map((ch) => OLD[ch] || ch), n = chars.length, G = GROUND[style] || GROUND.ink;
  const cell = band ? 320 : 448, pad = 168, long = cell * n + pad * 2, short = 616;   // large enough to read the brush at arm's length
  const rows = band ? Math.ceil(n / cols) : 1, pw = band ? Math.round(cols * cell * (notes ? 1.9 : 1.04) + 70) : 0, ph = band ? Math.round(rows * cell * 1.06 + 80) : 0;
  const W = band ? Math.round(pw / 0.64) : vertical ? short : long, H = band ? Math.round(ph / 0.75) : vertical ? long : short;
  const px = band ? Math.round((W - pw) / 2) : 0, py = band ? Math.round(H * 0.105) : 0;
  const c = doc.createElement("canvas"); c.width = W; c.height = H;
  const x = c.getContext("2d"), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  let s = n * 7919 + 13; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  let glyphs = null;   // the picture of the hand, once it has come
  const where = (i) => band ? [px + pw / 2 + (cols > 1 ? ((cols - 1) / 2 - Math.floor(i / rows)) * cell * 1.04 : 0), py + 40 + cell * 1.06 * ((i % rows) + 0.5)]
    : vertical ? [W / 2, pad + cell * (i + 0.5) + 6] : [W - pad - cell * (i + 0.5), H / 2 + 6];
  // One character, cut in relief when it is gilt: a dark edge below and to the right, a bright one above.
  function write(ch, i, cx, cy, size, colour) {
    const raised = style !== "gold" || bare;
    if (glyphs && i >= 0) {
      const t = doc.createElement("canvas"); t.width = t.height = glyphs.width; const g = t.getContext("2d");
      const stamp = (col, dx, dy) => { g.globalCompositeOperation = "copy"; g.drawImage(glyphs, 0, glyphs.width * i, glyphs.width, glyphs.width, 0, 0, t.width, t.height); g.globalCompositeOperation = "source-in"; g.fillStyle = col; g.fillRect(0, 0, t.width, t.height); x.drawImage(t, cx - size / 2 + dx, cy - size / 2 + dy, size, size); };
      if (raised) { stamp("rgba(0,0,0,.7)", 5, 6); stamp("#e2cc8a", -2, -3); } stamp(colour, 0, 0); return;
    }
    x.font = `${Math.round(size * 0.86)}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle"; x.lineJoin = "round"; x.lineWidth = Math.max(1.5, size * 0.008);
    if (raised) { x.fillStyle = "rgba(0,0,0,.7)"; x.fillText(ch, cx + size * 0.012, cy + size * 0.015); x.fillStyle = "#e2cc8a"; x.fillText(ch, cx - size * 0.005, cy - size * 0.007); }
    x.fillStyle = x.strokeStyle = colour; x.strokeText(ch, cx, cy); x.fillText(ch, cx, cy);
  }
  // A seal: red with the characters left pale, or pale with the characters red.
  function seal(cx, cy, size, word, red = true) {
    x.save(); x.translate(cx, cy); x.rotate((rnd() - 0.5) * 0.05); x.fillStyle = red ? "#8f2318" : "rgba(226,208,160,.9)"; x.fillRect(-size / 2, -size / 2, size, size);
    if (!red) { x.strokeStyle = "#8f2318"; x.lineWidth = size * 0.07; x.strokeRect(-size / 2 + x.lineWidth / 2, -size / 2 + x.lineWidth / 2, size - x.lineWidth, size - x.lineWidth); }
    x.fillStyle = red ? "#e9dcb8" : "#8f2318"; x.font = `${Math.round(size * 0.44)}px ${SEAL}`; x.textAlign = "center"; x.textBaseline = "middle";
    [...word].slice(0, 4).forEach((ch, k) => x.fillText(ch, (k < 2 ? 1 : -1) * size * 0.22, ((k % 2) - 0.5) * size * 0.46 + size * 0.02));
    x.restore();
  }
  function draw() {
    x.clearRect(0, 0, W, H); s = n * 7919 + 13;
    if (band) {
      // The band: wide and winged at the head, drawn in a little at the waist, a scalloped skirt at the foot. Dark
      // red-brown, carved all over with scrolling cloud, its rim gilt.
      const outline = () => {
        x.beginPath(); x.moveTo(W * 0.015, H * 0.062); x.quadraticCurveTo(W * 0.02, H * 0.012, W * 0.13, H * 0.012); x.quadraticCurveTo(W * 0.5, H * -0.004, W * 0.87, H * 0.012);
        x.quadraticCurveTo(W * 0.98, H * 0.012, W * 0.985, H * 0.062); x.quadraticCurveTo(W * 0.98, H * 0.1, W * 0.915, H * 0.115); x.bezierCurveTo(W * 0.955, H * 0.36, W * 0.935, H * 0.66, W * 0.925, H * 0.865);
        x.quadraticCurveTo(W * 0.985, H * 0.885, W * 0.975, H * 0.925);
        const k = 5; for (let i = 0; i < k; i++) { const a = W * (0.975 - (0.95 * i) / k), b = W * (0.975 - (0.95 * (i + 1)) / k), dip = H * (0.965 + 0.03 * Math.sin(((i + 0.5) / k) * Math.PI)); x.quadraticCurveTo((a + b) / 2, dip + H * 0.022, b, dip - H * 0.012 * (i === k - 1 ? 2.4 : 0)); }
        x.quadraticCurveTo(W * 0.015, H * 0.885, W * 0.075, H * 0.865); x.bezierCurveTo(W * 0.065, H * 0.66, W * 0.045, H * 0.36, W * 0.085, H * 0.115); x.quadraticCurveTo(W * 0.02, H * 0.1, W * 0.015, H * 0.062); x.closePath();
      };
      outline(); const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, "#3a1a13"); g.addColorStop(1, "#2c130e"); x.fillStyle = g; x.fill();
      x.save(); outline(); x.clip();
      for (let i = 0; i < 520; i++) { const cx = rnd() * W, cy = rnd() * H, r = 7 + rnd() * 16, a = rnd() * 6.3; x.strokeStyle = rnd() < 0.5 ? "rgba(96,52,34,.55)" : "rgba(14,6,4,.6)"; x.lineWidth = 2.5 + rnd() * 3; x.beginPath(); x.arc(cx, cy, r, a, a + 2.2 + rnd() * 2.4); x.stroke(); }
      x.restore();
      outline(); x.strokeStyle = "#b08f47"; x.lineWidth = Math.max(6, W * 0.012); x.lineJoin = "round"; x.stroke();
      const p = x.createLinearGradient(0, py, 0, py + ph); p.addColorStop(0, G.top); p.addColorStop(1, G.foot); x.fillStyle = p; x.fillRect(px, py, pw, ph);
      x.strokeStyle = "#b08f47"; x.lineWidth = 9; x.strokeRect(px + 4, py + 4, pw - 8, ph - 8);
    } else if (!bare) {
      const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, G.top); g.addColorStop(1, G.foot); x.fillStyle = g; x.fillRect(0, 0, W, H);
      if (style === "gold") for (let i = 0; i < 2600; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "70,50,20" : "220,190,110"},${0.05 + rnd() * 0.1})`; x.fillRect(rnd() * W, rnd() * H, 2, 2); }   // the stippled gilding
      x.strokeStyle = G.rim; x.lineWidth = 34; x.strokeRect(17, 17, W - 34, H - 34);
      if (style === "gold" || style === "ink") { x.strokeStyle = "rgba(176,143,71,.5)"; x.lineWidth = 3; for (let i = 0; i < 90; i++) { const along = rnd() * 2 * (W + H), q = along < W ? [along, 17] : along < 2 * W ? [along - W, H - 17] : along < 2 * W + H ? [17, along - 2 * W] : [W - 17, along - 2 * W - H]; x.beginPath(); x.arc(q[0], q[1], 6 + rnd() * 7, rnd() * 6, rnd() * 6 + 3); x.stroke(); } }   // scrollwork along the frame
      x.strokeStyle = G.fillet; x.lineWidth = 5; x.strokeRect(40, 40, W - 80, H - 80);
    }
    const size = band ? cell * 0.98 : cell * 0.96;
    chars.forEach((ch, i) => { const [cx, cy] = where(i); write(ch, i, cx, cy, size, bare ? "#b89a52" : G.ink); });
    if (notes && band) {   // the small columns: the day it was written to the right, who wrote it to the left
      notes.forEach((line, k) => { const cs = [...line], fs = Math.min(cell * 0.2, (ph * 0.5) / cs.length), cx = px + pw / 2 + (k ? -1 : 1) * pw * 0.36, y0 = py + ph * (k ? 0.44 : 0.12);
        cs.forEach((ch, j) => write(ch, -1, cx, y0 + fs * 1.05 * (j + 0.5), fs, G.ink)); if (k) seal(cx, y0 + fs * 1.05 * cs.length + fs * 0.9, fs * 1.2, "佛鑑", true); });
    }
    if (seals && !band && !bare && !vertical) { seal(W - pad * 0.56, H * 0.3, 62, "正法", false); seal(pad * 0.56, H * 0.56, 58, "雲徑", true); seal(pad * 0.56, H * 0.56 + 74, 58, "禪寺", false); }
    // Wear: the gilding thins and the lacquer dulls in patches; the grain of the plank shows through.
    if (!bare) {
      x.save(); if (band) { x.beginPath(); x.rect(px, py, pw, ph); x.clip(); }
      for (let i = 0; i < 900; i++) { x.fillStyle = style === "gold" ? `rgba(60,40,18,${0.03 + rnd() * 0.12})` : `rgba(12,14,18,${0.04 + rnd() * 0.18})`; x.beginPath(); x.ellipse(rnd() * W, rnd() * H, 1 + rnd() * 14, 0.6 + rnd() * 4, rnd() * 3, 0, 7); x.fill(); }
      for (let y = 0; y < H; y += 3) { x.fillStyle = `rgba(${style === "gold" ? "40,26,10" : "160,150,130"},${0.012 + rnd() * 0.03})`; x.fillRect(0, y + Math.sin(y * 0.05) * 2, W, 1); }
      x.restore();
    }
    tex.needsUpdate = true;
  }
  draw();
  // The brush face and the picture of the hand arrive over the network; redraw as each comes.
  if (doc.fonts && doc.fonts.load) Promise.all([doc.fonts.load(`200px "Yunjing Bang"`, chars.join("") + (notes || []).join("")), doc.fonts.load(`40px "Yunjing Seal"`, "佛鑑正法雲徑禪寺")]).then(draw, () => {});
  if (hand && HANDS[hand] && typeof Image !== "undefined") { const im = new Image(); im.onload = () => { glyphs = im; draw(); }; im.src = asset(HANDS[hand]); }

  const cut = band || bare, mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6, metalness: style === "gold" ? 0.25 : 0.08, envMapIntensity: 0.3, alphaTest: cut ? 0.5 : 0, transparent: false });
  // Where each character lies on the face, as fractions of its width (u, from the left) and height (v, from the top), and half its
  // size: for the tests, which look at every character from everywhere it may be seen (plaques.test.mjs).
  const boxes = chars.map((_, i) => { const [cx, cy] = where(i); return { u: cx / W, v: cy / H, du: (cell * 0.36) / W, dv: (cell * 0.36) / H }; });
  if (!cut) {
    const a = n * 0.6 + 0.45, b = (a * short) / long, w = vertical ? b : a, h = vertical ? a : b;
    // The lettered face is a sheet on the front of a plank of the scene's own timber, so that the back and the four edges are
    // plain wood and never a mirrored or squashed copy of the writing (#245). The sheet is the board's mesh; the plank hangs from it.
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, 0, 0.035), mat); m.userData.height = h; m.userData.plaque = { text, w, h, z: 0.035, chars: boxes };
    const plank = mesh(new THREE.BoxGeometry(w, h, 0.068), back || PLANK()); plank.name = "plank"; m.add(plank); return m;
  }
  // A board with a shaped edge: the painted face, and behind it a dark plank the size of the panel for its thickness.
  const h = bare ? 0.9 : rows >= 4 ? 2.9 : rows === 3 ? 2.35 : 2.3, w = (h * W) / H, g = new THREE.Group();
  const face = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); face.position.z = bare ? 0 : 0.04; face.castShadow = !bare; g.add(face);
  if (band) { const back = new THREE.Mesh(new THREE.BoxGeometry(w * 0.8, h * 0.84, 0.07), new THREE.MeshStandardMaterial({ color: 0x1c0f0b, roughness: 0.8 })); back.castShadow = true; g.add(back); }
  g.userData.height = h; g.userData.plaque = { text, w, h, z: 0.04, chars: boxes }; return g;
}

// The face of the screen wall, as it is at the real temple: no hanging board, but a panel of grey bricks laid on the
// diamond inside a frame of pale dressed stone, and the four characters set into it large and gilt, read from the right.
export function makeWallPanel(text, w, h, back = null) {
  const chars = [...text].map((ch) => OLD[ch] || ch), n = chars.length, W = 2048, H = Math.round((W * h) / w);
  const c = doc.createElement("canvas"); c.width = W; c.height = H; const x = c.getContext("2d"), tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  function draw() {
    let s = 4241; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const f = Math.round(H * 0.085), b = Math.round(H * 0.045);   // the stone frame, and the plain grey band inside it
    x.fillStyle = "#c9c7bf"; x.fillRect(0, 0, W, H);
    for (let i = 0; i < 1400; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "90,90,84" : "240,240,232"},${0.03 + rnd() * 0.06})`; x.fillRect(rnd() * W, rnd() * H, 2 + rnd() * 9, 1 + rnd() * 2); }
    x.strokeStyle = "rgba(70,70,64,.5)"; x.lineWidth = 3; x.strokeRect(f * 0.42, f * 0.42, W - f * 0.84, H - f * 0.84);   // a moulding cut round the frame
    x.fillStyle = "#74777a"; x.fillRect(f, f, W - 2 * f, H - 2 * f);
    const px = f + b, py = f + b, pw = W - 2 * (f + b), ph = H - 2 * (f + b);
    x.save(); x.beginPath(); x.rect(px, py, pw, ph); x.clip();
    x.fillStyle = "#63676a"; x.fillRect(px, py, pw, ph);
    const d = ph / 3.5;   // the half-diagonal of one brick
    for (let j = -1; j * d < ph + d; j++) for (let i = -1; i * d < pw + d; i++) {
      if ((i + j) & 1) continue; const cx = px + i * d, cy = py + j * d, v = 92 + Math.floor(rnd() * 26);
      x.fillStyle = `rgb(${v},${v + 4},${v + 7})`; x.beginPath(); x.moveTo(cx, cy - d); x.lineTo(cx + d, cy); x.lineTo(cx, cy + d); x.lineTo(cx - d, cy); x.closePath(); x.fill();
      x.strokeStyle = "rgba(38,40,42,.75)"; x.lineWidth = 5; x.stroke(); x.strokeStyle = "rgba(190,194,196,.16)"; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - d + 6, cy); x.lineTo(cx, cy - d + 6); x.stroke();
    }
    for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd() < 0.6 ? "30,34,36" : "170,176,170"},${0.04 + rnd() * 0.1})`; x.beginPath(); x.ellipse(px + rnd() * pw, py + rnd() * ph, 2 + rnd() * 22, 1 + rnd() * 7, rnd() * 3, 0, 7); x.fill(); }   // weather on the brick
    x.restore();
    x.strokeStyle = "rgba(40,42,44,.8)"; x.lineWidth = 4; x.strokeRect(px, py, pw, ph);
    // The characters: gilt, standing a finger proud of the brick.
    const size = ph * 0.6, gap = pw / (n + 0.6); x.font = `${Math.round(size)}px ${FONT}`; x.textAlign = "center"; x.textBaseline = "middle";
    chars.forEach((ch, i) => { const cx = px + pw - gap * (i + 0.8), cy = py + ph / 2 + size * 0.02;
      x.fillStyle = "rgba(0,0,0,.55)"; x.fillText(ch, cx + size * 0.018, cy + size * 0.024); x.fillStyle = "#ecd89a"; x.fillText(ch, cx - size * 0.006, cy - size * 0.008); x.fillStyle = "#c2a14e"; x.fillText(ch, cx, cy); });
    tex.needsUpdate = true;
  }
  draw();
  if (doc.fonts && doc.fonts.load) doc.fonts.load(`200px "Yunjing Bang"`, chars.join("")).then(draw, () => {});
  // The picture is a sheet on the face of a slab of the wall's own stone, so that its back and its four edges are plain
  // stone and never a mirrored or squashed copy of the brick and the characters (#272, as the plain boards since #245).
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h).translate(0, 0, 0.04), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.82, metalness: 0.06, envMapIntensity: 0.25 }));
  m.castShadow = false; m.userData.height = h;
  // (It casts, as the wall does, so that it joins the wall's stone in one draw.)
  const slab = mesh(new THREE.BoxGeometry(w, h, 0.078), back || PLANK()); slab.name = "panel slab"; m.add(slab); return m;
}
