// Inside the halls. Every hall with a door can be entered: each has a real room, walked in the same way as the
// courts, furnished for what the hall is (an altar and its figures, meditation platforms, tea tables, shelves of
// sutras), and along its side walls a row of hanging frames that are empty for now. Each frame is a place where
// something will be shown and told later; what hangs in it is data (GALLERY below, by the frame's id).
//
// The rooms are built far below the courts, side by side (the paving above hides them), and the walker is moved
// into one at its hall's door.
import * as THREE from "../vendor/three/build/three.module.js";
import { paintLeaf } from "./leaves.js";
import { WORKS, HANG } from "./works.js";
import { GLTFLoader } from "../vendor/three/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "../vendor/three/jsm/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "../vendor/three/jsm/libs/meshopt_decoder.module.js";
import { box, merge, mesh, footAt } from "./geo.js";

const FLOOR = -60;
// What each kind of hall is like inside: width, depth, height, and how it is furnished.
export const KINDS = {
  buddha:    { w: 26.4, d: 16.8, h: 7.6, cols: [-9, -4.5, 4.5, 9] },
  figure:    { w: 15, d: 11, h: 5.6, cols: [-4.5, 4.5] },
  chan:      { w: 17, d: 9, h: 4.8, cols: [] },
  tea:       { w: 17, d: 9, h: 4.8, cols: [] },
  library:   { w: 19, d: 11, h: 6.2, cols: [-5, 5] },
  patriarch: { w: 12, d: 9, h: 4.8, cols: [] },
  pavilion:  { w: 15, d: 15, h: 5.2, cols: [-4.5, 4.5] },
};
// What hangs in a frame, by its id ("main-w1" is the first frame on the great hall's west wall). `title` and `text`
// are shown when a visitor stands before it; `image` (a URL) replaces the blank paper. The story will be written here.
// Beside the leaves hang real works (works.js, written by tools/gallery.py): things that survive from the temple this
// place is drawn from, each shown with its encyclopedia note and the museum's source line.
// The first leaf in each hall: eight short notes a visitor reads on the way up, written for this imagined temple out
// of what is told of such mountain monasteries (docs/JINGSHAN.md). They stand in for the artworks the story will
// hang here later; each has a small ink painting drawn for it (`paint`, see leaves.js); give a frame an `image` and it shows that instead.
export const GALLERY = {
  "main-w1": { paint: "gate", title: "入山帖", text: "山门之外是路，山门之内也是路。上来的人各有来处，到了殿前，都只是站一站。" },
  "chan-w1": { paint: "sit", title: "坐帖", text: "禅堂里没有要学的东西。一炷香的工夫，听得见自己呼吸，就算坐过了。" },
  "tea-w1": { paint: "tea", title: "茶帖", text: "相传山里的茶宴有十几道规矩，后来渡海东去。小沙弥只记得一条：茶来了，就喝茶。" },
  "library-w1": { paint: "scroll", title: "经帖", text: "楼上的经卷多数没人翻过。老师父说，请一句带下山，够用很久。" },
  "yaoshi-w1": { paint: "gourd", title: "药帖", text: "山下的人上来求药，师父先让他们在廊下坐一会儿。坐过之后，要的常常不是药了。" },
  "guanyin-w1": { paint: "lamp", title: "灯帖", text: "灯是别人点的，也是给别人点的。添一盏的人，往往不知道它照见了谁。" },
  "dahui-w1": { paint: "well", title: "井帖", text: "相传开山那年，龙让出了整座山，只留下这口井。水在暗处，俯身才看得见。" },
  "lingxiao-w1": { paint: "roofs", title: "顶帖", text: "登到顶上回头看，一层一层的屋顶都在脚下。来时的路，原来这么短。" },
};
const BLANK = { title: "空着的画框", text: "这里以后会挂上一件东西，讲这座寺的一段事。" };

