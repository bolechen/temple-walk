// The seven Buddhas, painted, on the altar of the great hall (issue #701, second version). Read only when the hall's doors are open (./index.js; HALL_DOORS in ../hall.js).
//
// What it does: while the eye is within NEAR of the hall's door each figure's file is fetched, middle one first, one at a time (a meshopt decode and
// four KTX2 transcodes in workers; never two figures in a frame), stood on its plinth on the altar with the paint the statue session's stage judged
// (./paint.js, ./recipe.json, ./anchors/<id>.json and the masks), and the white-box seated mass it replaces hidden. A figure that fails to load keeps the white box.
//
// The figure's frame, in which its anchors are written, is the stage's: the file scaled to the height the stage gave it above its plinth. The game's heights
// are not the stage's (the middle one 9.28 m, the six 8.6), so the whole frame is scaled to the game's height by the pivot (`pivot.scale`): the paint reads
// the pivot's own inverse matrix, so a scaled pivot leaves every anchor where it was written.
//
// The renderer is not handed to a level; it is taken from the first frame drawn (a sheet that draws nothing, whose onBeforeRender receives it) so that the transcoder can
// ask the card what it takes and the reflection of the hall can be captured. The reflection (a light probe of the hall with the figures left out, what gold has to
// mirror in a dark room) is taken once, before the first figure arrives, and shared by all seven.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { asset } from "../../../src/assets.js";
import { HALL } from "../hall.js";
import { ALTAR, SEAT, FIGURES } from "../altar.js";
import { paintMaterial } from "./paint.js";
import recipe from "./recipe.json";
import { FIGURE_FILES, LOAD_ORDER, NEAR, PLINTH, DOOR, PIVOT_DZ, ENV_INTENSITY, HALO_COLOR } from "./registry.js";

const ANCHORS = import.meta.glob("./anchors/*.json", { eager: true, import: "default" });
const anchorsOf = (id) => /** @type {any} */ (ANCHORS[`./anchors/${id}.json`]).anchors;

/**
 * @param {{ root: THREE.Object3D, fg: { list: { id: string, f: any, parts: THREE.Mesh[] }[], group: THREE.Object3D }, M: any, sh: any, shadowNeeds?: () => void }} ctx
 *   root: the level's group; fg: `benchFigures`'s result (each figure's white-box body, attendants and halo as parts of their own); M: the level's materials
 */
