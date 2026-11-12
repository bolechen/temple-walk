// A Song-style timber building from a handful of numbers: platform, columns, beams, bracket sets,
// infill, and a curved tiled roof. Built in local space: centred on the origin, front facing +z.
// Halls, gate houses, towers and covered walks are all this function with different parameters.
import * as THREE from "../v/build/three.module.js";
import { box, smooth, plain, merge, mesh, tube, stairGeo } from "./geo.js";
import { makePlaque } from "./plaque.js";

const DEFAULTS = {
  xs: [-6.7, -2.5, 2.5, 6.7],   // column lines across the front
  zs: [5.4, 1.8, -1.8, -5.4],   // column lines front to back (front first)
  platH: 0.9, platOut: 1.6,     // platform height and how far it reaches beyond the columns
  platBase: 0,                  // where the platform starts: above 0 for an upper storey standing on a roof
  ground: 0,                    // height of the terrace the building stands on (for weathering that follows the ground)
  colTop: 4.08,                 // column head above the platform
  overhang: 2.4,                // eave beyond the columns
  rise: 5.2,                    // eave to ridge
  G: 3.3,                       // depth of the end slopes: 0 = plain gable, >= half depth = pyramid
  lift: 0.5, liftLen: 3.6,      // corner upturn and how far along the eave it reaches
  brackets: true,
  front: "lattice",             // lattice | pass | wall | open
  back: "wall",                 // wall | pass | open
  sides: "wall",                // wall | open
  dark: true, lamps: true,      // a dark interior behind the front, with two lamps far back
  steps: 4.6, stepsBack: 0,     // width of the stairs, 0 for none
  walkAll: false,               // the whole platform is open floor (covered walks)
  plaque: "",                   // name board over the front: a string, or { text, vertical, gold }
  rail: false,                  // a white stone balustrade round the platform
};

