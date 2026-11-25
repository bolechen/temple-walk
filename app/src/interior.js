// Inside the halls. Every hall with a door can be entered: each has a real room, walked in the same way as the
// courts, furnished for what the hall is (an altar and its figures, meditation platforms, tea tables, shelves of
// sutras), and along its side walls a row of hanging frames that are empty for now. Each frame is a place where
// something will be shown and told later; what hangs in it is data (GALLERY below, by the frame's id).
// Overhead is the hall's own timber (framing.js): columns on the bays the building shows outside, beams resting on
// them, and the ceiling its rank calls for, from a caisson over the Buddha to a roof open to the rafters.
//
// The rooms are built far below the courts, side by side (the paving above hides them), and the walker is moved
// into one at its hall's door.
import * as THREE from "three";
import { asset } from "./assets.js";
import { paintLeaf } from "./leaves.js";
import { WORKS, HANG } from "../levels/t00/works.js";
import { workIn } from "../levels/t00/works-local.js";
import { FONT, lang } from "./i18n.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { box, merge, mesh, footAt, BODY, STOOL, CUSHION } from "./geo.js";
import { frameRoom, CEILING, bays } from "./framing.js";
import { makePlaque } from "./plaque.js";
import { incenseId } from "./incense.js";

const FLOOR = -60;
// What each kind of hall is like inside: width, depth and the height of its walls. Where its columns stand comes from
// the building's own bays (framing.js), and how it is furnished from its kind (below).
// The eye's shot for the incense (src/director.js), in the place's frame: x to his left, z the way he faces, y up from the floor there.
// Low, below his brow, from behind him and well to his right, so that he stands side-on, the stand with its bowl of ash
// beside him and the Buddha above; it draws a little nearer as he offers (our own draft).
// A small hall's figure stands farther from the cushion and its dais is narrow, so from the great hall's 3.2 m out the dais's
// shaded end showed as a black block at the edge of the picture and the figure fell to the right: its camera stands 2.2 m out and
// aims between him and the figure. The Guanyin hall's two front columns stand either side of the aisle a step behind his
// cushion and would stand across the figure from either: there the camera stands in the aisle behind him, a little to his right.
const GUANYIN_CAM = { at: [-1.4, 1.2, -3.2], look: [0, 1.9, 2.8], fov: 56 };
const INCENSE_SHOT = {
  buddha: { at: [-3.2, 0.8, -2.4], look: [0, 1.69, 1.98], fov: 44, in: 2.2, out: 1.0, drift: { side: 0.015, for: 10 }, keep: [[0, 0.1, 0], [0, 1.2, 0], [0, 0.6, 0.8], [0, 1.7, 4.55], [0, 4.9, 4.55]] },
  // `top`: the figure's head above the floor; `far`: how far before him it stands (the dais's middle, from his cushion).
  figure: (top, far, cam = { at: [-2.2, 0.8, -2.4], look: [0, 1.4, 3.0], fov: 48 }) => ({ ...cam, in: 2.2, out: 1.0, drift: { side: 0.015, for: 10 }, keep: [[0, 0.1, 0], [0, 1.2, 0], [0, 0.6, 0.8], [0, 1.7, far], [0, top, far]] }),
};
export const KINDS = {
  buddha:    { w: 26.4, d: 16.8, h: 7.6 },
  figure:    { w: 15, d: 11, h: 5.6 },
  chan:      { w: 17, d: 9, h: 4.8 },
  tea:       { w: 17, d: 9, h: 4.8 },
  library:   { w: 19, d: 11, h: 6.2 },
  patriarch: { w: 12, d: 9, h: 4.8 },
  pavilion:  { w: 15, d: 15, h: 5.2 },
};
// What hangs in a frame, by its id ("main-w1" is the first frame on the great hall's west wall). `title` and `text`
// are shown when a visitor stands before it; `image` (a URL) replaces the blank paper. The story will be written here.
// Beside the leaves hang real works (levels/t00/works.js, written by tools/gallery.py): things that survive from the temple this
// place is drawn from, each shown with its encyclopedia note and the museum's source line.
// The first leaf in each hall: eight short notes a visitor reads on the way up, written for this imagined temple out
// of what is told of such mountain monasteries (docs/JINGSHAN.md). They stand in for the artworks the story will
// hang here later; each has a small ink painting drawn for it (`paint`, see leaves.js); give a frame an `image` and it shows that instead.
export const GALLERY = {
  "main-w1": { paint: "gate", title: "入山帖", text: "上山的人在山门外的石阶上歇脚，到殿前时，鞋帮上都沾着竹林里的泥。站一站，再进去。" },
  "chan-w1": { paint: "sit", title: "坐帖", text: "禅堂里一排坐榻，蒲团朝着墙。坐的人点一炷香，香没烧完，谁也不先起身。" },
  "tea-w1": { paint: "tea", title: "茶帖", text: "相传山里的茶宴有十几道规矩，后来渡海东去。小沙弥只记得一条：茶来了，就喝茶。" },
  "library-w1": { paint: "scroll", title: "经帖", text: "楼上的经卷按函排在柜里，函套上落着薄灰。管经的老师父每天开一个柜子，晾一晾，再合上。上山的人可以在檐下请一句话。" },
  "yaoshi-w1": { paint: "gourd", title: "药帖", text: "山下的人上来求药，师父先请他们在廊下坐着，等一壶水烧开，问家里几口人、地里种的什么。药包好了，麻绳扎两道，让他们带下山。" },
  "guanyin-w1": { paint: "lamp", title: "灯帖", text: "灯台上一排小盏，油是香客背上山的，灯芯是殿里的师父捻的。夜里风大，守殿的人要起来两回，把吹灭的再点上。" },
  "dahui-w1": { paint: "well", title: "井帖", text: "相传开山那年，龙让出了整座山，只留下这口井。水在暗处，俯身才看得见。" },
  "lingxiao-w1": { paint: "roofs", title: "顶帖", text: "登到顶上回头看，一层一层的屋顶都在脚下。山门外那片竹林，只剩一道浅绿。" },
};
// The figures that stand in the halls beside the great Buddha, until the project carves its own: scans of real
// sculpture which two museums publish as public domain (CC0), thinned and packed by tools/statues.py into
// app/shared/models/. What a hall of this kind holds is set out in docs/JINGSHAN.md; these are the nearest open
// figures to it, and where one only stands in for another the note there says so.
//   beside: [file, x, z, height] on the altar's dais, either side of the main figure
//   centre: [file, height] in place of the Buddha and his pedestal
//   table:  [file, height] on the offering table of a plain hall
export const STAND = {
  main: { beside: [["arhat", -2.95, 0.95, 2.2], ["gilt-monk", 2.95, 0.95, 2.3], ["guanyin-seated", -4.6, 0.15, 2.0], ["guanyin-rock", 4.6, 0.15, 1.9]] },   // the two disciples nearest him, a bodhisattva beyond each
  yaoshi: { centre: ["buddha-lacquer", 2.5] },      // a Buddha of another make for the hall of the Medicine Buddha
  guanyin: { centre: ["guanyin-eleven", 3.4] },     // the eleven-headed Guanyin, standing
  dahui: { table: ["monk-seated", 0.82] },          // a seated monk teaching, for the patriarchs' hall
};
const BLANK = { title: "空着的画框", text: "这里以后会挂上一件东西，讲这座寺的一段事。" };

