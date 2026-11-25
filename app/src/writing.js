// What his hands do when he writes on his own page (T05's observation and the copying of the stele; rites.js hands this its
// clock, his frame and `act`, so the passages are the observances' own: on the clock, dropped the moment the visitor walks on).
// He takes a leaf of paper on a thin board into his left hand and a brush into his right, raises the board before his chest,
// tilted to him, looks up at what he is writing from, and writes: the brush comes down onto the paper, moves a little, lifts,
// and the ink is there; between a few characters he looks up again. Then the brush is held off the paper a moment (停笔),
// and both go back into his sleeve. He touches nothing but the paper: the board is held before him, never laid on the stone
// (CHECKPOINTS.md §0, PRD.md §1.3 (a) (4): his hand stays 0.3 m off the stele's face, tests/unit/t05-writing.test.mjs).
import * as THREE from "three";
import { LEAF, drawPage } from "./pagework.js";

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const ease = (u) => u * u * (3 - 2 * u), mix = (a, b, u) => a + (b - a) * u;

/** Where the board is held in his own frame (x to his left, y up from his soles, z the way he faces), and how far the brush is held up its shaft.
 * The board sits a little to his left and below his chin, the brush leaning forward over it (`lean`), so that seen over his left shoulder
 * the hand that writes stands clear of his ear rather than against it (#744). */
export const HOLD = Object.freeze({ board: [0.08, 0.72, 0.3], tilt: 0.4, grip: 0.075, shaft: 0.17, lean: 0.6 });

/**
 * @param {{ act: any, play: (secs: number, fn: (u: number) => void, on: () => boolean) => Promise<boolean>, homeward: (u: number, secs: number, after?: number) => void,
 *   at: (x: number, y: number, z: number, out?: THREE.Vector3) => THREE.Vector3, dir: (x: number, y: number, z: number, out?: THREE.Vector3) => THREE.Vector3,
 *   scene: THREE.Object3D, G: THREE.Object3D, head: THREE.Object3D, sound?: (secs: number) => void, each?: (f: () => void) => void,
 *   stele?: { face: number }, handR?: () => THREE.Vector3, handL?: () => THREE.Vector3 }} o
 */
