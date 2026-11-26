// The ground of the great hall's murals, inside its back and end walls, made for T05 alone (the prologue has no such wall).
// The walls of the real hall carry Yuan and Ming murals on an earth ground, darker and greyer than the timber's paint
// (ARCHITECTURE.md §7.2); until the figures are painted on them (ART.md, phase two) this is that ground, aged and smoked.
// It replaces the lime wash the hall's inner walls shared with the court's: under the door's light the lime read L* 45–48,
// pure grey (C* 0.1), the lightest thing between the seven's seats, lighter than their faces (30–42), so that the eye went to
// the gaps first (the art director on #762, 2026-11-26, comment 7182749941). The line given: no lighter than the darkest face
// in the same picture, no darker than 18, and warm (b* at least +2), as the lime and the mural grounds of ART.md are.
// Two things made the lime read so. The doors' spots reached the walls (their range now stops short of them: hall.js FILL),
// and what light the walls did get was the court's sky, blue, in its diffuse share and in its sheen. So the ground takes
// three fifths of the sky's share the lime takes, none of its sheen, and in their place a warm bounce that comes up with the
// hall's own light (MURAL_LIT, set by site.js's tick): the light the floor and the timber throw back. Software rendering,
// #762's lights: L* 18.2, b* +2.4 at cam03; 19.7, +3.4 at mid10-6 (tools/t05-zones.cjs). The light pass judges it on a T4.
import * as THREE from "three";
import { procMat } from "../../src/materials.js";

/** The earth colour of the ground and how far it varies; the foot of the wall and the smoke near the top are darker. */
export const MURAL = Object.freeze({ base: [0.77, 0.624, 0.458], vary: 0.12, foot: 0.8, smoke: 0.82, sky: 0.6, bounce: 0.2, warm: [1, 0.8, 0.55] });

/** How much of the hall's own light is up (site.js's tick sets it with the fill, 0 from the court, 1 well inside). */
export const MURAL_LIT = { value: 0 };

const made = new WeakMap();
/** The mural ground for this set of materials, made once. @param {object} M */
export function muralMaterial(M) {
  if (!made.has(M)) {
    const v = MURAL.base.map((x) => x.toFixed(3)).join(",");
    const warm = MURAL.warm.map((x) => x.toFixed(3)).join(",");
    const m = procMat("muralGround", { roughness: 0.92, envMapIntensity: 0 }, `
      float base=vUv2.x; vec3 q=vWP/2.7, w=triW(vWN);
      vec3 A=triA(tPlasterA,q,w)/mPlaster; vec4 Nr=triN(tPlasterN,q,w);
      float lay=fbm3(vWP*vec3(.18,.3,.18))-.5;                                 // the ground laid in patches, as a painter's crew lays it
      col=vec3(${v})*mix(vec3(1.),A,.35)*(1.+${MURAL.vary.toFixed(3)}*2.*lay);
      col*=mix(${MURAL.foot.toFixed(3)},1.,smoothstep(base,base+1.6,vWP.y));    // darker where the damp rises at the foot
      col*=mix(1.,${MURAL.smoke.toFixed(3)},smoothstep(base+7.,base+11.,vWP.y)); // and smoked toward the top, where the lamps' soot gathers
      ao_*=${MURAL.sky.toFixed(3)};                                               // the back and end walls face away from the doors: less of the court's sky reaches them than the lime's share
      emit_=col*vec3(${warm})*uMuralLit*${MURAL.bounce.toFixed(3)}*vAO;          // and what does is the light the floor and the timber throw back, warm, which comes up with the hall's own
      rough_=Nr.w*.95; nd_=Nr.xyz*.6;`, { tex: ["plaster"], snow: false, glsl: "uniform float uMuralLit;", uniforms: () => ({ uMuralLit: MURAL_LIT }) });
    m.name = "muralGround";
    made.set(M, m);
  }
  return made.get(M);
}

/**
 * The faces of the hall's own lime walls that look into the hall, apart from the rest. Above the column heads the inner
 * face of each wall shows between the bracket sets (the Yingzao Fashi's gongyan walls), and there the lime, lit as the
 * inside is lit and taking the court's blue sky in its sheen, read as a cold grey band over the seven (L* 23, b* -6 at
 * mid10-6). Those boards are painted in the real halls, on the same ground as the walls below them, so the faces inside
 * the shut box, or within the walls' depth of it (the boards stand on the column line), that turn toward its middle take the mural ground; every face that looks outward, from the court under the
 * eaves, stays lime. @param {THREE.BufferGeometry[]} list @param {{ x0: number, x1: number, z0: number, z1: number, y0: number, y1: number }} b
 * @returns {[THREE.BufferGeometry[], THREE.BufferGeometry[]]} the faces that look in, and the rest
 */
export function splitInward(list, b, reach = 0) {
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, e = 0.02, ins = [], outs = [];   // (e: and horizontally the walls' thickness more, `reach`, since the boards stand on the column line inside the wall's depth)
  for (const g0 of list) {
    const g = g0.index ? g0.toNonIndexed() : g0, P = g.attributes.position, N = g.attributes.normal, n = P.count / 3, keep = [[], []];
    for (let t = 0; t < n; t++) {
      let x = 0, y = 0, z = 0, nx = 0, ny = 0, nz = 0;
      for (let k = 0; k < 3; k++) { const i = 3 * t + k; x += P.getX(i) / 3; y += P.getY(i) / 3; z += P.getZ(i) / 3; nx += N.getX(i); ny += N.getY(i); nz += N.getZ(i); }
      const l = Math.hypot(nx, ny, nz) || 1, r = e + reach, c = 0.7;
      nx /= l; nz /= l;
      // A face belongs to the room's ground only where it stands against one of the room's walls and looks
      // away from that wall into the room: the jambs of the front doors also look toward the middle, but
      // they stand across the front wall's depth, sunlit from the terrace, and stay lime as the doorway is.
      const against = y > b.y0 - e && y < b.y1 + e && x > b.x0 - r && x < b.x1 + r && z > b.z0 - r && z < b.z1 + r && (
        (nx > c && Math.abs(x - b.x0) < r) || (nx < -c && Math.abs(x - b.x1) < r) ||
        (nz > c && Math.abs(z - b.z0) < r) || (nz < -c && Math.abs(z - b.z1) < r));
      keep[against && nx * (cx - x) + nz * (cz - z) > 1e-6 ? 0 : 1].push(t);
    }
    keep.forEach((ts, s) => {
      if (!ts.length) return;
      if (ts.length === n) { (s ? outs : ins).push(g); return; }
      const h = new THREE.BufferGeometry();
      for (const [name, a] of Object.entries(g.attributes)) {
        const w = a.itemSize, arr = new /** @type {any} */ (a.array.constructor)(ts.length * 3 * w);
        ts.forEach((t, j) => arr.set(a.array.subarray(3 * t * w, 3 * t * w + 3 * w), j * 3 * w));
        h.setAttribute(name, new THREE.BufferAttribute(arr, w, a.normalized));
      }
      (s ? outs : ins).push(h);
    });
  }
  return [ins, outs];
}
