// The far land from a heightmap (#183, a spike behind ?terrain=dem|made on the workbench only; the page's default is still the hill rings).
// One mesh laid out in rings round the hill rings' centre, close together near the temple and wider apart as the land
// goes away, out to 4.4 km. Near the walls it is the plan's own land and sinks under the drawn earth; over the next
// 220 m it bends into the heightmap; its last kilometre rises into a far range (made up, for both maps) so that no
// line of sight below the horizon reaches the sky (#114).
//
// The eye sees 800 m and the sky's dome stands at 600 m, so the land beyond 350 m is drawn pulled in along each line
// of sight to within 575 m: the same picture, ordered as it should be, with the mist reckoned from where it really is.
import * as THREE from "three";
import { NOISE, U } from "./glsl.js";
import { SUN_DIR } from "./sky.js";
import { onBench } from "./debuggate.js";

/** Which heightmap the address asks for (#183's spike): on the workbench only, as ?seals and ?at are; the canary and the
 *  public page never read it and always draw the hill rings. @param {{ dev: boolean, hostname: string, search: string }} o
 *  @returns {"dem" | "made" | null} */
export function terrainAsked({ dev, hostname, search }) {
  if (!onBench({ dev, hostname })) return null;
  const t = new URLSearchParams(search).get("terrain");
  return t === "dem" || t === "made" ? t : null;
}

/** @typedef {{ n: number, extent: number, centre: [number, number], unit: number, h: Int16Array }} Heightmap */

/** @param {any} meta @param {ArrayBuffer} buf @returns {Heightmap} */
export const parseHeightmap = (meta, buf) => ({ ...meta, h: new Int16Array(buf) });

