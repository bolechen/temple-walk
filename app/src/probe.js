// Baked light probes (#592, trial A): where the light that is not the sun's comes from, and where it is shut out.
//
// The sky's light on a surface is, in this place, one colour from above and one from below (a hemisphere light and the
// sky's own environment map): it does not know that a court's floor lies under the eaves of four halls, or that the
// whitewashed wall beside it is lit. Probes say so. At build time `tools/bake-probes.mjs` stands a lattice of points in
// the court and in the great hall, casts rays from each against the drawn meshes, and keeps, as the first four spherical
// harmonics, how much of the sky each can see and what colour of light the nearer surfaces give back. The page reads
// them as four small 3-D pictures and a surface asks for the lattice's value at its own point, trilinear, in one fetch
// each: nothing is worked out per frame.
//
// A trial: off unless the address says `?trial=probe` (a material built without it has none of this in its shader, so
// the default page is exactly what it was). `PROBE_GLSL` is what a shader adds; `createProbes` loads the files.
import * as THREE from "three";
import { asset } from "./assets.js";
import { U } from "./glsl.js";

/** Whether this page was asked to wear the trial. Read once, before any material is built. */
export const PROBE_ON = typeof location !== "undefined" && /[?&]trial=([^&]*,)?probe(,|&|$)/.test(location.search);

/** The four volumes (one per harmonic) and the box they stand over; shared by reference with every shader that asks. */
export const PROBE = {
  uProbeBox: { value: new THREE.Vector4(0, 0, 0, 0) },      // x, y, z of the lattice's low corner and the cell size, metres
  uProbeDim: { value: new THREE.Vector3(1, 1, 1) },          // points along x, y, z
  uProbeK: { value: 1 }, uProbeAmb: U.uAmb, uProbeAbs: { value: 0 },   // the sky level the bounce is a share of (the hour sets it), or 1 where the bounce is absolute (a room's lamps)
                                      // how much of the trial shows (0 none: the surface as it was)
  tProbe0: { value: null }, tProbe1: { value: null }, tProbe2: { value: null }, tProbe3: { value: null },
};

/** What a lit surface adds: `probeLight(world point, world normal, out bounce)` gives the share of the sky it sees, and the bounce in `bounce`. */
export const PROBE_GLSL = /* glsl */`
uniform vec4 uProbeBox; uniform vec3 uProbeDim; uniform float uProbeK, uProbeAbs; uniform vec3 uProbeAmb;
uniform highp sampler3D tProbe0, tProbe1, tProbe2, tProbe3;
float probeLight(vec3 p, vec3 n, out vec3 bounce){
  bounce=vec3(0.);
  if(uProbeBox.w<=0.||uProbeK<=0.) return 1.;
  vec3 g=(p-uProbeBox.xyz)/uProbeBox.w, hi=uProbeDim-1.;
  // Past the lattice the trial fades out over a cell and a half, so its edge is not a seam.
  vec3 e=min(g,hi-g); float w=clamp(min(e.x,min(e.y,e.z))/1.5+.5,0.,1.)*uProbeK; if(w<=0.) return 1.;
  vec3 uv=(clamp(g,vec3(0.),hi)+.5)/uProbeDim;
  vec4 c0=texture(tProbe0,uv), c1=texture(tProbe1,uv), c2=texture(tProbe2,uv), c3=texture(tProbe3,uv);
  // Irradiance from the first four harmonics, as a share of what an open sky gives: A0*Y0*c0 + A1*Y1*(c1*y + c2*z + c3*x), cosine-convolved.
  vec4 f=c0*.282095+(c1*n.y+c2*n.z+c3*n.x)*.325735;
  bounce=max(f.rgb,0.)*w*mix(uProbeAmb,vec3(1.),uProbeAbs);
  return mix(1.,clamp(f.a,0.,1.2),w);
}`;

/**
 * Read the lattices of the level's baked file and stand the court's under the shaders. `setRoom(id)` swaps in a room's
 * (the great hall's, in the trial); out of doors, or in a room the file has none for, the court's. Loads nothing unless the
 * page was asked for the trial.
 * @param {string} levelId
 */
export function createProbes(levelId) {
  /** @type {Record<string, any>} */ const grids = {};
  let current = "outdoors", ready = false;
  const put = (id) => {
    const g = grids[id];
    if (!g) { PROBE.uProbeBox.value.set(0, 0, 0, 0); return; }
    PROBE.uProbeBox.value.set(g.box[0], g.box[1], g.box[2], g.cell); PROBE.uProbeDim.value.set(g.dim[0], g.dim[1], g.dim[2]);
    for (let k = 0; k < 4; k++) PROBE["tProbe" + k].value = g.tex[k];
  };
  const api = {
    get ready() { return ready; },
    get grids() { return Object.fromEntries(Object.entries(grids).map(([id, g]) => [id, { dim: g.dim, cell: g.cell, box: g.box, bytes: g.bytes }])); },
    /** Show the trial at strength `k` (0 to 1; 1 is the baked light). */
    strength(k) { PROBE.uProbeK.value = k; },
    setRoom(id) { current = id && grids["room:" + id] ? "room:" + id : id ? "none" : "outdoors"; put(current); },
    async load() {
      if (!PROBE_ON) return api;
      const res = await fetch(asset(`shared/probes/${levelId}.bin`));
      if (!res.ok) throw new Error(`probes: ${res.status}`);
      const buf = await res.arrayBuffer(), dv = new DataView(buf), hl = dv.getUint32(4, true);
      const head = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 8, hl)));
      let off = 8 + hl; off += (4 - (off % 4)) % 4;
      for (const h of head.grids) {
        const n = h.dim[0] * h.dim[1] * h.dim[2] * 4, tex = [];
        for (let k = 0; k < 4; k++) {
          const data = new Uint16Array(buf.slice(off, off + n * 2)); off += n * 2;
          const t = new THREE.Data3DTexture(data, h.dim[0], h.dim[1], h.dim[2]);
          t.format = THREE.RGBAFormat; t.type = THREE.HalfFloatType; t.minFilter = t.magFilter = THREE.LinearFilter; t.wrapS = t.wrapT = t.wrapR = THREE.ClampToEdgeWrapping; t.unpackAlignment = 1; t.needsUpdate = true;
          tex.push(t);
        }
        grids[h.id] = { ...h, tex, bytes: n * 8 };
      }
      ready = true; put(current);
      return api;
    },
  };
  return api;
}
