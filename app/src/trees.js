// The trees. Cryptomerias, tall and dark, as old as the walls; and the two that keep the calendar: one flowers
// pale pink in spring and burns red in autumn, the other is a ginkgo that turns gold. Both stand bare under snow.
//
// A tree is a crooked trunk and three orders of branches, built as tapering tubes, and a crown of small flat
// sprays ("cards"), each drawn large and fine with the leaves of its kind. The cards do not light as the flat
// things they are: every one borrows its normal from the round crown it belongs to, so a tree shades as a mass,
// light on top and toward the sun, dark within. With the sun behind them the leaves glow.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { box, merge, mesh } from "./geo.js";
import { U } from "./glsl.js";
import { SUN_DIR } from "./sky.js";
import { TreeGenerator } from "./three-tree.js";

const seeded = (seed) => { let s = seed; return () => ((s = (s * 16807) % 2147483647) / 2147483647); };

// ---- The sheets: one for each thing a tree can wear. Drawn pale; the season lays its colour over them. ----
function sheet(kind) {
  const N = 1024, c = document.createElement("canvas"); c.width = c.height = N;
  const x = c.getContext("2d"), rnd = seeded(kind.length * 977 + kind.charCodeAt(0) * 31);
  x.lineCap = "round"; x.lineJoin = "round";
  // A leaf's own tone: mostly its lightness, and a little of its hue, so that an autumn crown is not one red.
  const tone = (lo = 150) => { const v = lo + rnd() * (255 - lo), g = 0.78 + rnd() * 0.22, b = 0.8 + rnd() * 0.2; return `rgb(${v | 0},${(v * g) | 0},${(v * b) | 0})`; };
  const at = (px, py, rot, draw) => { x.save(); x.translate(px, py); x.rotate(rot); draw(); x.restore(); };

  const maple = (r) => {   // seven narrow lobes from the stalk
    const A = [-112, -72, -36, 0, 36, 72, 112].map((d) => (d * Math.PI) / 180), L = [0.5, 0.8, 0.95, 1, 0.95, 0.8, 0.5];
    x.fillStyle = tone(); x.beginPath(); x.moveTo(0, r * 0.12);
    A.forEach((a, i) => {
      const l = L[i] * r;
      x.lineTo(Math.sin(a - 0.31) * r * 0.3, -Math.cos(a - 0.31) * r * 0.3); x.lineTo(Math.sin(a - 0.11) * l * 0.62, -Math.cos(a - 0.11) * l * 0.62);
      x.lineTo(Math.sin(a) * l, -Math.cos(a) * l); x.lineTo(Math.sin(a + 0.11) * l * 0.62, -Math.cos(a + 0.11) * l * 0.62);
    });
    x.lineTo(Math.sin(A[6] + 0.31) * r * 0.3, -Math.cos(A[6] + 0.31) * r * 0.3); x.closePath(); x.fill();
    x.strokeStyle = "rgba(70,60,52,.5)"; x.lineWidth = Math.max(1, r * 0.035);
    A.forEach((a, i) => { x.beginPath(); x.moveTo(0, r * 0.06); x.lineTo(Math.sin(a) * L[i] * r * 0.85, -Math.cos(a) * L[i] * r * 0.85); x.stroke(); });
    x.beginPath(); x.moveTo(0, r * 0.1); x.lineTo(0, r * 0.5); x.stroke();
  };
  const ginkgo = (r) => {   // a fan with a notch, on a thin stalk
    x.fillStyle = tone(); x.beginPath(); x.moveTo(0, r * 0.3);
    for (let i = 0; i <= 18; i++) { const t = i / 18, a = ((-62 + 124 * t) * Math.PI) / 180, k = 1.25 * (1 - 0.32 * Math.exp(-Math.pow((t - 0.5) / 0.045, 2)) + 0.025 * Math.sin(t * 43)); x.lineTo(Math.sin(a) * r * k, r * 0.3 - Math.cos(a) * r * k); }
    x.closePath(); x.fill();
    x.strokeStyle = "rgba(70,62,50,.32)"; x.lineWidth = 1;
    for (let p = -6; p <= 6; p++) { const a = p * 0.165; x.beginPath(); x.moveTo(0, r * 0.3); x.lineTo(Math.sin(a) * r * 1.15, r * 0.3 - Math.cos(a) * r * 1.15); x.stroke(); }
    x.strokeStyle = "rgba(80,70,56,.8)"; x.lineWidth = Math.max(1.2, r * 0.05); x.beginPath(); x.moveTo(0, r * 0.3); x.lineTo(r * 0.06, r * 0.95); x.stroke();
  };
  const blossom = (r) => {   // five petals, each notched, round a darker heart
    for (let p = 0; p < 5; p++) {
      x.rotate(6.283 / 5); const g = x.createRadialGradient(0, -r * 0.2, 0, 0, -r * 0.6, r * 0.75), v = 225 + rnd() * 30;
      g.addColorStop(0, `rgb(${v - 40},${(v - 75) | 0},${(v - 60) | 0})`); g.addColorStop(1, `rgb(${v | 0},${(v * 0.94) | 0},${(v * 0.95) | 0})`); x.fillStyle = g;
      x.beginPath(); x.moveTo(0, 0); x.bezierCurveTo(-r * 0.62, -r * 0.3, -r * 0.5, -r * 1.05, -r * 0.06, -r * 0.92); x.lineTo(0, -r * 0.8); x.lineTo(r * 0.06, -r * 0.92); x.bezierCurveTo(r * 0.5, -r * 1.05, r * 0.62, -r * 0.3, 0, 0); x.fill();
    }
    x.fillStyle = "rgb(150,96,104)"; x.beginPath(); x.arc(0, 0, r * 0.14, 0, 6.3); x.fill();
    x.strokeStyle = "rgba(170,120,110,.8)"; x.lineWidth = 1; for (let p = 0; p < 9; p++) { const a = rnd() * 6.283; x.beginPath(); x.moveTo(0, 0); x.lineTo(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4); x.stroke(); }
  };

  if (kind === "cedar") {
    // Ropes of short curved needles hanging from boughs that sweep out and down from the top of the sheet.
    const rope = (px, py, a, len, w) => {
      for (let d = 0; d < len; d += 4.5) {
        a += (rnd() - 0.5) * 0.05 + 0.0014 * Math.sign(Math.sin(a)) * -1; px += Math.sin(a) * 4.5; py += Math.cos(a) * 4.5;
        const t = d / len, nl = w * (1 - t * 0.55) * (0.75 + rnd() * 0.5), v = 110 + rnd() * 90 + t * 55;
        x.strokeStyle = `rgb(${(v * 0.92) | 0},${v | 0},${(v * 0.86) | 0})`; x.lineWidth = 3.4;
        for (const s of [-1, 1]) { x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + Math.sin(a + s * 0.5) * nl * 0.6, py + Math.cos(a + s * 0.5) * nl * 0.6, px + Math.sin(a + s * 0.85) * nl, py + Math.cos(a + s * 0.85) * nl + nl * 0.25); x.stroke(); }
      }
      return [px, py, a];
    };
    for (let k = 0; k < 11; k++) {
      const a0 = (k / 10 - 0.5) * 2.2 + (rnd() - 0.5) * 0.12; let px = N / 2 + (rnd() - 0.5) * 60, py = 14, a = a0;
      x.strokeStyle = "rgb(96,80,66)"; x.lineWidth = 5;
      for (let seg = 0; seg < 7; seg++) {
        const from = [px, py]; [px, py, a] = rope(px, py, a, 120 + rnd() * 30, 19); a = a * 0.86;   // the bough turns to hang
        for (const s of [-1, 1]) if (rnd() < 0.85) rope(from[0], from[1], a + s * (0.5 + rnd() * 0.5), 150 + rnd() * 160, 15);
      }
    }
  } else if (kind === "twig") {
    // Bare twigs, forking three times: what is left in winter.
    const fork = (px, py, a, len, w, depth) => {
      const n = 5; x.strokeStyle = `rgb(${200 + rnd() * 40},${196 + rnd() * 40},${190 + rnd() * 40})`;
      for (let i = 0; i < n; i++) { const qx = px + Math.cos(a) * len / n, qy = py + Math.sin(a) * len / n; x.lineWidth = Math.max(1.1, w * (1 - (i / n) * 0.4)); x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke(); px = qx; py = qy; a += (rnd() - 0.5) * 0.34;
        if (depth && i > 0 && rnd() < 0.75) fork(px, py, a + (rnd() < 0.5 ? -1 : 1) * (0.45 + rnd() * 0.5), len * (0.5 + rnd() * 0.25), w * 0.6, depth - 1); }
      if (depth) for (const s of [-1, 1]) fork(px, py, a + s * (0.3 + rnd() * 0.3), len * 0.55, w * 0.6, depth - 1);
    };
    for (let k = 0; k < 7; k++) fork(N / 2, N / 2, (k / 7) * 6.283 + rnd() * 0.5, 250 + rnd() * 90, 7, 3);
  } else {
    const leaf = kind === "maple" ? maple : kind === "ginkgo" ? ginkgo : blossom, size = kind === "blossom" ? 17 : kind === "maple" ? 25 : 21;
    // A spray seen from its side: twigs running out from the middle, leaves along them and thick between them.
    const twigs = [];
    for (let k = 0; k < 9; k++) {
      let a = (k / 9) * 6.283 + rnd() * 0.5, px = N / 2, py = N / 2; x.strokeStyle = "rgb(104,88,74)";
      for (let i = 0; i < 9; i++) { const qx = px + Math.cos(a) * 50, qy = py + Math.sin(a) * 50; x.lineWidth = 4.5 - i * 0.42; x.beginPath(); x.moveTo(px, py); x.lineTo(qx, qy); x.stroke(); px = qx; py = qy; a += (rnd() - 0.5) * 0.5; twigs.push([px, py, a]); }
    }
    const spots = [];
    for (const [px, py, a] of twigs) for (let j = 0; j < (kind === "blossom" ? 8 : 7); j++) spots.push([px + (rnd() - 0.5) * 70, py + (rnd() - 0.5) * 70, a + (rnd() < 0.5 ? -1 : 1) * (0.5 + rnd() * 0.9) + Math.PI / 2]);
    for (let i = 0; i < (kind === "blossom" ? 330 : 240); i++) { const rr = Math.pow(rnd(), 0.75) * 470, aa = rnd() * 6.283; spots.push([N / 2 + Math.cos(aa) * rr, N / 2 + Math.sin(aa) * rr, rnd() * 6.283]); }
    for (let i = spots.length - 1; i > 0; i--) { const j = (rnd() * (i + 1)) | 0; [spots[i], spots[j]] = [spots[j], spots[i]]; }
    for (const [px, py, rot] of spots) if (Math.hypot(px - N / 2, py - N / 2) < 488) at(px, py, rot, () => leaf(size * (0.72 + rnd() * 0.56)));
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.premultiplyAlpha = false; return t;
}

