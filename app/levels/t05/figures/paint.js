// Painting a clay statue as a painted sculpture (彩塑) without a texture (issue #287): the figure is divided into zones by
// shapes written in its own frame (ellipsoids, capsules, boxes, half-spaces, a curved band), each shape placed by a few
// anchor points read off the figure once, and each zone has its own colour, roughness and metalness. The face's fine
// lines (brows, lids, eyes, lips, the urna) are drawn as a decal projected from the front in the head's frame, measured
// from the eyes and the mouth, so they are as sharp at any distance as the screen allows and do not depend on how many
// triangles the face has. The same recipe paints every figure; a figure brings only its anchors (paint/<figure>.json).
//
// The figure's frame (the pivot in stage.js): metres, x to the viewer's right when facing it, y up from the top of its
// seat, z toward the viewer. A shape in the recipe names anchors with "@name" (or "@name.x" for one number of a point).
// A zone whose anchors a figure does not have (a bare shoulder on a figure wearing the robe over both) is not drawn.
//
// The recipe compiles to one shader for all figures; the numbers are uniforms, so seven figures share one program.
import * as THREE from "three";

// Leaf shapes and the GLSL that tests a point against each, softly over `e` metres at its edge (1 inside, 0 outside).
const GLSL = /* glsl */ `
uniform mat4 uToFig;
uniform vec4 uL[LEAVES];
uniform vec4 uFace[10];
uniform float uEdge;
uniform sampler2D uMaskF;
uniform sampler2D uMaskB;
uniform sampler2D uMaskS;
uniform sampler2D uMaskH;
uniform vec3 uTint;
uniform float uLotus;
uniform vec3 uInner;
varying vec3 vFig;
varying vec3 vFigN;
float pEll(vec3 p, vec4 a, vec4 b) { if (a.w < .5) return 0.; vec3 q = (p - a.xyz) / b.xyz; float k = min(b.x, min(b.y, b.z));
  return 1. - smoothstep(-uEdge, uEdge, (length(q) - 1.) * k); }
float pCap(vec3 p, vec4 a, vec4 b) { if (a.w < .5) return 0.; vec3 pa = p - a.xyz, ba = b.xyz - a.xyz; float h = clamp(dot(pa, ba) / dot(ba, ba), 0., 1.);
  return 1. - smoothstep(-uEdge, uEdge, length(pa - ba * h) - b.w); }
float pBox(vec3 p, vec4 a, vec4 b) { if (a.w < .5) return 0.; vec3 d = max(a.xyz - p, p - b.xyz); return 1. - smoothstep(-uEdge, uEdge, max(d.x, max(d.y, d.z))); }
float pHalf(vec3 p, vec4 a, vec4 b) { if (a.w < .5) return 0.; return smoothstep(-uEdge, uEdge, dot(p - a.xyz, b.xyz)); }
// a mask drawn in the figure's frame and laid on from the front (b.w = 1) or the back (b.w = -1) (issue #370, round 6):
// a = (x0, y0, the depth past which it reaches, on), b = (x1, y1, channel, side). The mask is a picture over the
// rectangle x0..x1 × y0..y1, worked out from the figure's own surface (tools/t05-hall/mask.py), so its edges follow the
// folds and the collar instead of a box's straight sides; only the surface on its own side and facing that way takes it.
float pMap(vec3 p, vec4 a, vec4 b) { if (a.w < .5) return 0.;
  // b.w: 1 front, 2 back, 3 the figure's right side (picture across = z); +10 when the alpha holds the depth seen
  float code = mod(b.w, 10.); bool depth = b.w > 9.5; bool fr = code < 1.5 || code > 3.5;   // code 4: a second picture from the front, the curls' (issue #701)
  vec3 q = fr ? p : code < 2.5 ? vec3(-p.x, p.y, -p.z) : vec3(p.z, p.y, -p.x);   // q.z toward that picture's eye
  float nz = fr ? vFigN.z : code < 2.5 ? -vFigN.z : -vFigN.x;
  vec2 uv = ((code < 2.5 || code > 3.5 ? p.xy : p.zy) - a.xy) / (b.xy - a.xy);
  if (uv.x < 0. || uv.y < 0. || uv.x > 1. || uv.y > 1.) return 0.;
  if (q.z < a.z || nz < -.1) return 0.;
  vec4 t = code > 3.5 ? texture2D(uMaskH, uv) : code < 1.5 ? texture2D(uMaskF, uv) : code < 2.5 ? texture2D(uMaskB, vec2(1. - uv.x, uv.y)) : texture2D(uMaskS, uv);
  // the mask's alpha holds the depth of the surface its picture saw ((depth toward the eye + 3.5) / 7); a surface lying
  // behind that one (the robe behind a forearm) was not seen and takes none of it
  if (depth && q.z < t.a * 7. - 3.5 - .06 - .2 * (1. - nz)) return 0.;   // more room where the picture only grazed the surface
  return b.z < .5 ? t.r : b.z < 1.5 ? t.g : t.b; }
// a band round the figure whose middle line rises as y0 + c·x² (a neckline, a sash), half-height h, across |x| < w, in front of z0
float pBand(vec3 p, vec4 a, vec4 b) { if (a.w < .5) return 0.; float d = abs(p.y - (a.x + a.y * p.x * p.x)) - a.z;
  d = max(d, abs(p.x) - b.x); d = max(d, b.y - p.z); return 1. - smoothstep(-uEdge, uEdge, d); }
float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(hash12(i), hash12(i + vec2(1, 0)), f.x), mix(hash12(i + vec2(0, 1)), hash12(i + 1.), f.x), f.y); }
// a pattern of round flowers in a lattice (团花) seen from the front: 1 on the flower, 0 on the ground
float flowers(vec2 q, float cell) { vec2 g = q / cell; vec2 id = floor(g); vec2 f = fract(g) - .5;
  if (mod(id.x + id.y, 2.) > .5) f = fract(g + .5) - .5;   // staggered rows
  float r = length(f), a = atan(f.y, f.x); float petal = .30 + .08 * cos(a * 6.);
  return max(1. - smoothstep(petal - .03, petal, r), 0.) * (1. - (1. - smoothstep(.07, .10, r)) * .6); }
// the decal on the face: brows, upper lids, the eyes beneath, the lips and the urna, in the head's front plane.
// uFace[0] = eyeL.xy, eyeR.xy (eyeL is on the viewer's right); [1] = mouth.xy, urna.xy; [2] = brow up, brow half-width,
// brow thickness, lid half-width; [3] = lid thickness, lid sag, iris radius, lip half-width; [4] = lip half-height,
// urna radius, front of the face (z below which nothing is drawn), on (0/1); [5] = lid lift above the eye's centre, -, -, -
float arcDist(vec2 q, vec2 c, float w, float sag) { float x = clamp((q.x - c.x) / w, -1., 1.); float y = c.y - sag * x * x; return abs(q.y - y) + max(abs(q.x - c.x) - w, 0.); }
// the face's ink: x the brows, y the upper lids (and the eye beneath, when its radius is above zero), drawn in two colours
// (#370 round 7: a brow is a soft shadow under the brow ridge, not a hard line; a lid is one soft line along the eye's slit)
float eyeW = 0., eyeP = 0.;   // the half-open eye's white and pupil, set by faceInk
float seamW = 0.;             // how much of the lip seam's lift lies here, set by faceInk (uFace[8]: half-height, strength)
vec2 faceInk(vec3 p, vec3 n, out float lip, out float urna) {
  vec2 ink = vec2(0); lip = 0.; urna = 0.; eyeW = 0.; eyeP = 0.; seamW = 0.;
  if (uFace[4].w < .5 || p.z < uFace[4].z || n.z < .15) return ink;
  vec2 q = p.xy; float aa = max(fwidth(q.x), fwidth(q.y)) * 1.2 + .002, soft = uFace[5].y;
  for (int s = 0; s < 2; s++) {
    vec2 e = s == 0 ? uFace[0].xy : uFace[0].zw;
    float bw = uFace[2].y, tt = clamp(abs(q.x - e.x) / bw, 0., 1.), bt = uFace[2].z * (1. - .8 * pow(max(tt, 0.), 1.5));   // a brow thins to points at its ends
    ink.x = max(ink.x, 1. - smoothstep(bt - aa - soft, bt + aa + soft, arcDist(q, e + vec2(0., uFace[2].x), bw, uFace[2].x * .35)));
    // the lid: on the carved slit when it was measured (uFace[6], tilted by its rise outward, uFace[7]); its line thins
    // to nothing at both ends, so the outer corner does not flick up like eyeliner (#463)
    vec2 le = uFace[7].z > .5 ? (s == 0 ? uFace[6].xy : uFace[6].zw) : e;
    float rise = uFace[7].z > .5 ? (s == 0 ? uFace[7].x : uFace[7].y) : 0.;
    vec2 ql = q - vec2(0., rise * (q.x - le.x) * sign(le.x));
    // and, toward the outer corner, it is gone before the corner (#480 r7, the art director: a line on the edge, not a band)
    float outer = clamp((ql.x - le.x) * sign(le.x) / uFace[2].w, 0., 1.);
    float lt = uFace[3].x * (1. - .9 * pow(clamp(abs(ql.x - le.x) / uFace[2].w, 0., 1.), 2.)) * (1. - smoothstep(.45, .8, outer)); vec2 lc = le + vec2(0., uFace[5].x);
    // a half-open eye under the lid line (only drawn, the carving unchanged): a narrow lens of white, widest in the middle,
    // and a dark pupil in it, looking down at whoever stands below (#480, the art director's trial for r7)
    if (uFace[5].z > 0.) {
      float ex = (ql.x - le.x) / (uFace[2].w * .8), below = lc.y - ql.y, hw = uFace[5].z * (1. - ex * ex);
      // no white at the inner corner (seen level it read as a sidelong glance); the pupil a band about four tenths of the
      // slit's width, reaching from lid to lid, in the slit's middle (#480 r7, the art director)
      float white = step(abs(ex), 1.) * step(-.55, ex * sign(le.x)) * smoothstep(-aa, aa, below) * (1. - smoothstep(hw - aa, hw + aa, below));
      float pupil = white * (1. - smoothstep(.32 * uFace[2].w - aa, .32 * uFace[2].w + aa, abs(ql.x - le.x)));
      eyeW = max(eyeW, white); eyeP = max(eyeP, pupil);
    }
    ink.y = max(ink.y, 1. - smoothstep(lt - aa - soft, lt + aa + soft, arcDist(ql, lc, uFace[2].w, -uFace[3].y)));
    if (uFace[3].z > 0.) { vec2 d = q - lc; float ir = uFace[3].z; float half_ = d.y < 0. ? length(d) : 1e3;
      ink.y = max(ink.y, (1. - smoothstep(ir - aa, ir + aa, half_)) * .9); }
  }
  // the lines fade out where the surface turns away from the front: projected straight on, they would lie along the
  // temples as dark blades seen from the side (#480 r7, the 3 m side view)
  float face = smoothstep(.35, .65, n.z) * (1. - uFace[8].z); ink *= face; eyeW *= face; eyeP *= face;
  vec2 m = (q - uFace[1].xy) / vec2(uFace[3].w, uFace[4].x);
  float le = aa * 2. + .002 / max(uFace[4].x, .01);   // the lip's edge soft over about 2 mm (#463, the 3D review's third round)
  if (uFace[8].w > 0.) le = uFace[8].w;
  lip = 1. - smoothstep(1. - le, 1. + le, length(m));
  // the lip colour only on the surface of the lips that faces the eye: not on the underside of the upper lip nor on the walls of the
  // seam, whose darkness is the shading's own (issue #701, the art director's second round: the mouth was read as an open dark spot)
  lip *= uFace[8].w > 0. ? smoothstep(.2, .5, n.z) : smoothstep(.3, .6, n.z) * smoothstep(-.3, .0, n.y);
  // a pale layer along the seam between the lips, where their shading makes one dark line (issue #701): a thin band on the mouth's line,
  // across three quarters of the lips' width, only on what faces the eye; the fragment lifts the colour by uFace[8].y there
  seamW = uFace[8].y > 0. ? (1. - smoothstep(uFace[8].x * .5, uFace[8].x, abs(q.y - uFace[1].y))) * (1. - smoothstep(uFace[3].w * .7, uFace[3].w * .9, abs(q.x - uFace[1].x))) * smoothstep(.3, .6, n.z) : 0.;
  urna = 1. - smoothstep(uFace[4].y - aa, uFace[4].y + aa, length(q - uFace[1].zw));
  return ink;
}
`;