export function createFigures({ root, fg, M, sh }) {
  const top = HALL.floor + ALTAR.h, state = { renderer: /** @type {THREE.WebGLRenderer | null} */ (null), scene: /** @type {THREE.Object3D | null} */ (null), probe: /** @type {THREE.Texture | null} */ (null), camera: /** @type {THREE.Camera | null} */ (null), started: false, loaded: 0 };
  const figs = new Map(FIGURE_FILES.map((d) => [d.id, { d, status: /** @type {"idle" | "loading" | "ready" | "failed"} */ ("idle"), ms: 0, bytes: 0, pivot: /** @type {THREE.Object3D | null} */ (null), paints: /** @type {Map<string, THREE.Material> | null} */ (null) }]));
  const entry = (id) => fg.list.find((e) => e.id === id);

  // The renderer, from the first frame: a sheet one triangle large that draws nothing (the same kind as the shut windows' veil in ../site.js).
  const tap = new THREE.Mesh(new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3)), new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false }));
  tap.frustumCulled = false; tap.userData.keep = true; tap.userData.bake = false; tap.userData.eye = false; tap.userData.walk = false; tap.name = "figures-tap";
  tap.onBeforeRender = (r, s, c) => { state.renderer ||= r; state.scene ||= s; state.camera ||= c; };
  root.add(tap);

  /** @type {Promise<{ loader: GLTFLoader, masks: Map<string, THREE.Texture> }> | null} */
  let tools = null;
  const getTools = () => (tools ||= (async () => {
    const r = /** @type {THREE.WebGLRenderer} */ (state.renderer);
    const ktx2 = new KTX2Loader().setTranscoderPath(asset("vendor/basis/")).detectSupport(r);
    return { loader: new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx2), masks: new Map() };
  })());
  const mask = async (t, file) => {
    if (!file) return undefined;
    if (!t.masks.has(file)) t.masks.set(file, new THREE.TextureLoader().loadAsync(asset(`shared/models/t05/masks/${file}`)).then((x) => { x.colorSpace = THREE.NoColorSpace; x.generateMipmaps = false; x.minFilter = x.magFilter = THREE.LinearFilter; return x; }));
    return t.masks.get(file);
  };

  // The hall's own light probe, figures left out (the stage's: from before the altar, a little above the people's heads).
  const captureProbe = () => {
    const r = /** @type {THREE.WebGLRenderer} */ (state.renderer), pm = new THREE.PMREMGenerator(r);
    const hidden = [fg.group, ...fg.list.flatMap((e) => e.parts), tap].filter((o) => o.visible); for (const o of hidden) o.visible = false;
    const rt = pm.fromScene(/** @type {THREE.Scene} */ (state.scene), 0.02, 0.1, 300, { size: 256, position: new THREE.Vector3(0, top + 4.5, SEAT.z + 7) });
    for (const o of hidden) o.visible = true; pm.dispose(); return rt.texture;
  };

  const plinths = new Map();
  const load = async (id) => {
    const rec = /** @type {NonNullable<ReturnType<typeof figs.get>>} */ (figs.get(id)), d = rec.d, e = entry(id);
    if (!e) { rec.status = "failed"; return; }
    rec.status = "loading"; const t0 = performance.now();
    try {
      const t = await getTools(), url = asset(`shared/models/t05/${d.file}`);
      const anchors = anchorsOf(id);
      const [gltf, front, hair] = await Promise.all([t.loader.loadAsync(url), mask(t, anchors.maskFront?.file), mask(t, anchors.maskHair?.file)]);
      state.probe ||= captureProbe();
      const obj = gltf.scene; obj.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3());
      const k = (d.stageH - PLINTH.h) / size.y; obj.scale.setScalar(k); obj.updateMatrixWorld(true);
      const bb2 = new THREE.Box3().setFromObject(obj), c = bb2.getCenter(new THREE.Vector3());
      obj.position.sub(new THREE.Vector3(c.x, bb2.min.y, c.z));
      // the game's height for this figure, the whole from the altar's top, plinth and all, against the stage's
      const f = e.f, s = (f.h - PLINTH.h) / (d.stageH - PLINTH.h);
      const pivot = new THREE.Group(); pivot.add(obj);
      pivot.position.set(f.x, top + PLINTH.h, SEAT.z + PIVOT_DZ); pivot.rotation.y = f.yaw ?? 0; pivot.scale.setScalar(s); pivot.name = `figure-${id}`;
      const paints = new Map(); rec.paints = paints;
      obj.traverse((o) => {
        const m = /** @type {THREE.Mesh} */ (o); if (!m.isMesh) return;
        const nmap = /** @type {any} */ (m.material).normalMap ?? null, key = nmap ? nmap.uuid : "none";
        if (!paints.has(key)) {
          const p = paintMaterial(recipe, anchors, pivot, { masks: { front, hair }, fig: FIGURE_FILES.indexOf(d), normalMap: nmap, envMap: state.probe, envIntensity: ENV_INTENSITY });
          p.userData.paint.U.uInner.value.set(...(d.inner ?? [1, 1, 1])); p.userData.paint.U.uLotus.value = d.lotus ?? 1;
          paints.set(key, p);
        }
        m.material = paints.get(key); m.castShadow = m.receiveShadow = true;
        // the eye's hierarchy, the baked floor and the static merge leave the figures alone: a figure is far above the floor and out of reach, and is one mesh of its own
        m.userData.keep = true; m.userData.eye = false; m.userData.walk = false; m.userData.bake = false; m.frustumCulled = true;
      });
      root.add(pivot); pivot.updateMatrixWorld(true); for (const p of paints.values()) p.userData.update();
      // its plinth, and the white box's seated mass out of the way (the attendants and the halo stay, the halo in the painted colour)
      const pl = new THREE.Mesh(new THREE.BoxGeometry(PLINTH.w, PLINTH.h, PLINTH.d), M.stone); pl.position.set(f.x, top + PLINTH.h / 2, SEAT.z + PIVOT_DZ); pl.castShadow = pl.receiveShadow = true; pl.userData.keep = true; pl.userData.bake = false; pl.name = `plinth-${id}`;
      root.add(pl); plinths.set(id, pl);
      const [body, , halo] = e.parts; body.visible = false;
      const hm = new THREE.MeshStandardMaterial({ color: HALO_COLOR, roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide }); if (d.halo) hm.color.multiplyScalar(d.halo);
      halo.material = hm;
      rec.pivot = pivot; rec.status = "ready"; rec.ms = performance.now() - t0; state.loaded++;
      /** @type {any} */ (state.renderer).shadowMap.needsUpdate = true;
    } catch (err) {
      rec.status = "failed"; console.warn(`figure ${id}:`, err);   // the white box stays
    }
  };

  // Each frame from the level's tick: when the eye is within NEAR of the door, ask for the next figure, one at a time.
  const queue = [...LOAD_ORDER]; let busy = false;
  const tick = (/** @type {number} */ _dt, /** @type {THREE.Vector3} */ eye) => {
    if (busy || !queue.length || !state.renderer) return;
    if (Math.hypot(eye.x - DOOR.x, eye.z - DOOR.z) > NEAR) return;
    busy = true; state.started = true;
    load(/** @type {string} */ (queue.shift())).finally(() => { busy = false; });
  };
  const report = () => ({ near: NEAR, started: state.started, loaded: state.loaded, probe: !!state.probe, figures: [...figs.values()].map((r) => ({ id: r.d.id, status: r.status, ms: Math.round(r.ms) })), scale: FIGURES.map((f) => { const d = /** @type {any} */ (figs.get(f.id)).d; return { id: f.id, stageH: d.stageH, gameH: f.h, s: +((f.h - PLINTH.h) / (d.stageH - PLINTH.h)).toFixed(4) }; }) });
  // For the workbench's measuring tools (site.js hangs it on `__t05FiguresDebug`): the renderer, the scene and each loaded figure's pivot and paint materials.
  const debug = () => ({ renderer: state.renderer, scene: state.scene, camera: state.camera, figures: Object.fromEntries([...figs].filter(([, r]) => r.pivot).map(([id, r]) => [id, { pivot: r.pivot, paints: [...(r.paints?.values() ?? [])], anchors: anchorsOf(id) }])) });
  return { tick, report, debug };
}
