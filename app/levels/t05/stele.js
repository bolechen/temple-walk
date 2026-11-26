// The Yuan stele in the monument pavilion west of the terrace, and the place before it where a line of it is copied
// (docs/t05/PRD.md §1.3 (a), SCOPE-OPTIONS.md (a): copied by hand, never rubbed; CHECKPOINTS.md §0: the stone is not
// touched). The pavilion itself is axis.js's; what is here is what copying needs of it: three steps up onto its base on
// the south side, so that he can stand before the stele (a Qing pavilion's base is climbed by steps, as every platform
// of the temple is: SOURCES.md, our own), the written plan's say of the base, columns and stele, the inscription's face,
// and the place with its shot.
//
// What is cut in the stone is only what a transcription we have read gives (STELE_TEXT: Luo Fuyi's, by way of a 2021 paper;
// the 1931 gazetteer was not reached, so it is not collated against it: docs/t05/SOURCES.md §17): the rest of its face is
// left as weathered stone, not filled with characters nobody has read. The face is a canvas laid a millimetre proud of the
// shaft's south face; drawn when a face is there to draw with (the browser), a plain plane in Node.
import * as THREE from "three";
import { box, mesh, merge, stairGeo, stairProfile, BODY, CHEEK } from "../../src/geo.js";
import { MONUMENT, MONUMENT_FORM, STELE } from "./axis.js";

/**
 * The inscription: the stele's title and the passages as the transcription read gives them (SOURCES.md §17), turned back into
 * the full forms by us (our own reading of the simplified text, not a rubbing). Each line is one column, read top to bottom, the columns from right to left. `lines` are the
 * lines that may be copied: an id (kept on the page, never the words), its text as cut, and which column holds it.
 */
export const STELE_TEXT = Object.freeze({
  // The owner's choice of 2026-11-26 (#770, SOURCES.md §17): the stone's heading (義州重修大奉國寺碑) and the column that names the temple (遼金遺刹，一炬殆盡，
  // 獨奉國孑然而在) are weathered past reading, so that nothing readable names the real temple or its county town beside the fictional 奉明寺 on the head. What
  // can be read is only what names no temple: the two passages below. `worn` says which columns are weathered and how many cells each holds (blotches, no characters).
  title: "",
  columns: Object.freeze(["觀其寶殿崔嵬儼居七佛", "法堂弘敞可納千僧"]),
  worn: Object.freeze({ title: 9, columns: Object.freeze([{ after: 0, cells: 11 }, { after: 1, cells: 7 }]) }),
  lines: Object.freeze([
    // The line's text is also the key of its rendering in the other languages (locales/{ja,en,ko}.js: a free rendering, shown under it on the slip).
    Object.freeze({ id: "qifo", text: "觀其寶殿崔嵬，儼居七佛", col: 0 }),
    Object.freeze({ id: "kenqian", text: "法堂弘敞，可納千僧", col: 1 }),
  ]),
});

/** The pavilion's base, its steps and the stele, worked out from axis.js's numbers so that a move of the pavilion moves them all. */
export function steleFrame() {
  const M0 = MONUMENT, F = MONUMENT_FORM, mx = (M0.x0 + M0.x1) / 2, mz = (M0.z0 + M0.z1) / 2;
  const floor = M0.y + F.base, plinth = { x0: mx - 0.8, x1: mx + 0.8, z0: mz - 0.475, z1: mz + 0.475, top: floor + 0.45 };
  const face = mz + STELE.t / 2;                  // the shaft's south face
  const flight = { w: 1.6, rise: F.base, ...stairProfile(F.base) };
  return { mx, mz, floor, plinth, face, flight, top: plinth.top + STELE.L, span: F.span / 2, colR: F.colR, ceil: floor + F.column + 0.3 + F.beam };
}

/** The face where the characters are cut: from a hand above the plinth to a hand under the head, the shaft's width less a margin. */
export const FACE = Object.freeze({ margin: 0.07, foot: 0.12, head: 0.1 });