// A real work, mounted as a scroll is: the picture on a sheet of pale paper, a hair-line round it, and under it the
// name and the maker in the kai hand. The picture is fetched only when the hall it hangs in is first entered.
const KAI = '"Yunjing Kai", "STKaiti", "KaiTi", serif';
function mount(slug) {
  const w = WORKS[slug], c = document.createElement("canvas"); c.width = 768; c.height = 1126; const x = c.getContext("2d");
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const sheet = () => {
    const g = x.createLinearGradient(0, 0, 768, 1126); g.addColorStop(0, "#e6dfce"); g.addColorStop(1, "#d6cdb8"); x.fillStyle = g; x.fillRect(0, 0, 768, 1126);
    let s = 11; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 1500; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "110,95,70" : "255,255,250"},${0.03 + rnd() * 0.05})`; x.fillRect(rnd() * 768, rnd() * 1126, 1 + rnd() * 6, 1); }
    return rnd;
  };
  sheet();   // bare paper until the picture has come
  const im = new Image();
  im.onload = () => {
    sheet();
    const bw = 668, bh = 876, k = Math.min(bw / im.width, bh / im.height), iw = im.width * k, ih = im.height * k, ix = (768 - iw) / 2, iy = 56 + (bh - ih) / 2;
    x.shadowColor = "rgba(40,30,20,.3)"; x.shadowBlur = 14; x.shadowOffsetY = 5; x.drawImage(im, ix, iy, iw, ih); x.shadowColor = "transparent";
    x.strokeStyle = "rgba(40,32,24,.55)"; x.lineWidth = 2; x.strokeRect(ix - 1, iy - 1, iw + 2, ih + 2);
    x.fillStyle = "rgba(28,24,20,.92)"; x.textAlign = "center"; x.textBaseline = "middle";
    let fs = 40; x.font = `${fs}px ${KAI}`; while (fs > 24 && x.measureText(w.title).width > 690) x.font = `${--fs}px ${KAI}`;
    x.fillText(w.title, 384, 996); x.fillStyle = "rgba(70,62,52,.9)"; x.font = `26px ${KAI}`; x.fillText(`${w.by}　${w.period}`.slice(0, 26), 384, 1050);
    x.strokeStyle = "rgba(60,50,40,.3)"; x.lineWidth = 3; x.strokeRect(22, 22, 724, 1082);
    tex.needsUpdate = true;
  };
  im.src = new URL(`../levels/t00/gallery/${slug}.webp`, import.meta.url).href;
  return tex;
}

const lathe = (pts, seg) => new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), seg);
let sheetTex = null;
function paper() {   // a hanging scroll's blank sheet
  if (sheetTex) return sheetTex;
  const c = document.createElement("canvas"); c.width = 512; c.height = 768; const x = c.getContext("2d");
  const g = x.createLinearGradient(0, 0, 512, 768); g.addColorStop(0, "#e9e2d2"); g.addColorStop(1, "#d9d0bc"); x.fillStyle = g; x.fillRect(0, 0, 512, 768);
  let s = 5; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(${rnd() < 0.5 ? "110,95,70" : "255,255,250"},${0.03 + rnd() * 0.06})`; x.fillRect(rnd() * 512, rnd() * 768, 1 + rnd() * 5, 1); }
  x.strokeStyle = "rgba(60,50,40,.35)"; x.lineWidth = 3; x.strokeRect(26, 26, 460, 716);
  sheetTex = new THREE.CanvasTexture(c); sheetTex.colorSpace = THREE.SRGBColorSpace; sheetTex.anisotropy = 4; return sheetTex;
}