/** @param {(path: string) => string} asset @param {string} name */
export async function loadHeightmap(asset, name) {
  const [meta, buf] = await Promise.all([fetch(asset(`shared/terrain/${name}.json`)).then((r) => r.json()), fetch(asset(`shared/terrain/${name}.bin`)).then((r) => r.arrayBuffer())]);
  return parseHeightmap(meta, buf);
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
export const FAR = { R: 4400, rings: 120, segs: 480, blend: 220, rim: 900, lift: 1, earth: { x0: -140, x1: 140, z0: -230, z1: 130 } };

/** The height of the far land at (x, z). @param {Heightmap} map @param {(x: number, z: number) => number} land */
export function farHeight(map, land) {
  const { n, extent, centre, unit, h } = map, E = FAR.earth;
  const dem = (x, z) => {
    const c = ((x - centre[0]) / extent + 0.5) * n - 0.5, r = ((z - centre[1]) / extent + 0.5) * n - 0.5;
    const c0 = Math.max(0, Math.min(n - 2, Math.floor(c))), r0 = Math.max(0, Math.min(n - 2, Math.floor(r))), fc = Math.min(1, Math.max(0, c - c0)), fr = Math.min(1, Math.max(0, r - r0)), k = r0 * n + c0;
    return unit * (h[k] * (1 - fr) * (1 - fc) + h[k + 1] * (1 - fr) * fc + h[k + n] * fr * (1 - fc) + h[k + n + 1] * fr * fc);
  };
  return (x, z) => {
    const cx = Math.min(E.x1, Math.max(E.x0, x)), cz = Math.min(E.z1, Math.max(E.z0, z));
    const out = Math.hypot(x - cx, z - cz), inside = Math.min(x - E.x0, E.x1 - x, z - E.z0, E.z1 - z);   // metres outside, or inside, the drawn earth
    if (out === 0) return land(x, z) - 3 * smooth(0, 12, inside);                                      // under the earth, out of sight
    let v = land(cx, cz) + (dem(x, z) - land(cx, cz)) * smooth(0, FAR.blend, out);
    const r = Math.hypot(x - map.centre[0], z - map.centre[1]), a = Math.atan2(x - map.centre[0], z - map.centre[1]);
    const rim = 150 + 70 * Math.sin(a * 3 + 1.3) + 40 * Math.sin(a * 7 + 0.4) + 25 * Math.sin(a * 13 + 2.1);
    v = Math.max(v, v + (rim - v) * smooth(FAR.R - FAR.rim, FAR.R - 120, r) * FAR.lift);
    return v;
  };
}

/** @param {THREE.Scene} scene @param {Heightmap} map @param {(x: number, z: number) => number} land */
export function createFarTerrain(scene, map, land) {
  const H = farHeight(map, land), [cx, cz] = map.centre, { rings, segs, R } = FAR;
  // ring radii: 6 m apart at the centre, growing geometrically to the rim
  const radii = [0]; { const q = 1.052; let step = 6 * (q - 1) / (Math.pow(q, rings) - 1) * (R / 6); for (let k = 1; k <= rings; k++) radii.push(radii[k - 1] + step * Math.pow(q, k - 1)); }
  const pos = new Float32Array((rings * segs + 1) * 3); let p = 0;
  pos[p++] = cx; pos[p++] = H(cx, cz); pos[p++] = cz;
  for (let k = 1; k <= rings; k++) for (let s = 0; s < segs; s++) { const a = (s / segs) * Math.PI * 2, x = cx + Math.sin(a) * radii[k], z = cz + Math.cos(a) * radii[k]; pos[p++] = x; pos[p++] = H(x, z); pos[p++] = z; }
  const idx = [];
  for (let s = 0; s < segs; s++) idx.push(0, 1 + s, 1 + ((s + 1) % segs));
  for (let k = 1; k < rings; k++) for (let s = 0; s < segs; s++) {
    const a = 1 + (k - 1) * segs + s, b = 1 + (k - 1) * segs + ((s + 1) % segs), c = a + segs, d = b + segs;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  // (the winding above faces down; turn the normals up)
  const nrm = g.attributes.normal; for (let i = 0; i < nrm.count; i++) if (nrm.getY(i) < 0) nrm.setXYZ(i, -nrm.getX(i), -nrm.getY(i), -nrm.getZ(i));
  const mat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 4,
    uniforms: { uTop: { value: new THREE.Color(0.1, 0.16, 0.13) }, uMist: { value: new THREE.Color(0.6, 0.65, 0.63) }, uHaze: { value: 1 }, uFogD: U.uFogD, uSun: { value: SUN_DIR }, uLight: U.uLight },
    vertexShader: /* glsl */`
      varying vec3 vW, vN; varying float vD;
      void main(){
        vec4 w=modelMatrix*vec4(position,1.); vW=w.xyz; vN=normal;
        vec3 v=w.xyz-cameraPosition; float d=length(v); vD=d;
        float dc=d<350.?d:350.+225.*(1.-exp(-(d-350.)/1400.));            // pulled in along the line of sight, in order
        w.xyz=cameraPosition+v*(dc/max(d,1e-3));
        gl_Position=projectionMatrix*viewMatrix*w;
      }`,
    fragmentShader: NOISE + /* glsl */`
      varying vec3 vW, vN; varying float vD; uniform vec3 uTop, uMist, uSun, uLight; uniform float uHaze, uFogD;
      void main(){
        vec3 n=normalize(vN);
        // the wood on the slopes: crowns in clumps, darker in the gullies, a little light on the faces toward the sky and the sun
        float wood=fbm3(vW*.045)*.6+fbm3(vW*.17+3.)*.4;
        float lit=.62+.3*n.y+.22*max(dot(n,uSun),0.);
        vec3 c=uTop*(.62+.7*wood)*lit;
        // mist: by how far it really is, and lying in the valleys well below the temple
        float k=clamp((.16*log2(max(vD,150.)/150.)+.02)*uHaze,0.,.94);   // each doubling of the distance a sixth more mist: the ridges stand in layers
        float valley=smoothstep(-50.,-220.,vW.y+(fbm3(vW*.004)-.5)*90.)*smoothstep(250.,900.,vD);
        float scene=(1.-exp(-pow(abs(uFogD*vD),2.)))*(1.-smoothstep(160.,420.,vD));
        c=mix(c,uMist,clamp(max(max(k,scene),valley*.8),0.,1.));
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const m = new THREE.Mesh(g, mat); m.name = "far terrain"; m.userData.walk = false; m.userData.keep = true; scene.add(m);
  return {
    mesh: m, height: H, tris: idx.length / 3,
    setMood(md) { const L = U.uLight.value; mat.uniforms.uTop.value.setRGB(md.hills[0] * L.r, md.hills[1] * L.g, md.hills[2] * L.b); mat.uniforms.uMist.value.setRGB(md.fog[0], md.fog[1], md.fog[2]); mat.uniforms.uHaze.value = md.haze ?? 1; },
  };
}