// Compile the recipe's zone expressions into GLSL; return the code, the number of leaves and how to fill their uniforms.
export function compileRecipe(recipe) {
  const leaves = [];   // { type, spec }
  function expr(node) {
    if (node.and) return "(" + node.and.map(expr).join(" * ") + ")";
    if (node.or) return node.or.map(expr).reduce((a, b) => `max(${a}, ${b})`);
    if (node.not) return "(1. - " + expr(node.not) + ")";
    const type = Object.keys(node).find((k) => ["ell", "cap", "box", "half", "band", "map"].includes(k));
    if (!type) throw new Error("paint: unknown shape " + JSON.stringify(node));
    const i = leaves.length; leaves.push({ type, spec: node[type] });
    const fn = { ell: "pEll", cap: "pCap", box: "pBox", half: "pHalf", band: "pBand", map: "pMap" }[type];
    return `${fn}(p, uL[${2 * i}], uL[${2 * i + 1}])`;
  }
  const zones = recipe.zones.map((z) => ({ ...z, glsl: expr(z.where) }));
  return { zones, leaves };
}

// Resolve "@name", "@name.x" and plain numbers or arrays against a figure's anchors; undefined if an anchor is missing.
function val(v, A) {
  if (typeof v === "string" && v[0] === "@") {
    const [name, comp] = v.slice(1).split("."); const a = A[name]; if (a === undefined) return undefined;
    return comp ? a["xyz".indexOf(comp)] : a;
  }
  if (Array.isArray(v)) { const r = v.map((x) => val(x, A)); return r.some((x) => x === undefined) ? undefined : r.flat(); }
  return v;
}
const add = (a, b) => a.map((x, i) => x + b[i]);
// each leaf as two vec4s: the first's w says whether the figure has what it needs
function leafUniforms(leaf, A) {
  const s = leaf.spec, off = val(s.offset ?? [0, 0, 0], A) || [0, 0, 0];
  const out = [0, 0, 0, 0, 0, 0, 0, 0];
  if (leaf.type === "ell") { const c = val(s.c, A), r = val(s.r, A); if (!c || !r) return out; const cc = add(c, off); return [...cc, 1, ...r, 0]; }
  if (leaf.type === "cap") { const a = val(s.a, A), b = val(s.b, A), r = val(s.r, A); if (!a || !b || r === undefined) return out; return [...add(a, off), 1, ...add(b, off), r]; }
  if (leaf.type === "box") { const mn = val(s.min, A), mx = val(s.max, A); if (!mn || !mx) return out; return [...mn, 1, ...mx, 0]; }
  if (leaf.type === "half") {   // through a point with a normal, or the plane through two points in the y–z plane, its normal upward
    if (s.through) { const a = val(s.through[0], A), b = val(s.through[1], A); if (!a || !b) return out;
      const dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dy, dz); let n = [0, -dz / l, dy / l]; if (n[1] < 0) n = n.map((x) => -x);
      return [...a, 1, ...n, 0]; }
    const p = val(s.p, A), n = val(s.n, A); if (!p || !n) return out; const l = Math.hypot(...n); return [...p, 1, ...n.map((x) => x / l), 0];
  }
  if (leaf.type === "band") { const y0 = val(s.y0, A), c = val(s.c ?? 0, A), h = val(s.h, A), w = val(s.w, A), z0 = val(s.z0 ?? -99, A);
    if ([y0, c, h, w, z0].some((x) => x === undefined)) return out; return [y0, c, h, 1, w, z0, 0, 0]; }
  if (leaf.type === "map") { const key = { front: "maskFront", back: "maskBack", right: "maskRight", hair: "maskHair" }[s.m]; const M = A[key]; if (!M || !M.rect) return out;
    // rect: x0, y0, x1, y1 of the picture (across: x from the front and back, z from the side); z: how far toward that
    // picture's eye a surface must lie to take it (front: z, back: -z, right side: -x)
    const [x0, y0, x1, y1] = M.rect, code = { front: 1, back: 2, right: 3, hair: 4 }[s.m];
    return [x0, y0, M.z ?? -99, 1, x1, y1, s.ch ?? 0, code + (M.depth ? 10 : 0)]; }
  return out;
}