// One room. `hall`: { id, kind } from the plan; `ox`: where along the row of rooms it stands.
function buildRoom(M, hall, ox, figures) {
  const K = KINDS[hall.kind] || KINDS.patriarch, Y = FLOOR, g = new THREE.Group(), solids = [], dim = () => 0.42, deep = () => 0.26;
  const R = { id: hall.id, y: Y, x0: ox - K.w / 2, x1: ox + K.w / 2, z0: -K.d / 2, z1: K.d / 2, h: K.h, door: [ox, K.d / 2 - 1.6], exitZ: K.d / 2 - 0.7, cx: ox };
  const add = (geo, mat, ao = dim) => { const m = mesh(geo.translate(ox, 0, 0), mat, { ao }); g.add(m); return m; };
  const block = (x0, x1, z0, z1) => solids.push({ x0: ox + x0, x1: ox + x1, z0, z1 });
  const W = K.w + 0.6, D = K.d + 0.6, wx = K.w / 2 + 0.3, zs = K.d / 2 + 0.3, zn = -K.d / 2 - 0.3, flames = [];
  const flame = (x, y, z, r = 0.03) => { const f = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8).scale(1, 2, 1), M.flame); f.position.set(ox + x, Y + y, z); g.add(f); flames.push(f); };
  // Floor, walls with the door in the south one, and a dark timber ceiling crossed by beams.
  add(box(W, 0.4, D, 0, Y - 0.2, 0), M.stone, () => 0.6);
  add(footAt(merge([box(W, K.h, 0.3, 0, Y + K.h / 2, zn - 0.15), box(0.3, K.h, D, -wx - 0.15, Y + K.h / 2, 0), box(0.3, K.h, D, wx + 0.15, Y + K.h / 2, 0),
    box(W / 2 - 1.5, K.h, 0.3, -(W / 4 + 0.75), Y + K.h / 2, zs + 0.15), box(W / 2 - 1.5, K.h, 0.3, W / 4 + 0.75, Y + K.h / 2, zs + 0.15), box(3, K.h - 3.3, 0.3, 0, Y + 3.3 + (K.h - 3.3) / 2, zs + 0.15)]), Y - 30), M.plaster());
  const beams = [box(W, 0.5, D, 0, Y + K.h + 0.25, 0)]; for (let z = -K.d / 2 + 2; z < K.d / 2; z += 3) beams.push(box(W, 0.4, 0.28, 0, Y + K.h - 0.5, z));
  add(merge(beams), M.woodX, deep);
  const trim = []; for (const sx of [-1, 1]) trim.push(box(0.1, 1.0, D, sx * (wx - 0.05), Y + 0.5, 0), box(0.12, 0.2, D, sx * (wx - 0.06), Y + Math.min(5.2, K.h - 0.9), 0));
  trim.push(box(W, 1.0, 0.1, 0, Y + 0.5, zn + 0.05), box(W, 0.2, 0.12, 0, Y + Math.min(5.2, K.h - 0.9), zn + 0.06)); add(merge(trim), M.woodX);
  if (K.cols.length) {
    const cols = [], bases = [];
    for (const x of K.cols) for (const z of [K.d * 0.18, -K.d * 0.18]) { cols.push(new THREE.CylinderGeometry(0.25, 0.29, K.h - 0.5, 20).translate(x, Y + (K.h - 0.5) / 2 + 0.1, z)); bases.push(lathe([[0, 0], [0.48, 0], [0.5, 0.05], [0.4, 0.14], [0.34, 0.22], [0, 0.22]], 20).translate(x, Y, z)); block(x - 0.48, x + 0.48, z - 0.48, z + 0.48); }
    add(merge(cols), M.woodV); add(merge(bases), M.monolith);
  }
  const cushion = () => lathe([[0, 0], [0.26, 0], [0.3, 0.03], [0.3, 0.07], [0.26, 0.1], [0, 0.11]], 24);
  const table = (w, d, T, x, z) => merge([box(w, 0.07, d, x, Y + T, z), box(w - 0.1, 0.1, 0.05, x, Y + T - 0.1, z + d / 2 - 0.05), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => box(0.07, T, 0.07, x + a * (w / 2 - 0.08), Y + T / 2, z + c * (d / 2 - 0.07)))]);
  const lampStand = (x, z) => { add(lathe([[0, 0], [0.24, 0], [0.26, 0.04], [0.08, 0.12], [0.035, 0.2], [0.03, 1.3], [0.1, 1.36], [0.17, 1.44], [0.16, 1.47], [0, 1.45]], 20).translate(x, Y, z), M.bronze, () => 0.8); flame(x, 1.54, z); block(x - 0.35, x + 0.35, z - 0.35, z + 0.35); };
  const places = {}, altar = new THREE.Group(); altar.position.set(ox, Y, 0); g.add(altar);
  const tz = -K.d / 2 + 5.4, lightAt = [];

  if (hall.kind === "buddha" || hall.kind === "figure") {
    // An altar: a stone dais, an offering table with a censer between candlesticks, cushions, tall lamps.
    const big = hall.kind === "buddha", ax = big ? 5.6 : 2.6, az0 = -K.d / 2 + 0.9, az1 = az0 + (big ? 3.4 : 2.6), ah = big ? 1.0 : 0.8;
    add(merge([box(ax * 2, ah - 0.16, az1 - az0, 0, Y + (ah - 0.16) / 2, (az0 + az1) / 2), box(ax * 2 + 0.24, 0.16, az1 - az0 + 0.24, 0, Y + ah - 0.08, (az0 + az1) / 2), box(ax * 2 + 0.2, 0.14, az1 - az0 + 0.2, 0, Y + 0.07, (az0 + az1) / 2)]), M.monolith);
    block(-ax - 0.4, ax + 0.4, az0 - 0.5, az1 + 0.4);
    add(table(big ? 2.6 : 1.8, 0.7, 0.86, 0, tz), M.woodX); block(-(big ? 1.6 : 1.2), big ? 1.6 : 1.2, tz - 0.6, tz + 0.6);
    add(merge([lathe([[0, 0.02], [0.1, 0.02], [0.17, 0.08], [0.2, 0.17], [0.18, 0.22], [0.14, 0.22], [0.13, 0.18], [0, 0.16]], 24).translate(0, Y + 0.895, tz), ...[-1, 1].map((sx) => lathe([[0, 0], [0.08, 0], [0.03, 0.04], [0.025, 0.26], [0.07, 0.3], [0.07, 0.32], [0, 0.32]], 16).translate(sx * 0.6, Y + 0.895, tz))]), M.bronze, () => 0.8);
    for (const sx of [-1, 1]) flame(sx * 0.6, 1.26, tz, 0.016);
    add(merge([-1.1, 0, 1.1].map((x) => cushion().translate(x, Y, tz + 1.75))), M.straw, () => 0.7);
    for (const sx of [-1, 1]) lampStand(sx * (big ? 3.3 : 2.2), tz + 0.2);
    altar.position.set(ox, Y + ah, (az0 + az1) / 2);
    figures.then((f) => { if (!f) return; if (big) for (const sx of [-1, 1]) { const s = f.iron(1.5); s.position.set(sx * 3.4, 0, 1.0); altar.add(s); } const p = f.pedestal(big ? 0.62 : 0.46), b = f.gold(big ? 3.5 : 2.5); b.position.y = big ? 0.62 : 0.46; altar.add(p, b); });
    if (big) places.incense = { at: [ox, tz + 1.75], r: 1.5, face: Math.PI, inside: true, y: Y + 0.03, room: hall.id };
    lightAt.push([-(big ? 3.3 : 2.2), 1.9, tz + 0.2, 0xffa050, 9, 14], [big ? 3.3 : 2.2, 1.9, tz + 0.2, 0xffa050, 9, 14], [0, K.h - 2.4, tz + 0.8, 0xffe6c4, big ? 11 : 7, 16]);
  } else if (hall.kind === "chan") {
    // The meditation hall: long sitting platforms down both sides, a cushion at every place, the aisle between.
    const plat = [], seats = [];
    for (const sx of [-1, 1]) { plat.push(box(K.w - 3, 0.42, 1.7, 0, Y + 0.21, sx * (K.d / 2 - 1.2) - (sx > 0 ? 2.2 : 0))); for (let x = -K.w / 2 + 2.4; x < K.w / 2 - 2; x += 1.25) seats.push(cushion().translate(x, Y + 0.42, sx * (K.d / 2 - 1.2) - (sx > 0 ? 2.2 : 0))); }
    add(merge(plat), M.woodX); add(merge(seats), M.straw, () => 0.7);
    block(-K.w / 2 + 1.5, K.w / 2 - 1.5, -K.d / 2, -K.d / 2 + 2.2); block(-K.w / 2 + 1.5, -1.6, K.d / 2 - 4.4, K.d / 2 - 2.4); block(1.6, K.w / 2 - 1.5, K.d / 2 - 4.4, K.d / 2 - 2.4);
    lampStand(0, -K.d / 2 + 3.2); lightAt.push([0, 2.0, -K.d / 2 + 3.2, 0xffa050, 9, 14], [0, K.h - 1.4, 0.5, 0xffe6c4, 6, 14]);
  } else if (hall.kind === "tea") {
    // The tea house: tables with stools, each set with a ewer and bowls.
    const wood = [], glaze = [], iron = [];
    for (const [x, z] of [[-5, -1.4], [0, -2.2], [5, -1.4]]) {
      wood.push(table(1.3, 0.8, 0.78, x, z)); block(x - 0.75, x + 0.75, z - 0.5, z + 0.5);
      for (const [a, c] of [[0, 0.95], [0, -0.95], [1.05, 0]]) wood.push(lathe([[0, 0], [0.17, 0], [0.2, 0.06], [0.215, 0.22], [0.2, 0.38], [0.17, 0.44], [0, 0.44]], 18).translate(x + a, Y, z + c));
      for (const a of [-0.2, 0.25]) glaze.push(lathe([[0, 0.012], [0.03, 0], [0.036, 0.012], [0.07, 0.048], [0.078, 0.06], [0.072, 0.06], [0.028, 0.02], [0, 0.02]], 20).translate(x + a, Y + 0.815, z + 0.1));
      iron.push(lathe([[0, 0], [0.07, 0], [0.1, 0.05], [0.105, 0.12], [0.07, 0.19], [0.035, 0.22], [0.03, 0.27], [0.045, 0.29], [0, 0.29]], 20).translate(x - 0.42, Y + 0.815, z - 0.15));
    }
    add(merge(wood), M.woodX); add(merge(glaze), M.glaze, () => 0.8); add(merge(iron), M.iron, () => 0.8);
    lampStand(-K.w / 2 + 1.4, -K.d / 2 + 1.4); lampStand(K.w / 2 - 1.4, -K.d / 2 + 1.4); lightAt.push([-K.w / 2 + 1.4, 1.9, -K.d / 2 + 1.4, 0xffa050, 8, 13], [K.w / 2 - 1.4, 1.9, -K.d / 2 + 1.4, 0xffa050, 8, 13], [0, K.h - 1.4, 0, 0xffe6c4, 6, 14]);
  } else if (hall.kind === "library") {
    // The library: tall cases of sutra boxes along the back wall and standing in rows, and a desk to read at.
    const cases = [], boxes = []; let s = 13; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const shelf = (x, z, w) => { cases.push(box(w, 3.6, 0.5, x, Y + 1.8, z)); block(x - w / 2 - 0.1, x + w / 2 + 0.1, z - 0.45, z + 0.45); for (let r = 0; r < 6; r++) for (let c = -w / 2 + 0.25; c < w / 2 - 0.1; c += 0.3) if (rnd() < 0.86) boxes.push(box(0.24, 0.2 + rnd() * 0.22, 0.34, x + c, Y + 0.34 + r * 0.56, z + 0.12)); };
    shelf(-5.5, -K.d / 2 + 0.6, 6); shelf(5.5, -K.d / 2 + 0.6, 6); for (const x of [-6, 6]) shelf(x, -1.2, 4.4);
    add(merge(cases), M.woodZ); add(merge(boxes), M.lacquer, () => 0.6);
    add(table(1.8, 0.8, 0.74, 0, -1.6), M.woodX); block(-1.1, 1.1, -2.2, -1.0); add(cushion().translate(0, Y, -0.6), M.straw, () => 0.7);
    lampStand(-1.6, -1.6); lightAt.push([-1.6, 1.9, -1.6, 0xffa050, 9, 14], [0, K.h - 1.6, 0, 0xffe6c4, 8, 16]);
  } else {
    // A plain hall: a table, cushions, a lamp. (The patriarchs' hall and the summit pavilion: their walls are the point.)
    add(table(1.8, 0.7, 0.8, 0, -K.d / 2 + 1.6), M.woodX); block(-1.1, 1.1, -K.d / 2 + 1, -K.d / 2 + 2.2);
    add(merge([-0.9, 0.9].map((x) => cushion().translate(x, Y, -K.d / 2 + 3.2))), M.straw, () => 0.7);
    lampStand(-1.8, -K.d / 2 + 1.6); lampStand(1.8, -K.d / 2 + 1.6); lightAt.push([-1.8, 1.9, -K.d / 2 + 1.6, 0xffa050, 8, 13], [1.8, 1.9, -K.d / 2 + 1.6, 0xffa050, 8, 13], [0, K.h - 1.4, 0, 0xffe6c4, 6, 14]);
  }
  // Through the doorway: the court outside, as it stood when he came in. The room is not where the hall is (it lies
  // under the hill), so the view cannot simply be left open. Instead a picture of all that surrounds the hall's own
  // door is taken as he steps over the threshold (`lookOut` in yard.js), and here it is laid on the inside of a great
  // box standing beyond the opening: its floor level with this one, its far wall ten metres off. Each point of the box
  // shows what lay in that direction from the real doorway, so the porch runs on from the sill and the picture shifts
  // as it should when he walks across the room. Until a picture arrives it is the pale grey of an overcast noon.
  const C = new THREE.Vector3(ox, Y + 1.5, zs + 0.9);
  const out = new THREE.Mesh(new THREE.BoxGeometry(44, 14, 10.5).translate(ox, Y + 7 - 0.02, zs + 0.28 + 5.25), new THREE.ShaderMaterial({
    side: THREE.BackSide, fog: false,
    uniforms: { tOut: { value: null }, uHas: { value: 0 }, uC: { value: C }, uTurn: { value: new THREE.Vector2(0, 1) }, uGain: { value: 1.12 } },
    vertexShader: "varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }",
    fragmentShader: "uniform samplerCube tOut; uniform float uHas, uGain; uniform vec3 uC; uniform vec2 uTurn; varying vec3 vW; void main(){ vec3 v = vW - uC; vec3 d = vec3(uTurn.y * v.x + uTurn.x * v.z, v.y, -uTurn.x * v.x + uTurn.y * v.z); vec3 c = mix(vec3(.62, .66, .68), textureCube(tOut, d).rgb * uGain, uHas); gl_FragColor = vec4(c, 1.); }",
  }));
  g.add(out);
  // The opening itself: jambs and a lintel of dark timber the thickness of the wall, a stone sill, and the two
  // leaves of the door folded back against the wall inside, so that the daylight has an edge to come round.
  add(merge([box(0.22, 3.3, 0.42, -1.5, Y + 1.65, zs + 0.15), box(0.22, 3.3, 0.42, 1.5, Y + 1.65, zs + 0.15), box(3.3, 0.24, 0.42, 0, Y + 3.3, zs + 0.15),
    box(1.3, 3.0, 0.07, -2.3, Y + 1.56, zs - 0.06), box(1.3, 3.0, 0.07, 2.3, Y + 1.56, zs - 0.06)]), M.woodX);
  add(box(3.0, 0.12, 0.5, 0, Y + 0.06, zs + 0.15), M.stone, () => 0.7);
  lightAt.push([0, 3.0, K.d / 2 - 1.6, 0xcfdcec, 14, 20]);
  // The frames along the side walls: a timber border round a sheet of paper, hung a little above a child's eye.
  const frames = [], spots = {}, hangs = [], fw = 1.5, fh = 2.2, n = Math.max(1, Math.floor((K.d - 2.4) / 3.1)), fy = Y + Math.min(2.35, K.h / 2);
  for (const west of [true, false]) for (let k = 0; k < n; k++) {
    // The first frame on the west wall keeps its leaf; the works go round from the first on the east: e1, w2, e2, w3 ...
    const order = west ? 2 * k - 1 : 2 * k, slug = order >= 0 ? (HANG[hall.id] || [])[order] : null, work = slug && WORKS[slug];
    const id = `${hall.id}-${west ? "w" : "e"}${k + 1}`, z = (n - 1) * 1.55 - k * 3.1 + 0.4, x = (west ? -1 : 1) * (wx - 0.08), it = work ? { work: slug, title: work.title, text: work.note } : GALLERY[id] || BLANK;
    frames.push(box(0.08, fh + 0.24, 0.1, x, fy, z - fw / 2 - 0.07), box(0.08, fh + 0.24, 0.1, x, fy, z + fw / 2 + 0.07), box(0.08, 0.1, fw + 0.24, x, fy + fh / 2 + 0.07, z), box(0.08, 0.1, fw + 0.24, x, fy - fh / 2 - 0.07, z));
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh).rotateY(west ? Math.PI / 2 : -Math.PI / 2).translate(ox + x + (west ? 0.03 : -0.03), fy, z), new THREE.MeshStandardMaterial({ map: it.paint ? paintLeaf(it) : paper(), roughness: 0.95, envMapIntensity: 0.1 }));
    if (it.image) new THREE.TextureLoader().load(it.image, (t) => { t.colorSpace = THREE.SRGBColorSpace; sheet.material.map = t; sheet.material.needsUpdate = true; });
    if (work) hangs.push(() => { sheet.material = sheet.material.clone(); sheet.material.map = mount(slug); });
    g.add(sheet); spots[id] = { at: [ox + x + (west ? 1.7 : -1.7), z], face: west ? -Math.PI / 2 : Math.PI / 2, r: 1.3, item: { id, ...it }, room: hall.id };
  }
  add(merge(frames), M.woodZ);
  const lights = lightAt.map(([x, y, z, c, i, d]) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(ox + x, Y + y, z); l.visible = false; g.add(l); return l; });
  // `hang()`: fetch and mount this hall's works, the first time someone comes in.
  return { group: g, room: { ...R, solids }, lights, flames, spots, places, outlook: out, hang() { hangs.splice(0).forEach((f) => f()); } };
}