// A real work, mounted as a scroll is: the picture on a sheet of pale paper, a hair-line round it, and under it the
// name and the maker in the kai hand. The picture is fetched only when the hall it hangs in is first entered.
const KAI = FONT.kai;
function mount(slug) {
  const w = workIn(slug), c = document.createElement("canvas"); c.width = 768; c.height = 1126; const x = c.getContext("2d");
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
    x.fillText(w.title, 384, 996); x.fillStyle = "rgba(70,62,52,.9)";
    // Under it the maker and the age: cut short in characters, set smaller in letters until it fits.
    if (lang === "zh") { x.font = `26px ${KAI}`; x.fillText(`${w.by}　${w.period}`.slice(0, 26), 384, 1050); }
    else { const by = `${w.by} · ${w.period}`; let s = 26; x.font = `${s}px ${KAI}`; while (s > 16 && x.measureText(by).width > 690) x.font = `${--s}px ${KAI}`; x.fillText(by, 384, 1050); }
    x.strokeStyle = "rgba(60,50,40,.3)"; x.lineWidth = 3; x.strokeRect(22, 22, 724, 1082);
    tex.needsUpdate = true;
  };
  im.src = asset(`levels/t00/gallery/${slug}.webp`);
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
  const K = KINDS[hall.kind] || KINDS.patriarch, Y = FLOOR, g = new THREE.Group(), solids = [], dim = () => 0.42;
  // Where a column must not stand: on what is in the way already, on a cushion, where a visitor stops (`keep`).
  // Every cushion and stool is a seat he may take (`seats`: where it is, the height of its top, the way one faces on it,
  // and its kind: a cushion is sat on cross-legged, a stool as a chair).
  const keep = [], seats = [], sitAt = (x, z, up, face = Math.PI, kind = "cushion") => seats.push({ at: [ox + x, z], top: Y + up, face, room: hall.id, kind });
  const seat = (x, z, r = 0.32, up = 0, face = Math.PI) => (keep.push({ x, z, r }), sitAt(x, z, up + 0.104, face), cushion().translate(x, Y, z));
  const R = { id: hall.id, y: Y, x0: ox - K.w / 2, x1: ox + K.w / 2, z0: -K.d / 2, z1: K.d / 2, h: K.h, door: [ox, K.d / 2 - 1.6], exitZ: K.d / 2 - 0.7, cx: ox };
  const add = (geo, mat, ao = dim) => { const m = mesh(geo.translate(ox, 0, 0), mat, { ao }); g.add(m); return m; };
  const block = (x0, x1, z0, z1) => solids.push({ x0: ox + x0, x1: ox + x1, z0, z1 });
  const W = K.w + 0.6, D = K.d + 0.6, wx = K.w / 2 + 0.3, zs = K.d / 2 + 0.3, zn = -K.d / 2 - 0.3, flames = [];
  const flame = (x, y, z, r = 0.03) => { const f = new THREE.Mesh(new THREE.SphereGeometry(r, 10, 8).scale(1, 2, 1), M.flame); f.position.set(ox + x, Y + y, z); g.add(f); flames.push(f); };
  // Floor, and walls with the door in the south one. Under an open roof the front and back walls stand a little higher,
  // to the boards, and the side walls rise in gables (framing.js); under a ceiling all four stop at it.
  const hw = CEILING[hall.kind] === "open" ? K.h + 0.45 : K.h;
  add(box(W, 0.4, D, 0, Y - 0.2, 0), M.stone, () => 0.6);
  add(footAt(merge([box(W, hw, 0.3, 0, Y + hw / 2, zn - 0.15), box(0.3, K.h, D, -wx - 0.15, Y + K.h / 2, 0), box(0.3, K.h, D, wx + 0.15, Y + K.h / 2, 0),
    box(W / 2 - 1.5, hw, 0.3, -(W / 4 + 0.75), Y + hw / 2, zs + 0.15), box(W / 2 - 1.5, hw, 0.3, W / 4 + 0.75, Y + hw / 2, zs + 0.15), box(3, hw - 3.3, 0.3, 0, Y + 3.3 + (hw - 3.3) / 2, zs + 0.15)]), Y - 30), M.plaster());
  const cushion = () => lathe(CUSHION, 24);   // the same straw cushion as out of doors, whose top is the seat's height
  const table = (w, d, T, x, z) => merge([box(w, 0.07, d, x, Y + T, z), box(w - 0.1, 0.1, 0.05, x, Y + T - 0.1, z + d / 2 - 0.05), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => box(0.07, T, 0.07, x + a * (w / 2 - 0.08), Y + T / 2, z + c * (d / 2 - 0.07)))]);
  const lampStand = (x, z) => { add(lathe([[0, 0], [0.24, 0], [0.26, 0.04], [0.08, 0.12], [0.035, 0.2], [0.03, 1.3], [0.1, 1.36], [0.17, 1.44], [0.16, 1.47], [0, 1.45]], 20).translate(x, Y, z), M.bronze, () => 0.8); flame(x, 1.54, z); block(x - 0.35, x + 0.35, z - 0.35, z + 0.35); };
  let coinBox = null;   // the great hall's 功德箱, registered with the frames below (a spot he stands before and presses E at)
  const places = {}, altar = new THREE.Group(), stand = STAND[hall.id] || {}, later = [], stood = []; altar.position.set(ox, Y, 0); g.add(altar);   // `later`: what is fetched only when someone first comes in
  const tz = -K.d / 2 + 5.4, lightAt = [];

  if (hall.kind === "buddha" || hall.kind === "figure") {
    // An altar: a stone dais, an offering table with a censer between candlesticks, cushions, tall lamps.
    const big = hall.kind === "buddha", ax = big ? 5.6 : 2.6, az0 = -K.d / 2 + 0.9, az1 = az0 + (big ? 3.4 : 2.6), ah = big ? 1.0 : 0.8;
    add(merge([box(ax * 2, ah - 0.16, az1 - az0, 0, Y + (ah - 0.16) / 2, (az0 + az1) / 2), box(ax * 2 + 0.24, 0.16, az1 - az0 + 0.24, 0, Y + ah - 0.08, (az0 + az1) / 2), box(ax * 2 + 0.2, 0.14, az1 - az0 + 0.2, 0, Y + 0.07, (az0 + az1) / 2)]), M.monolith);
    block(-ax - 0.4, ax + 0.4, az0 - 0.5, az1 + 0.4);
    add(table(big ? 2.6 : 1.8, 0.7, 0.86, 0, tz), M.woodX); block(-(big ? 1.6 : 1.2), big ? 1.6 : 1.2, tz - 0.6, tz + 0.6);
    add(merge([lathe([[0, 0.02], [0.1, 0.02], [0.17, 0.08], [0.2, 0.17], [0.18, 0.22], [0.14, 0.22], [0.13, 0.18], [0, 0.16]], 24).translate(0, Y + 0.895, tz), ...[-1, 1].map((sx) => lathe([[0, 0], [0.08, 0], [0.03, 0.04], [0.025, 0.26], [0.07, 0.3], [0.07, 0.32], [0, 0.32]], 16).translate(sx * 0.6, Y + 0.895, tz))]), M.bronze, () => 0.8);
    for (const sx of [-1, 1]) flame(sx * 0.6, 1.26, tz, 0.016);
    // The two cushions before an altar are sat on and walked round, never crossed (#638: with one in the middle he walked over it from
    // the door to the stand): the middle of the hall's width stays open as the way to the stand and the altar, where he bows
    // (`places.incense.at`) and steps up to `front`.
    add(merge([-1.1, 1.1].map((x) => seat(x, tz + 1.75))), M.straw, () => 0.7).userData.walk = "post";
    for (const sx of [-1, 1]) lampStand(sx * (big ? 3.3 : 2.2), tz + 0.2);
    altar.position.set(ox, Y + ah, (az0 + az1) / 2);
    if (!stand.centre) figures.then((f) => { if (!f) return; const p = f.pedestal(big ? 0.62 : 0.46), b = f.gold(big ? 3.5 : 2.5); b.position.y = big ? 0.62 : 0.46; altar.add(p, b); });
    else later.push((get) => get(stand.centre[0], stand.centre[1]).then((o) => altar.add(o)));
    for (const [file, x, z, h] of stand.beside || []) later.push((get) => get(file, h).then((o) => { o.position.set(x, 0, z); o.rotation.y = -Math.sign(x) * 0.12; altar.add(o); }));   // turned a little toward the middle
    // Before the middle cushion of each hall that keeps a Buddha (#146), a low stand with a bowl of ash: the censer on the
    // table is out of a child's reach, and this is where a visitor's own incense goes. He bows at the cushion, steps up to
    // `front`, and sets the sticks in the ash at `bowl` (rites.js). The cushions and the table stand the same way from
    // hall to hall, so the stand does too; only the eye's shot is each hall's own.
    {
      const sz = tz + 0.95, sh = 0.52;
      add(merge([box(0.34, 0.035, 0.3, 0, Y + sh - 0.018, sz), box(0.3, 0.04, 0.26, 0, Y + sh - 0.06, sz), ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, c]) => box(0.035, sh - 0.03, 0.035, a * 0.14, Y + (sh - 0.03) / 2, sz + c * 0.12)), box(0.28, 0.03, 0.03, 0, Y + 0.14, sz - 0.12), box(0.28, 0.03, 0.03, 0, Y + 0.14, sz + 0.12)]), M.woodX);
      add(lathe([[0, 0], [0.07, 0], [0.085, 0.012], [0.12, 0.05], [0.13, 0.085], [0.118, 0.085], [0.11, 0.07], [0, 0.07]], 24).translate(0, Y + sh, sz), M.bronze, () => 0.8);
      block(-0.17 - BODY, 0.17 + BODY, sz - 0.15 - BODY, sz + 0.15 + BODY);
      places[incenseId(hall.id)] = { at: [ox, tz + 1.75], r: 1.5, face: Math.PI, inside: true, y: Y + 0.03, room: hall.id, front: [ox, sz + 0.15 + BODY + 0.02], bowl: [ox, Y + sh + 0.07, sz], shot: big ? INCENSE_SHOT.buddha : INCENSE_SHOT.figure(ah + (stand.centre ? stand.centre[1] : 0.46 + 2.5) - 0.1, (tz + 1.75) - (az0 + az1) / 2, hall.id === "guanyin" ? GUANYIN_CAM : undefined) };
    }
    // The 功德箱 (offering box), a step east of the offering table beside the lamp: a lacquered chest on a low plinth under a
    // lid that overhangs it, a slot in the lid, and on its front a small board with the two characters. Shaped as such boxes
    // are in working temples (about 0.5 m wide, a man's waist high, a slot on top; no Song or Yuan example survives to copy,
    // docs/t00/SOURCES.md). He stands before it and presses E to put in a coin (game.js `offerCoin`); it is a piece of furniture
    // in every build, and only the web build says anything more (src/donate.js).
    if (big) {
      // Small enough for a child to reach over: the lid's top is 0.74 m, a little under his shoulder (0.78 m), and the slot
      // lies near the lid's front edge, so that standing a body's width off the lid (BODY) his arm, a bow leaning him in, reaches it.
      // It stands before the altar, a step east of the cushions, level with the front of them (the middle of the hall's width is the way to the Buddha), with its front
      // to the door: the eye that follows him in stands to his right, so the box on that side is not behind him, and its three characters
      // read from there. Further north on this side it would shut the way round him for the incense's shot (tests/unit/director.test.mjs).
      const bx = 2.45, bz = tz + 2.2, lw = 0.46, ld = 0.34, bh = 0.74, bw = 0.38, bd = 0.28, slotZ = bz + 0.12;   // centre; lid width and depth; height to the lid's top; body width and depth; the slot's depth
      add(merge([box(bw + 0.04, 0.07, bd + 0.02, bx, Y + 0.035, bz), box(lw, 0.05, ld, bx, Y + bh - 0.025, bz)]), M.woodX);
      add(merge([box(bw, bh - 0.12, bd, bx, Y + 0.07 + (bh - 0.12) / 2, bz)]), M.lacquer, () => 0.5);   // up to the lid's underside: no gap for the lamp to light
      add(merge([box(0.16, 0.006, 0.026, bx, Y + bh + 0.003, slotZ)]), M.bronze, () => 0.8);   // the slot's brass rim
      // On its front, the three characters 功德箱 written down the board in the name boards' own hand (plaque.js: Yunjing Bang, each
      // character evened to its neighbours' weight): gilt on a dark ground, the column two thirds as tall as the front of the box.
      const board = /** @type {THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial>} */ (makePlaque("功德箱", { vertical: true, style: "ink", seals: false, back: M.woodV }));   // an unshaped board is one mesh
      board.scale.setScalar(0.25); board.position.set(ox + bx, Y + 0.4, bz + bd / 2 + 0.008); board.castShadow = false; g.add(board);
      Object.assign(board.material, { emissive: new THREE.Color(0xffffff), emissiveMap: board.material.map, emissiveIntensity: 0.4 });   // the gilt holds what light there is: read from the door, in a hall of lamps
      block(bx - lw / 2 - BODY, bx + lw / 2 + BODY, bz - ld / 2 - BODY, bz + ld / 2 + BODY);
      // Where he stands before it, facing north (just off the solid), and where the coin goes in: the middle of the slot on
      // the lid's top (world coordinates, for rites.js). The eye's own shot is data in his frame, as the other places' are
      // (src/director.js): from his right and a little above, over the lid, the slot, his hand and the coin in one picture.
      coinBox = { at: [ox + bx, bz + ld / 2 + BODY + 0.01], face: Math.PI, r: 1.1, offering: true, slot: [ox + bx, Y + bh, slotZ], room: hall.id,
        shot: { at: [-1.35, 1.05, -0.05], look: [-0.03, 0.62, 0.4], fov: 44, in: 2.0, out: 1.0, drift: { side: 0.01, for: 8 }, keep: [[0, 0.77, 0.44], [0, 0.45, 0.42], [-0.04, 0.82, 0.3]] } };
    }
    lightAt.push([-(big ? 3.3 : 2.2), 1.9, tz + 0.2, 0xffa050, 9, 14], [big ? 3.3 : 2.2, 1.9, tz + 0.2, 0xffa050, 9, 14], [0, big ? K.h - 2.4 : K.h - 2.0, big ? tz + 0.8 : tz + 1.8, 0xffe6c4, big ? 11 : 7, 16, true]);
  } else if (hall.kind === "chan") {
    // The meditation hall: long sitting platforms down both sides, a cushion at every place, the aisle between.
    const plat = [], mats = [];
    // The platform on the door's side is two, with the way in from the door between them (#274: it was drawn as one, across
    // the way the written plan left open, and he walked through it and the three cushions on it).
    const WAY = 1.6, zOf = (sx) => sx * (K.d / 2 - 1.2) - (sx > 0 ? 2.2 : 0), half = (K.w - 3) / 2;
    plat.push(box(K.w - 3, 0.42, 1.7, 0, Y + 0.21, zOf(-1)));
    for (const s of [-1, 1]) plat.push(box(half - WAY, 0.42, 1.7, s * (half + WAY) / 2, Y + 0.21, zOf(1)));
    for (const sx of [-1, 1]) for (let x = -K.w / 2 + 2.4; x < K.w / 2 - 2; x += 1.25) if (sx < 0 || Math.abs(x) > WAY + 0.4) mats.push(seat(x, zOf(sx), 0.32, 0.42, sx > 0 ? Math.PI : 0).translate(0, 0.42, 0));   // each faces the aisle
    add(merge(plat), M.woodX); add(merge(mats), M.straw, () => 0.7);
    block(-K.w / 2 + 1.5, K.w / 2 - 1.5, -K.d / 2, -K.d / 2 + 2.2); block(-K.w / 2 + 1.5, -WAY, K.d / 2 - 4.4, K.d / 2 - 2.4); block(WAY, K.w / 2 - 1.5, K.d / 2 - 4.4, K.d / 2 - 2.4);
    lampStand(0, -K.d / 2 + 3.2); lightAt.push([0, 2.0, -K.d / 2 + 3.2, 0xffa050, 9, 14], [0, K.h - 1.4, 0.5, 0xffe6c4, 6, 14, true]);
  } else if (hall.kind === "tea") {
    // The tea house: tables with stools, each set with a ewer and bowls.
    const wood = [], glaze = [], iron = [];
    for (const [x, z] of [[-5, -1.4], [0, -2.2], [5, -1.4]]) {
      wood.push(table(1.3, 0.8, 0.78, x, z)); block(x - 0.75, x + 0.75, z - 0.5, z + 0.5);
      for (const [a, c] of [[0, 0.95], [0, -0.95], [1.05, 0]]) keep.push({ x: x + a, z: z + c, r: 0.22 }), sitAt(x + a, z + c, 0.44, Math.atan2(-a, -c), "stool"), wood.push(lathe(STOOL, 18).translate(x + a, Y, z + c));
      for (const a of [-0.2, 0.25]) glaze.push(lathe([[0, 0.012], [0.03, 0], [0.036, 0.012], [0.07, 0.048], [0.078, 0.06], [0.072, 0.06], [0.028, 0.02], [0, 0.02]], 20).translate(x + a, Y + 0.815, z + 0.1));
      iron.push(lathe([[0, 0], [0.07, 0], [0.1, 0.05], [0.105, 0.12], [0.07, 0.19], [0.035, 0.22], [0.03, 0.27], [0.045, 0.29], [0, 0.29]], 20).translate(x - 0.42, Y + 0.815, z - 0.15));
    }
    add(merge(wood), M.woodX); add(merge(glaze), M.glaze, () => 0.8); add(merge(iron), M.iron, () => 0.8);
    lampStand(-K.w / 2 + 1.4, -K.d / 2 + 1.4); lampStand(K.w / 2 - 1.4, -K.d / 2 + 1.4); lightAt.push([-K.w / 2 + 1.4, 1.9, -K.d / 2 + 1.4, 0xffa050, 8, 13], [K.w / 2 - 1.4, 1.9, -K.d / 2 + 1.4, 0xffa050, 8, 13], [0, K.h - 1.4, 0, 0xffe6c4, 6, 14, true]);
  } else if (hall.kind === "library") {
    // The library: tall cases of sutra boxes along the back wall and standing in rows, and a desk to read at.
    const cases = [], boxes = []; let s = 13; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    const shelf = (x, z, w) => { cases.push(box(w, 3.6, 0.5, x, Y + 1.8, z)); block(x - w / 2 - 0.1, x + w / 2 + 0.1, z - 0.45, z + 0.45); for (let r = 0; r < 6; r++) for (let c = -w / 2 + 0.25; c < w / 2 - 0.1; c += 0.3) if (rnd() < 0.86) boxes.push(box(0.24, 0.2 + rnd() * 0.22, 0.34, x + c, Y + 0.34 + r * 0.56, z + 0.12)); };
    shelf(-5.5, -K.d / 2 + 0.6, 6); shelf(5.5, -K.d / 2 + 0.6, 6); for (const x of [-6, 6]) shelf(x, -1.2, 4.4);
    add(merge(cases), M.woodZ); add(merge(boxes), M.lacquer, () => 0.6);
    add(table(1.8, 0.8, 0.74, 0, -1.6), M.woodX); block(-1.1, 1.1, -2.2, -1.0); add(seat(0, -0.6), M.straw, () => 0.7);
    lampStand(-1.6, -1.6); lightAt.push([-1.6, 1.9, -1.6, 0xffa050, 9, 14], [0, K.h - 1.6, 0, 0xffe6c4, 8, 16, true]);
  } else {
    // A plain hall: a table, cushions, a lamp. (The patriarchs' hall and the summit pavilion: their walls are the point.)
    add(table(1.8, 0.7, 0.8, 0, -K.d / 2 + 1.6), M.woodX); block(-1.1, 1.1, -K.d / 2 + 1, -K.d / 2 + 2.2);
    if (stand.table) later.push((get) => get(stand.table[0], stand.table[1]).then((o) => { o.position.set(ox, Y + 0.82, -K.d / 2 + 1.5); g.add(o); }));   // the patriarch's likeness, on the table
    add(merge([-0.9, 0.9].map((x) => seat(x, -K.d / 2 + 3.2))), M.straw, () => 0.7).userData.walk = "floor";
    lampStand(-1.8, -K.d / 2 + 1.6); lampStand(1.8, -K.d / 2 + 1.6); lightAt.push([-1.8, 1.9, -K.d / 2 + 1.6, 0xffa050, 8, 13], [1.8, 1.9, -K.d / 2 + 1.6, 0xffa050, 8, 13], [0, K.h - 1.4, 0, 0xffe6c4, 6, 14, true]);
  }
  // A hall with a storey that is walked round (the summit pavilion's top) has a stair up to it in the north-west corner,
  // against the north wall behind the corner column, clear of the frames, the table and the way from the door: a steep
  // timber stair between two strings, its treads open behind, rising westward into a well cut in the ceiling. It is
  // not climbed step by step (the room is five metres high, the storey it leads to fourteen): at its foot one goes up,
  // behind the veil.
  if (hall.up) {
    const x0 = -2.8, x1 = -7.3, za = -7.45, zb = -6.65, zc = (za + zb) / 2, w = zb - za, rise = K.h, n = 20, go = (x0 - x1) / n, len = Math.hypot(x0 - x1, rise), tilt = Math.atan2(rise, x0 - x1), wood = [];
    for (let i = 0; i < n; i++) wood.push(box(go + 0.04, 0.05, w - 0.1, x0 - (i + 0.5) * go, Y + (i + 1) * (rise / n) - 0.025, zc));
    for (const z of [za + 0.03, zb - 0.03]) wood.push(box(len, 0.3, 0.06, 0, 0, 0).rotateZ(-tilt).translate((x0 + x1) / 2, Y + rise / 2 - 0.05, z));
    wood.push(box(len - 0.4, 0.06, 0.06, 0, 0, 0).rotateZ(-tilt).translate((x0 + x1) / 2 + 0.15, Y + rise / 2 + 0.82, zb), box(0.1, 1.0, 0.1, x0 - 0.1, Y + 0.5, zb));   // a hand rail on the open side, on a post at the foot
    // The well in the ceiling the stair rises into: dark above, a frame of boards round it.
    const wx0 = -K.w / 2, wx1 = x1 + 2.6, wz0 = -K.d / 2, wz1 = zb + 0.15, H = Y + K.h;
    wood.push(box(wx1 - wx0, 0.16, 0.12, (wx0 + wx1) / 2, H - 0.12, wz1), box(0.12, 0.16, wz1 - wz0, wx1, H - 0.12, (wz0 + wz1) / 2));
    add(merge(wood), M.woodX);
    add(new THREE.PlaneGeometry(wx1 - wx0, wz1 - wz0).rotateX(Math.PI / 2).translate((wx0 + wx1) / 2, H - 0.035, (wz0 + wz1) / 2), new THREE.MeshBasicMaterial({ color: 0x0b0907 }), () => 1);
    block(-K.w / 2, x0 + BODY, -K.d / 2, zb + BODY);
    // Where he stands to go up, facing the stair (west); where he is set down coming back, facing into the room (east).
    R.stair = { at: [ox + x0 + 0.5, zc], up: hall.up, face: -Math.PI / 2, back: Math.PI / 2, r: 0.9 };
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
  add(merge([box(0.22, 3.306, 0.42, -1.5, Y + 1.647, zs + 0.15), box(0.22, 3.306, 0.42, 1.5, Y + 1.647, zs + 0.15), box(3.3, 0.24, 0.42, 0, Y + 3.3, zs + 0.15),
    box(1.3, 3.0, 0.07, -2.3, Y + 1.56, zs - 0.06), box(1.3, 3.0, 0.07, 2.3, Y + 1.56, zs - 0.06)]), M.woodX);
  // (The jambs go 6 mm into the floor and the sill 3 mm, so that their feet and the wall's are not three faces on one plane, #688.)
  add(box(3.0, 0.123, 0.5, 0, Y + 0.0585, zs + 0.15), M.stone, () => 0.7);
  // What the opening is to the eye that follows him: a wall, from the jambs' inner face out. Beyond it there is no porch,
  // only the picture of one, and the eye backing out through the door saw the dark under the courts with the two lamps
  // (27c9458). Never drawn, not stood on; eyegather.js takes it as it takes the walls. Sheets a hand apart through more
  // than a metre rather than one: eye.js lets pass for a moment anything the eye is clear of again half a metre and three
  // quarters beyond (a column, `FOLLOW.postWait`), which one sheet with nothing behind it would be.
  const eyeStop = new THREE.Mesh(merge(Array.from({ length: 11 }, (_, k) => new THREE.PlaneGeometry(2.8, 3.3).translate(ox, Y + 1.65, zs - 0.06 + k * 0.12))), new THREE.MeshBasicMaterial());
  eyeStop.visible = false; eyeStop.userData.walk = false; eyeStop.userData.eye = "stop"; g.add(eyeStop);
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
  if (coinBox) spots[`${hall.id}-box`] = { ...coinBox, item: { id: `${hall.id}-box`, title: "功德箱", text: "", offering: true } };

  // The frame and what is overhead (framing.js). A column may not stand where something is already in the way, on a
  // cushion, where a visitor stops before a frame or the altar, in the way from the door, or under the caisson.
  const focusZ = hall.kind === "pavilion" ? 0 : (hall.kind === "buddha" || hall.kind === "figure") ? altar.position.z : null;
  const stops = [...Object.values(places).map((p) => ({ x: p.at[0] - ox, z: p.at[1], r: 0.8 * p.r })), ...Object.values(spots).map((p) => ({ x: p.at[0] - ox, z: p.at[1], r: 0.5 }))];   // before a frame he needs only room to stand
  const lane = { x0: -0.9, x1: 0.9, z0: Math.min(0, ...Object.values(places).map((p) => p.at[1])), z1: zs }, hollow = focusZ === null ? null : { x0: -2.2, x1: 2.2, z0: focusZ - 2.2, z1: focusZ + 2.2 };
  const inside = (q, x, z, r) => x > q.x0 - r && x < q.x1 + r && z > q.z0 - r && z < q.z1 + r;
  const clear = (x, z, r) => solids.some((q) => inside({ x0: q.x0 - ox, x1: q.x1 - ox, z0: q.z0, z1: q.z1 }, x, z, r + 0.05)) || inside(lane, x, z, r) || (hollow && inside(hollow, x, z, r))
    || [...keep, ...stops].some((c) => Math.hypot(x - c.x, z - c.z) < r + c.r + 0.1);
  const timber = frameRoom(M, add, { K, hall, Y, focus: { ox, z: focusZ ?? 0 }, clear });
  for (const c of timber.cols) block(c.x - 0.29 - BODY, c.x + 0.29 + BODY, c.z - 0.29 - BODY, c.z + 0.29 + BODY);
  // The dado at the foot of the walls and a rail higher up; on the back wall the rail is left out where it would run
  // through the brackets under the beams' ends.
  const rail = Y + Math.min(5.2, K.h - 0.9), trim = [];
  for (const sx of [-1, 1]) trim.push(box(0.1, 1.0, D, sx * (wx - 0.05), Y + 0.5, 0), box(0.12, 0.2, D, sx * (wx - 0.06), rail, 0));
  trim.push(box(W, 1.0, 0.1, 0, Y + 0.5, zn + 0.05)); if (rail + 0.15 < timber.members.colTop - 0.32) trim.push(box(W, 0.2, 0.12, 0, rail, zn + 0.06));
  add(merge(trim), M.woodX);
  // The windows of the front wall seen from inside: in each bay clear of the door's leaves, upright bars (zhiling) over
  // paper with the day behind it. From outside these bays are lattice; inside they are where the daylight comes from.
  {
    const { xs } = bays(hall, K), bars = [], paperG = [], sill = 1.0, head = Math.min(3.1, K.h - 1.3);
    for (let i = 1; i < xs.length; i++) {
      let x0 = xs[i - 1], x1 = xs[i]; const leaves = 3.15;   // the door's leaves stand folded back within this of the middle
      if (x0 < -leaves && x1 > -leaves) x1 = -leaves; else if (x0 < leaves && x1 > leaves) x0 = leaves; else if (x0 > -leaves && x1 < leaves) continue;
      const w = Math.min(x1 - x0 - 0.7, 2.6); if (w < 1.0) continue;
      const cx = (x0 + x1) / 2, cy = Y + (sill + head) / 2, h = head - sill, z = zs - 0.04;
      bars.push(box(w + 0.24, 0.12, 0.12, cx, Y + sill - 0.06, z), box(w + 0.24, 0.12, 0.12, cx, Y + head + 0.06, z), box(0.12, h, 0.12, cx - w / 2 - 0.06, cy, z), box(0.12, h, 0.12, cx + w / 2 + 0.06, cy, z));
      for (let k = 1, n = Math.round(w / 0.14); k < n; k++) bars.push(box(0.045, h, 0.06, cx - w / 2 + (k * w) / n, cy, z));
      paperG.push(new THREE.PlaneGeometry(w, h, 1, 1).rotateY(Math.PI).translate(cx, cy, zs - 0.006));
    }
    if (bars.length) { add(merge(bars), M.woodX, () => 0.6); add(merge(paperG), M.paper, () => 1); }
  }
  // The hanging lamp: a bronze cap and bowl round panes of horn, on a chain from the beam or the boards above. Its
  // light is the room's one light from high up, so that what is overhead is lit from something there to see.
  for (const L of lightAt) if (L[6]) {
    const [x, y, z] = L, up = timber.roofAt(x, z), top = Y + y + 0.3;
    add(merge([new THREE.CylinderGeometry(0.012, 0.012, up - top, 5).translate(x, (up + top) / 2, z),
      lathe([[0, 0.3], [0.08, 0.3], [0.22, 0.2], [0.21, 0.17], [0, 0.17]], 16).translate(x, Y + y, z), lathe([[0, -0.2], [0.1, -0.2], [0.2, -0.12], [0.19, -0.1], [0, -0.1]], 16).translate(x, Y + y, z)]), M.bronze, () => 0.8);
    add(new THREE.CylinderGeometry(0.17, 0.15, 0.28, 12, 1, true).translate(x, Y + y + 0.035, z), M.lampglass, () => 1);
  }
  // Before the great hall's altar, two banners (fan) hang from the ceiling either side, faded indigo, not red.
  if (hall.kind === "buddha") {
    const cloth = [];
    for (const sx of [-1, 1]) {
      const L = K.h - 2.3, gb = new THREE.PlaneGeometry(0.56, L, 2, 14), p = gb.attributes.position;
      // Hung from its peak, the head a shallow triangle, the foot drawn to a point; a slow fold down its length.
      for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); if (y > L / 2 - 1e-6 && Math.abs(x) > 0.01) p.setY(i, y - 0.28); if (y < -L / 2 + 1e-6 && Math.abs(x) < 0.01) p.setY(i, y - 0.3); p.setZ(i, 0.05 * Math.sin(y * 1.7 + sx)); }
      gb.computeVertexNormals(); cloth.push(gb.translate(sx * 6.9, Y + K.h - 0.12 - L / 2, altar.position.z + 2.0));
    }
    add(merge(cloth), M.banner, () => 0.85);
  }
  const lights = lightAt.map(([x, y, z, c, i, d]) => { const l = new THREE.PointLight(c, i, d, 1.6); l.position.set(ox + x, Y + y, z); l.visible = false; g.add(l); return l; });
  // `hang()`: fetch and mount this hall's works, the first time someone comes in.
  const m = timber.members, frame = { ...m, cols: m.cols.map((c) => ({ ...c, x: c.x + ox })), beams: m.beams.map((q) => ({ ...q, x: q.x + ox })), ties: m.ties.map((q) => ({ ...q, x0: q.x0 + ox, x1: q.x1 + ox })), wx: m.wx, ox };
  return { group: g, room: { ...R, solids, frame }, lights, flames, spots, places, seats, outlook: out, altar, stand(get) { const now = later.splice(0).map((f) => f(get)); stood.push(...now); return Promise.all(stood); }, hang(get) { hangs.splice(0).forEach((f) => f()); return this.stand(get); } };
}