export function createWriting(o) {
  const { act, play, homeward, at, dir, scene, G } = o;
  // The leaf: a canvas on a plane, on a board a little larger. Where there is no document (Node) it is a plain plane.
  const canvas = typeof document !== "undefined" && document.createElement ? document.createElement("canvas") : null;
  const ctx = canvas?.getContext ? canvas.getContext("2d") : null;
  if (canvas) { canvas.width = 256; canvas.height = Math.round((256 * LEAF.h) / LEAF.w); }
  const tex = ctx ? new THREE.CanvasTexture(/** @type {HTMLCanvasElement} */ (canvas)) : null;
  if (tex) tex.colorSpace = THREE.SRGBColorSpace;
  const leaf = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(LEAF.w, LEAF.h).translate(0, 0, 0.004), new THREE.MeshStandardMaterial({ map: tex, color: tex ? 0xffffff : 0xefe6d2, roughness: 0.92, side: THREE.DoubleSide }));
  // The board is 6 mm thick; the paper lies a millimetre over its face (on one plane they flicker) and the brush's tip a millimetre over that.
  const board = new THREE.Mesh(new THREE.BoxGeometry(LEAF.w + 0.02, LEAF.h + 0.02, 0.006), new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.8 }));
  leaf.add(board, paper);
  // The brush: a bamboo shaft and its tip of hair, wet with ink. Its origin is the tip of the hair.
  const brush = new THREE.Group();
  brush.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0042, 0.0048, HOLD.shaft, 8).translate(0, 0.024 + HOLD.shaft / 2, 0), new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.6 })),
    new THREE.Mesh(new THREE.ConeGeometry(0.0062, 0.026, 8).rotateX(Math.PI).translate(0, 0.013, 0), new THREE.MeshStandardMaterial({ color: 0x15120f, roughness: 0.5 })));
  for (const g of [leaf, brush]) { g.visible = false; g.traverse((m) => { m.userData.keep = m.userData.soft = true; m.userData.part = "writing"; }); scene.add(g); }
  const page = { stroke: 0, note: "", noteK: 0, copy: "", copyK: 0, from: "" };
  const redraw = () => { if (!ctx || !canvas || !tex) return; drawPage(ctx, canvas.width, canvas.height, page); tex.needsUpdate = true; };
  const state = { held: 0, writing: false, marks: 0, nearest: Infinity, copied: "", stroked: 0 };
  const tA = V(), tB = V();
  // The board before his chest, its face turned up to him by `tilt`; `k` how far it has come up from his sleeve.
  const placeLeaf = (k) => {
    const [bx, by, bz] = HOLD.board;
    at(mix(0.08, bx, k), mix(0.55, by, k), mix(0.12, bz, k), leaf.position);
    leaf.quaternion.copy(G.quaternion).multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler((Math.PI / 2 - HOLD.tilt) * k, Math.PI, 0)));   // turned to face him, then laid back so that its top leans away
    leaf.scale.setScalar(Math.max(0.001, k)); leaf.updateMatrixWorld();
  };
  // A point of the paper (u, v from -0.5 to 0.5, v up the page) in the world, a hair above it.
  const onPaper = (u, v, lift = 0, out = V()) => out.set(u * LEAF.w, v * LEAF.h, 0.005 + lift).applyMatrix4(leaf.matrixWorld);
  // His right hand holds the brush up its shaft, upright over the paper; the left holds the board by its left edge.
  const hold = (tip, lift = 0) => {
    const up = dir(0, 1, HOLD.lean, tB);
    brush.position.copy(tip).addScaledVector(up, lift); brush.quaternion.setFromUnitVectors(V(0, 1, 0), up);
    const R = act.hands.right, L = act.hands.left;
    R.at.copy(brush.position).addScaledVector(up, HOLD.grip); dir(0.25, -0.35, 1, R.fingers); dir(1, 0.1, 0, R.palm);
    onPaper(-0.56, -0.05, 0, L.at); dir(-0.2, 0.35, 1, L.fingers); dir(-1, 0.2, 0, L.palm);
  };
  // Posed at once (`?show=shot-copy`, `__poseRite`), he holds the brush on the paper; the walk turns him to the place a
  // frame later, so the board and his hands follow him every frame until he really writes or rests.
  let posed = false;
  o.each?.(() => { if (posed && leaf.visible) { placeLeaf(1); hold(onPaper(0.3, 0.05, 0, tA), 0); } });
  const near = (p) => { if (o.stele) { const s = o.stele, d = Math.max(0, p.z - s.face) /* the face looks south: +z */; state.nearest = Math.min(state.nearest, Math.abs(d) < 1e-9 ? 0 : d); } };
  const track = () => { if (!o.stele) return; for (const b of [o.handR?.(), o.handL?.()]) if (b) near(b); near(brush.position); near(leaf.position); };

  /** He takes them out and raises the board. */
  async function takeUp(on) {
    posed = false; leaf.visible = brush.visible = true; state.held = 1; redraw();
    return play(1.0, (u) => { const k = ease(u); placeLeaf(k); hold(onPaper(0.2, 0.3, 0.06 * (2 - k), tA), 0); act.hands.left.w = act.hands.right.w = k; act.bow = 0.12 * k; track(); }, on);
  }
  /** He puts them away. */
  async function putAway(on, after = 0) {
    const ok = await play(1.0, (u) => { const k = 1 - ease(u); placeLeaf(Math.max(0.001, k)); hold(onPaper(0.2, 0.3, 0.06, tA), 0.04 * (1 - k)); act.hands.left.w = act.hands.right.w = k; act.bow = 0.12 * k; act.nod = act.nod * k; homeward(u, 1.0, after); track(); }, on);
    leaf.visible = brush.visible = false; state.held = 0; act.nod = 0; return ok;
  }
  /** He looks up from the paper to what he is writing from (`up`: how far he raises his head, 0..1) and back. */
  const lookUp = (on, secs, up = 1) => play(secs, (u) => { const k = Math.sin(Math.PI * ease(u)); act.nod = mix(0.16, -0.22 * up, k); placeLeaf(1); hold(onPaper(0.15, 0.2, 0.05, tA), 0); track(); }, on);
  /** One mark: the brush comes down at (u0, v0), goes to (u1, v1) on the paper and lifts; `ink(k)` reveals the mark as it goes. */
  const mark = (on, secs, [u0, v0], [u1, v1], ink) => {
    o.sound?.(secs * 0.7);
    return play(secs, (u) => {
      const down = u < 0.2 ? ease(u / 0.2) : u > 0.82 ? 1 - ease((u - 0.82) / 0.18) : 1, k = Math.min(1, Math.max(0, (u - 0.15) / 0.67));
      placeLeaf(1); act.nod = 0.16; hold(onPaper(mix(u0, u1, k), mix(v0, v1, k), 0.03 * (1 - down), tA), 0); ink(k); redraw(); track();
    }, on).then((ok) => { if (ok) state.marks++; return ok; });
  };

  /**
   * Copies a line from the stele: looks up at it, writes it down the right of the page a character at a time, looking up
   * again every few characters, stops his brush, and puts the leaf away. `line` is the text as cut; `from` names the stone.
   * @param {() => boolean} on @param {{ text: string, from?: string, keep?: { stroke?: number, note?: string } }} w @param {(what: string) => void} [cue]
   */
  async function copyLine(on, w, cue = () => {}) {
    const chars = [...w.text].filter((c) => c !== "，" && c !== "、");
    Object.assign(page, { stroke: w.keep?.stroke ?? 0, note: w.keep?.note ?? "", noteK: 1, copy: w.text, copyK: 0, from: "" });
    state.writing = true; state.copied = "";
    if (!(await takeUp(on))) return false;
    if (!(await lookUp(on, 1.8, 1))) return false;
    const cell = Math.min(0.16, 0.74 / chars.length);
    for (let i = 0; i < chars.length; i++) {
      const v = 0.5 - 0.22 - cell * (i + 0.5);   // down the column at the right, as drawPage lays it (its y down from the top)
      if (!(await mark(on, 0.7, [0.3, v + cell * 0.3], [0.3, v - cell * 0.25], (k) => { page.copyK = (i + k) / chars.length; }))) return false;
      page.copyK = (i + 1) / chars.length; state.copied = chars.slice(0, i + 1).join(""); redraw();
      if (i < chars.length - 1 && (i + 1) % 4 === 0 && !(await lookUp(on, 1.1, 1))) return false;
    }
    cue("written");
    page.from = w.from || ""; redraw();
    // The brush held off the paper, still; he reads what he has written.
    if (!(await play(1.2, () => { placeLeaf(1); act.nod = 0.2; hold(onPaper(0.1, -0.2, 0.05, tA), 0); track(); }, on))) return false;
    state.writing = false;
    return putAway(on);
  }
  /**
   * The observation: one stroke of ink across the top of the page, then the sentence written small beneath it.
   * @param {() => boolean} on @param {{ note: string, keep?: { copy?: string, from?: string } }} w @param {(what: string) => void} [cue]
   */
  async function strokeLine(on, w, cue = () => {}) {
    Object.assign(page, { stroke: 0, note: w.note, noteK: 0, copy: w.keep?.copy ?? "", copyK: 1, from: w.keep?.from ?? "" });
    state.writing = true;
    if (!(await takeUp(on))) return false;
    if (!(await lookUp(on, 1.4, 1.4))) return false;
    if (!(await mark(on, 1.5, [-0.36, 0.37], [0.36, 0.37], (k) => { page.stroke = k; }))) return false;
    page.stroke = 1; state.stroked = 1; cue("stroke");
    const n = [...w.note].length, rows = 3;
    for (let r = 0; r < rows; r++) if (!(await mark(on, 1.4, [-0.36, 0.3 - r * 0.07], [0.12, 0.3 - r * 0.07], (k) => { page.noteK = (r + k) / rows; }))) return false;
    page.noteK = 1; redraw(); cue("written");
    if (!(await play(1.0, () => { placeLeaf(1); act.nod = 0.2; hold(onPaper(0.1, 0, 0.05, tA), 0); track(); }, on))) return false;
    state.writing = false;
    return putAway(on);
  }
  function rest() { posed = false; leaf.visible = brush.visible = false; state.held = 0; state.writing = false; }
  return {
    copyLine, strokeLine, rest, page,
    /** Poses him at the moment the brush is on the paper, at once (`?show=shot-copy`, `__poseRite`). */
    pose(w = {}) { posed = true; Object.assign(page, { stroke: 0, note: "", copy: w.text || "", copyK: 0.5, from: "" }); leaf.visible = brush.visible = true; placeLeaf(1); hold(onPaper(0.3, 0.05, 0, tA), 0); act.hands.left.w = act.hands.right.w = 1; act.bow = 0.12; act.nod = 0.16; redraw(); },
    track,
    state: () => ({ ...state, nearest: Number.isFinite(state.nearest) ? +state.nearest.toFixed(3) : null, leaf: leaf.visible, brush: brush.visible, at: leaf.position.toArray().map((v) => +v.toFixed(3)) }),
    resetNearest() { state.nearest = Infinity; },
  };
}
