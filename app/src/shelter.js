// What the roofs keep dry. Snow falls almost straight down, so under a roof's eaves the floor of a gate's passage, a
// bell tower's platform or a porch stays bare stone, and only a strip just inside the eave line takes what the wind
// blows in. Every building's eave footprint and the height of the foot of its beams (site.walk.roofs) are baked once,
// when the place is built, into a small map seen from above; the stone's snow (materials.js) and his steps (steps.js)
// read the same map. A point is kept dry by a roof when it lies inside the footprint and below the beams. Where two
// roofs overlap (a gate's two storeys, a tower's), the lowest and the highest are both kept, so the floor is dry under
// the lower roof and the lower roof's own tiles are dry where the upper one hangs over them.
import * as THREE from "three";
import { U } from "./glsl.js";

export const PER_M = 4;                 // points of the map to a metre
// How far in from the edge of a footprint the blown snow reaches. A footprint runs 0.3 m past the tiles, so the strip
// of snow is about half a metre under the eave and fades out by 1.1 m.
export const BLOWN = [0.4, 1.4];
const NONE = -1000;

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The map: for each point, [bottom, depth inside] of the lowest roof over it and of the highest.
export function bakeShelter(roofs) {
  if (!roofs.length) return null;
  const x0 = Math.floor(Math.min(...roofs.map((r) => r.x0))) - 1, z0 = Math.floor(Math.min(...roofs.map((r) => r.z0))) - 1;
  const W = Math.ceil((Math.max(...roofs.map((r) => r.x1)) + 1 - x0) * PER_M), H = Math.ceil((Math.max(...roofs.map((r) => r.z1)) + 1 - z0) * PER_M);
  const data = new Float32Array(W * H * 4);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = x0 + (i + 0.5) / PER_M, z = z0 + (j + 0.5) / PER_M, o = (j * W + i) * 4;
    let lo = NONE, loD = 0, hi = NONE, hiD = 0;
    for (const r of roofs) {
      const d = Math.min(x - r.x0, r.x1 - x, z - r.z0, r.z1 - z);
      if (d <= 0) continue;
      if (lo === NONE || r.bottom < lo) { lo = r.bottom; loD = d; }
      if (hi === NONE || r.bottom > hi) { hi = r.bottom; hiD = d; }
    }
    data[o] = lo; data[o + 1] = Math.min(loD, 4); data[o + 2] = hi; data[o + 3] = Math.min(hiD, 4);
  }
  return { data, W, H, box: [x0, z0, 1 / (W / PER_M), 1 / (H / PER_M)] };
}

// How far a point is kept from the snow, 0 open sky to 1 dry, read from the map as the shader reads it (nearest point).
export function shelterAt(map, x, y, z) {
  if (!map) return 0;
  const u = (x - map.box[0]) * map.box[2], v = (z - map.box[1]) * map.box[3];
  if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0;
  const o = (Math.min(map.H - 1, Math.floor(v * map.H)) * map.W + Math.min(map.W - 1, Math.floor(u * map.W))) * 4, d = map.data;
  return Math.max(y < d[o] ? smooth(BLOWN[0], BLOWN[1], d[o + 1]) : 0, y < d[o + 2] ? smooth(BLOWN[0], BLOWN[1], d[o + 3]) : 0);
}

// Hands the map to every shader that lays snow.
export function useShelter(map) {
  if (!map) return;
  const half = new Uint16Array(map.data.length);
  for (let k = 0; k < half.length; k++) half[k] = THREE.DataUtils.toHalfFloat(map.data[k]);
  const tex = new THREE.DataTexture(half, map.W, map.H, THREE.RGBAFormat, THREE.HalfFloatType);
  tex.minFilter = tex.magFilter = THREE.LinearFilter; tex.needsUpdate = true;
  U.tShelter.value = tex; U.uShelter.value.fromArray(map.box);
}

// The same in GLSL. Before the map is made (or where there is none), nothing is sheltered.
export const SHELTER = /* glsl */`
uniform sampler2D tShelter; uniform vec4 uShelter;
float shelter(vec3 p){
  vec2 uv=(p.xz-uShelter.xy)*uShelter.zw; if(uShelter.z==0.||uv.x<=0.||uv.x>=1.||uv.y<=0.||uv.y>=1.) return 0.;
  vec4 s=texture2D(tShelter,uv);
  return max(step(p.y,s.x)*smoothstep(${BLOWN[0].toFixed(2)},${BLOWN[1].toFixed(2)},s.y),step(p.y,s.z)*smoothstep(${BLOWN[0].toFixed(2)},${BLOWN[1].toFixed(2)},s.w));
}
`;