// The inscription drawn on a canvas, characters in the kai (the project's own regular hand, Yunjing Kai, written in the forms
// cut), as incised characters: a darker hollow with a lit lower edge, the stone's grain over all. Weathered where nothing was
// read in a transcription (SOURCES.md §17): no characters there.
/**
 * Where each character stands on the face, as a canvas `px` wide and `ph` high lays them: its centre (x, y) and size, the title
 * down the first column, larger, then the columns read, right to left; each as large as a column is wide, reaching about half
 * way down. The face's own drawing and the tests that keep the copy's shot from cutting a character both read it.
 * @param {number} px @param {number} ph @returns {{ ch: string, worn: boolean, col: number, row: number, x: number, y: number, size: number }[]}
 */
export function steleLayout(px, ph) {
  const cols = STELE_TEXT.columns, W = STELE_TEXT.worn, n = cols.length + W.columns.length + 1, step = px / (n + 0.4), fs = step * 0.8, cell = fs * 1.08, out = [];
  // Slots right to left: the weathered heading, then each readable column with the weathered one that follows it.
  const put = (slot, text, worn, rows, size) => { for (let i = 0; i < rows; i++) out.push({ ch: worn ? "" : [...text][i], worn, col: slot, row: i, x: px - step * (slot === 0 ? 0.7 : 0.7 + slot), y: ph * 0.03 + cell * (i + 0.5), size }); };
  let slot = 0; put(slot++, "", true, W.title, fs * 0.92);
  cols.forEach((s, k) => { put(slot++, s, false, [...s].length, fs * 0.86); const w = W.columns.find((c) => c.after === k); if (w) put(slot++, "", true, w.cells, fs * 0.86); });
  return out;
}
/** The common characters the worn cells keep a third of (none of them is in the stone's own text or names anything there). */
const REMNANT = "山水人日月天心三大小上下中不有";
function inscription(w, h, again = true) {
  if (typeof document === "undefined" || !document.createElement) return null;
  const c = document.createElement("canvas"); if (!c.getContext) return null;
  const px = 1024, ph = Math.round((px * h) / w); c.width = px; c.height = ph;
  const g = c.getContext("2d"); if (!g) return null;
  g.clearRect(0, 0, px, ph);
  // An incised character in a stone under a roof reads by its two edges: the upper wall of the cut in shadow, and the floor of
  // the cut and its lower lip catching the sky (with the pale dust that lies in old cuts). Drawn as three passes of the glyph.
  let ds = 11; const dr = () => ((ds = (ds * 16807) % 2147483647) / 2147483647);
  const draw = (ch, x, y, size, fade = 0) => {
    g.globalAlpha = fade || 0.62 + 0.3 * dr();   // old cuts are not all as deep as each other (`fade`: a worn cell's remnant, a third to a half as bright as a readable one)
    g.font = `${size}px "Yunjing Kai", serif`; g.textAlign = "center"; g.textBaseline = "middle";
    g.fillStyle = "rgba(8,7,6,0.85)"; g.fillText(ch, x - size * 0.025, y - size * 0.035);       // the upper wall of the cut, in shadow
    g.fillStyle = "rgba(214,208,196,0.78)"; g.fillText(ch, x + size * 0.02, y + size * 0.03);   // the lower lip, catching the light
    g.fillStyle = "rgba(150,144,134,0.9)"; g.fillText(ch, x, y);                                 // the floor of the cut, pale with dust
    g.globalAlpha = 1;
    // a nick or two where the edge of a stroke has flaked: a small patch of the face's own tone laid over the cut
    for (let k = 0, n = dr() < 0.5 ? 1 : 0; k < n; k++) { g.fillStyle = "rgba(128,124,116,0.55)"; g.beginPath(); g.arc(x + (dr() - 0.5) * size * 0.7, y + (dr() - 0.5) * size * 0.7, size * (0.04 + 0.05 * dr()), 0, 6.283); g.fill(); }
  };
  // The five columns (steleLayout); below them the stone is left as it weathered.
  // A weathered cell is a few dull, uneven scuffs of the stone, drawn with the same seeded hand every time, with no character in it.
  let ws = 3; const wr = () => ((ws = (ws * 16807) % 2147483647) / 2147483647);
  for (const c of steleLayout(px, ph)) {
    if (!c.worn) { draw(c.ch, c.x, c.y, c.size); continue; }
    // A cell where the cut has worn away keeps remnants of the old cut: a third of the strokes of a common character, in the same face, size and
    // line as the readable ones and a third to a half as bright (the art director, #773). The character is drawn from a fixed set that has nothing to do
    // with the stone's own text, by a fixed seed, so that no heading or column of it, nor any name, can be made out however the contrast is lifted.
    // Only one faint pale patch of flaked stone is added, no more (soft dark patches read as water stains).
    const ch = REMNANT[Math.floor(wr() * REMNANT.length)];
    g.save(); g.beginPath();
    for (let k = 0; k < 3; k++) { const w = c.size * (0.28 + 0.2 * wr()), h = c.size * (0.34 + 0.2 * wr()); g.rect(c.x - c.size / 2 + wr() * (c.size - w), c.y - c.size / 2 + wr() * (c.size - h), w, h); }
    g.clip(); draw(ch, c.x, c.y, c.size, 0.36 + 0.12 * wr()); g.restore();
    { const rx = c.size * (0.4 + 0.3 * wr()), ry = rx * 0.7;
      g.save(); g.translate(c.x + (wr() - 0.5) * c.size, c.y + (wr() - 0.5) * c.size); g.rotate(wr() * 3); g.scale(1, ry / rx);
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, rx); gr.addColorStop(0, "rgba(206,200,188,0.07)"); gr.addColorStop(1, "rgba(206,200,188,0)");
      g.fillStyle = gr; g.beginPath(); g.arc(0, 0, rx, 0, 6.283); g.fill(); g.restore(); }
  }
  // Weathering: the stone's own blotches over the face, heavier toward its foot and its left, where nothing is read.
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 1800; i++) {
    const x = rnd() * px, y = rnd() * ph, r = 2 + rnd() * 12 * (0.4 + y / ph), a = 0.05 + 0.1 * rnd() * (1 - x / px * 0.6);
    g.fillStyle = `rgba(40,36,30,${(a * 0.8).toFixed(3)})`; g.beginPath(); g.arc(x, y, r, 0, 6.283); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4;
  // Redrawn once the face has come (the first frames may draw before the font has loaded).
  if (again) document.fonts?.load?.(`40px "Yunjing Kai"`, STELE_TEXT.columns.join("")).then(() => { const next = inscription(w, h, false); if (next) { t.image = next.image; t.needsUpdate = true; } }).catch(() => {});
  return t;
}