export function buildHall(M, opts) {
  const p = { ...DEFAULTS, ...opts };
  const { xs, zs } = p, nx = xs.length - 1, X = xs[nx], Z = zs[0], ZB = zs[zs.length - 1];
  const COL_TOP = p.platH + p.colTop, PLATE_TOP = COL_TOP + 0.12;
  const EX = X + p.overhang, EZ = Z + p.overhang;
  const EAVE_Y = PLATE_TOP + (p.brackets ? 0.75 : 0.2);
  const G = Math.min(p.G, EZ), gx = EX - G, lift = G > 0.05 ? p.lift : 0;
  const zF = Z + p.platOut, zB = ZB - p.platOut, PX = X + p.platOut;

  const profile = (d) => p.rise * Math.pow(Math.min(Math.max(d, 0), EZ) / EZ, 1.38);   // concave roof curve
  function roofY(x, z, eps = 0) {
    const dz = EZ - Math.abs(z), dx = EX - Math.abs(x) + eps;
    const d = dx <= G ? Math.min(dz, dx) : dz;                 // beyond G the end slope stops: that step is the gable
    const t = Math.max(0, 1 - Math.max(dz, dx) / p.liftLen);
    return EAVE_Y + profile(d) + lift * t * t * (1 - smooth(0, 2.6, Math.min(dz, dx)));
  }
  // Darker the higher a surface sits beneath the roof.
  const ao = (x, y, z) => 1 - smooth(-0.4, 1.6, Math.min(EX - Math.abs(x), EZ - Math.abs(z))) * smooth(EAVE_Y - 2.7, EAVE_Y + 0.3, y) * 0.72;

  const g = new THREE.Group();
  const add = (geo, mat, o = {}) => { const m = mesh(geo, mat, { ao, ...o }); g.add(m); return m; };

  // ---- Platform and stairs ----
  const run = stairGeo(1, p.platH).run, stairs = (w) => stairGeo(w, p.platH).geo;
  {
    const parts = [box(PX * 2, p.platH - p.platBase, zF - zB, 0, (p.platH + p.platBase) / 2, (zF + zB) / 2)];
    if (p.steps) parts.push(stairs(p.steps).translate(0, 0, zF));
    if (p.stepsBack) parts.push(stairs(p.stepsBack).rotateY(Math.PI).translate(0, 0, zB));
    add(merge(parts), p.platBase > 0 ? M.woodX : M.stone, { ao: null });   // an upper floor is a timber gallery, not a stone platform
  }
  if (p.rail) {   // posts with caps, a top rail and a panel between, broken where the stairs arrive
    const parts = [], y = p.platH, inset = 0.16, gapF = p.steps ? p.steps / 2 + 0.5 : 0, gapB = p.stepsBack ? p.stepsBack / 2 + 0.5 : 0;
    const run = (ax, a, b, fixed) => {   // a line of railing along x (ax = "x") or z, from a to b
      const n = Math.max(1, Math.round((b - a) / 1.5)), d = (b - a) / n;
      for (let i = 0; i <= n; i++) { const t = a + i * d, px = ax === "x" ? t : fixed, pz = ax === "x" ? fixed : t; parts.push(box(0.17, 1.0, 0.17, px, y + 0.5, pz), box(0.23, 0.1, 0.23, px, y + 1.05, pz)); }
      const mid = (a + b) / 2, len = b - a;
      parts.push(ax === "x" ? box(len, 0.1, 0.11, mid, y + 0.86, fixed) : box(0.11, 0.1, len, fixed, y + 0.86, mid), ax === "x" ? box(len, 0.46, 0.06, mid, y + 0.42, fixed) : box(0.06, 0.46, len, fixed, y + 0.42, mid));
    };
    const ex = PX - inset;
    for (const [z, gap] of [[zF - inset, gapF], [zB + inset, gapB]]) { if (gap) { run("x", -ex, -gap, z); run("x", gap, ex, z); } else run("x", -ex, ex, z); }
    run("z", zB + inset, zF - inset, -ex); run("z", zB + inset, zF - inset, ex);
    add(merge(parts), p.platBase > 0 ? M.woodX : M.marble, { ao: null });
  }

  // ---- Columns ----
  const perimeter = [];
  for (const x of xs) for (const z of zs) {
    const ox = x === xs[0] ? -1 : x === X ? 1 : 0, oz = z === Z ? 1 : z === ZB ? -1 : 0;
    if (ox || oz) perimeter.push({ x, z, ox, oz });
  }
  {
    const h = p.colTop - 0.25, r = p.colTop > 3.6 ? 0.27 : 0.2;
    const shaft = new THREE.LatheGeometry([[r, 0], [r * 1.02, h * 0.15], [r, h * 0.55], [r * 0.93, h * 0.88], [r * 0.87, h]].map(([a, b]) => new THREE.Vector2(a, b)), 18).translate(0, p.platH + 0.25, 0);
    const drum = new THREE.LatheGeometry([[0, 0], [r * 1.5, 0], [r * 1.56, 0.05], [r * 1.33, 0.13], [r * 1.22, 0.22], [r * 1.1, 0.25], [0, 0.25]].map(([a, b]) => new THREE.Vector2(a, b)), 18).translate(0, p.platH, 0);
    add(merge(perimeter.map((c) => shaft.clone().translate(c.x, 0, c.z))), M.woodV);
    add(merge(perimeter.map((c) => drum.clone().translate(c.x, 0, c.z))), M.stone, { ao: null });
  }

  // ---- Beams ----
  const bh = 0.36, by = COL_TOP - bh / 2, topY = COL_TOP - bh;
  const bx = [], bz = [];
  for (const z of [Z, ZB]) {
    for (let i = 0; i < nx; i++) bx.push(box(xs[i + 1] - xs[i], bh, 0.2, (xs[i] + xs[i + 1]) / 2, by, z));
    bx.push(box(X * 2 + 0.7, 0.12, 0.5, 0, COL_TOP + 0.06, z));
  }
  for (const x of [xs[0], X]) {
    for (let i = 0; i < zs.length - 1; i++) bz.push(box(0.2, bh, zs[i] - zs[i + 1], x, by, (zs[i] + zs[i + 1]) / 2));
    bz.push(box(0.5, 0.12, Z - ZB + 0.7, x, COL_TOP + 0.06, (Z + ZB) / 2));
  }

  // ---- Infill ----
  const walls = [], lat = [];
  const sill = p.platH + 0.16, head = Math.min(sill + 2.86, topY - 0.5), hasTransom = topY - head > 0.4;
  const leaf = (x0, x1, y0, y1, transom, z, flip) => {
    const g2 = new THREE.PlaneGeometry(x1 - x0, y1 - y0);
    if (flip) g2.rotateY(Math.PI);
    g2.translate((x0 + x1) / 2, (y0 + y1) / 2, z);
    const n = Math.max(1, Math.round((x1 - x0) / 1.05)), uv = g2.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * n, (transom ? 100 : 0) + uv.getY(i) * (transom ? 0.7 : 3.02));
    lat.push(g2);
  };
  const mid = Math.floor(nx / 2);
  const face = (mode, z, sign) => {   // one long side of the building; sign = +1 front, -1 back
    if (mode === "open") return;
    const zz = z - sign * 0.03, flip = sign < 0;
    for (let i = 0; i < nx; i++) {
      const x0 = xs[i] + 0.25, x1 = xs[i + 1] - 0.25, centre = i === mid;
      if (mode === "lattice") {
        if (centre && p.dark) { leaf(x0, x0 + 1.05, sill, head, false, zz, flip); leaf(x1 - 1.05, x1, sill, head, false, zz, flip); }
        else leaf(x0, x1, sill, head, false, zz, flip);
        if (hasTransom) leaf(x0, x1, head + 0.14, topY, true, zz, flip);
      } else if (!(mode === "pass" && centre)) {
        walls.push(box(x1 - x0, topY - p.platH, 0.14, (x0 + x1) / 2, (topY + p.platH) / 2, z));
        bx.push(box(x1 - x0, 0.16, 0.2, (x0 + x1) / 2, p.platH + 1.5, z));
      }
    }
    if (mode === "lattice") bx.push(box(X * 2, 0.16, 0.2, 0, p.platH + 0.08, z), box(X * 2, 0.14, 0.18, 0, head + 0.07, z));
  };
  face(p.front, Z, 1); face(p.back, ZB, -1);
  if (p.sides === "wall") for (const x of [xs[0], X]) for (let i = 0; i < zs.length - 1; i++) {
    walls.push(box(0.14, topY - p.platH, zs[i] - zs[i + 1] - 0.5, x, (topY + p.platH) / 2, (zs[i] + zs[i + 1]) / 2));
    bz.push(box(0.2, 0.16, zs[i] - zs[i + 1] - 0.5, x, p.platH + 1.5, (zs[i] + zs[i + 1]) / 2));
  }
  const underside = (d) => EAVE_Y + profile(d) - 0.17;
  if (p.brackets) {   // the white band between the bracket sets, all the way round
    const bandH = underside(p.overhang) - PLATE_TOP + 0.12, y = PLATE_TOP + bandH / 2;
    walls.push(box(X * 2, bandH, 0.1, 0, y, Z), box(X * 2, bandH, 0.1, 0, y, ZB), box(0.1, bandH, Z - ZB, xs[0], y, (Z + ZB) / 2), box(0.1, bandH, Z - ZB, X, y, (Z + ZB) / 2));
  }
  add(merge(bx), M.woodX); add(merge(bz), M.woodZ);
  if (walls.length) add(merge(walls), M.plaster(p.platH + p.ground));
  if (lat.length) add(merge(lat), M.lattice, { cast: false });
  if (p.dark) {
    const d = Math.min(2.4, Z - ZB - 0.4);
    const m = new THREE.Mesh(box(X * 2 - 0.3, topY - p.platH - 0.03, d, 0, p.platH + (topY - p.platH) / 2, Z - 0.1 - d / 2), M.dark);
    g.add(m);
    if (p.lamps) for (const sx of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), M.flame);
      f.position.set(sx * 1.1, p.platH + 1.2, Z - d + 0.1); g.add(f);
    }
  }

  // ---- Bracket sets (dougong) ----
  if (p.brackets) {
    // One set, outward = +z, base at y = 0: blocks, lateral arms, two projecting tiers, an outer lateral arm.
    const set = merge([
      box(0.46, 0.26, 0.46, 0, 0.13, 0),
      box(1.25, 0.17, 0.16, 0, 0.36, 0), box(0.22, 0.14, 0.22, -0.52, 0.52, 0), box(0.22, 0.14, 0.22, 0.52, 0.52, 0),
      box(1.7, 0.16, 0.15, 0, 0.68, 0),
      box(0.16, 0.18, 1.0, 0, 0.36, 0.25), box(0.22, 0.14, 0.22, 0, 0.52, 0.62),
      box(0.16, 0.18, 1.3, 0, 0.67, 0.3),
      box(1.0, 0.15, 0.15, 0, 0.84, 0.88), box(0.2, 0.12, 0.2, -0.4, 0.97, 0.88), box(0.2, 0.12, 0.2, 0.4, 0.97, 0.88),
      box(0.14, 0.14, 0.36, 0, 0.67, 1.05),
      new THREE.BoxGeometry(0.13, 0.15, 1.5).rotateX(0.32).translate(0, 0.6, 0.55),   // the slanting arm whose beak shows under the eave
    ]);
    const spots = perimeter.map((c) => ({ x: c.x, z: c.z, a: Math.atan2(c.ox, c.oz) }));
    const between = (a, b) => { const n = Math.abs(b - a) > 4.6 ? 2 : 1; return Array.from({ length: n }, (_, i) => a + ((b - a) * (i + 1)) / (n + 1)); };
    for (const [z, a] of [[Z, 0], [ZB, Math.PI]]) for (let i = 0; i < nx; i++) for (const x of between(xs[i], xs[i + 1])) spots.push({ x, z, a });
    for (const [x, a] of [[xs[0], -Math.PI / 2], [X, Math.PI / 2]]) for (let i = 0; i < zs.length - 1; i++) for (const z of between(zs[i], zs[i + 1])) spots.push({ x, z, a });
    add(merge(spots.map((s) => set.clone().rotateY(s.a).translate(s.x, PLATE_TOP, s.z))), M.woodX);
    const o = 0.88, py = PLATE_TOP + 1.0;   // the eave purlin the outer arms carry
    add(merge([box(X * 2 + o * 2 + 0.6, 0.2, 0.17, 0, py, Z + o), box(X * 2 + o * 2 + 0.6, 0.2, 0.17, 0, py, ZB - o)]), M.woodX);
    add(merge([box(0.17, 0.2, Z - ZB + o * 2 + 0.6, xs[0] - o, py, (Z + ZB) / 2), box(0.17, 0.2, Z - ZB + o * 2 + 0.6, X + o, py, (Z + ZB) / 2)]), M.woodZ);
  }

  // ---- Roof ----
  {
    const STEP = 0.26;
    const cols = [];   // {x, eps}: the gable line appears twice, once evaluated on each side of the step
    for (let x = -EX; x < EX - 1e-6; x += STEP) cols.push({ x, eps: 0 });
    cols.push({ x: EX, eps: 0 });
    const split = gx > 0.3 && G > 0.05;
    if (split) for (const s of [-1, 1]) cols.push({ x: s * gx, eps: 0, cut: s }, { x: s * gx, eps: -1e-3, cut: s, inner: true });
    cols.sort((a, b) => a.x - b.x || ((a.inner ? 1 : 0) - (b.inner ? 1 : 0)) * Math.sign(a.x));
    const rows = []; for (let z = -EZ; z < EZ - 1e-6; z += STEP) rows.push(z); rows.push(EZ);

    const pos = [], uv = [], idx = [], nz = rows.length;
    for (const c of cols) for (const z of rows) {
      const dz = EZ - Math.abs(z), dx = EX - Math.abs(c.x) + c.eps, end = dx <= G && dx < dz;   // on an end slope the tiles run the other way
      pos.push(c.x, roofY(c.x, z, c.eps), z); uv.push(end ? z : c.x, end ? dx : dz);
    }
    for (let i = 0; i < cols.length - 1; i++) {
      if (cols[i].cut && cols[i + 1].cut && cols[i].x === cols[i + 1].x) continue;   // the vertical step is the gable wall, built below
      for (let j = 0; j < nz - 1; j++) { const a = i * nz + j, b = a + nz; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    }
    const top = new THREE.BufferGeometry();
    top.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    top.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    top.setIndex(idx); top.computeVertexNormals();
    add(top, M.tile, { ao: null });
    add(top.clone().translate(0, -0.17, 0), M.rafters, { cast: false });   // boards and rafters seen from below

    // Eave board closing the edge between tiles and rafters.
    const ring = [];
    for (let x = -EX; x <= EX + 1e-6; x += STEP) ring.push([Math.min(x, EX), EZ]);
    for (let z = EZ; z >= -EZ - 1e-6; z -= STEP) ring.push([EX, Math.max(z, -EZ)]);
    for (let x = EX; x >= -EX - 1e-6; x -= STEP) ring.push([Math.max(x, -EX), -EZ]);
    for (let z = -EZ; z <= EZ + 1e-6; z += STEP) ring.push([-EX, Math.min(z, EZ)]);
    const ep = [], ei = [];
    ring.forEach(([x, z], i) => { const y = roofY(x, z); ep.push(x, y + 0.02, z, x, y - 0.2, z); if (i) { const a = (i - 1) * 2; ei.push(a, a + 1, a + 2, a + 2, a + 1, a + 3); } });
    const fascia = new THREE.BufferGeometry();
    fascia.setAttribute("position", new THREE.Float32BufferAttribute(ep, 3));
    fascia.setAttribute("uv", new THREE.Float32BufferAttribute(new Array((ep.length / 3) * 2).fill(0), 2));
    fascia.setIndex(ei); fascia.computeVertexNormals();
    add(fascia, M.fascia, { ao: null });

    // Round end tiles closing each row of cover tiles along the eave.
    const ends = [], cap = new THREE.CylinderGeometry(0.085, 0.085, 0.07, 10);
    for (let x = -EX + 0.125 + 0.4; x < EX - 0.4; x += 0.25) for (const s of [-1, 1]) ends.push(cap.clone().rotateX(Math.PI / 2).translate(x, roofY(x, s * EZ) + 0.035, s * (EZ + 0.02)));
    if (G > 0.05) for (let z = -EZ + 0.125 + 0.4; z < EZ - 0.4; z += 0.25) for (const s of [-1, 1]) ends.push(cap.clone().rotateZ(Math.PI / 2).translate(s * (EX + 0.02), roofY(s * EX, z) + 0.035, z));
    add(merge(ends), M.ridge, { ao: null, cast: false });

    // Ridges: the main ridge with its end ornaments, the gable ridges, the hip ridges that sweep up at the corners.
    const ridgeY = EAVE_Y + p.rise, parts = [];
    if (gx > 0.3) {
      parts.push(box(gx * 2 + 0.5, 0.62, 0.36, 0, ridgeY + 0.2, 0), box(gx * 2 + 0.7, 0.1, 0.46, 0, ridgeY + 0.54, 0));
      const k = Math.min(1, p.rise / 5), curl = new THREE.Shape([[0, 0], [0.95, 0], [1.0, 0.55], [0.74, 1.1], [0.34, 1.36], [0.1, 1.18], [0.36, 0.98], [0.46, 0.66], [0.22, 0.5], [0, 0.56]].map(([x, y]) => new THREE.Vector2(x * k, y * k)));
      for (const s of [-1, 1]) {
        const c = plain(new THREE.ExtrudeGeometry(curl, { depth: 0.34, bevelEnabled: false }).translate(-k, 0, -0.17));
        if (s < 0) {   // mirror, then restore the winding
          c.scale(-1, 1, 1);
          for (const a of ["position", "uv"]) { const arr = c.attributes[a].array, n = a === "uv" ? 2 : 3; for (let i = 0; i < arr.length; i += n * 3) for (let q = 0; q < n; q++) { const t = arr[i + q]; arr[i + q] = arr[i + n + q]; arr[i + n + q] = t; } }
        }
        parts.push(c.translate(s * (gx + 0.25), ridgeY - 0.1, 0));
      }
    } else {   // pyramid roof: a finial at the apex
      parts.push(new THREE.LatheGeometry([[0, 0], [0.34, 0], [0.4, 0.12], [0.2, 0.3], [0.3, 0.52], [0.22, 0.78], [0.08, 0.95], [0, 1.3]].map(([a, b]) => new THREE.Vector2(a, b)), 14).translate(0, roofY(0, 0) - 0.1, 0));
    }
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      if (G > 0.05) {
        const hip = [];
        for (let t = -0.04; t <= 1.0001; t += 0.08) { const d = t * G, x = sx * (EX - d), z = sz * (EZ - d); hip.push(new THREE.Vector3(x, roofY(x, z) + 0.13 + (t < 0 ? 0.12 : 0), z)); }
        parts.push(tube(hip, 0.17));
      }
      if (gx > 0.3 && EZ - G > 0.3) {
        const gab = [];
        for (let t = 0; t <= 1.0001; t += 0.1) { const z = sz * (EZ - G) * (1 - t); gab.push(new THREE.Vector3(sx * (gx + 0.02), EAVE_Y + profile(EZ - Math.abs(z)) + 0.14, z)); }
        parts.push(tube(gab, 0.15));
      }
    }
    add(merge(parts), M.ridge, { ao: null });

    // Gable walls under the upper roof.
    const half = EZ - G;
    if (gx > 0.3 && half > 0.3) {
      const gs = new THREE.Shape(), baseY = EAVE_Y + profile(G) - 0.25;
      gs.moveTo(-half, baseY);
      for (let z = -half; z <= half + 1e-6; z += 0.3) gs.lineTo(z, EAVE_Y + profile(EZ - Math.abs(z)) - 0.22);
      gs.lineTo(half, baseY);
      for (const s of [-1, 1]) add(plain(new THREE.ShapeGeometry(gs).rotateY((s * Math.PI) / 2).translate(s * (gx - 0.3), 0, 0)), M.gable, { ao: null });
    }
  }

  if (p.plaque) {   // hung forward of the bracket arms, tucked under the eave
    const pq = typeof p.plaque === "string" ? { text: p.plaque } : p.plaque, m = makePlaque(pq.text, pq), zz = Z + (p.brackets ? 1.3 : 0.45);
    m.position.set(0, Math.min(PLATE_TOP + 0.52, underside(p.overhang - (zz - Z)) - m.userData.height / 2 - 0.08), zz); m.rotation.x = 0.1;
    g.add(m);
  }

  // ---- Where you can stand (local space; the site turns these into world space) ----
  const walk = { solids: [], decks: [], ramps: [] };
  const plat = { x0: -PX, x1: PX, z0: zB, z1: zF };
  if (p.walkAll) walk.decks.push({ ...plat, h: p.platH });
  else {
    walk.solids.push({ x0: -PX - 0.5, x1: PX + 0.5, z0: zB - 0.5, z1: zF + 0.5 });
    const stair = (w, sign) => {   // sign = +1 front, -1 back
      const edge = sign > 0 ? zF : zB, a = edge - sign * 0.25, b = edge + sign * run, hw = w / 2 - 0.3;
      walk.ramps.push({ x0: -hw, x1: hw, z0: Math.min(a, b), z1: Math.max(a, b), h: p.platH, low: [0, b], high: [0, a] });
      walk.solids.push({ x0: -w / 2 - 0.8, x1: w / 2 + 0.8, z0: Math.min(edge, b), z1: Math.max(edge, b) });
    };
    if (p.steps) stair(p.steps, 1);
    if (p.stepsBack) stair(p.stepsBack, -1);
    const passing = p.front === "pass" && p.back === "pass";
    if (passing) { const hw = (xs[mid + 1] - xs[mid]) / 2 - 0.45; walk.decks.push({ x0: -hw, x1: hw, z0: zB + 0.25, z1: zF - 0.25, h: p.platH }); }
    else if (p.steps) walk.decks.push({ x0: -X - 0.8, x1: X + 0.8, z0: Z + 0.45, z1: zF - 0.25, h: p.platH });   // the porch
  }

  return { group: g, walk, plat, EX, EZ, eaveY: EAVE_Y, ridgeY: EAVE_Y + p.rise, colTop: COL_TOP, platH: p.platH, run, frontZ: Z, zF, zB, roofAt: (d) => EAVE_Y + profile(d) };
}
