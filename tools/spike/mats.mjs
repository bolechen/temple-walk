// Materials that are only names, as the unit tests make them: enough for the meshes to say what they are made of.
import * as THREE from "three";
export function namedMaterials() {
  const named = (k) => Object.assign(new THREE.MeshBasicMaterial(), { name: String(k) });
  return new Proxy({}, { get: (t, k) => (k === "plaster" || k === "interior" ? () => (t["__" + k] ||= named(k)) : (t[k] ||= named(k))) });
}