// Every room, one for each hall the plan says can be entered. Returns them by the hall's id.
export function buildInteriors(M, halls, renderer) {
  const group = new THREE.Group(), rooms = {}, spots = {}, places = {}, state = { figures: "loading" };
  // The figures are fetched once and stood in every hall that has an altar.
  const figures = (async () => {
    if (typeof fetch === "undefined" || typeof document === "undefined") return null;
    try {
      // The statue and its pedestal are not kept in git: `pnpm install` fetches them as they are published (tools/setup.mjs),
      // packed with meshopt and with Basis textures, which are opened here by the decoders that come with three.js.
      const base = new URL("../levels/t00/models/", import.meta.url).href, loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      if (renderer) loader.setKTX2Loader(new KTX2Loader().setTranscoderPath(new URL("../vendor/three/jsm/libs/basis/", import.meta.url).href).detectSupport(renderer));
      const get = async (name) => (await loader.loadAsync(base + name)).scene;
      const [buddha, ped] = await Promise.all([get("buddha.glb"), get("pedestal.glb")]);
      buddha.traverse((o) => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.5; o.material.envMapIntensity = 0; } });
      ped.traverse((o) => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.95; } });
      const fit = (o, h) => { const b = new THREE.Box3().setFromObject(o), w = new THREE.Group(); o.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); w.add(o); w.scale.setScalar(h / (b.max.y - b.min.y)); return w; };
      const ironMat = {};
      state.figures = "here";
      return {
        gold: (h) => fit(buddha.clone(true), h), pedestal: (h) => fit(ped.clone(true), h),
        iron: (h) => { const f = buddha.clone(true); f.traverse((o) => { if (o.isMesh) { ironMat[o.material.uuid] ||= Object.assign(o.material.clone(), { roughness: 0.72, metalness: 0.45, color: new THREE.Color(0x57524c) }); o.material = ironMat[o.material.uuid]; } }); return fit(f, h); },
      };
    } catch (e) { state.figures = "missing: " + (e && e.message ? e.message : e); return null; }
  })();
  halls.forEach((hall, i) => {
    const r = buildRoom(M, hall, i * 60, figures); group.add(r.group); rooms[hall.id] = r; Object.assign(spots, r.spots); Object.assign(places, r.places);
  });
  return { group, rooms, spots, places, state };
}
