// The trees. Cryptomerias, tall and dark, as old as the walls; and the two that keep the calendar: one flowers
// pale pink in spring and burns red in autumn, the other is a ginkgo that turns gold. Both stand bare under snow.
//
// A tree is a crooked trunk and three orders of branches, built as tapering tubes, and a crown of small flat
// sprays ("cards"), each drawn large and fine with the leaves of its kind. The cards do not light as the flat
// things they are: every one borrows its normal from the round crown it belongs to, so a tree shades as a mass,
// light on top and toward the sun, dark within. With the sun behind them the leaves glow.
import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { merge, mesh } from "./geo.js";
import { U } from "./glsl.js";
import { SUN_DIR } from "./sky.js";
import { grow as growBy } from "./spike/gens.js";   // the #162 trial: two trees grown by an existing generator, with ?trees=three|ez

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
  ginkgo: { spring: [0.42, 0.6, 0.22], summer: [0.22, 0.4, 0.13], autumn: [0.8, 0.56, 0.1], winter: null },
  cedar:  { spring: [0.075, 0.15, 0.08], summer: [0.06, 0.125, 0.075], autumn: [0.07, 0.125, 0.065], winter: [0.065, 0.12, 0.08] },
};

// A crown material: cards that take their light as parts of one round mass, let the low sun through, hold snow,
// keep their leaves at a distance (a sheet's thin places would otherwise vanish), and stir in the air.
export function crownMaterial(map, { a2c, sway = 0.035, snow = 0.9 }) {
  const m = new THREE.MeshStandardMaterial({ map, alphaTest: 0.42, side: THREE.DoubleSide, roughness: 0.82, envMapIntensity: 0.25, vertexColors: true, alphaToCoverage: !!a2c });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uSnow: U.uSnow, uSunC: U.uSunC, uT: U.uT, uSunDir: { value: SUN_DIR } });
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nuniform float uT; varying float vUp;")
      .replace("#include <begin_vertex>", `#include <begin_vertex>
        vUp=normalize(mat3(modelMatrix)*objectNormal).y;
        transformed.x+=sin(uT*1.1+position.x*.7+position.y*.5)*${sway.toFixed(3)}; transformed.z+=cos(uT*.83+position.z*.6+position.y*.4)*${sway.toFixed(3)};`);
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform float uSnow; uniform vec3 uSunC, uSunDir; varying float vUp;")
      .replace("#include <map_fragment>", `#include <map_fragment>
        { vec2 tx=vMapUv*1024.; float lod=max(0.,.5*log2(max(dot(dFdx(tx),dFdx(tx)),dot(dFdy(tx),dFdy(tx))))); diffuseColor.a*=1.+lod*.32; }
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.84,.88,.94),uSnow*smoothstep(.15,.7,vUp)*${snow.toFixed(2)});`)
      .replace("#include <normal_fragment_begin>", "#include <normal_fragment_begin>\n normal=normalize(vNormal);")   // both faces of a card take the crown's light the same way
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>
        { vec3 Lv=normalize((viewMatrix*vec4(uSunDir,0.)).xyz); float thru=pow(max(dot(normalize(vViewPosition),-Lv),0.),2.5);
          totalEmissiveRadiance+=diffuseColor.rgb*uSunC*vec3(1.,1.,.45)*thru*1.6*(1.-uSnow*.7); }`);
  };
  m.customProgramCacheKey = () => "crown" + sway + snow + (a2c ? "c" : "");
  return m;
}

// A tapering tube through `pts`, smoothed. Radius runs from r0 to r1.
function limb(pts, r0, r1, radial = 7, flare = 0) {
  const curve = new THREE.CatmullRomCurve3(pts), n = Math.max(2, (pts.length - 1) * (flare ? 6 : 3)), len = curve.getLength(), pos = [], nor = [], uv = [], idx = [];
  const T = new THREE.Vector3(), Nn = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), ref = new THREE.Vector3();
  for (let i = 0; i <= n; i++) {
    const t = i / n; curve.getPoint(t, P); curve.getTangent(t, T);
    ref.set(Math.abs(T.y) > 0.9 ? 1 : 0, Math.abs(T.y) > 0.9 ? 0 : 1, 0); Nn.crossVectors(T, ref).normalize(); B.crossVectors(T, Nn);
    const r = (r0 + (r1 - r0) * t) * (1 + flare * Math.exp(-(t * len) / 0.4) * (1 + 0.18 * Math.sin(i * 1.7)));   // spreading into roots where it meets the ground
    for (let k = 0; k <= radial; k++) { const a = (k / radial) * 6.283, cx = Math.cos(a), sx = Math.sin(a); nor.push(Nn.x * cx + B.x * sx, Nn.y * cx + B.y * sx, Nn.z * cx + B.z * sx); pos.push(P.x + (Nn.x * cx + B.x * sx) * r, P.y + (Nn.y * cx + B.y * sx) * r, P.z + (Nn.z * cx + B.z * sx) * r); uv.push(k / radial, t); }
  }
  for (let i = 0; i < n; i++) for (let k = 0; k < radial; k++) { const a = i * (radial + 1) + k, b = a + radial + 1; idx.push(a, b, a + 1, a + 1, b, b + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return { geo: g, curve };
}

// Where a trunk meets the ground. A tube ending at the paving looks sawn off, so each tree stands on a foot of its
// own: the bole swelling as it comes down and dividing into five or six root-spurs that run out and under, drawn in
// level rings (so nothing is lifted clear of the ground) and carried well below it. `trunk(h)` says where the trunk is,
// and how thick, at `h` above the ground: every ring is centred on it and never thinner than it, so that at `top`,
// where the swelling begins, the foot's ring is the trunk's own and the tree is one piece. `R` is the trunk's number of
// sides, so that the two rings meet corner to corner. The bark's grain runs on down it.
function foot(y, trunk, top, seed, R = 24) {
  const rings = 12, pos = [], nor = [], uv = [], idx = [], spurs = 5 + (seed % 2), turn = seed * 1.3;
  const at = (i, k) => { const t = i / rings, h = top * (1 - t) - 0.35 * t * t * 3, a = (k / R) * 6.283, swell = Math.max(0, Math.exp(-Math.max(0, h) / (top * 0.3)) - Math.exp(-1 / 0.3)) * (1 - t < 0.08 ? (1 - t) / 0.08 : 1);   // nothing at its top: it leaves the trunk without a collar
    const spur = Math.pow(0.5 + 0.5 * Math.cos(a * spurs + turn + Math.sin(a * 2 + seed) * 0.5), 2.2), c = trunk(h), rr = c.r * (1 + 0.55 * swell + 1.25 * swell * swell * spur) + (h < 0 ? -h * 0.5 : 0);
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
    pos.push(...p); nor.push(ox, oy, oz); uv.push(k / R, -i / rings * 0.5); }
  for (let i = 0; i < rings; i++) for (let k = 0; k < R; k++) { const a = i * (R + 1) + k, b = a + R + 1; idx.push(a, a + 1, b, a + 1, b + 1, b); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute("normal", new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  return g;
}
// The bed it grows in: a round of dark earth standing a finger above the paving, uneven at its edge, heaped a little against the roots.
function bed(x, y, z, r, seed) {
  const R = 30, pos = [x, y + 0.07, z], idx = [];
  for (const [f, lift] of [[0.62, 0.05], [1, 0.012]]) for (let k = 0; k < R; k++) { const a = (k / R) * 6.283, rr = r * f * (1 + 0.07 * Math.sin(a * 3 + seed) + 0.05 * Math.sin(a * 7 + seed * 2)); pos.push(x + Math.cos(a) * rr, y + lift, z + Math.sin(a) * rr); }
  for (let k = 0; k < R; k++) { const n = (k + 1) % R; idx.push(0, 1 + n, 1 + k, 1 + k, 1 + n, 1 + R + k, 1 + n, 1 + R + n, 1 + R + k); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals(); return g;
}

// `spots`: [x, y, z, kind, height]. `opts.a2c`: the frame is multisampled, so leaf edges can be soft.
export function createTrees(scene, M, spots, opts = {}) {
  // One stream of chance for the whole wood, so a tree's shape depends on those grown before it; `draw` can be
  // lent to another stream for a moment without disturbing it.
  let draw = seeded(311); const rnd = () => draw();
  const wood = [], cards = { maple: [], ginkgo: [], cedar: [], twig: [] };
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
    const d = p.distanceTo(centre), shade = 0.62 + 0.38 * Math.min(1, d / 2.6); n = Math.round(n * 1.7);
    for (let i = 0; i < n; i++) {
      if (rnd() < 0.72) q.setFromEuler(e.set(-Math.PI / 2 + (rnd() - 0.5) * 0.9, rnd() * 6.3, (rnd() - 0.5) * 0.5, "YXZ")); else q.setFromEuler(e.set(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1, "XYZ"));
      const s = w * (0.55 + rnd() * 0.35), at = p.clone().add(V((rnd() - 0.5) * w * 0.75, (rnd() - 0.5) * w * 0.5, (rnd() - 0.5) * w * 0.75));
      card(cards[kind], new THREE.PlaneGeometry(s, s), at, centre, shade);
      if (i < 2) { q.setFromEuler(e.set(rnd() * 3.1, rnd() * 6.3, rnd() * 3.1)); card(cards.twig, new THREE.PlaneGeometry(s * 1.1, s * 1.1), at, centre, 1); }
    }
  };
  const grow = (pts, r0, r1, radial, flare) => { const l = limb(pts, r0, r1, radial, flare); wood.push(l.geo); return l.curve; };
  const spike = [];
  const beds = [], joints = [], branches = []; let nth = 0;   // (where each foot meets its trunk, and where each cedar branch ends: for the tests)
  // Where the trunk is at `h` above the ground: found on its own curve, its radius tapering as `limb` tapers it.
  const along = (curve, r0, r1, y) => { const P = new THREE.Vector3(), lo0 = curve.getPoint(0).y; return (h) => { const want = Math.max(lo0, y + h); let lo = 0, hi = 1; for (let i = 0; i < 30; i++) { const mid = (lo + hi) / 2; curve.getPoint(mid, P); if (P.y < want) lo = mid; else hi = mid; } curve.getPoint(lo, P); return { x: P.x, z: P.z, r: r0 + (r1 - r0) * lo }; }; };
  const root = (x, y, z, r, far, trunk) => { if (far) return; nth++; const top = Math.min(1.1, 0.5 + r * 1.6), g = foot(y, along(trunk.curve, trunk.r0, trunk.r1, y), top, nth, trunk.sides); wood.push(g); beds.push(bed(x, y, z, r * 3.4 + 0.25, nth));
    joints.push({ ...trunk, foot: g, ring: trunk.sides, y, top, at: [x, z] }); };
  // The fine wood at the end of a branch: a few twigs fanning out, which is what a bare tree is made of.
  const twigs = (p, dir, n = 3, reach = 0.6) => { for (let i = 0; i < n; i++) { const tip = p.clone().add(V(dir.x * reach + jit(reach), reach * (0.2 + rnd() * 0.6), dir.z * reach + jit(reach))); grow([p, p.clone().lerp(tip, 0.5).add(V(jit(0.12), 0.05, jit(0.12))), tip], 0.011, 0.004, 4); } };
  const jit = (k) => (rnd() - 0.5) * k;

  for (const [x, y, z, kind, h, far0] of spots) {
    // The #162 trial: the court's west maple and its cedar grown by three's TreeGenerator or by ez-tree, in this
    // project's bark and leaves, so the three may be set side by side. Every other tree is grown here as before.
    if (opts.gen && ((kind === "maple" && x === -9.5 && z === 28) || (kind === "cedar" && x === -19 && z === 29))) {
      const t0 = performance.now(), t = growBy(opts.gen, kind, x, y, z, h, 7, kind === "cedar" ? 0.2 + h * 0.012 : 0.22), centre = V(x, y + h * 0.62, z);
      wood.push(...t.wood); for (const l of t.leaves) clump(kind, l.p, centre, l.w, kind === "cedar" ? 3 : 5);
      spike.push({ gen: opts.gen, kind, at: [x, z], stems: t.stems, trunks: t.trunks, ms: performance.now() - t0, wood: t.wood.reduce((n, g) => n + (g.index ? g.index.count : g.attributes.position.count) / 3, 0), leaves: t.leaves.length });
      continue;
    }
    if (kind === "cedar") {
      // A straight shaft, bare for its lower third; above that, whorl on whorl of boughs that sweep out and hang.
      // A young one is the same tree drawn smaller, its boughs only as long as its height allows, and it is not yet
      // bare below: see the end of this block.
      const lean = V(jit(0.5), 0, jit(0.5)), r0 = h < 8 ? 0.035 + h * 0.009 : 0.2 + h * 0.012, axis = (t) => V(x + lean.x * t * t, y + h * t, z + lean.z * t * t), size = Math.min(1, h / 18);
      const sides = far0 ? 12 : 24, shaft = grow([axis(0).setY(y - 0.2), axis(0.3), axis(0.62), axis(1)], r0, h < 8 ? 0.02 : 0.05, sides, far0 ? 0.4 : 0); root(x, y, z, r0, far0, { curve: shaft, r0, r1: h < 8 ? 0.02 : 0.05, sides, kind, h });
      const whorl = (by) => {   // one tier of boughs round the shaft at `by` above the ground
        const t = by / h, c = axis(t), len = (1 - t) * (3.6 + h * 0.1) * (0.78 + 0.44 * Math.sin(by * 1.3 + x)) + 0.9, n = 5 + ((rnd() * 3) | 0), a0 = rnd() * 6.283;
        for (let k = 0; k < n; k++) {
          if (rnd() < 0.14) continue;   // a gap where a bough was lost
          // and however it hangs, it stops short of the ground under it
          const a = a0 + (k / n) * 6.283 + jit(0.5), droop = 0.72 + jit(0.3), l = Math.min(len * size * (0.65 + rnd() * 0.6) * (far0 ? 1.25 : 1), (by - 0.2) / Math.cos(droop)), w = l * (0.95 + rnd() * 0.3), far = V(Math.sin(a), 0, Math.cos(a));
          // the branch the foliage hangs from, laid down the middle of the spray it carries and ending inside it
          const onSpray = (u) => c.clone().addScaledVector(far, u * l * Math.sin(droop)).add(V(0, 0.2 - u * l * Math.cos(droop), 0));
          let tip = null; if (k % 2 === 0 && !far0) { tip = onSpray(0.85); grow([c.clone(), onSpray(0.45), tip], Math.min(0.03 + (1 - t) * 0.05, r0 * 0.5), 0.012, 5); }
          // a bough: hinged at the trunk, reaching out and down
          q.setFromEuler(e.set(-droop, a, 0, "YXZ"));
          if (tip) { const loc = tip.clone().sub(c).sub(V(0, 0.2, 0)).applyQuaternion(q.clone().invert()); branches.push({ h, inside: Math.max(0, Math.abs(loc.x) - w / 2, loc.y, -l - loc.y, Math.abs(loc.z) - 0.15) }); }
          card(cards.cedar, new THREE.PlaneGeometry(w, l).translate(0, -l / 2, 0), c.clone().add(V(0, 0.2, 0)), c.clone().add(V(0, -l * 0.9, 0)), 0.72 + 0.28 * rnd(), 0.4, 0.2);
          // and a curtain hanging from it, so the tree has depth from every side
          if (k % 2 === 0 && !far0) { q.setFromEuler(e.set(0, a + Math.PI / 2, 0)); const cw = Math.min(l * 0.75, (by - 0.4) / 0.9); card(cards.cedar, new THREE.PlaneGeometry(cw, cw * 0.95).translate(0, -cw * 0.42, 0), c.clone().addScaledVector(far, l * 0.36), c.clone().add(V(0, -1.2, 0)), 0.55 + 0.25 * rnd(), 0.4, 0.2); }
        }
      };
      for (let by = h * 0.36; by < h * 0.985; by += far0 ? 0.85 : 0.4) whorl(by);   // a tree seen only from afar is grown with half the boughs, each a little larger
      q.setFromEuler(e.set(0, rnd() * 3, 0)); for (let k = 0; k < 3; k++) { q.setFromEuler(e.set(0, k * 2.1, 0)); card(cards.cedar, new THREE.PlaneGeometry(1.5, 2.3).translate(0, -0.6, 0), axis(1).add(V(0, 0.9, 0)), axis(0.9), 0.95, 0.4, 0.5); }
      // A young tree is clothed nearly to the ground, the lowest boughs short where the paving stops them. They are
      // grown from a chance of their own, so that every tree after this one keeps the shape it had.
      if (size < 1) {
        const wood0 = draw; draw = seeded(Math.abs(Math.round(x * 131 + z * 17)) + 7);
        for (let by = h * 0.36 - 0.4; by >= Math.max(0.9, h * 0.36 * size); by -= 0.4) whorl(by);
        draw = wood0;
      }
      continue;
    }
    const tall = kind === "ginkgo", top = y + h, centre = V(x, y + h * (tall ? 0.62 : 0.7), z), r0 = 0.09 + h * 0.019;
    if (tall) {
      // Ginkgo: one leader, and boughs that climb away from it.
      const lead = grow([V(x, y - 0.15, z), V(x + jit(0.3), y + h * 0.3, z + jit(0.3)), V(x + jit(0.5), y + h * 0.65, z + jit(0.5)), V(x + jit(0.4), top, z + jit(0.4))], r0, 0.03, 24, 0); root(x, y, z, r0, false, { curve: lead, r0, r1: 0.03, sides: 24, kind, h });
      let a = rnd() * 6.283;
      for (let t = 0.26; t < 0.97; t += 0.058) {
        a += 2.4 + jit(0.5); const from = lead.getPoint(t), reach = h * (0.36 - t * 0.24) * (0.8 + rnd() * 0.4), rise = reach * (0.75 + rnd() * 0.5);
        const tip = from.clone().add(V(Math.cos(a) * reach, rise, Math.sin(a) * reach)), mid = from.clone().lerp(tip, 0.5).add(V(Math.cos(a) * reach * 0.12, -rise * 0.14, Math.sin(a) * reach * 0.12)).add(V(jit(0.3), 0, jit(0.3)));
        const bough = grow([from, mid, tip], 0.03 + (1 - t) * 0.07, 0.012, 5);
        twigs(tip, V(Math.cos(a), 0, Math.sin(a)), 3, 0.5);
        for (const u of [0.45, 0.7, 0.95]) { const p = bough.getPoint(u); clump(kind, p, centre, 0.95 + rnd() * 0.5, 4);
          if (u < 0.9) { const side = p.clone().add(V(Math.cos(a + 1.3 * (rnd() < 0.5 ? -1 : 1)) * reach * 0.4, reach * 0.22, Math.sin(a + 1.3) * reach * 0.4)); grow([p, p.clone().lerp(side, 0.5).add(V(0, -0.08, 0)), side], 0.018, 0.008, 4); clump(kind, side, centre, 0.9 + rnd() * 0.4, 4); } }
      }
      clump(kind, V(x, top - 0.2, z), centre, 1.1, 5);
    } else {
      // The spreading tree: a short crooked trunk that forks low, long boughs that reach out before they rise.
      const forkAt = V(x + jit(0.6), y + h * (0.3 + rnd() * 0.07), z + jit(0.6));
      const bole = grow([V(x, y - 0.15, z), V(x + jit(0.3), y + h * 0.14, z + jit(0.3)), forkAt], r0, r0 * 0.74, 24, 0); root(x, y, z, r0, false, { curve: bole, r0, r1: r0 * 0.74, sides: 24, kind, h });
      const n = 5, a0 = rnd() * 6.283;
      for (let i = 0; i < n; i++) {
        const a = a0 + (i / n) * 6.283 + jit(0.5), reach = h * (0.36 + rnd() * 0.16), rise = h * (0.34 + rnd() * 0.2);
        const tip = forkAt.clone().add(V(Math.cos(a) * reach, rise, Math.sin(a) * reach)), elbow = forkAt.clone().add(V(Math.cos(a + jit(0.5)) * reach * 0.5, rise * 0.3, Math.sin(a + jit(0.5)) * reach * 0.5));
        const bough = grow([forkAt, elbow, tip.clone().lerp(elbow, 0.35).add(V(jit(0.4), rise * 0.12, jit(0.4))), tip], r0 * 0.5, 0.02, 8); twigs(tip, V(Math.cos(a), 0, Math.sin(a)), 4, 0.6);
        for (const u of [0.42, 0.6, 0.78, 0.97]) {
          const p = bough.getPoint(u); clump(kind, p, centre, 1.05 + rnd() * 0.55, 5);
          if (u < 0.9) {   // a side branch, and a twig off that
            const b = a + (rnd() < 0.5 ? -1 : 1) * (0.7 + rnd() * 0.6), side = p.clone().add(V(Math.cos(b) * reach * 0.45, rise * 0.16 + jit(0.4), Math.sin(b) * reach * 0.45));
            const sb = grow([p, p.clone().lerp(side, 0.5).add(V(jit(0.25), -0.1, jit(0.25))), side], 0.035, 0.012, 5); clump(kind, side, centre, 1.0 + rnd() * 0.5, 5); twigs(side, V(Math.cos(b), 0, Math.sin(b)), 3, 0.55);
            const mid = sb.getPoint(0.55), tw = mid.clone().add(V(jit(1.3), 0.5 + rnd() * 0.5, jit(1.3))); grow([mid, tw], 0.014, 0.006, 4); clump(kind, tw, centre, 0.9 + rnd() * 0.4, 4);
          }
        }
      }
      clump(kind, centre.clone().add(V(jit(0.8), h * 0.2, jit(0.8))), centre, 1.5, 5);
    }
  }
  scene.add(mesh(merge(wood), M.bark));
  if (beds.length) { const soil = mesh(merge(beds), M.earth); soil.receiveShadow = true; scene.add(soil); }

  const tex = { blossom: sheet("blossom"), maple: sheet("maple"), ginkgo: sheet("ginkgo"), cedar: sheet("cedar"), twig: sheet("twig") }, crowns = {};
  const put = (kind, map, o) => {
    if (!cards[kind].length) return;
    const mat = crownMaterial(map, { a2c: opts.a2c, ...o }), m = new THREE.Mesh(mergeGeometries(cards[kind]), mat);
    m.castShadow = true; m.receiveShadow = false; m.renderOrder = 1; scene.add(m); crowns[kind] = { mat, mesh: m };   // after the buildings, which then hide most of it for nothing
  };
  put("maple", tex.maple, {}); put("ginkgo", tex.ginkgo, {}); put("cedar", tex.cedar, { sway: 0.02, snow: 0.8 }); put("twig", tex.twig, { sway: 0.012, snow: 0.55 });
  return {
    joints, branches, spike,
    setMood(m) {
      for (const kind of ["maple", "ginkgo", "cedar"]) {
        const c = COLOURS[kind][m.season], k = crowns[kind]; if (!k) continue;
        k.mesh.visible = !!c; if (!c) continue;
        k.mat.color.setRGB(...c); if (kind === "maple") k.mat.map = m.season === "spring" ? tex.blossom : tex.maple;
      }
      // Bare twigs show only when the leaves are down.
      if (crowns.twig) { crowns.twig.mesh.visible = m.season === "winter"; crowns.twig.mat.color.setRGB(0.2, 0.16, 0.13); }
    },
  };
}