// The colour each crown wears, season by season (null: bare).
const COLOURS = {
  maple:  { spring: [0.94, 0.92, 0.86], summer: [0.2, 0.36, 0.13], autumn: [0.62, 0.13, 0.055], winter: null },
  ginkgo: { spring: [0.42, 0.6, 0.22], summer: [0.34, 0.5, 0.17], autumn: [0.8, 0.56, 0.1], winter: null },
  cedar:  { spring: [0.075, 0.15, 0.08], summer: [0.06, 0.125, 0.075], autumn: [0.07, 0.125, 0.065], winter: [0.065, 0.12, 0.08] },
};

// A crown material: cards that take their light as parts of one round mass, let the low sun through, hold snow,
// keep their leaves at a distance (a sheet's thin places would otherwise vanish), and stir in the air.
// `skyThru`: how much of the sky's own light a thin leaf lets through to the side the eye is on, as a share of what the sky
// gives a face turned up to it (uAmb, set by the hour). It follows the sky, so a grove under an overcast noon glows a fresh green
// and the same leaves at night do not. 0 (every crown but the bamboo's) changes nothing.
export function crownMaterial(map, { a2c, sway = 0.035, snow = 0.9, glow = 0, skyThru = 0 }) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, envMapIntensity: 0.25, vertexColors: true, alphaToCoverage: !!a2c });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uSnow: U.uSnow, uSunC: U.uSunC, uAmb: U.uAmb, uT: U.uT, uSunDir: { value: SUN_DIR } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uT; varying float vUp;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vUp=normalize(mat3(modelMatrix)*objectNormal).y;
        transformed.x+=sin(uT*1.1+position.x*.7+position.y*.5)*${sway.toFixed(3)}; transformed.z+=cos(uT*.83+position.z*.6+position.y*.4)*${sway.toFixed(3)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSnow; uniform vec3 uSunC, uSunDir, uAmb; varying float vUp;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        { vec2 tx=vMapUv*1024.; float lod=max(0.,.5*log2(max(dot(dFdx(tx),dFdx(tx)),dot(dFdy(tx),dFdy(tx))))); diffuseColor.a*=1.+lod*.32; }
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.88,.94),uSnow*smoothstep(.15,.7,vUp)*${snow.toFixed(2)});`)
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n normal=normalize(vNormal);")   // both faces of a card take the crown's light the same way
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        { vec3 Lv=normalize((viewMatrix*vec4(uSunDir,0.)).xyz); float thru=pow(max(dot(normalize(vViewPosition),-Lv),0.),2.5);
          totalEmissiveRadiance+=diffuseColor.rgb*uSunC*vec3(1.,1.,.45)*thru*1.6*(1.-uSnow*.7);
          totalEmissiveRadiance+=diffuseColor.rgb*${glow.toFixed(2)}*(1.-uSnow*.7);${skyThru ? `
          totalEmissiveRadiance+=diffuseColor.rgb*uAmb*${skyThru.toFixed(2)}*(1.-uSnow*.7);` : ""} }`);   // (glow: a thin leaf lets some light through even with the sun in front)
  };
  m.customProgramCacheKey = () => "crown" + sway + snow + (glow ? "g" + glow : "") + (skyThru ? "t" + skyThru : "") + (a2c ? "c" : "");
  return m;
}

// A tapering tube through `pts`, smoothed. `rad(t)` says how thick it is along the curve (a number for r0 and r1
// tapers it evenly). `flare` swells it where it starts: into roots where a trunk meets the ground, into a collar
// where a branch leaves its parent, dying away over `flareLen` metres. Its far end is closed with a point.
// A trunk standing on a foot starts at `startY`, the foot's top ring, and not below it: its first ring is laid level and
// turned as the ring above it is, so the two rings share their corners with the foot's and nothing of the trunk shows.
// A branch begins inside its parent (`cap` keeps its first ring within the parent's wood) and its collar swells where it
// comes out through the parent's surface, `flareAt` metres along it, tapering away outside over `flareLen` and dying
// faster back inside, so the swelling lies on the parent's bark and not on a lip of its own (#200).
function limb(pts, rad, r1, radial = 7, flare = 0, flareLen = 0.4, seg = 3, startY = null, flareAt = 0, cap = Infinity, tipLen = 1.5) {
  if (typeof rad === "number") { const r0 = rad; rad = (t) => r0 + (r1 - r0) * t; }
  const curve = new THREE.CatmullRomCurve3(pts), len = curve.getLength(), pos = [], nor = [], uv = [], idx = [];
  // the rings crowd towards the start where it swells, so that a collar is round and not faceted
  let t0 = 0; if (startY !== null) { const P0 = new THREE.Vector3(), want = Math.max(curve.getPoint(0).y, startY); let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; curve.getPoint(mid, P0); if (P0.y < want) lo = mid; else hi = mid; } t0 = lo; }
  let n = Math.max(2, (pts.length - 1) * seg + (flare && !flareAt ? (seg > 2 ? 3 : 1) : 0)), at = (i) => t0 + (1 - t0) * (flare ? Math.pow(i / n, 1.6) : i / n);
  if (flareAt && radial >= 6) {   // (rings gathered round where it comes out, so the collar is round; a twig too thin to show it goes without)
    const ts = new Set(); for (let i = 0; i <= n; i++) ts.add(i / n);
    for (const d of [0, 0.5, 1.3]) { const t = (flareAt + d * flareLen) / len; if (t > 0.02 && t < 0.98) ts.add(t); }
    const list = [...ts].sort((p, q) => p - q).filter((t, i, a) => i === 0 || t - a[i - 1] > 0.012); n = list.length - 1; at = (i) => list[i];
  }
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), ref = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = at(i); curve.getPoint(t, P); curve.getTangent(t, T);
    // each ring turned as little as it can from the last (a frame carried along the curve), so a limb that leans past
    // the upright does not twist like a wrung cloth where a fixed reference would have flipped
    if (i === 0 && startY !== null) Nn.set(0, 0, -1);   // level, and turned as the next ring is, its corners on the foot's
    else if (i === 0) { ref.set(Math.abs(T.y) > 0.9 ? 1 : 0, Math.abs(T.y) > 0.9 ? 0 : 1, 0); Nn.crossVectors(T, ref).normalize(); }
    else { Nn.addScaledVector(T, -Nn.dot(T)); if (Nn.lengthSq() < 1e-8) { ref.set(1, 0, 0); Nn.crossVectors(T, ref); } Nn.normalize(); }
    if (i === 0 && startY !== null) B.set(-1, 0, 0); else B.crossVectors(T, Nn);
    const d = t * len - flareAt, r = Math.min(i === 0 ? cap : Infinity, rad(t) * (1 + (flareAt ? flare * (d >= 0 ? Math.exp(-d / flareLen) : Math.exp(d / (0.4 * flareLen))) : flare * Math.exp(-(t * len) / flareLen) * (1 + 0.18 * Math.sin(i * 1.7)))));
    for (let k = 0; k <= radial; k++) { const a = (k / radial) * 6.283, cx = Math.cos(a), sx = Math.sin(a); nor.push(Nn.x * cx + B.x * sx, Nn.y * cx + B.y * sx, Nn.z * cx + B.z * sx); pos.push(P.x + (Nn.x * cx + B.x * sx) * r, P.y + (Nn.y * cx + B.y * sx) * r, P.z + (Nn.z * cx + B.z * sx) * r); uv.push(k / radial, t); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < radial; k++) { const a = i * (radial + 1) + k, b = a + radial + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }   // (wound to face outward: from outside each face is a front face, as the foot's are)
  // the tip: a short point beyond the last ring, so no limb ends as an open pipe (on a limb that forks, a low dome
  // hidden inside the collars of the limbs that leave it, not a point standing up between them)
  const tip = pos.length / 3; curve.getTangent(1, T); curve.getPoint(1, P).addScaledVector(T, rad(1) * tipLen); pos.push(P.x, P.y, P.z); nor.push(T.x, T.y, T.z); uv.push(0.5, 1);
  for (let k = 0; k < radial; k++) { const a = n * (radial + 1) + k; idx.push(a, a + 1, tip); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return { geo: g, curve, rad };
}

