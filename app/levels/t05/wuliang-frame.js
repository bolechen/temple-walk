// What a visitor sees overhead in the Wuliang hall's passage: the roof left open to its timber. `buildHall` draws a
// roof as tiles over one sheet of boards, with nothing under it inside; from the passage the eye looked up at that sheet
// and it read as a flat black triangle (the lead's note on #492, the same fault the prologue's gate had before #475). The
// Great Hall has its own frames (hall.js); this hall, drawn by the generator, gets the same kind of thing here, as a white
// box: on each of the four inner column lines a frame of two tiers of tie beam with posts up to the purlins, the
// purlins along the hall at each joint of the roof's falls, and the rafters under the boards. Positions and sections are
// proposals except the sections of the beams and rafters, which are the Yingzao Fashi's (docs/t05/SOURCES.md §13.2, read by the structure review); the roof's own numbers are read from the built hall, so the frame follows the
// roof wherever the roof is changed.
import * as THREE from "three";
import { box, merge, mesh } from "../../src/geo.js";

const PT = 0.3;            // a purlin's section, square (a round purlin is not drawn; the white box has none)
const RT = 0.15;           // a rafter's diameter: 9-10 fen in a hall's size (Yingzao Fashi, juan 5), the fen at this hall's cai; drawn square, its width a fifth less
const BD1 = 0.78, BD2 = 0.65, BW = 0.45;   // the lower beam's and the upper's depth (a four-rafter beam is 50 fen deep, a three-rafter one 42: juan 5), and their width, two thirds of the greater
const RAFTER_GAP = 0.5;
const TONE = { beam: 1.9, purlin: 1.65, rafter: 1.6 };   // what the generator's timber colour is multiplied by: the beams and posts; the purlins (which the generator's wood already draws lighter); the rafters    // the rafters' spacing across the hall

/**
 * The frame's boxes, in the hall's own frame (x across, z along, y from the ground the hall stands on).
 * @param {*} b the built hall (what `buildHall` returns): EX, EZ, roof.purlin, roofAt(d)
 * @param {{ xs: readonly number[], zs: readonly number[], G: number }} H the hall's column lines and the depth of its end slopes
 */
export function frameParts(b, H) {
  const { EX, EZ } = b, PIN = b.roof.purlin, G = H.G;
  const under = (d) => b.roofAt(d) - 0.17;   // the boards' underside
  // (the boards' own sheet is cut away under the ridge, a quarter metre down at its crown, so the frame is let down there too)
  const underAt = (x, z) => { const dz = EZ - Math.abs(z), dx = EX - Math.abs(x); return under(dx <= G ? Math.min(dz, dx) : dz) - Math.max(0, 0.25 * (1 - Math.abs(z) / 0.6)); };
  const half = EZ - PIN, n = Math.max(2, Math.ceil(half / 1.86)), seg = half / n;
  const zk = (k) => EZ - (PIN + k * seg);   // the k-th purlin from the front eave purlin; k = n is the ridge, at 0
  const purlinBottom = (z) => underAt(0, z) - RT - PT;
  const wood = [], woodZ = [];

  // The purlins, along the hall as far as the hipped ends leave room over their tops.
  const within = (z, top) => { let x = EX - 0.5; while (x > 0 && underAt(x, z) < top + 0.05) x -= 0.05; return x; };
  for (let k = 0; k <= n; k++) for (const s of k === n ? [1] : [1, -1]) {
    const z = s * zk(k), bottom = purlinBottom(z), len = within(z, bottom + PT) - 0.2;   // stopped a little short of the step where the hip begins
    if (len > 0.5) wood.push(box(2 * len, PT, PT, 0, bottom + PT / 2, z));
  }

  // The frames: on each inner column line a lower tie beam from the front column line to the back, its top under the
  // first purlin in; an upper one between the purlins two falls in from the eave, standing on posts on the lower; and
  // posts from there to the purlins above, up to the ridge. The two end lines are under the hip, whose slope leaves no room.
  const zc = H.zs[0], k2 = Math.max(2, n - 2);
  const top1 = purlinBottom(zk(1)), top2 = purlinBottom(zk(k2));
  const post = (x, z, from, to, w, d) => { if (to - from > 0.12) woodZ.push(box(w, to - from, d, x, (from + to) / 2, z)); };
  for (const x of H.xs.slice(1, -1)) {
    woodZ.push(box(BW, BD1, 2 * zc, x, top1 - BD1 / 2, 0));
    woodZ.push(box(BW, BD2, 2 * zk(k2), x, top2 - BD2 / 2, 0));
    for (const s of [1, -1]) {
      for (let k = 2; k <= n; k++) {
        const z = s * zk(k);
        if (k === n && s < 0) continue;   // one post under the ridge
        if (k < k2) post(x, z, top1, purlinBottom(z), BW * 0.7, 0.3);
        else if (k === k2) post(x, z, top1, top2 - BD2, BW * 0.8, 0.35);   // the post carrying the upper beam's end
        else post(x, z, top2, purlinBottom(z), BW * 0.7, 0.3);
      }
    }
  }

  // The rafters, one every half metre across the hall, in lengths following the falls, from the front eave purlin over the
  // ridge to the back one; none where the hip begins.
  const rafters = [], reach = EX - G - 0.2, steps = 2 * Math.ceil(zk(0) / 0.5), dz = (2 * zk(0)) / steps;
  for (let x = -Math.floor(reach / RAFTER_GAP) * RAFTER_GAP; x <= reach + 1e-6; x += RAFTER_GAP) {
    for (let i = 0; i < steps; i++) {
      const za = zk(0) - i * dz, zb = za - dz, ya = underAt(x, za) - RT / 2, yb = underAt(x, zb) - RT / 2, L = Math.hypot(dz, yb - ya);
      const g = box(RT * 0.8, RT, L + 0.02, 0, 0, 0);
      g.rotateX(Math.atan2(yb - ya, dz)).translate(x, (ya + yb) / 2, (za + zb) / 2);
      rafters.push(g);
    }
  }
  return { wood, woodZ, rafters };
}

/**
 * The frame as a group, placed where the hall stands. The beams, posts and purlins are drawn a little lighter than the generator's timber
 * and the rafters a little darker, so that they stand off the rafters and the boards behind them (the art director's note on #511: five or
 * six L* apart, to be eight or more, the whole no lighter than before).
 * @param {*} M @param {*} b @param {*} H @param {number} z0 @param {number} y0
 */
export function buildWuliangFrame(M, b, H, z0, y0 = 0) {
  const { wood, woodZ, rafters } = frameParts(b, H), g = new THREE.Group();
  const toned = (base, name, mul) => {
    const m = base.clone(), was = base.onBeforeCompile;
    m.onBeforeCompile = (sh, rr) => { was.call(base, sh, rr); sh.fragmentShader = sh.fragmentShader.replace("diffuseColor.rgb=col;", `diffuseColor.rgb=col*vec3(${mul});`); };
    m.customProgramCacheKey = () => name;
    return m;
  };
  g.add(mesh(merge(wood), toned(M.woodX, "wuliang-purlin", TONE.purlin)), mesh(merge(woodZ), toned(M.woodZ, "wuliang-beam", TONE.beam)), mesh(merge(rafters), toned(M.woodZ, "wuliang-rafter", TONE.rafter)));
  g.position.set(0, y0, z0);
  return g;
}