function faceUniforms(face, A) {
  const out = new Array(40).fill(0);
  const L = A.eyeL, R = A.eyeR, M = A.lipAt ?? A.mouth, U = A.urna;   // `lipAt`: where the lips lie, when the mouth anchor was set on the chin pad below them (issue #701) if (!face || !L || !R || !M) return out;
  const e = Math.abs(L[0] - R[0]) / 2, k = (x) => x * e;
  out.splice(0, 4, L[0], L[1], R[0], R[1]);
  out.splice(4, 4, M[0], M[1], U ? U[0] : 0, U ? U[1] : -99);
  out.splice(8, 4, k(face.browUp), k(face.browHalf), k(face.browT), k(face.lidHalf));
  out.splice(12, 4, k(face.lidT), k(face.lidSag), k(face.iris), A.lipHalf ?? k(face.lipHalf));
  out.splice(16, 4, A.lipH ?? k(face.lipH), k(face.urna), (A.faceZ ?? A.eyeL[2]) - face.depth, 1);
  out.splice(20, 4, k(face.lidLift ?? 0), face.soft ?? 0, A.eyeOpen ? A.eyeOpen[0] : 0, A.eyeOpen ? A.eyeOpen[1] : 0);   // eyeOpen: a half-open eye drawn under the lid line (white's height, pupil's radius, metres; #480 the art director's trial)
  // the lids laid on the carved eye's slit where it was measured (lidL/lidR: x, y and the rise per metre outward,
  // tools/t05-statue/face-ratios.py; #463), else on the eye anchors as before
  out.splice(36, 4, ...(A.lipMul ?? [1, 1, 1]), 0);   // lipMul: the lip colour's red, green and blue multiplied on this figure (1, 1, 1 = as the recipe; less is darker, the blue less than the red is redder)
  out.splice(32, 4, A.seamH ?? 0, A.seamLift ?? 0, A.noInk ?? 0, A.lipSoft ?? 0);   // seamH: the half-height of a pale band on the lips' seam, seamLift: how much brighter it is (1 = twice); noInk: 1 draws no line on the face (brows, lids, the half-open eye); lipSoft: the lip colour laid over the whole lip surface with its edge feathered over that part of the ellipse; all only where a figure names them
  if (A.lidL && A.lidR) { out.splice(24, 4, A.lidL[0], A.lidL[1], A.lidR[0], A.lidR[1]); out.splice(28, 4, A.lidL[2] ?? 0, A.lidR[2] ?? 0, 1, 0); }
  return out;
}

