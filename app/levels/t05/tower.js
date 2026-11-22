// The old town's brick pagoda, seen far off to the west-south-west from the platform (T05, docs/t05/PLAN.md item 11, issue #548, step two).
// The owner asked for it on 2026-11-22 (「加远处的广胜寺塔」): the 广胜寺塔 of Yixian, an octagonal solid brick tower of thirteen close eaves
// that stands in the old town where 奉明寺's real model, 奉国寺, stands too (docs/t05/SOURCES.md §16 has every number and how far it was checked).
//
// It is a part of its own: this file and one line in site.js. `?off=tower` leaves it out, and nothing else in the level reads it, moves with it or
// stands on it (tests/unit/t05-tower.test.mjs builds the level both ways and compares everything else). It is a distant silhouette: eight-sided
// lathe of about two thousand triangles, never walked on or into (`userData.walk = false`, so the baked floor is the same with or without it).
//
// Where it stands, and what is done to draw it at all. The real tower is 952 m from the platform (SOURCES.md §16), beyond the camera's far plane
// (800 m), and at that distance the scene's mist (a density of about 0.009 a metre) takes everything. So it is drawn as the same tower brought in along the
// same line from the platform and made smaller by the same ratio (`BRING`): from the platform it has exactly the real angular size and bearing, and from
// anywhere in the court or on the way within a few per cent of it. It is not enlarged and not moved nearer in the picture. The mist is replaced by one of its own,
// the scene's mist colour laid over the brick by a share that is `HAZE.foot` at the foot and `HAZE.top` at the top, so that it stands out of the haze
// and does not float on it; the share is a judgement of the art director's to make (DECISIONS.md).
import * as THREE from "three";

/** The tower as the sources and the owner's brief give it. Metres. */
export const TOWER = Object.freeze({
  name: "广胜寺塔",
  at: Object.freeze({ x: -838, z: 460 }),   // from the encyclopaedia's 41.53889°N 121.23266°E and SITE.md §1's origin (SOURCES.md §16)
  from: Object.freeze({ x: 0, z: 8 }),      // the platform, where the line of sight to it is kept clear (surround.js LIMITS.tower)
  height: 42.5,                             // 塔高 42.5 m (a travel blog; the encyclopaedia says 41 m before the repair): SOURCES.md §16
  baseSide: 6.2,                            // 塔座边长 6.2 m (the encyclopaedia)
  storeys: 13,
  far: 800,                                 // the camera's far plane (app/yard.js)
});
/** How the tower is brought in so that the far plane holds it: along the line from the platform, by this share of the distance, and made smaller by the same. */
export const BRING = 0.735;
/** The eye the scaling is about: the platform's, 4.6 m over the plain's level (checks.js `horizon.places` for C and F), so that from there the foot and the top are seen at the real angles; the drawn foot is then 1.2 m above the plain, 700 m off and inside the haze. */
export const EYE = 4.6;
/** The mist laid over the brick: the share of the scene's mist colour at the foot and at the top (1 is the mist itself, 0 is the brick). */
export const HAZE = Object.freeze({ foot: 0.85, top: 0.42 });
/** The brick's colour in the working space: a grey brick (SOURCES.md §16: 砖; the colour is ours). */
export const BRICK = 0x4a4c4a;

/** Where the drawn tower stands: the real one's place brought in along the line from the platform. */
export function placed() {
  const { at, from } = TOWER;
  return { x: from.x + (at.x - from.x) * BRING, y: EYE * (1 - BRING), z: from.z + (at.z - from.z) * BRING, scale: BRING };
}
/** The real distance from the platform to the real tower, and the bearing of the line from north (north is -z), clockwise. */
export function truth() {
  const dx = TOWER.at.x - TOWER.from.x, dz = TOWER.at.z - TOWER.from.z;
  let bearing = (Math.atan2(dx, -dz) * 180) / Math.PI; if (bearing < 0) bearing += 360;
  return { distance: Math.hypot(dx, dz), bearing };
}

