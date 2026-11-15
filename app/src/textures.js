// The scanned surfaces the temple is dressed in: stone, timber, lime wash, bark, fallen leaves, woven straw, snow.
// They come from Poly Haven's CC0 library, packed by tools/textures.py into app/shared/textures/ as a colour image and an image
// holding the surface normal (red, green) and the roughness (blue). Until one has arrived, its place is held by its
// own mean colour, so the temple is whole from the first frame and only grows finer.
import * as THREE from "three";
import { asset } from "./assets.js";
import { SURFACES } from "../shared/textures/index.js";

export { SURFACES };
// One pair of uniforms per surface, shared by every material that uses it.
export const TEX = {};
const state = { total: 0, loaded: 0, failed: [] };
const flat = (r, g, b, srgb) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1); if (srgb) t.colorSpace = THREE.SRGBColorSpace; t.needsUpdate = true; return t; };
const toSrgb = (v) => Math.round(255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
for (const [name, s] of Object.entries(SURFACES)) {
  TEX[name] = { a: { value: flat(...s.mean.map(toSrgb), true) }, n: { value: flat(128, 128, Math.round(s.rough * 255), false) } };
}

// Begin fetching them. `anisotropy` is what the renderer allows; `onChange` is called as each arrives.
/** @param {number} [anisotropy] @param {(state: any) => void} [onChange] */
export function loadTextures(anisotropy = 8, onChange = () => {}) {
  if (typeof document === "undefined" || state.total) return state;
  const loader = new THREE.TextureLoader(), base = asset("shared/textures/");
  for (const name of Object.keys(SURFACES)) for (const [slot, file, srgb] of /** @type {[string, string, boolean][]} */ ([["a", `${name}_a.webp`, true], ["n", `${name}_n.jpg`, false]])) {
    state.total++;
    loader.load(base + file, (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = anisotropy; if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.minFilter = THREE.LinearMipmapLinearFilter; t.needsUpdate = true;
      const old = TEX[name][slot].value; TEX[name][slot].value = t; old.dispose(); state.loaded++; onChange(state);
    }, undefined, () => { state.failed.push(file); onChange(state); });
  }
  return state;
}
export const textureState = () => ({ total: state.total, loaded: state.loaded, failed: [...state.failed] });

// Shader helpers. A surface is laid on the world from three sides and blended by which way the face looks, so
// nothing needs unwrapping and a stone is the same stone on both sides of a corner.
export const TRI = /* glsl */`
vec3 triW(vec3 n){ vec3 w=abs(n); w=w*w*w; w=w*w; return w/(w.x+w.y+w.z+1e-5); }
vec3 triA(sampler2D t, vec3 p, vec3 w){ return texture2D(t,p.zy).rgb*w.x+texture2D(t,p.xz).rgb*w.y+texture2D(t,p.xy).rgb*w.z; }
// xyz: how the scan tilts the surface, as a nudge to the world-space normal; w: its roughness
vec4 triN(sampler2D t, vec3 p, vec3 w){
  vec3 a=texture2D(t,p.zy).xyz, b=texture2D(t,p.xz).xyz, c=texture2D(t,p.xy).xyz;
  vec2 ta=(a.xy*2.-1.)*w.x, tb=(b.xy*2.-1.)*w.y, tc=(c.xy*2.-1.)*w.z;
  return vec4(tb.x+tc.x, ta.y+tc.y, ta.x+tb.y, a.z*w.x+b.z*w.y+c.z*w.z);
}`;
// Declarations for the surfaces a shader uses: "wood" gives tWoodA, tWoodN and the constant mWood (its mean colour).
const cap = (s) => s[0].toUpperCase() + s.slice(1);
export const declare = (names) => names.map((n) => `uniform sampler2D t${cap(n)}A, t${cap(n)}N; const vec3 m${cap(n)}=vec3(${SURFACES[n].mean.map((v) => v.toFixed(4)).join(",")});`).join("\n");
export const bind = (uniforms, names) => { for (const n of names) { uniforms[`t${cap(n)}A`] = TEX[n].a; uniforms[`t${cap(n)}N`] = TEX[n].n; } return uniforms; };