const lin = (hex) => new THREE.Color(hex);   // sRGB hex → working (linear) colour, as three's own materials take it
const v3 = (c) => `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;

// One material for a figure: the recipe's shader (shared by every figure) with this figure's anchors in its uniforms.
// `pivot` is the figure's frame (an Object3D); the material reads its matrix each frame.
export function paintMaterial(recipe, anchors, pivot, opts = {}) {
  const { zones, leaves } = compileRecipe(recipe);
  const N = Math.max(1, leaves.length);
  const L = new Float32Array(N * 8); leaves.forEach((lf, i) => L.set(leafUniforms(lf, anchors), i * 8));
  const uL = []; for (let i = 0; i < N * 2; i++) uL.push(new THREE.Vector4().fromArray(L, i * 4));
  const F = faceUniforms(recipe.face, anchors), uFace = []; for (let i = 0; i < 10; i++) uFace.push(new THREE.Vector4().fromArray(F, i * 4));
  const base = recipe.base;
  const m = new THREE.MeshStandardMaterial({ color: base.color, roughness: base.rough, metalness: base.metal ?? 0 });
  const none = new THREE.DataTexture(new Uint8Array(4), 1, 1); none.needsUpdate = true;
  const U = { uToFig: { value: new THREE.Matrix4() }, uL: { value: uL }, uFace: { value: uFace }, uEdge: { value: recipe.edge ?? 0.02 },
    uMaskF: { value: opts.masks?.front ?? none }, uMaskB: { value: opts.masks?.back ?? none }, uMaskS: { value: opts.masks?.right ?? none }, uMaskH: { value: opts.masks?.hair ?? none }, uTint: { value: new THREE.Vector3(...(anchors.tint ?? [1, 1, 1])) }, uLotus: { value: opts.lotusGain ?? 1 }, uInner: { value: new THREE.Vector3(...(opts.innerTint ?? [1, 1, 1])) },
    uIdMode: { value: 0 }, uFig: { value: opts.fig ?? 0 } };
  m.userData.paint = { U, anchors, leaves: leaves.map((l, i) => ({ type: l.type, on: L[i * 8 + 3] > 0.5 })) };
  const zoneCode = zones.map((z, i) => {
    const c = lin(z.color);
    let col = v3(c);
    if (z.pattern === "flowers") { const c2 = lin(z.pattern2 ?? "#9A7A3E"); col = `mix(${v3(c)}, ${v3(c2)}, flowers(p.xy, ${(z.cell ?? 0.16).toFixed(3)}))`; }
    const metal = z.pattern === "flowers" ? `mix(${(z.metal ?? 0).toFixed(3)}, ${(z.metal2 ?? 0.6).toFixed(3)}, flowers(p.xy, ${(z.cell ?? 0.16).toFixed(3)}))` : (z.metal ?? 0).toFixed(3);
    const wear = (z.wear ? ` * (1. - ${z.wear.toFixed(3)} * vnoise(p.xy * 9.) )` : "") + (z.tint ? " * uTint" : "") + (z.gain === "lotus" ? " * uLotus" : z.gain === "inner" ? " * uInner" : "");
    // a zone may tint what stands out of it (the tips and rims of a lotus's petals, issue #463): toward `edgeTint.color`
    // by its amount where the surface is convex (cvEdge, below)
    if (z.edgeTint) col = `mix(${col}, ${v3(lin(z.edgeTint.color))}, ${(z.edgeTint.amount ?? 0.5).toFixed(3)} * cvEdge)`;
    // `folds: false` keeps a zone out of the fold shading (curls, the face: their small forms are lit triangle by
    // triangle by a curvature taken from screen-space derivatives, #463 round two)
    return `  { float k = ${z.glsl}; foldW = mix(foldW, ${z.folds === false ? "0." : "1."}, k); pCol = mix(pCol, ${col}${wear}, k); pRough = mix(pRough, ${(z.rough).toFixed(3)} + ${(z.roughJitter ?? 0).toFixed(3)} * (vnoise(p.xy * 23.) - .5), k); pMetal = mix(pMetal, ${metal}, k); zone = mix(zone, ${(i + 1).toFixed(1)}, step(.5, k)); }`;
  }).join("\n");
  const fo = recipe.folds ?? {}, fk0 = (fo.k0 ?? 3).toFixed(2), fk1 = (fo.k1 ?? 18).toFixed(2), fh = (fo.hollow ?? 0).toFixed(3), fe = (fo.edge ?? 0).toFixed(3);
  const fc = recipe.face, ink = lin(fc.ink), browC = lin(fc.browColor ?? fc.ink), lipC = lin(fc.lip), urnaC = lin(fc.urnaColor);
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nuniform mat4 uToFig;\nvarying vec3 vFig;\nvarying vec3 vFigN;")
      .replace("#include <project_vertex>", "#include <project_vertex>\n  vFig = (uToFig * modelMatrix * vec4(transformed, 1.)).xyz;\n  vFigN = normalize(mat3(uToFig * modelMatrix) * objectNormal);");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nuniform float uIdMode;\nuniform float uFig;\n" + GLSL.replace(/LEAVES/g, String(N * 2)))
      .replace("#include <color_fragment>", `#include <color_fragment>
  vec3 p = vFig; vec3 pCol = diffuseColor.rgb; float pRough = roughness; float pMetal = metalness; float zone = 0.;
  // how the surface bends here, from the change of its normal across the pixel against the change of its place: the
  // mean curvature in 1/m, more than zero where it stands out (a fold's ridge, a petal's rim) and less where it goes in
  // (a fold's hollow); a fold's ridge some 5–30 cm round reads 3–18 (issue #463: hollows darkened, ridges worn)
  vec3 cvN = normalize(vFigN), cvPx = dFdx(vFig), cvPy = dFdy(vFig);
  float cv = (dot(dFdx(cvN), cvPx) + dot(dFdy(cvN), cvPy)) / max(dot(cvPx, cvPx) + dot(cvPy, cvPy), 1e-10);
  float cvEdge = smoothstep(${fk0}, ${fk1}, cv), cvHollow = smoothstep(${fk0}, ${fk1}, -cv), foldW = 1.;
