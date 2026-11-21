// The novice's worn body. The skeleton and everything that moves it are monk.js's; this fetches a body made from a model
// and hands monk.js its four skinned parts to wear in place of the ones it builds in code. Until it arrives, and if it
// never does, he is the figure built in code.
//
// Two bodies are kept (#163). The one he wears by default is the layered body made from Tripo's model of the owner's
// four views (tools/novice-tripo.mjs → app/shared/models/novice-tripo.glb): a robe over trousers over legs, weighted to
// this skeleton and to two helper bones under the arms. The older one, made with Meshy from the drawing
// (tools/novice.mjs → app/shared/models/novice.glb), has no legs under its robe and tears sitting; it is kept for
// ?body=sculpt. ?body=code keeps the figure built in code.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { asset } from "./assets.js";

export const PARTS = ["skin", "robe", "legs", "shoes"];

/** Which body an address asks for: "tripo" (the default), "sculpt" (Meshy's) or "code" (none fetched). */
export function bodyChoice(q) { const b = q?.get?.("body"); return b === "code" || b === "sculpt" ? b : "tripo"; }
/** The file each fetched body is read from. */
export const BODY_FILE = { tripo: "shared/models/novice-tripo.glb", sculpt: "shared/models/novice.glb" };

/**
 * The four geometries, the material and the robe's colour out of a loaded glTF scene (meshes named for their parts) and
 * the extras the tool wrote. Throws if the file's joints are not numbered the way `monk`'s skeleton is, followed by the
 * helper bones the file asks for.
 * @param {import("three").Object3D} scene
 * @param {{ bones?: string[], robeColor?: number, helpers?: { name: string }[] }} extras
 * @param {{ skeleton: { bones: { name: string }[] }, helpers?: string[] }} monk
 */
export function bodyOf(scene, extras, monk) {
  const had = monk.helpers || [], own = monk.skeleton.bones.map((b) => b.name).filter((n) => !had.includes(n));
  const names = [...own, ...(extras?.helpers || []).map((h) => h.name)];
  if (!extras?.bones || extras.bones.length !== names.length || extras.bones.some((n, i) => n !== names[i])) throw new Error("the sculpted body's joints are not this skeleton's");
  const geometries = {}; let material = null;
  scene.traverse((o) => { const m = /** @type {import("three").Mesh} */ (o); if (m.isMesh && PARTS.includes(m.name)) { geometries[m.name] = m.geometry; material ||= /** @type {import("three").Material} */ (m.material); } });
  for (const n of PARTS) if (!geometries[n]) throw new Error(`the sculpted body has no ${n}`);
  return { geometries, material, robeColor: extras.robeColor, helpers: extras.helpers || [] };
}

// The skin's own material. The figure built in code gives its skin a little warm light of its own (monk.js's skinM, a stand-in
// for light coming through skin), without which a face goes nearly black on a winter night; the body's one material has none.
// Its skin is drawn with a copy that glows by its own texture (dark irises stay dark), `SKIN_GLOW` of it: by day a few per
// cent, at night enough to keep the face at 0.7 of the built figure's or more (#163, the 3D review; tools/portrait.js winter-night).
export const SKIN_GLOW = 0.03;
/** @param {any} material */
export function skinMaterial(material) {
  const m = material.clone(); m.emissive.setRGB(1, 0.86, 0.76); m.emissiveMap = material.map; m.emissiveIntensity = SKIN_GLOW;
  return m;
}

/** Dress `monk` in a body. Resolves with `monk`; rejects (and leaves him as he was) if the file is missing or does not fit. */
export async function loadNovice(monk, url = asset(BODY_FILE.tripo)) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const { geometries, material, robeColor, helpers } = bodyOf(gltf.scene, gltf.parser.json.extras, monk);
  /** @type {any} */ (material).envMapIntensity = 0.45;
  monk.dress(geometries, material, robeColor, { helpers, skinMaterial: skinMaterial(material) });
  return monk;
}
