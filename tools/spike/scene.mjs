// The place as it is drawn, built in Node for the collision spike (#161): the plan's buildings (buildSite), the censer
// (props.js, as far as it builds without a canvas), the trees (trees.js), the rooms under the courts (interior.js) and
// a flat sheet of paving for each court where ground.js would lay its stone. Every mesh keeps its material's name, so
// that the walker built from them can say what a shoe comes down on and what stopped him.
import "../../tests/unit/dom-stub.mjs";
import * as THREE from "three";
import { namedMaterials } from "./mats.mjs";

const { buildSite, LEVELS, SITE } = await import("../../app/src/site.js");
const { buildInteriors } = await import("../../app/src/interior.js");
const { createTrees } = await import("../../app/src/trees.js");
const { createProps } = await import("../../app/src/props.js");

export { namedMaterials };

/** Build everything the walk would draw that stands on the ground. @returns {{ site: any, scene: THREE.Scene, rooms: any, ms: Record<string, number> }} */
export function buildDrawn() {
  const ms = {}, t = (k, f) => { const a = performance.now(), r = f(); ms[k] = Math.round(performance.now() - a); return r; };
  const M = namedMaterials();
  const site = t("site", () => buildSite(M));
  const scene = new THREE.Scene(); scene.add(site.root);
  t("props", () => { try { createProps(scene, M, site.censer, (SITE.zN + SITE.zS) / 2); } catch { /* the censer is in; the mist and shafts need a canvas */ } });
  t("trees", () => createTrees(scene, M, site.trees, { a2c: false }));
  const rooms = t("interiors", () => buildInteriors(M, site.halls)); scene.add(rooms.group);
  // The courts' paving, as ground.js lays it: level within each terrace's walls (the first court from the screen wall's
  // line down to the next terrace's foot).
  const pave = Object.assign(new THREE.MeshBasicMaterial(), { name: "paving" });
  const courts = [{ x: SITE.x + 1, zS: SITE.zS + 2, zN: LEVELS[0].zS, y: 0 }, ...LEVELS.map((L) => ({ x: L.x + 1, zS: L.zS, zN: L.zN, y: L.y }))];
  for (const c of courts) { const g = new THREE.PlaneGeometry(c.x * 2, c.zS - c.zN).rotateX(-Math.PI / 2).translate(0, c.y, (c.zS + c.zN) / 2); const m = new THREE.Mesh(g, pave); m.userData.ground = true; scene.add(m); }
  scene.updateMatrixWorld(true);
  return { site, scene, rooms, ms };
}