/**
 * The tower's section, as (radius to the corners, height) pairs from the ground up: a base with a waist, a tall first storey, twelve eaves
 * that shorten and draw in, and the spire. The brick eaves' shape is ours: the sources give a count, a base and a height, not a section (SOURCES.md §16).
 */
export function profile() {
  const R = TOWER.baseSide / (2 * Math.sin(Math.PI / 8));   // corner radius of an octagon of that side
  const pts = [[0, 0], [R, 0], [R, 1], [R * 0.9, 1.1], [R * 0.9, 3.1], [R, 3.2], [R, 4.4], [R * 0.74, 4.4]];
  let y = 4.4;
  const first = 9; pts.push([R * 0.69, y], [R * 0.69, y + first]); y += first;   // the first storey, tall, with its brick brackets under the first eave
  const bands = TOWER.storeys - 1;
  for (let i = 0; i < bands; i++) {
    const r = 6.7 - 0.3 * i, h = 2.3 - 0.075 * i;
    pts.push([r, y], [r, y + 0.32], [r - 0.75, y + 0.46]);   // an eave: its lip and the slope back to the wall
    y += h; pts.push([r - 0.9, y]);                          // the wall above it, a little in
  }
  const r = 6.7 - 0.3 * bands;
  pts.push([r, y], [r, y + 0.32], [r - 0.8, y + 0.5]); y += 0.5;   // the top eave
  // The spire: a lotus seat, a rod with rings, a jewel at the tip, reaching the height asked.
  pts.push([2.4, y], [2.4, y + 0.5], [1.5, y + 0.85]); y += 0.85;
  const rings = 7, rest = TOWER.height - y - 1.1, step = rest / rings;
  for (let i = 0; i < rings; i++) { const rr = 1.15 - 0.1 * i; pts.push([rr, y], [rr, y + step * 0.55], [0.4, y + step * 0.6], [0.4, y + step]); y += step; }
  pts.push([0.6, y], [0.55, y + 0.7], [0.001, y + 1.1]);
  return pts;
}

/** The brick: unlit, with the scene's mist laid over it by height (see the head of this file). */
function material() {
  const m = new THREE.MeshBasicMaterial({ color: BRICK, fog: true });
  m.name = "tower-brick";
  const top = TOWER.height;
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace("#include <common>", "#include <common>\nvarying float vTowerY;").replace("#include <begin_vertex>", "#include <begin_vertex>\nvTowerY = position.y;");
    sh.fragmentShader = sh.fragmentShader.replace("#include <common>", "#include <common>\nvarying float vTowerY;")
      .replace("#include <fog_fragment>", `
        #ifdef USE_FOG
        { float u = smoothstep(0., 1., clamp(vTowerY / ${top.toFixed(1)}, 0., 1.)); gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, mix(${HAZE.foot.toFixed(3)}, ${HAZE.top.toFixed(3)}, u)); }
        #endif`);
  };
  m.customProgramCacheKey = () => "tower-brick";
  return m;
}

/** The tower as a group for the site's root: one mesh, named `tower`, `userData.tower` set, not walked, not held, casting nothing. */
export function buildTower() {
  const geo = new THREE.LatheGeometry(profile().map(([x, y]) => new THREE.Vector2(x, y)), 8);
  geo.rotateY(Math.PI / 8);   // a flat, not a corner, to the south-west
  const mesh = new THREE.Mesh(geo, material());
  const at = placed(); mesh.position.set(at.x, at.y, at.z); mesh.scale.setScalar(at.scale);
  // After everything else that is opaque: the sky's dome (600 m round, drawn without writing depth) lies nearer than the tower from most places, and an opaque thing
  // is drawn in the order of its material, so without this the dome, made later, is drawn over the tower and takes it out of the picture (found on a T4 on 2026-11-22).
  mesh.renderOrder = 1;
  mesh.name = "tower"; mesh.castShadow = false; mesh.receiveShadow = false;
  mesh.userData.tower = true; mesh.userData.walk = false; mesh.userData.keep = true;
  const group = new THREE.Group(); group.name = "tower-group"; group.userData.tower = true; group.add(mesh);
  return group;
}
