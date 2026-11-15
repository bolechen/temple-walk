// The novice's sculpted body. The skeleton and everything that moves it are monk.js's; this fetches the model the owner
// made from the drawing (tools/novice.mjs builds app/shared/models/novice.glb from it) and hands monk.js its four skinned
// parts to wear in place of the ones it builds in code. Until it arrives, and if it never does, he is the figure built in code.
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { asset } from "./assets.js";

export const PARTS = ["skin", "robe", "legs", "shoes"];

/**
 * The four geometries, the material and the robe's colour out of a loaded glTF scene (meshes named for their parts) and
 * the extras the tool wrote. Throws if the file's joints are not numbered the way `monk`'s skeleton is.
 * @param {import("three").Object3D} scene
 * @param {{ bones?: string[], robeColor?: number }} extras
 * @param {{ skeleton: { bones: { name: string }[] } }} monk
 */
export function bodyOf(scene, extras, monk) {
  const names = monk.skeleton.bones.map((b) => b.name);
  if (!extras?.bones || extras.bones.length !== names.length || extras.bones.some((n, i) => n !== names[i])) throw new Error("the sculpted body's joints are not this skeleton's");
  const geometries = {}; let material = null;
  scene.traverse((o) => { if (o.isMesh && PARTS.includes(o.name)) { geometries[o.name] = o.geometry; material ||= o.material; } });
  for (const n of PARTS) if (!geometries[n]) throw new Error(`the sculpted body has no ${n}`);
  return { geometries, material, robeColor: extras.robeColor };
}

/** Dress `monk` in the sculpted body. Resolves with `monk`; rejects (and leaves him as he was) if the file is missing or does not fit. */
export async function loadNovice(monk, url = asset("shared/models/novice.glb")) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const { geometries, material, robeColor } = bodyOf(gltf.scene, gltf.parser.json.extras, monk);
  material.envMapIntensity = 0.45;
  monk.dress(geometries, material, robeColor);
  return monk;
}