// Where a trunk meets the ground. A tube ending at the paving looks sawn off, so each tree stands on a foot of its
// own: the bole swelling as it comes down and dividing into five or six root-spurs that run out and under, drawn in
// level rings (so nothing is lifted clear of the ground) and carried well below it. `trunk(h)` says where the trunk is,
// and how thick, at `h` above the ground: every ring is centred on it and never thinner than it, so that at `top`,
// where the swelling begins, the foot's ring is the trunk's own and the tree is one piece. `R` is the trunk's number of
// sides, so that the two rings meet corner to corner. The bark's grain runs on down it.
// The spurs are broad lobes, not the points of a star, and low (#92: in winter, standing on the snow, the old ones read as a
// star cut out of card with a bright edge of snow on each point).
function foot(y, trunk, top, seed, R = 24) {
  const rings = 12, pos = [], nor = [], uv = [], idx = [], spurs = 5 + (seed % 2), turn = seed * 1.3;
  const at = (i, k) => { const t = i / rings, h = top * (1 - t) - 0.35 * t * t * 3, a = (k / R) * 6.283, swell = Math.max(0, Math.exp(-Math.max(0, h) / (top * 0.3)) - Math.exp(-1 / 0.3)) * (1 - t < 0.08 ? (1 - t) / 0.08 : 1);   // nothing at its top: it leaves the trunk without a collar
    const spur = Math.pow(0.5 + 0.5 * Math.cos(a * spurs + turn + Math.sin(a * 2 + seed) * 0.5), 1.0), c = trunk(h), rr = c.r * (1 + 0.55 * swell + 0.6 * swell * swell * spur) + (h < 0 ? -h * 0.5 : 0);
    return [c.x + Math.cos(a) * rr, y + h, c.z + Math.sin(a) * rr]; };
  for (let i = 0; i <= rings; i++) for (let k = 0; k <= R; k++) { const p = at(i, k), q = at(i, k + 0.25), e = i < rings ? 0.25 : -0.25, d0 = at(i + e, k), d = i < rings ? d0 : [2 * p[0] - d0[0], 2 * p[1] - d0[1], 2 * p[2] - d0[2]];   // the lowest ring looks back up the foot for its slope: a normal of no length would shade as not-a-number
    const ax = q[0] - p[0], ay = q[1] - p[1], az = q[2] - p[2], bx = d[0] - p[0], by = d[1] - p[1], bz = d[2] - p[2], nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx, l = Math.hypot(nx, ny, nz) || 1;
    // facing out of the wood; at its top, where it is the trunk, the trunk's own normal, so the light runs on unbroken
    let ox = nx / l, oy = ny / l, oz = nz / l; const blend = i === 0 ? 1 : i === 1 ? 0.5 : 0;
    if (blend) { const hh = top * (1 - i / rings), c = trunk(hh), up = trunk(hh + 0.05), dn = trunk(hh - 0.05), tx = up.x - dn.x, tz = up.z - dn.z, tl = Math.hypot(tx, 0.1, tz), Tx = tx / tl, Ty = 0.1 / tl, Tz = tz / tl;
      let rx = p[0] - c.x, rz = p[2] - c.z; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl; const d = rx * Tx + rz * Tz, wx = rx - Tx * d, wy = -Ty * d, wz = rz - Tz * d, wl = Math.hypot(wx, wy, wz) || 1;
      ox = ox * (1 - blend) + (wx / wl) * blend; oy = oy * (1 - blend) + (wy / wl) * blend; oz = oz * (1 - blend) + (wz / wl) * blend; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol; }
    else {   // lower down, leaned a little out from the trunk, so the flanks of a root-spur shade softly rather than turning edge-on
      const c = trunk(top * (1 - i / rings)); let rx = p[0] - c.x, rz = p[2] - c.z; const rl = Math.hypot(rx, rz) || 1; ox += (0.45 * rx) / rl; oz += (0.45 * rz) / rl; const ol = Math.hypot(ox, oy, oz) || 1; ox /= ol; oy /= ol; oz /= ol; }
    pos.push(...p); nor.push(ox, oy, oz); uv.push(k / R, -1 - Math.max(0, p[1] - y)); }   // (the bark is grained from the world; its v says how far above the paving it is, below -1 so no limb is taken for it, for the snow drifted against it)
  for (let i = 0; i < rings; i++) for (let k = 0; k < R; k++) { const a = i * (R + 1) + k, b = a + R + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// The bed it grows in: a round of dark earth standing a finger above the paving, uneven at its edge, heaped a little against the roots.
function bed(x, y, z, r, seed) {
  const R = 48, pos = [x, y + 0.07, z], idx = [];
  for (const [f, lift] of [[0.62, 0.05], [0.93, 0.02], [1, 0.012]]) for (let k = 0; k < R; k++) { const a = (k / R) * 6.283, rr = r * f * (1 + 0.07 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7 + seed * 2)); pos.push(x + Math.cos(a) * rr, y + lift, z + Math.sin(a) * rr); }
  for (let k = 0; k < R; k++) { const n = (k + 1) % R; idx.push(0, 1 + n, 1 + k, 1 + k, 1 + n, 1 + R + k, 1 + n, 1 + R + n, 1 + R + k, 1 + R + k, 1 + R + n, 1 + 2 * R + k, 1 + R + n, 1 + 2 * R + n, 1 + 2 * R + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// The fallen leaves under a ginkgo: a round patch of the season's leaf colour (the material's colour is set by the mood) laid
// a finger over the paving, thickest at the trunk and fading to nothing at its edge (the alpha in each vertex's colour), so
// that no hard line shows where it ends.
function softBed(x, y, z, r, seed, h = 0.02, step = 0.004) {
  const R = 36, rings = [[0, 0.5], [0.35, 0.46], [0.65, 0.26], [0.85, 0.09], [1, 0]], pos = [x, y + h, z], col = [1, 1, 1, rings[0][1]], idx = [];
  for (let i = 1; i < rings.length; i++) for (let k = 0; k < R; k++) { const a = (k / R) * 6.283, rr = r * rings[i][0] * (1 + 0.1 * Math.sin(a * 3 + seed) + 0.07 * Math.sin(a * 7 + seed * 2)); pos.push(x + Math.cos(a) * rr, y + h - step * i, z + Math.sin(a) * rr); col.push(1, 1, 1, rings[i][1]); }
  for (let k = 0; k < R; k++) { const n = (k + 1) % R; idx.push(0, 1 + n, 1 + k); }
  for (let i = 1; i < rings.length - 1; i++) for (let k = 0; k < R; k++) { const n = (k + 1) % R, a = 1 + (i - 1) * R, b = 1 + i * R; idx.push(a + k, a + n, b + k, a + n, b + n, b + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, 0, 1, 0);
  return g;
}

// The stone pit a ginkgo stands in (#611): the edge stones of a square pit let into the paving, as courtyard trees of the
// Chinese temples stand, so the stone never runs up to the bark. Edge stones are PIT.rim wide and stand PIT.up over the
// paving (sunk PIT.sink into it); the soil inside lies PIT.drop under their tops. `side` is the pit's inside width.
export const PIT = Object.freeze({ rim: 0.15, up: 0.065, sink: 0.1, drop: 0.045, min: 1.6, times: 2.5, block: 0.93 });
/** Inside width of the pit for a tree whose roots spread `flare` m from the trunk at the paving: 2.5 times their diameter, in whole stone-block lengths (`PIT.block`, a block of three chi in the Yingzao Fashi's juan 3, by analogy and not from a source), at least two of them (1.86 m). */
export const pitSide = (flare) => PIT.block * Math.max(2, Math.ceil((PIT.times * 2 * flare) / PIT.block - 1e-9));
function pitStones(x, y, z, side) {
  const w = PIT.rim, h = PIT.up + PIT.sink, cy = y + PIT.up - h / 2, half = side / 2 + w / 2, long = side + 2 * w;
  return [box(long, h, w, x, cy, z - half), box(long, h, w, x, cy, z + half), box(w, h, side, x - half, cy, z), box(w, h, side, x + half, cy, z)];
}
// The snow lying on the edge stones: a cap a little wider than each stone and a finger thick, drawn only while snow lies (the
// stone's own snow reads thin on so low and narrow a top, and showed as a dark line round the white).
function pitSnow(x, y, z, side) {
  const w = PIT.rim + 0.04, h = 0.035, cy = y + PIT.up + h / 2 - 0.005, half = side / 2 + PIT.rim / 2, long = side + 2 * PIT.rim + 0.04;
  return [box(long, h, w, x, cy, z - half), box(long, h, w, x, cy, z + half), box(w, h, side, x - half, cy, z), box(w, h, side, x + half, cy, z),
    new THREE.PlaneGeometry(side, side).rotateX(-Math.PI / 2).translate(x, y + PIT.up - PIT.drop + 0.03, z)];   // (and the floor: snow over the gravel, which showed as black dots through the paving's snow)
}
function pitSoil(x, y, z, side) {
  const g = new THREE.PlaneGeometry(side + 0.02, side + 0.02).rotateX(-Math.PI / 2).translate(x, y + PIT.up - PIT.drop, z);
  return g;
}
// A soft patch of moss: a round laid a finger over the paving, `rgb` its colour, fully there from the middle out to
// `hold` of its radius, then fading to nothing at the edge (the alpha in each vertex's colour): a seam that never ends
// in a line (#611). A ring of vertices every `rings` fraction of the radius, wandering a little at its edge.
function mossPatch(x, y, z, r, hold, seed, rgb, a0 = 0.85, lift = 0.016, R = 36) {
  const rings = [0, hold, hold + (1 - hold) * 0.45, hold + (1 - hold) * 0.8, 1], alpha = [a0, a0, a0 * 0.55, a0 * 0.18, 0], pos = [x, y + lift, z], col = [...rgb, alpha[0]], idx = [];
  for (let i = 1; i < rings.length; i++) for (let k = 0; k < R; k++) { const a = (k / R) * 6.283, rr = r * rings[i] * (1 + 0.06 * Math.sin(a * 3 + seed) + 0.04 * Math.sin(a * 7 + seed * 2)); pos.push(x + Math.cos(a) * rr, y + lift - 0.001 * i, z + Math.sin(a) * rr); col.push(...rgb, alpha[i]); }
  for (let k = 0; k < R; k++) { const n = (k + 1) % R; idx.push(0, 1 + n, 1 + k); }
  for (let i = 1; i < rings.length - 1; i++) for (let k = 0; k < R; k++) { const n = (k + 1) % R, a = 1 + (i - 1) * R, b = 1 + i * R; idx.push(a + k, a + n, b + k, a + n, b + n, b + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, 0, 1, 0);
  return g;
}
/** How far past its earth a cedar's moss fades out to the paving, in metres (#611: at least 0.3). */
export const MOSS_FADE = 0.45;
const MOSS = [0.08, 0.105, 0.062];
// The moss between a cedar's earth and the paving: patches of it round the earth's edge, one every 1.4 m of the ring, so that the
// paving shows between them (#621: a continuous ring read as a felt, L* 16-20 and 0.25 saturated against the paving's 30-37 and 0.10),
// each fading out over MOSS_FADE beyond its solid middle.
const CEDAR_MOSS = [0.125, 0.135, 0.105];
function edgeMoss(x, y, z, r, seed) {
  const n = Math.max(4, Math.ceil((2 * Math.PI * r) / 1.4)), out = [], size = 0.5;
  for (let k = 0; k < n; k++) {
    const a = ((k + 0.35 * hash1(seed, 300 + k)) / n) * 6.283, d = r - 0.05 + 0.12 * (hash1(seed, 400 + k) - 0.5), t = hash1(seed, 500 + k);
    out.push(mossPatch(x + Math.cos(a) * d, y, z + Math.sin(a) * d, size * (0.8 + 0.4 * hash1(seed, 600 + k)), 0.25, seed + k, [CEDAR_MOSS[0] * (0.85 + 0.35 * t), CEDAR_MOSS[1] * (0.9 + 0.25 * t), CEDAR_MOSS[2] * (0.9 + 0.2 * t)], 0.5, 0.019 + 0.0004 * k, 12));
  }
  return out;
}

// What lies in a pit besides soil (#611, the 3D review): gravel (small flat stones of the court's own stone, laid with the
// edge stones in the static stone batch), moss in patches and a dark line where the soil meets the edge stones. All of it
// is drawn from a hash of the tree's number, never from the wood's stream of chance, so that no tree's shape depends on it.
const hash1 = (n, k) => { const v = Math.sin(n * 127.1 + k * 311.7) * 43758.5453; return v - Math.floor(v); };
function pitGravel(x, y, z, side, flare, seed, count = 48) {
  const out = [], inner = side / 2 - 0.05, base = y + PIT.up - PIT.drop;
  for (let i = 0, k = 0; i < count && k < count * 6; k++) {
    const px = (hash1(seed, k * 3) * 2 - 1) * inner, pz = (hash1(seed, k * 3 + 1) * 2 - 1) * inner;
    if (Math.hypot(px, pz) < flare * 1.15 + 0.05) continue;
    const r = 0.014 + 0.022 * hash1(seed, k * 3 + 2), g = new THREE.OctahedronGeometry(1, 0).scale(r, r * 0.5, r * (0.8 + 0.5 * hash1(seed, k * 7))).rotateY(hash1(seed, k * 5) * 6.283).translate(x + px, base + r * 0.2, z + pz);
    out.push(g); i++;
  }
  return out;
}
function pitMossPatches(x, y, z, side, flare, seed, count = 7) {
  const out = [], inner = side / 2 - 0.2, lift = PIT.up - PIT.drop + 0.014;
  for (let k = 0; k < count; k++) {
    const px = (hash1(seed, 100 + k * 3) * 2 - 1) * inner, pz = (hash1(seed, 101 + k * 3) * 2 - 1) * inner, r = 0.14 + 0.16 * hash1(seed, 102 + k * 3);
    if (Math.hypot(px, pz) < flare * 1.2) continue;
    const t = hash1(seed, 200 + k); out.push(mossPatch(x + px, y, z + pz, r, 0.4, seed + k, [MOSS[0] * (0.85 + 0.4 * t), MOSS[1] * (0.9 + 0.3 * t), MOSS[2] * (0.9 + 0.2 * t)], 0.7, lift + 0.0005 * k, 12));
  }
  return out;
}
// A neutral dust over the pit's soil, thinning towards the edges: the litter's own green and the moss together read more
// saturated than the court's stone by far (#611: 0.33 against 0.1), and a pit of old soil is grey-brown.
function pitDust(x, y, z, side) {
  const h = side / 2 - 0.02, yy = y + PIT.up - PIT.drop + 0.009, pos = [x - h, yy, z - h, x + h, yy, z - h, x + h, yy, z + h, x - h, yy, z + h], col = [];
  for (let i = 0; i < 4; i++) col.push(0.11, 0.1, 0.09, 0.6);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex([0, 2, 1, 0, 3, 2]); g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, 0, 1, 0);
  return g;
}
// A dark line, two centimetres wide, along the inside of the four edge stones: where soil meets stone the ground is shaded.
function pitContact(x, y, z, side) {
  const w = 0.025, h = side / 2, yy = y + PIT.up - PIT.drop + 0.003, pos = [], col = [], idx = [];
  const quad = (x0, z0, x1, z1) => { const b = pos.length / 3; pos.push(x0, yy, z0, x1, yy, z0, x1, yy, z1, x0, yy, z1); for (let i = 0; i < 4; i++) col.push(0.025, 0.02, 0.015, 0.8); idx.push(b, b + 2, b + 1, b, b + 3, b + 2); };
  quad(x - h, z - h, x + h, z - h + w); quad(x - h, z + h - w, x + h, z + h); quad(x - h, z - h + w, x - h + w, z + h - w); quad(x + h - w, z - h + w, x + h, z + h - w);
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx); g.computeVertexNormals();
  const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, 0, 1, 0);
  return g;
}

// A low heap of earth round the trunk where it goes into the pit's soil (#611, the 3D review: the trunk stood in the flat
// soil like a post set in, its clean round section meeting the plane): from inside the wood out to a hand's breadth beyond
// it, `height` thick at the trunk, wandering a little in outline.
function pitMound(x, y, z, r, seed, height = 0.034, reach = 0.06, shade = false) {
  const R = 28, base = y + PIT.up - PIT.drop, pos = [], uv = [], idx = [];
  for (const [rr, h] of [[r * 0.82, height], [r + reach * 0.35, height * 0.7], [r + reach, 0]]) for (let k = 0; k < R; k++) {
    const a = (k / R) * 6.283, w = 1 + 0.12 * Math.sin(a * 3 + seed) + 0.08 * Math.sin(a * 7 + seed * 2), d = rr === r * 0.82 ? rr : rr * w;
    pos.push(x + Math.cos(a) * d, base + h * (rr === r + reach ? 0 : w), z + Math.sin(a) * d); uv.push(k / R, h);
  }
  for (let i = 0; i < 2; i++) for (let k = 0; k < R; k++) { const n = (k + 1) % R, a = i * R + k, b = i * R + n, c = (i + 1) * R + k, d = (i + 1) * R + n; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  if (shade) { const col = []; for (let i = 0; i < pos.length / 3; i++) col.push(0.045, 0.036, 0.027, i < R ? 0.9 : i < 2 * R ? 0.7 : 0); g.setAttribute("color", new THREE.Float32BufferAttribute(col, 4)); }
  else g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  if (shade) { const N = g.attributes.normal; for (let i = 0; i < N.count; i++) N.setXYZ(i, 0, 1, 0); }
  return g;
}

// `spots`: [x, y, z, kind, height]. `opts.a2c`: the frame is multisampled, so leaf edges can be soft.
// A short fingerprint of some geometry, every coordinate rounded to a tenth of a millimetre: the same plan grown in Node
// and in the browser must give the same one (the cedars' wood is grown from a seed; #161, #162).
export function geometryHash(geos) {
  let h = 2166136261;
  for (const g of geos) { const a = g.attributes.position.array; for (let i = 0; i < a.length; i++) { h ^= Math.round(a[i] * 1e4) | 0; h = Math.imul(h, 16777619) >>> 0; } }
  return h.toString(16);
}

// A young male ginkgo's boughs, laid out layer by layer (#162, docs/t00/SOURCES.md): one straight leader to the top, and
// from it boughs in whorls, 3 to 5 to a layer about a metre apart, each layer's boughs leaving at one height (within
// 0.2 m), climbing at 50-70 degrees off the leader low down and 30-45 degrees up in the crown, the longest the lowest and each
// layer shorter than the one below, so that the crown is a cone about 0.55 as wide as the
// tree is tall. The lowest layer is 2.0 to 2.8 m up, high enough to walk under. Heights are above the ground.
export function ginkgoLayout(h, rnd) {
  const base = 2.0 + (0.8 * Math.min(3, Math.max(0, h - 8))) / 3, top = h - 1.8, count = Math.max(2, 2 * Math.round(((top - base) / 0.9 + 1) / 2)), step = (top - base) / (count - 1), rmax = 0.275 * h, layers = [];
  for (let i = 0; i < count; i++) {
    const y = base + i * step, u = (y - base) / (top - base), n = u > 0.7 ? 3 : [4, 5, 4, 3][i % 4], spin = i * 2.4 + rnd() * 6.283, boughs = [];
    const f = 1 - 0.85 * u;   // the crown's width at this height: widest at its foot, a cone
    for (let k = 0; k < n; k++) {
      const theta = (u < 0.5 ? 64 - (10 * u) / 0.5 : 42 - (7 * (u - 0.5)) / 0.5) + (rnd() - 0.5) * 4;
      boughs.push({ dy: (rnd() - 0.5) * 0.16, az: spin + (k / n) * 6.283 + (rnd() - 0.5) * 0.4, theta, reach: rmax * f * (0.92 + rnd() * 0.16) });
    }
    layers.push({ y, u, boughs });
  }
  return { base, layers };
}

export function createTrees(scene, M, spots, opts = {}) {
  // A place with no trees of its own (#409: T05's white box) grows none, and has nothing to merge.
  if (!spots.length) return { joints: [], branches: [], forks: [], census: [], limbs: [], cedars: [], beds: null, setMood() {} };
  // One stream of chance for the whole wood, so a tree's shape depends on those grown before it; `draw` can be
  // lent to another stream for a moment without disturbing it.
  let draw = seeded(311); const rnd = () => draw();
  const wood = [], ginkgoWood = [], ginkgoBeds = [], pitStone = [], pitCap = [], moss = [], softGinkgos = [], pits = [], cards = { maple: [], ginkgo: [], cedar: [], twig: [] };
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1), V = (x, y, z) => new THREE.Vector3(x, y, z);
  // One flat spray at `p`, lit as part of the crown round `centre`; `shade` darkens those deep inside.
  const card = (list, g, p, centre, shade, squash = 0.75, lift = 0.35) => {
    g.applyMatrix4(m4.compose(p, q, one));
    const P = g.attributes.position, Nn = g.attributes.normal, col = new Float32Array(P.count * 3), tint = 0.86 + rnd() * 0.28;
    for (let i = 0; i < P.count; i++) {
      const nx = P.getX(i) - centre.x, ny = (P.getY(i) - centre.y) * squash + lift, nz = P.getZ(i) - centre.z, l = Math.hypot(nx, ny, nz) || 1;
      Nn.setXYZ(i, nx / l, ny / l, nz / l); col[i * 3] = shade * tint; col[i * 3 + 1] = shade * (tint * 0.5 + 0.5); col[i * 3 + 2] = shade * tint;
    }
    g.setAttribute("color", new THREE.BufferAttribute(col, 3)); list.push(g);
  };
  const clump = (kind, p, centre, w, n = 5) => {
    const d = p.distanceTo(centre), floor = kind === "ginkgo" ? 0.84 : 0.62, shade = floor + (1 - floor) * Math.min(1, d / 2.6); n = Math.round(n * 1.7);   // (a ginkgo's thin leaves are never dark: its inner ones keep 0.84)
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.72) q.setFromEuler(e.set(-Math.PI / 2 + (rnd() - 0.5) * 0.9, rnd() * 6.3, (rnd() - 0.5) * 0.5, "YXZ")); else q.setFromEuler(e.set(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1, "XYZ"));
      const s = w * (0.55 + rnd() * 0.35), at = p.clone().add(V((rnd() - 0.5) * w * 0.75, (rnd() - 0.5) * w * 0.5, (rnd() - 0.5) * w * 0.75));
      card(cards[kind], new THREE.PlaneGeometry(s, s), at, centre, shade, 0.75, kind === "ginkgo" ? 0.85 : 0.35);
      if (i < 2) { q.setFromEuler(e.set(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1)); card(cards.twig, new THREE.PlaneGeometry(s * 1.1, s * 1.1), at, centre, 1); }
    }
  };
  const grow = (pts, r0, r1, radial, flare) => { const l = limb(pts, r0, r1, radial, flare); wood.push(l.geo); return l.curve; };
  const cedarSkeletons = [], ginkgoSkeletons = [];   // (each cedar's skeleton as the generator grew it: for the tests)
  const beds = [], joints = [], branches = [], forks = [], census = [], limbs = []; let nth = 0;   // (where each foot meets its trunk, where each cedar branch ends, each fork: for the tests)
  // Where the trunk is at `h` above the ground: found on its own curve, as thick as it is drawn there.
  const along = (curve, rad, y) => { const P = new THREE.Vector3(), lo0 = curve.getPoint(0).y; return (h) => { const want = Math.max(lo0, y + h); let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; curve.getPoint(mid, P); if (P.y < want) lo = mid; else hi = mid; } curve.getPoint(lo, P); return { x: P.x, z: P.z, r: rad(lo) }; }; };
  const footTop = (r) => Math.min(1.1, 0.5 + r * 1.6);   // how high a foot of a trunk this thick swells, and where the trunk itself begins
  const root = (x, y, z, r, far, trunk, bedR = r) => { if (far) return; nth++; const top = footTop(r), g = foot(y, along(trunk.curve, trunk.rad, y), top, nth, trunk.sides); wood.push(g); if (bedR) beds.push(bed(x, y, z, bedR * 3.4 + 0.25, nth));
    joints.push({ ...trunk, foot: g, ring: trunk.sides, y, top, at: [x, z] }); };

  // A tree's wood is planned before it is drawn, so that each limb can be as thick as what it carries: the wood that
  // goes up a branch is the wood of everything above it (Leonardo's rule, the "pipe model"). Each limb carries its own
  // tip, the foliage hung along it (`load`, spent along its length as 1 - t^0.7, so it tapers fast at first and slowly
  // towards the end), and the limbs that leave it. A limb that ends in a fork (`end`) hands all of itself on.
  const plan = (pts, o = {}) => ({ pts, curve: new THREE.CatmullRomCurve3(pts), kids: [], tip: o.tip ?? 0.01, load: o.load ?? 0, radial: o.radial ?? 5, end: !!o.end, seg: o.seg ?? 2 });
  const offshoot = (parent, u, pts, o) => { const L = plan(pts, o); parent.kids.push({ u: parent.end && u > 0.97 ? 1 : Math.min(u, 0.95), limb: L }); return L; };
  const EASE = 0.04, spent = (u) => Math.pow(1 - Math.pow(u, 0.7), 2), smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };
  // The cross-section of every limb, worked out from the tips down. No branch is more than 0.7 of its parent's
  // width where it leaves (a branch that would be is drawn thinner, all of it); a fork at a limb's end passes on
  // nine tenths of its wood, the rest being the bark and the swelling at the crotch.
  const bake = (L, s) => {
    L.kids.sort((p, q) => q.u - p.u); let above = 0, ends = 0;
    const tops = L.kids.filter((K) => K.u === 1), sides = L.kids.filter((K) => K.u < 1);
    if (tops.length) {
      for (const K of tops) { K.b = bake(K.limb, s); K.f = 1; }
      for (let pass = 0; pass < 8; pass++) { const all = tops.reduce((t, K) => t + K.b * K.f, 0) / 0.9; for (const K of tops) K.f = Math.min(1, (0.48 * all) / K.b); }
      for (const K of tops) { K.area = K.b * K.f; ends += K.area; } ends /= 0.9;
    }
    L.tipA = tops.length ? ends : L.tip * L.tip;
    // each fork eases in over no more than half the way to the next, so forks close together stay apart
    const us = [...new Set(sides.map((K) => K.u))].sort((p, q) => p - q);
    for (const K of sides) { const i = us.indexOf(K.u), gap = Math.min(i > 0 ? K.u - us[i - 1] : K.u, i < us.length - 1 ? us[i + 1] - K.u : 1 - K.u); K.e = Math.min(EASE, gap / 2); }
    for (const K of sides) { const b = bake(K.limb, s), cont = L.tipA + s * L.load * spent(Math.min(1, K.u + K.e)) + above; K.f = Math.min(1, (0.96 * cont) / b); K.area = b * K.f; above += K.area; }
    L.s = s; return (L.base = L.tipA + s * L.load + above);
  };
  const areaAt = (L, u) => { let A = L.tipA + L.s * L.load * spent(u); for (const K of L.kids) if (K.u < 1) A += K.area * (1 - smooth(K.u - K.e, K.u + K.e, u)); return A; };
  // How much foliage the whole tree carries is found so that its trunk is `r0` at the foot. With too little
  // foliage to need it, every tip is drawn thinner instead.
  const settle = (L, r0) => {
    let m = 1, s = 0; if (bake(L, 0) >= r0 * r0) m = (r0 * r0) / L.base;
    else { let hi = 1; while (bake(L, hi) < r0 * r0 && hi < 1e9) hi *= 4; let lo = 0; for (let i = 0; i < 40; i++) { s = (lo + hi) / 2; if (bake(L, s) < r0 * r0) lo = s; else hi = s; } bake(L, s); }
    return m;
  };
  // Then drawn: each branch begun on its parent's axis (out of a fork, a little back inside the parent's last ring), its
  // first ring kept 2 cm inside the parent's surface, and swelling into a collar where it comes out through that surface.
  const paint = (L, m, info, parent = null) => {
    const rad = (u) => Math.sqrt(m * areaAt(L, u)); let pts = L.pts, cap = Infinity, flareAt = 0;
    if (parent) {
      cap = parent.R - Math.min(0.02, 0.3 * parent.R) - 0.001;
      const start = parent.P.clone(); if (parent.end) start.addScaledVector(parent.T, -(Math.min(rad(0), cap) + 0.02));
      pts = [start, ...pts.slice(1)];
      // where it comes out: marched along it until it leaves the parent's tube (or, out of a fork, the point that closes it)
      const cv = new THREE.CatmullRomCurve3(pts), Q = new THREE.Vector3(), O = new THREE.Vector3(), len = cv.getLength(); let te = 1;
      for (let i = 1; i <= 80; i++) {
        cv.getPoint(i / 80, Q); O.subVectors(Q, parent.P); const al = O.dot(parent.T), rr = O.addScaledVector(parent.T, -al).length();
        const inside = parent.end && al > 0 ? al < 0.4 * parent.R && rr < parent.R * (1 - al / (0.4 * parent.R)) : rr < parent.R;
        if (!inside) { te = i / 80; break; }
      }
      flareAt = Math.max(0.005, te * len);
    }
    // a branch out of a fork at its parent's end swells enough to fill the crotch over the parent's low dome, one out of
    // its parent's side into a full collar; a trunk on a foot starts at the foot's top ring
    const l = limb(pts, rad, 0, L.radial, parent ? (parent.end ? 0.35 : 0.3) : info.flare || 0, parent ? 0.1 : 0.4, L.seg, parent ? null : info.startY ?? null, flareAt, cap, L.end ? 0.4 : 1.5); wood.push(l.geo); info.tris += l.geo.index.count / 3; /** @type {any} */ (l.curve).geo = l.geo;   // (the tests read a trunk's own rings from it)
    let first = null;
    if (parent) {   // its first ring, measured against the parent, for the tests
      const P = l.geo.attributes.position, O = new THREE.Vector3(); first = { R: parent.R, radial: 0, along: -Infinity, end: parent.end, exit: +flareAt.toFixed(3) };
      for (let k = 0; k <= L.radial; k++) { O.fromBufferAttribute(P, k).sub(parent.P); const al = O.dot(parent.T); first.along = Math.max(first.along, al); first.radial = Math.max(first.radial, O.addScaledVector(parent.T, -al).length()); }
    }
    // a stem's axis and thickness below 2 m, every 10 cm, for the tests
    let axis = null;
    if (!parent && info.startY !== undefined && info.startY !== null) {
      axis = []; const Q = new THREE.Vector3();
      for (let hy = 0.3; hy <= 2.001; hy += 0.1) { let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; l.curve.getPoint(mid, Q); if (Q.y < info.base + hy) lo = mid; else hi = mid; } l.curve.getPoint(lo, Q); axis.push([hy, Q.x, Q.z, rad(lo)]); }
    }
    limbs.push({ kind: info.kind, h: info.h, at: info.at, points: L.pts.length, r: rad(0), ends: l.curve.getPoint(1).toArray().map((v) => +v.toFixed(3)), depth: parent ? parent.depth + 1 : 0, first, axis });
    // every point where wood leaves this limb, the limbs leaving there together, recorded for the tests
    for (const u of [...new Set(L.kids.map((K) => K.u))]) {
      const here = L.kids.filter((K) => K.u === u), e = u < 1 ? here[0].e : EASE, before = m * areaAt(L, Math.max(0, u - e)), after = u < 1 ? m * areaAt(L, Math.min(1, u + e)) : 0, out = here.map((K) => m * K.f * K.limb.base);
      forks.push({ kind: info.kind, h: info.h, ratio: (after + out.reduce((t, a) => t + a, 0)) / before, width: Math.sqrt(Math.max(...out) / before), end: u === 1, n: here.length });
      for (const K of here) paint(K.limb, m * K.f, info, { P: l.curve.getPoint(u), T: l.curve.getTangent(u), R: rad(u), end: u === 1, depth: parent ? parent.depth + 1 : 0 });
    }
    return l;
  };
  // A bough bending as it goes: `n` points from `from`, out along `dir` by `reach`, up by `rise` (as `rise * u^lift`,
  // so a climbing bough lifts late and a spreading one early), each point knocked aside a little.
  const bend = (from, dir, reach, rise, n = 5, kink = 0.12, lift = 1) => {
    // the wander is one slow swing to a side and back, with a little of chance on top: a bough wanders, it does not zigzag
    const pts = [from.clone()], side = V(-dir.z, 0, dir.x), phase = rnd() * 6.283, swing = kink * reach * (0.6 + rnd() * 0.8);
    for (let i = 1; i < n; i++) { const u = i / (n - 1), j = swing * Math.sin(phase + u * 3.6) * Math.sin(u * Math.PI * 0.9) + jit(kink * reach * 0.25); pts.push(from.clone().addScaledVector(dir, reach * u).addScaledVector(side, j).add(V(0, rise * Math.pow(u, lift) + swing * 0.3 * Math.sin(phase * 1.7 + u * 4.1) * u, 0))); }
    return pts;
  };
  const jit = (k) => (rnd() - 0.5) * k;
  // The fine wood at the end of a branch: a few twigs fanning out, which is what a bare tree is made of.
  const twigs = (L, dir, n = 3, reach = 0.6) => { const p = L.curve.getPoint(0.96); for (let i = 0; i < n; i++) { const tip = p.clone().add(V(dir.x * reach + jit(reach), reach * (0.2 + rnd() * 0.6), dir.z * reach + jit(reach))); offshoot(L, 0.95 - i * 0.02, [p.clone(), p.clone().lerp(tip, 0.5).add(V(jit(0.12), 0.05, jit(0.12))), tip], { tip: 0.004, radial: 4 }); } };
  // Every tree but a cedar is grown from a chance of its own, from where it stands, so that each differs from the
  // next and a picture of it can be taken again.
  const own = (x, z, k) => { const prev = draw; draw = seeded(Math.abs(Math.round(x * 211 + z * 37)) + k); for (let i = 0; i < 4; i++) rnd(); return () => { draw = prev; }; };   // (a small seed's first draws are all near nothing)
  for (const [x, y, z, kind, h, far0, bedKind] of spots) {
    const info = { kind, h, at: [x, z], base: y, tris: 0 }, w0 = wood.length;
    if (kind === "cedar") {
      // A cryptomeria, its wood grown by three's TreeGenerator (three-tree.js; #162): one straight shaft swelling into its
      // roots in one piece, so there is no foot to meet it and no seam; an old tree bare for its lower third, a young one
      // clothed nearly to the ground and slender (#91); boughs that leave the shaft nearly level, together as thick as the
      // shaft they leave (each its share of it, so every fork carries what comes into it), shorter towards the top
      // so the crown is a cone, and sag as they go. Its foliage is this project's own: a spray hung down the middle of
      // every bough and every twig of a bough, as the cedars were hung before, and a curtain from every other.
      const young = h < 8, r0 = young ? 0.035 + h * 0.009 : 0.2 + h * 0.012, seed = Math.abs(Math.round(x * 211 + z * 37)) + 13;
      const gen = /** @type {any} */ (new TreeGenerator(null)), P = young
        ? { levels: 3, children: [Math.round(h * 8), 3], childRadius: [1 / Math.sqrt(Math.round(h * 8)), 0.577], branchAngle: [100], angleVariance: 12, lengthRatio: [Math.min(0.36, 0.95 / h)], branchLengthFalloff: 0.6,   /* (its wood within the 0.2 h that stops a visitor: girth() in site.js) */ trunkRadius: r0, taper: 0.7, taperCurve: 0.9, rootFlare: 0.3, flareFrac: 0.08, trunkClear: Math.max(0.1, 1.35 / h), droop: 0.05, radialSegments: [12, 4, 3] }
        : { levels: far0 ? 2 : 3, children: far0 ? [Math.round(h * 1.4)] : [Math.round(h * 2.4), 4], childRadius: far0 ? [1 / Math.sqrt(Math.round(h * 1.4))] : [1 / Math.sqrt(Math.round(h * 2.4)), 0.5], branchAngle: [96, 38], angleVariance: 10, lengthRatio: [0.3, 0.3], branchLengthFalloff: 0.8, trunkRadius: r0, taper: [0.88, 0.45], taperCurve: 0.8, rootFlare: 0.5, flareFrac: 0.06, trunkClear: 0.34, droop: 0.22, radialSegments: far0 ? [6, 3] : [16, 4, 3] };
      for (const [k, v] of Object.entries({ seed, trunkLength: h, radiusExponent: 2.6, minRadius: 0.012, minLength: 0.4, upPull: 0, gnarl: [0.01, 0.06, 0.1], sectionLength: 1.0, childStart: 0.2, collar: 0.25, ...P })) gen["set" + k[0].toUpperCase() + k.slice(1)](v);
      const m = gen.build(), tubes = m.userData.tubes; m.geometry.translate(x, y - 0.2, z); for (const t of tubes) for (const r of t.rings) r.pos.add(V(x, y - 0.2, z));
      wood.push(m.geometry); cedarSkeletons.push({ at: [x, z], h, young, far: !!far0, tubes, geometry: m.geometry });
      // its bed: as wide against its flare where that meets the paving as the old foot's bed was against its trunk, so the
      // swelling comes down into earth and not onto the stone (lost with the foot in #199, put back)
      if (!far0) { const rg = tubes[0].rings, i = Math.max(0, rg.findIndex((r) => r.pos.y > y) - 1), a = rg[i], b = rg[Math.min(i + 1, rg.length - 1)], f = b === a ? 0 : (y - a.pos.y) / (b.pos.y - a.pos.y), flare = a.radius + (b.radius - a.radius) * f;
        nth++; beds.push(bed(x, y, z, flare * 2.5 + 0.25, nth)); moss.push(mossPatch(x, y, z, (flare * 2.5 + 0.25) * 1.03, 0.62, nth, [0.12, 0.112, 0.095], 0.6, 0.0165, 24), ...edgeMoss(x, y, z, flare * 2.5 + 0.25, nth)); }   // (a grey-brown dust over the earth's outer slope: its own litter is greener and darker than the court's stone)
      for (const t of tubes) {
        if (t.level < 1) continue;
        const from = t.rings[0].pos, to = t.rings[t.rings.length - 1].pos, d = to.clone().sub(from), a = Math.atan2(d.x, d.z), droop = Math.atan2(Math.hypot(d.x, d.z), -d.y);
        // however it hangs, the spray stops short of the ground under it
        const w0 = 0.95 + rnd() * 0.3, l = Math.min(d.length() * 1.12 + 0.3, (from.y - y - 0.45) / Math.max(0.2, Math.cos(droop) + 0.5 * w0 * Math.abs(Math.sin(droop)) * 0)), w = l * w0;
        if (l < (young ? 0.25 : 0.5)) continue;   // (a young tree's short upper boughs carry their small sprays too: #93)
        q.setFromEuler(e.set(-droop, a, 0, "YXZ"));
        const loc = to.clone().sub(from).applyQuaternion(q.clone().invert()); branches.push({ h, inside: Math.max(0, Math.abs(loc.x) - w / 2, loc.y, -l - loc.y, Math.abs(loc.z) - 0.15) });
        card(cards.cedar, new THREE.PlaneGeometry(w, l).translate(0, -l / 2, 0), from, from.clone().add(V(0, -l * 0.9, 0)), 0.72 + 0.28 * rnd(), 0.4, 0.2);   // (hung from the bough itself, so the bough lies in it)
        if (t.level === 1 && !far0 && rnd() < 0.5) { q.setFromEuler(e.set(0, a + Math.PI / 2, 0)); const hang = from.clone().add(d.clone().multiplyScalar(0.36)), cw = Math.min(l * 0.75, (hang.y - y - 0.45) / 0.9); if (cw > 0.3) card(cards.cedar, new THREE.PlaneGeometry(cw, cw * 0.95).translate(0, -cw * 0.42, 0), hang, from.clone().add(V(0, -1.2, 0)), 0.55 + 0.25 * rnd(), 0.4, 0.2); }
      }
      // A young tree is dense from its foot to its point, a narrow cone (#93: its generated boughs thin out up the leader,
      // where they are short, and the upper half read as bare trunk under a hanging skirt). So up its upper half the leader
      // is clothed in threes of sprays a sixth of a turn apart (so that two face any eye), every 35 cm, each as wide as the cone is there.
      if (young && !far0) {
        const top = y + h - 0.2, foot = y + h * 0.36;
        for (let yy = y + h * 0.45; yy < top - 0.55; yy += 0.35) {
          const r = 0.2 * h * Math.min(1, (top - yy) / (top - foot)) * 0.9, l = 0.75, a0 = rnd() * 3.14;
          for (let k = 0; k < 3; k++) { q.setFromEuler(e.set(0, a0 + k * 1.047, 0)); const at = V(x, yy + l * 0.45, z); card(cards.cedar, new THREE.PlaneGeometry(2 * r, l).translate(0, -l / 2, 0), at, at.clone().add(V(0, -l, 0)), 0.75 + 0.25 * rnd(), 0.4, 0.2); }
        }
      }
      const tip = V(x, y + h - 0.2, z); for (let k = 0; k < 3; k++) { q.setFromEuler(e.set(0, k * 2.1, 0)); card(cards.cedar, new THREE.PlaneGeometry(1.5 * Math.min(1, h / 18) + 0.4, 2.3 * Math.min(1, h / 18) + 0.5).translate(0, -0.6, 0), tip.clone().add(V(0, 0.9, 0)), tip.clone().add(V(0, -1, 0)), 0.95, 0.4, 0.5); }
    } else if (kind === "ginkgo") {
      // A young male ginkgo (#162): see ginkgoLayout for its shape. Its wood is grown by three's TreeGenerator like the
      // cedars', the leader and its whorled boughs in one piece from the roots up, so there is no foot and no seam.
      const back = own(x, z, 3), lay = ginkgoLayout(h, rnd), top = y + h, centre = V(x, y + h * 0.55, z), r0 = 0.06 + h * 0.012, sk = { at: [x, z], h, base: y, trunk: [], boughs: [], tubes: null, geometry: null };
      {
        const seed = Math.abs(Math.round(x * 211 + z * 37)) + 29, whorls = [];
        for (const L of lay.layers) for (const b of L.boughs) whorls.push({ t: (L.y + b.dy + 0.2) / h, tilt: b.theta, roll: b.az, length: b.reach / Math.sin((b.theta * Math.PI) / 180) });
        const gen = /** @type {any} */ (new TreeGenerator(null));
        for (const [k, v] of Object.entries({ seed, levels: 3, trunkLength: h, trunkRadius: r0, taper: [0.93, 0.93, 0.93], taperCurve: 0.85, rootFlare: 0.5, flareFrac: 0.07, radialSegments: [20, 6, 4], whorls, childRadius: [0.2, 0.55], children: [0, 3], branchAngle: [0, 50], angleVariance: 12, lengthRatio: [0, 0.22], branchLengthFalloff: 0.3, childStart: 0.35, minRadius: 0.006, minLength: 0.3, droop: 0.015, upPull: 0.12, gnarl: [0.004, 0.02, 0.05], sectionLength: 0.9, collar: 0.3, inside: 0.68, radiusExponent: 2.6 })) gen["set" + k[0].toUpperCase() + k.slice(1)](v);
        const m = gen.build(), tubes = m.userData.tubes; m.geometry.translate(x, y - 0.2, z); for (const t of tubes) for (const r of t.rings) r.pos.add(V(x, y - 0.2, z));
        ginkgoWood.push(m.geometry); sk.geometry = m.geometry; sk.tubes = tubes; info.tris += m.geometry.index.count / 3;
        const at = (t, u) => { const f = u * (t.rings.length - 1), i = Math.min(t.rings.length - 2, Math.floor(f)); return t.rings[i].pos.clone().lerp(t.rings[i + 1].pos, f - i); };
        // The leaves hang on the outer part of each bough and at the ends of its twigs, not in the cone's inside: the layers
        // stay open to the sky between them, and the whorled boughs show through (the art director's review of #327).
        const topW = y + h - 1.8, widthAt = (yy) => 0.275 * h * Math.max(0.1, 1 - 0.85 * Math.min(1, Math.max(0, (yy - y - lay.base) / (topW - y - lay.base))));
        for (const t of tubes) {
          if (t.level === 0) { sk.trunk = t.rings.map((r) => r.pos.toArray()); sk.radii = t.rings.map((r) => r.radius); continue; }
          if (t.level === 1) { sk.boughs.push({ from: t.rings[0].pos.toArray(), to: t.rings[t.rings.length - 1].pos.toArray(), r: t.base, r0: t.rings[0].radius, r1: t.rings[t.rings.length - 1].radius }); for (const u of [0.62, 0.82, 0.98]) clump(kind, at(t, u), centre, 0.8 + rnd() * 0.4, 3); }
          else { const e = at(t, 1); if (Math.hypot(e.x - x, e.z - z) >= 0.55 * widthAt(e.y)) clump(kind, e, centre, 0.75 + rnd() * 0.35, 3); }
        }
        const rg = tubes[0].rings, i = Math.max(0, rg.findIndex((r) => r.pos.y > y) - 1), a = rg[i], b = rg[Math.min(i + 1, rg.length - 1)], f = b === a ? 0 : (y - a.pos.y) / (b.pos.y - a.pos.y), flare = a.radius + (b.radius - a.radius) * f;
        if (bedKind === "soft") {   // a ginkgo that cannot have a pit (the pavilion's platform is 0.6 m off): an earth ring with moss, as a cedar's, and the leaves over it
          nth++; const r = flare * 2.5 + 0.25; beds.push(bed(x, y, z, r, nth)); moss.push(mossPatch(x, y, z, r * 1.03, 0.62, nth, [0.12, 0.112, 0.095], 0.6, 0.0165, 24), ...edgeMoss(x, y, z, r, nth));
          ginkgoBeds.push(softBed(x, y, z, r + 0.5, nth, 0.075, 0.002)); softGinkgos.push({ at: [x, z], r });
        } else {
          nth++; const side = pitSide(flare); ginkgoBeds.push(softBed(x, y, z, side * 0.78, nth, PIT.up - PIT.drop + 0.012, 0.0004));   // (over the pit's soil and dust: lower, it was hidden by them and ended in a hard line)
          pitStone.push(...pitStones(x, y, z, side)); beds.push(pitSoil(x, y, z, side), pitMound(x, y, z, flare * 1.05, nth, 0.05, 0.085)); pitCap.push(...pitSnow(x, y, z, side)); pits.push({ at: [x, z], side, flare });
          moss.push(mossPatch(x, y, z, flare * 1.7 + 0.2, 0.45, nth + 5, MOSS, 0.55, PIT.up - PIT.drop + 0.012), pitContact(x, y, z, side), pitDust(x, y, z, side), ...pitMossPatches(x, y, z, side, flare, nth), pitMound(x, y, z, flare * 1.05, nth, 0.05, 0.085, true));   // (the earth heap's dark shading goes last, so that the moss does not cover it)   // moss at the roots and in patches, the dark contact line
          pitStone.push(...pitGravel(x, y, z, side, flare, nth));   // gravel on the soil, drawn with the stones
        }
      }
      clump(kind, V(x, top - 0.2, z), centre, 1.1, 5);
      ginkgoSkeletons.push(sk);
      back();
    } else {
      // The maple is a Japanese maple (Acer palmatum) as it grows in a temple court: two to four stems from the
      // ground, each 15 to 25 cm across, wandering as they rise and forking again and again, each fork wider and
      // flatter than the last, so that the crown is broad and low and lies in tiers.
      const back = own(x, z, 5), centre = V(x, y + h * 0.66, z), stems = 2 + ((rnd() * 3) | 0), a0 = rnd() * 6.283, thick = 0.08 + h * 0.005;
      const grown = [];
      // Each stem stands out from the middle far enough that no two grow against each other below head height (#200):
      // between neighbours at least 1.3 times their radii together, so that what shows between them is air round
      // each, not a crack. (Their radii are not known until the wood is planned; a stem is never thicker than `thick`.)
      const angs = []; for (let i = 0; i < stems; i++) angs.push(a0 + (i / stems) * 6.283 + jit(0.3));
      let gap = 6.283; for (let i = 0; i < stems; i++) { const d = (angs[(i + 1) % stems] - angs[i] + 6.283 * 2) % 6.283; gap = Math.min(gap, d); }
      // as far apart as 1.8 times their radii where the post leaves room (`girth` in site.js, its formula repeated here), never under 1.3
      const post = (0.09 + h * 0.019) * 1.8 + 0.1, apart = (k) => (k * 2 * thick) / (2 * Math.sin(Math.min(gap, 3.1) / 2)) + 0.01;
      const out = Math.max(0.1, apart(1.3), Math.min(apart(1.8), post - 0.06 - thick - 0.05));
      for (let i = 0; i < stems; i++) {
        const a = angs[i], dir = V(Math.cos(a), 0, Math.sin(a)), at = V(x, y, z).addScaledVector(dir, out);
        // close together to head height, so that the stems rise from one foot; then away
        // (within the post that stops a visitor up to head height: `girth` in site.js)
        const len = 2.5 + h * 0.04 + rnd() * 0.3, pts = [at.clone().setY(y - 0.15), at.clone().add(V(0, 0.8, 0)).addScaledVector(dir, 0.02), at.clone().add(V(0, 1.6, 0)).addScaledVector(dir, 0.06), at.clone().add(V(jit(0.03), 2.1, jit(0.03))).addScaledVector(dir, 0.11), at.clone().add(V(jit(0.2), len, jit(0.2))).addScaledVector(dir, len * 0.24)];
        const stem = plan(pts, { end: true, radial: 12, seg: 3 }); grown.push(stem);
        const fork = (L, depth, a, reach, rise) => {   // the forks above, each limb ending in two
          const ends = L.curve.getPoint(1);
          for (let k = 0; k < 2; k++) {
            const b = a + (k - 0.5) * (0.9 + rnd() * 0.5) + jit(0.3), d = V(Math.cos(b), 0, Math.sin(b)), last = depth === 2;
            const kid = offshoot(L, 1, bend(ends, d, reach * (0.8 + rnd() * 0.4), rise * (0.7 + rnd() * 0.5), last ? 4 : 5, 0.16, 0.8), { end: !last, tip: 0.007, load: last ? reach : 0, radial: last ? 4 : depth === 0 ? 7 : 6 });
            if (last) {   // the last wood carries the leaves: along it and at its end, with a side twig and fine twigs
              if (stems < 4) twigs(kid, d, 1, 0.5); const along = Math.max(1, Math.round(48 / (stems * 8)));
              for (let j = 1; j <= along; j++) { const p = kid.curve.getPoint(0.4 + (0.6 * j) / along); clump(kind, p, centre, 1.0 + rnd() * 0.5, 5); }
            } else fork(kid, depth + 1, b, reach * 0.8, rise * 0.6);
          }
        };
        fork(stem, 0, a, h * 0.21, h * 0.17);
      }
      clump(kind, centre.clone().add(V(jit(0.8), h * 0.18, jit(0.8))), centre, 1.5, 5);
      grown.forEach((stem, i) => { const m = settle(stem, thick * (1 - 0.12 * i)), l = paint(stem, m, { ...info, startY: y + footTop(thick) }); root(x, y, z, thick, false, { curve: l.curve, rad: l.rad, sides: 12, kind, h, stem: i }, i === 0 ? 0.13 + h * 0.019 : 0); });
      back();
    }
    let tris = kind === "ginkgo" ? info.tris : 0;   // (a ginkgo's wood is grown on its own, counted as it was made)
    for (let i = w0; i < wood.length; i++) tris += wood[i].index ? wood[i].index.count / 3 : wood[i].attributes.position.count / 3;
    census.push({ kind, h, at: [x, z], tris, far: !!far0 });
  }
  if (wood.length) scene.add(mesh(merge(wood), M.bark));
  if (ginkgoWood.length) scene.add(mesh(merge(ginkgoWood), M.barkGinkgo));
  // The beds the trees stand in. Under snow a bed is buried as the paving round it is, one blanket over both, so in
  // winter it is not laid at all: drawn, it took a patchy snow of its own over its dark earth and showed as a hard-edged
  // grey disc against the paving's snow (#92). It stays its own mesh, not merged with the rest, so that it can be put away.
  let soil = null;
  if (beds.length) { soil = mesh(merge(beds), M.earth); soil.receiveShadow = true; soil.userData.keep = true; soil.name = "tree-beds"; scene.add(soil); }

  let gbed = null;
  if (ginkgoBeds.length) { gbed = new THREE.Mesh(mergeGeometries(ginkgoBeds), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })); gbed.receiveShadow = true; gbed.userData.keep = true; gbed.name = "ginkgo-beds"; gbed.renderOrder = 0; gbed.material.onBeforeCompile = (sh) => { sh.vertexShader = "varying vec3 vBedP;\n" + sh.vertexShader.replace("#include <begin_vertex>", "#include <begin_vertex>\n  vBedP = position;"); sh.fragmentShader = "varying vec3 vBedP;\n" + sh.fragmentShader.replace("#include <color_fragment>", "#include <color_fragment>\n  { vec2 q = vBedP.xz * 9.0, cell = floor(q); float n1 = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453), n2 = fract(sin(dot(cell, vec2(39.346, 11.135))) * 24634.6345), n3 = fract(sin(dot(cell, vec2(73.156, 52.235))) * 31415.9265); vec2 f = fract(q) - vec2(0.25 + 0.5 * n1, 0.25 + 0.5 * n2); float an = n3 * 6.2832; f = vec2(cos(an) * f.x + sin(an) * f.y, -sin(an) * f.x + cos(an) * f.y); float leaf = step(length(vec2(f.x, f.y / 0.55)), 0.2 + 0.16 * n3), here = step(fract(n1 * 5.17 + n2 * 3.31), 0.5 + diffuseColor.a * 1.4); diffuseColor.a = leaf * here * (0.6 + clamp(diffuseColor.a * 2.0, 0.0, 0.35)); }"); }; gbed.material.customProgramCacheKey = () => "bedgrain"; scene.add(gbed); }
  // The ginkgoes' pits (#611): the edge stones are the court's stone, the soil inside lies a little under their tops. In
  // winter the soil and the moss are put away like the beds, and the paving's one blanket of snow runs to the trunk.
  let pitMesh = null, mossMesh = null, capMesh = null;
  // (the stones are static and always drawn, so mergeStatic takes them into the stone batch with the buildings)
  if (pitStone.length) { pitMesh = mesh(merge(pitStone), M.stone); pitMesh.name = "ginkgo-pits"; scene.add(pitMesh); }
  if (pitCap.length) { capMesh = new THREE.Mesh(mergeGeometries(pitCap.map((g) => { g.deleteAttribute("uv"); return g; })), new THREE.MeshStandardMaterial({ color: new THREE.Color(0.7, 0.745, 0.81), roughness: 1, envMapIntensity: 0.25 })); capMesh.receiveShadow = true; capMesh.userData.keep = true; capMesh.name = "ginkgo-pit-snow"; capMesh.userData.walk = false; capMesh.visible = false; scene.add(capMesh); }
  if (moss.length) { mossMesh = new THREE.Mesh(mergeGeometries(moss), new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 1, envMapIntensity: 0.1, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 })); mossMesh.receiveShadow = true; mossMesh.userData.keep = true; mossMesh.name = "tree-moss"; mossMesh.renderOrder = 0; scene.add(mossMesh); }
  const tex = { blossom: sheet("blossom"), maple: sheet("maple"), ginkgo: sheet("ginkgo"), cedar: sheet("cedar"), twig: sheet("twig") }, crowns = {};
  const put = (kind, map, o) => {
    if (!cards[kind].length) return;
    const mat = crownMaterial(map, { a2c: opts.a2c, ...o }), m = new THREE.Mesh(mergeGeometries(cards[kind]), mat);
    m.castShadow = true; m.receiveShadow = false; m.renderOrder = 1; scene.add(m); crowns[kind] = { mat, mesh: m };   // after the buildings, which then hide most of it for nothing
  };
  put("maple", tex.maple, {}); put("ginkgo", tex.ginkgo, { glow: 0.16 }); put("cedar", tex.cedar, { sway: 0.02, snow: 0.8 }); put("twig", tex.twig, { sway: 0.012, snow: 0.55 });
  return {
    joints, branches, forks, census, limbs, cedars: cedarSkeletons, ginkgos: ginkgoSkeletons, beds: soil, ginkgoBeds: gbed, pits, softGinkgos, pitStones: pitMesh, pitSoil: soil, pitSnow: capMesh, moss: mossMesh,
    setMood(m) {
      for (const kind of ["maple", "ginkgo", "cedar"]) {
        const c = COLOURS[kind][m.season], k = crowns[kind]; if (!k) continue;
        k.mesh.visible = !!c; if (!c) continue;
        k.mat.color.setRGB(...c); if (kind === "maple") k.mat.map = m.season === "spring" ? tex.blossom : tex.maple;
      }
      if (soil) soil.visible = !(m.snow > 0.5);
      if (mossMesh) { mossMesh.visible = !(m.snow > 0.5); mossMesh.material.opacity = m.season === "autumn" ? 0.5 : 1; }   // (half as much moss in autumn: #621)
      if (capMesh) capMesh.visible = m.snow > 0.5;
      // the leaves under a ginkgo are the season's own, and are not there when it is bare
      if (gbed) { const c = COLOURS.ginkgo[m.season]; gbed.visible = !!c && !(m.snow > 0.5); gbed.material.opacity = m.season === "summer" ? 0.6 : 1; if (c) { const lum = 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2], k = 0.45, mix = 0.62; gbed.material.color.setRGB((c[0] + (lum - c[0]) * mix) * k, (c[1] + (lum - c[1]) * mix) * k * 0.95, (c[2] + (lum - c[2]) * mix) * k * 0.8); } }   // (a yellow-brown that has given up two fifths of its colour: the litter over the pit's soil read 3 times the saturation of the bed on the paving, #611)
      // Bare twigs show only when the leaves are down.
      if (crowns.twig) { crowns.twig.mesh.visible = m.season === "winter"; crowns.twig.mat.color.setRGB(0.2, 0.16, 0.13); }
    },
  };
}