/**
 * What copying needs built: the steps onto the base, the inscription, the written plan's rectangles (replacing the single
 * solid axis.js held the pavilion's place with), the place `copy` and its view.
 * @param {any} M the materials
 */
export function buildStele(M) {
  const S = steleFrame(), { mx, mz, floor, plinth, face, flight: fl } = S;
  const group = new THREE.Group(), steps = [], walk = { solids: [], decks: [], ramps: [], posts: [] };
  // Three steps down the base's south face, in the middle of it, between the two south columns.
  const M0 = MONUMENT, at = new THREE.Matrix4().makeTranslation(mx, M0.y, M0.z1);
  const flight = stairGeo(fl.w, fl.rise, { place: at }); steps.push(flight.geo); group.userData.flights = [{ w: fl.w, rise: fl.rise, sides: [-1, 1], m: at }];
  group.add(mesh(merge(steps), M.steps));
  // The inscribed face, a millimetre proud of the shaft.
  const fw = STELE.w - 2 * FACE.margin, fh = STELE.L - FACE.foot - FACE.head, map = inscription(fw, fh);
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(fw, fh), new THREE.MeshLambertMaterial({ map, transparent: true, depthWrite: false, color: map ? 0xffffff : 0x000000, opacity: map ? 1 : 0 }));
  plane.position.set(mx, plinth.top + FACE.foot + fh / 2, face + 0.001); plane.userData.keep = true; plane.userData.walk = false; plane.userData.part = "inscription"; plane.name = "stele-face";
  group.add(plane);
  // The written plan (the eye's, until its hierarchy is built; app/src/plan-walker.js): the base is a floor, the columns and the
  // stele on its plinth are in the way, and the flight climbs from the terrace.
  walk.decks.push({ x0: M0.x0, x1: M0.x1, z0: M0.z0, z1: M0.z1, h: floor, floor: "stone" });
  walk.solids.push({ x0: M0.x0 - BODY, x1: M0.x1 + BODY, z0: M0.z0 - BODY, z1: M0.z1 + BODY, top: floor });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) walk.posts.push({ x0: mx + sx * S.span - S.colR - BODY, x1: mx + sx * S.span + S.colR + BODY, z0: mz + sz * S.span - S.colR - BODY, z1: mz + sz * S.span + S.colR + BODY, h: S.ceil });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) walk.solids.push({ x0: mx + sx * S.span - S.colR, x1: mx + sx * S.span + S.colR, z0: mz + sz * S.span - S.colR, z1: mz + sz * S.span + S.colR, eyeTop: S.ceil + 2.6 });
  walk.posts.push({ x0: plinth.x0 - BODY, x1: plinth.x1 + BODY, z0: plinth.z0 - BODY, z1: plinth.z1 + BODY, h: S.top });
  walk.solids.push({ x0: plinth.x0, x1: plinth.x1, z0: plinth.z0, z1: plinth.z1, eyeTop: plinth.top });   // the plinth, knee high
  walk.solids.push({ x0: mx - STELE.headW / 2, x1: mx + STELE.headW / 2, z0: mz - STELE.headT / 2, z1: mz + STELE.headT / 2, eyeTop: S.top + STELE.headH + 0.05 });   // the stele, as wide and thick as its head
  const pad = BODY + 0.02;
  walk.ramps.push({ x0: mx - fl.w / 2 + pad, x1: mx + fl.w / 2 - pad, z0: M0.z1 - 0.4, z1: M0.z1 + fl.run + 0.3, base: M0.y, h: fl.rise, low: [mx, M0.z1 + fl.run], high: [mx, M0.z1], floor: "stone" });
  for (const sx of [-1, 1]) walk.posts.push({ x0: sx > 0 ? mx + fl.w / 2 - BODY - 0.021 : mx - fl.w / 2 - CHEEK - BODY, x1: sx > 0 ? mx + fl.w / 2 + CHEEK + BODY : mx - fl.w / 2 + BODY + 0.021, z0: M0.z1 + 0.02, z1: M0.z1 + fl.run + BODY + 0.06, h: floor });

  // Where he stands to copy: on the base, before the plinth, his robe clear of it, facing the stele (north). The shot: over his
  // left shoulder at the height of his head, inside the ring of the four columns, onto the stele's face with the columns he reads
  // and his left hand holding the leaf, the brush beyond it. From his right his arm hides the page and from behind the hat on his
  // back hides his hands; from before his left side (tried first) the swing from behind him passed round the south-west column,
  // which stood between the eye and him for a part of a second (the strip of #728's art review): t05-director.test holds both.
  const stand = plinth.z1 + BODY + 0.22;
  const toFace = stand - face;                    // how far the face is before him
  const copy = {
    at: [mx, stand], r: 1.1, face: Math.PI, act: "抄碑", rite: "copy",
    stele: { x: mx, face, y0: plinth.top + FACE.foot, y1: plinth.top + FACE.foot + fh, w: fw },
    shot: { at: [0.8, 1.4, -1.0], look: [0, 1.52, 0.4], fov: 60, in: 2.0, out: 1.0,
      keep: [[0, 1.12, 0], [0, 0.8, 0.26], [0, 1.7, toFace]] },   // his head, the leaf in his hands, and the foot of the columns he reads
  };
  const views = { "shot-copy": [mx, stand, Math.PI - copy.face, 0.05], stele: [mx, stand + 1.6, 0, 0.3] };   // (shot-<id> stands him at the place, as the prologue's do; `stele` looks at its face from the top of the steps)
  return { group, walk, places: { copy }, views, frame: S };
}