${zoneCode}
  float lip_, urna_; vec2 ink2 = faceInk(p, normalize(vFigN), lip_, urna_);
  float onFace = ${zones.findIndex((z) => z.name === recipe.face.zone) + 1}.0 == zone ? 1. : 0.;
  // the folds: their hollows darker, their ridges rubbed toward the dust's colour; not on the face, whose lines are drawn
  pCol *= 1. - ${fh} * cvHollow * foldW * (1. - onFace); pCol = mix(pCol, ${v3(lin(recipe.folds?.edgeColor ?? "#8A7A66"))}, ${fe} * cvEdge * foldW * (1. - onFace));
  pCol = mix(pCol, ${v3(lipC)} * uFace[9].xyz, lip_ * onFace);
  pCol *= 1. + uFace[8].y * seamW * onFace;   // the seam's pale layer
  pCol = mix(pCol, ${v3(lin(fc.eyeWhite ?? "#C9C0B0"))}, eyeW * onFace); pCol = mix(pCol, ${v3(lin(fc.pupil ?? "#2A221C"))}, eyeP * onFace); pRough = mix(pRough, ${fc.lipRough.toFixed(3)}, lip_ * onFace); pMetal = mix(pMetal, 0., lip_ * onFace);
  // the brow: the skin darkened, at most half covered; the lid: one line of the deep beam colour
  pCol = mix(pCol, ${v3(browC)}, ink2.x * onFace * ${(fc.browAlpha ?? 1).toFixed(3)}); pCol = mix(pCol, ${v3(ink)}, ink2.y * onFace);
  pRough = mix(pRough, ${fc.inkRough.toFixed(3)}, max(ink2.x, ink2.y) * onFace); pMetal = mix(pMetal, 0., max(ink2.x, ink2.y) * onFace);
  pCol = mix(pCol, ${v3(urnaC)}, urna_ * onFace); pMetal = mix(pMetal, .2, urna_ * onFace);
  // dust on what faces up (shoulders, forearms, knees, palms, the tops of the petals): a figure nine metres high and
  // nearly a thousand years old (#370 round 7); not on the face's lines
  pCol = mix(pCol, ${v3(lin(recipe.dust?.color ?? "#8A7A66"))}, ${(recipe.dust?.amount ?? 0).toFixed(3)} * smoothstep(.55, .95, normalize(vFigN).y) * (1. - max(ink2.x, ink2.y) * onFace) * (1. - onFace * uFace[8].z));   // a figure with no lines on its face (noInk) takes no dust on it either: the dust lifted every upward plane toward one colour and flattened the modelling
  diffuseColor.rgb = pCol;`)
      .replace("#include <roughnessmap_fragment>", "#include <roughnessmap_fragment>\n  roughnessFactor = clamp(pRough, .04, 1.);")
      .replace("#include <metalnessmap_fragment>", "#include <metalnessmap_fragment>\n  metalnessFactor = clamp(pMetal, 0., 1.);")
      // a picture of which zone each pixel is, for measuring the colours on screen zone by zone (stage.js zoneIds): red
      // the zone's number (the lips 14) over 16, green the figure's
      .replace("#include <dithering_fragment>", "#include <dithering_fragment>\n  if (uIdMode > .5) gl_FragColor = vec4(mix(zone, 14., step(.5, lip_ * onFace)) / 16., (uFig + 1.) / 16., 0., 1.);");
  };
  m.customProgramCacheKey = () => "t05paint:" + recipe.version + ":" + N + ":" + fh + ":" + fe + (recipe.debugKey ?? "");
  const upd = () => { pivot.updateMatrixWorld(true); U.uToFig.value.copy(pivot.matrixWorld).invert(); };
  upd(); m.userData.update = upd;
  // a normal map baked from the repaired full-detail surface (tools/t05-statue/bake.py, #463) is worn by the paint too
  if (opts.normalMap) { m.normalMap = opts.normalMap; m.normalScale.set(1, 1); }
  if (opts.envMap) { m.envMap = opts.envMap; m.envMapIntensity = opts.envIntensity ?? 1; }
  return m;
}