// Every room, one for each hall the plan says can be entered. Returns them by the hall's id.
export function buildInteriors(M, halls, renderer) {
  const group = new THREE.Group(), rooms = {}, spots = {}, places = {}, seats = [], state = { figures: "loading" };
  // The figures are fetched once and stood in every hall that has an altar.
  const figures = (async () => {
    if (typeof fetch === "undefined" || typeof document === "undefined") return null;
    try {
      // The statue and its pedestal are not kept in git: `pnpm install` fetches them as they are published (tools/setup.mjs),
      // packed with meshopt and with Basis textures, which are opened here by the decoders that come with three.js.
      const base = asset("shared/models/"), loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
      if (renderer) loader.setKTX2Loader(new KTX2Loader().setTranscoderPath(asset("vendor/basis/")).detectSupport(renderer));
      const get = async (name) => (await loader.loadAsync(base + name)).scene;
      const [buddha, ped] = await Promise.all([get("buddha.glb"), get("pedestal.glb")]);
      buddha.traverse((/** @type {any} */ o) => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.5; o.material.envMapIntensity = 0; } });
      ped.traverse((/** @type {any} */ o) => { if (o.isMesh) { o.material.metalness = 0; o.material.roughness = 0.95; } });
      const fit = (o, h) => { const b = new THREE.Box3().setFromObject(o), w = new THREE.Group(); o.position.set(-(b.min.x + b.max.x) / 2, -b.min.y, -(b.min.z + b.max.z) / 2); w.add(o); w.scale.setScalar(h / (b.max.y - b.min.y)); return w; };
      state.figures = "here";
      return {
        gold: (h) => fit(buddha.clone(true), h), pedestal: (h) => fit(ped.clone(true), h),
      };
    } catch (e) { state.figures = "missing: " + (e && e.message ? e.message : e); return null; }
  })();
  // The other figures (STAND) are fetched the first time a hall that has them is entered; each file once, however
  // many halls stand a copy. They come one unit tall, standing on the origin, painted on their vertices.
  const scans = {}, plain = typeof document === "undefined" ? null : new GLTFLoader(); state.stood = {};
  const get = (file, h) => (scans[file] ||= plain.loadAsync(asset(`shared/models/${file}.glb`)).then((s) => s.scene)).then((src) => {
    const o = src.clone(true); o.traverse((m) => { if (m.isMesh) { m.material.envMapIntensity = 0.12; m.castShadow = false; } }); o.scale.setScalar(h); state.stood[file] = (state.stood[file] || 0) + 1; return o;
  });
  halls.forEach((hall, i) => {
    const r = buildRoom(M, hall, i * 60, figures); group.add(r.group); rooms[hall.id] = r; Object.assign(spots, r.spots); Object.assign(places, r.places); seats.push(...r.seats);
    const hang = r.hang.bind(r), standUp = r.stand.bind(r); r.hang = () => hang(get); r.stand = () => standUp(get);   // `stand`: only the figures, without the works on the walls (doorway.js)
  });
  return { group, rooms, spots, places, seats, state, ready: figures };
}
